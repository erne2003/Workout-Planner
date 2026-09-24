/**
 * Phase 5: SyncManager end to end — the real engine and local SQLite against
 * the real backend on a disposable local Postgres database
 * (see backend/tests/helpers/testServer.js; set TEST_DATABASE_URL if needed).
 * Skipped when that database isn't reachable.
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createNodeSqliteAdapter } from "../db/testing/nodeSqliteAdapter.mjs";
import { registerDatabase } from "../db/database.js";
import { workouts, workoutSets, prs, outbox, syncState, MAX_PUSH_ATTEMPTS } from "../db/repositories.js";
import { SyncManager, SYNC_KEYS } from "./SyncManager.js";

const require = createRequire(import.meta.url);
const { startTestServer } = require("../../../../backend/tests/helpers/testServer.js");

let t = null;
let skipReason = null;

before(async () => {
  try {
    t = await startTestServer();
    await t.pool.query(`INSERT INTO exercises (name, muscle_group) VALUES ('Bench Press', 'Chest'), ('Squat', 'Quadriceps')`);
  } catch (e) {
    skipReason = `test database unavailable: ${e.message}`;
  }
});

after(async () => {
  await t?.close();
});

beforeEach(() => {
  registerDatabase(createNodeSqliteAdapter());
});

/** Timers the test fires by hand: no real waiting, and delays can be inspected. */
function fakeTimers() {
  let nextId = 0;
  const pending = new Map();
  return {
    setTimeout: (fn, ms) => {
      pending.set(++nextId, { fn, ms });
      return nextId;
    },
    clearTimeout: (id) => pending.delete(id),
    delays: () => [...pending.values()].map((p) => p.ms),
    fireAll: () => {
      const due = [...pending.values()];
      pending.clear();
      due.forEach((p) => p.fn());
    },
  };
}

/**
 * A SyncManager for userId whose "network" the test controls:
 *   net.online = false        → requests throw like fetch() offline
 *   net.losePushResponse = n  → the next n pushes reach the server, but the response is lost
 *   net.status = 401          → every request answers that status
 */
function device(userId, options = {}) {
  const net = { online: true, losePushResponse: 0, status: null, requests: [] };
  const timers = fakeTimers();
  const authFetch = async (url, init = {}) => {
    const { pathname, search } = new URL(url);
    net.requests.push(`${init.method || "GET"} ${pathname}${search}`);
    if (!net.online) throw new TypeError("Network request failed");
    if (net.status) return new Response(JSON.stringify({ error: "nope" }), { status: net.status });
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.headers || {}), Authorization: `Bearer ${t.tokenFor(userId)}` },
    });
    if (net.losePushResponse > 0 && url.includes("/sync/push")) {
      net.losePushResponse--;
      throw new TypeError("Network request failed");
    }
    return res;
  };
  const sync = new SyncManager({ fetch: authFetch, getApiUrl: () => t.baseUrl, timers, ...options });
  return { sync, net, timers };
}

const set = (over = {}) => ({ exercise_id: null, exercise_name: "Bench Press", muscle_group: "Chest", set_order: 1, reps: 8, weight: 185, rir: 1, ...over });

const serverWorkouts = async (userId) =>
  (await t.pool.query(
    `SELECT w.uuid, w.name, w.deleted_at, COUNT(ws.id) FILTER (WHERE ws.deleted_at IS NULL)::int AS sets
       FROM workouts w LEFT JOIN workout_sets ws ON ws.workout_id = w.id
      WHERE w.user_id = $1 GROUP BY w.id ORDER BY w.id`,
    [userId]
  )).rows;

test("10 workouts logged offline reach the server once after reconnecting", async (ctx) => {
  if (skipReason) return ctx.skip(skipReason);
  const userId = await t.createUser();
  const { sync, net, timers } = device(userId);
  await sync.start();

  net.online = false;
  for (let i = 0; i < 10; i++) {
    await workouts.create({ name: `Offline ${i}`, sets: [set(), set({ set_order: 2, reps: 6 })] });
  }
  const offline = await sync.requestSync();
  assert.equal(offline.error.kind, "network");
  assert.equal(offline.pending, 30);
  assert.deepEqual(timers.delays(), [2000], "a retry is scheduled");
  assert.equal((await serverWorkouts(userId)).length, 0);

  net.online = true;
  const status = await sync.requestSync(); // e.g. NetInfo reported online
  assert.equal(status.error, null);
  assert.equal(status.pending, 0);
  assert.ok(status.lastSyncedAt);
  assert.equal(await outbox.count(), 0);

  const onServer = await serverWorkouts(userId);
  assert.equal(onServer.length, 10, "no duplicates");
  assert.ok(onServer.every((w) => w.sets === 2));

  const local = await workouts.list();
  assert.equal(local.length, 10);
  assert.ok(local.every((w) => Number.isInteger(w.server_id)), "the pull brought back server ids");
  assert.deepEqual(new Set(local.map((w) => w.uuid)), new Set(onServer.map((w) => w.uuid)));
  await sync.stop();
});

test("a push whose response is lost is retried without duplicates", async (ctx) => {
  if (skipReason) return ctx.skip(skipReason);
  const userId = await t.createUser();
  const { sync, net } = device(userId);
  await sync.start();

  await workouts.create({ name: "Lost response", sets: [set()] });
  net.losePushResponse = 1;
  const first = await sync.requestSync();
  assert.equal(first.error.kind, "network");
  assert.equal(await outbox.count(), 2, "unacknowledged entries stay queued");
  assert.equal((await serverWorkouts(userId)).length, 1, "…although the server applied them");

  const second = await sync.requestSync();
  assert.equal(second.error, null);
  assert.equal(await outbox.count(), 0);
  const onServer = await serverWorkouts(userId);
  assert.equal(onServer.length, 1);
  assert.equal(onServer[0].sets, 1);
  assert.equal((await outbox.all()).length, 0);
  await sync.stop();
});

test("edits and deletes made on another device arrive on the next sync", async (ctx) => {
  if (skipReason) return ctx.skip(skipReason);
  const userId = await t.createUser();
  const { sync } = device(userId);
  await sync.start();

  // Another client (the REST API) creates, then edits, a workout
  const created = await t.api(userId, "POST", "/workouts", { name: "From the web" });
  const squat = (await t.pool.query(`SELECT id FROM exercises WHERE name = 'Squat'`)).rows[0].id;
  await t.api(userId, "POST", `/workouts/${created.body.id}/sets`, { exerciseId: squat, setOrder: 1, reps: 5, weight: 225 });
  await sync.requestSync(); // e.g. the app came to the foreground
  let [local] = await workouts.list();
  assert.equal(local.name, "From the web");
  assert.equal(local.sets[0].exercise_name, "Squat");
  assert.equal(local.sets[0].exercise_id, squat);

  await t.api(userId, "PUT", `/workouts/${created.body.id}`, { name: "Edited on the web" });
  await sync.requestSync();
  [local] = await workouts.list();
  assert.equal(local.name, "Edited on the web");

  await t.api(userId, "DELETE", `/workouts/${created.body.id}`);
  await sync.requestSync();
  assert.deepEqual(await workouts.list(), []);
  await sync.stop();
});

test("an unpushed local edit wins over the server's copy", async (ctx) => {
  if (skipReason) return ctx.skip(skipReason);
  const userId = await t.createUser();
  const { sync, net } = device(userId);
  await sync.start();

  const uuid = await workouts.create({ name: "Original" });
  await sync.requestSync();
  const serverId = (await workouts.list())[0].server_id;

  await t.api(userId, "PUT", `/workouts/${serverId}`, { name: "Server edit" });
  net.online = false;
  await workouts.update(uuid, { name: "Phone edit" });
  await sync.requestSync();
  assert.equal((await workouts.list())[0].name, "Phone edit");

  net.online = true;
  await sync.requestSync();
  assert.equal((await workouts.list())[0].name, "Phone edit");
  assert.equal((await serverWorkouts(userId))[0].name, "Phone edit", "pushed before pulling");
  await sync.stop();
});

test("a change the server keeps rejecting is parked; the rest still sync", async (ctx) => {
  if (skipReason) return ctx.skip(skipReason);
  const userId = await t.createUser();
  const { sync } = device(userId);
  await sync.start();

  // A set whose workout the server has never heard of
  await workoutSets.create("99999999-9999-4999-8999-999999999999", set());
  await prs.create({ exercise_name: "Squat", weight: 405 });

  let status = await sync.requestSync();
  assert.equal(status.pending, 1);
  assert.equal(status.parked, 0);
  assert.match((await outbox.all())[0].last_error, /parent/i);
  const prOnServer = await t.pool.query(`SELECT COUNT(*)::int AS n FROM prs WHERE user_id = $1`, [userId]);
  assert.equal(prOnServer.rows[0].n, 1, "the good change went through");

  for (let i = 1; i < MAX_PUSH_ATTEMPTS; i++) status = await sync.requestSync();
  assert.equal(status.pending, 0);
  assert.equal(status.parked, 1);
  assert.equal(status.error, null, "a parked change isn't a sync failure");

  const pushes = [];
  const { sync: again, net } = device(userId);
  await again.start();
  await again.requestSync();
  pushes.push(...net.requests.filter((r) => r.startsWith("POST")));
  assert.deepEqual(pushes, [], "parked entries are not pushed again");
  await again.stop();
  await sync.stop();
});

test("the first sync on a device pulls everything, page by page", async (ctx) => {
  if (skipReason) return ctx.skip(skipReason);
  const userId = await t.createUser();

  // Data created elsewhere
  const seed = device(userId);
  await seed.sync.start();
  for (let i = 0; i < 4; i++) await workouts.create({ name: `Seed ${i}`, sets: [set(), set({ set_order: 2 })] });
  await seed.sync.requestSync();
  await seed.sync.stop();

  // A fresh install
  registerDatabase(createNodeSqliteAdapter());
  const { sync, net } = device(userId, { pullLimit: 5 });
  const progress = [];
  sync.subscribe((s) => progress.push(s.pulledRows));
  await sync.start();
  assert.equal(sync.getStatus().initialSyncDone, false);

  const status = await sync.requestSync();
  assert.equal(status.initialSyncDone, true);
  assert.equal(await syncState.get(SYNC_KEYS.initialSyncDone), "1");
  const local = await workouts.list();
  assert.equal(local.length, 4);
  assert.ok(local.every((w) => w.sets.length === 2));
  assert.equal(net.requests.filter((r) => r.startsWith("GET")).length, 3, "12 rows in pages of 5");
  assert.ok(progress.includes(5) && progress.includes(10) && progress.includes(12), "progress reported per page");

  // Next launch: incremental from the stored cursor (re-reading only its 5 s overlap)
  const before = net.requests.length;
  await sync.requestSync();
  const next = net.requests.slice(before);
  assert.match(next[0], /^GET \/sync\/pull\?limit=5&since=/);
  assert.ok(next.every((r) => r.startsWith("GET")), "nothing to push");
  assert.equal((await workouts.list()).length, 4);
  assert.equal(await outbox.count(), 0);
  await sync.stop();
});

test("a cursor older than the tombstone retention triggers a full resync", async (ctx) => {
  if (skipReason) return ctx.skip(skipReason);
  const userId = await t.createUser();
  const { sync } = device(userId);
  await sync.start();

  const kept = await workouts.create({ name: "Still on the server" });
  const purged = await workouts.create({ name: "Deleted and purged while away" });
  await sync.requestSync();

  // The deletion's tombstone is long gone from the server
  await t.pool.query(`DELETE FROM workouts WHERE uuid = $1`, [purged]);
  await syncState.set(SYNC_KEYS.cursor, new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString());
  // …and a change that can't be pushed must survive the rebuild
  await workoutSets.create("99999999-9999-4999-8999-999999999999", set());

  const status = await sync.requestSync();
  assert.equal(status.error, null);
  assert.deepEqual((await workouts.list()).map((w) => w.id), [kept]);
  assert.equal(await outbox.count(), 1, "unpushed changes are kept");
  await sync.stop();
});

test("a 401 pauses sync without retrying or losing changes", async (ctx) => {
  if (skipReason) return ctx.skip(skipReason);
  const userId = await t.createUser();
  const { sync, net, timers } = device(userId);
  await sync.start();
  await workouts.create({ name: "Queued" });

  net.status = 401;
  const status = await sync.requestSync();
  assert.equal(status.error.kind, "auth");
  assert.deepEqual(timers.delays(), [], "no automatic retry — the next sign-in or token refresh resumes");
  assert.equal(await outbox.count(), 1);

  net.status = null;
  assert.equal((await sync.requestSync()).error, null);
  assert.equal(await outbox.count(), 0);
  await sync.stop();
});

test("network failures back off 2 s, 4 s, 8 s … up to 5 minutes", async (ctx) => {
  if (skipReason) return ctx.skip(skipReason);
  const { sync, net, timers } = device(await t.createUser());
  await sync.start();
  net.online = false;

  const delays = [];
  await sync.requestSync();
  for (let i = 0; i < 10; i++) {
    delays.push(...timers.delays());
    timers.fireAll(); // the retry fires…
    await sync.whenIdle(); // …and fails again
  }
  assert.deepEqual(delays, [2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000, 300000, 300000]);

  net.online = true;
  timers.fireAll();
  await sync.whenIdle();
  assert.equal(sync.getStatus().error, null);
  assert.deepEqual(timers.delays(), [], "success resets the backoff");
  await sync.stop();
});

test("a local write schedules a sync 2 s later", async (ctx) => {
  if (skipReason) return ctx.skip(skipReason);
  const userId = await t.createUser();
  const { sync, timers } = device(userId);
  await sync.start();

  await workouts.create({ name: "Debounced" });
  await workouts.create({ name: "Debounced 2" });
  assert.deepEqual(timers.delays(), [2000], "writes are debounced into one sync");
  timers.fireAll();
  await sync.whenIdle();
  assert.equal((await serverWorkouts(userId)).length, 2);
  await sync.stop();
});

test("concurrent requests share runs; stop() halts a run before its next write", async (ctx) => {
  if (skipReason) return ctx.skip(skipReason);
  const userId = await t.createUser();
  const { sync, net } = device(userId);
  await sync.start();
  await workouts.create({ name: "One" });

  await Promise.all([sync.requestSync(), sync.requestSync(), sync.requestSync()]);
  const pulls = net.requests.filter((r) => r.startsWith("GET")).length;
  assert.ok(pulls <= 2, `requests coalesce (got ${pulls} runs)`);

  // Hold the next push in flight, then stop
  await workouts.create({ name: "Two" });
  let release;
  const gate = new Promise((r) => { release = r; });
  const { sync: slow } = device(userId, {
    fetch: async (url, init) => {
      await gate;
      return fetch(url, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${t.tokenFor(userId)}` } });
    },
  });
  await sync.stop();
  await slow.start();
  const run = slow.requestSync();
  const stopped = slow.stop();
  release();
  await Promise.all([run, stopped]);
  assert.equal(await outbox.count(), 1, "the stopped run didn't settle the outbox");
});
