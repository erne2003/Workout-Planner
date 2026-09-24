/**
 * Phase 7: logout wipe, user switch, and a sync caught mid-flight by logout.
 * No server needed: the network is simulated.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createNodeSqliteAdapter } from "../db/testing/nodeSqliteAdapter.mjs";
import { registerDatabase } from "../db/database.js";
import { workouts, prs, outbox, syncState } from "../db/repositories.js";
import { SyncManager, SYNC_KEYS } from "./SyncManager.js";
import { wipeLocalSession, claimLocalData, rememberLocalUser, countUnsyncedChanges } from "./session.js";

beforeEach(() => {
  registerDatabase(createNodeSqliteAdapter());
});

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const noTimers = { setTimeout: () => 0, clearTimeout: () => {} };

/** A fake backend: accepts every push, and pulls return `pullRows` (as workouts). */
function fakeServer({ pullRows = [], gate = null } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push(`${init.method || "GET"} ${new URL(url).pathname}`);
    if (gate) await gate;
    if (url.includes("/sync/push")) {
      const { changes } = JSON.parse(init.body);
      return json({ results: changes.map((c) => ({ uuid: c.uuid, status: "ok" })) });
    }
    return json({ changes: { workouts: pullRows }, has_more: false, next_cursor: null, since: "2026-09-01T00:00:00.000000Z" });
  };
  return { fetch, calls };
}

const serverWorkout = (uuid, name) => ({
  uuid, id: 1, name, notes: null, status: "completed", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", deleted_at: null,
});

test("logout wipes every local table, the outbox and the sync state", async () => {
  const server = fakeServer({ pullRows: [serverWorkout("11111111-1111-4111-8111-111111111111", "From server")] });
  const sync = new SyncManager({ fetch: server.fetch, getApiUrl: () => "http://api", timers: noTimers });
  await sync.start();
  await sync.requestSync();
  await workouts.create({ name: "Local" });
  await syncState.set(SYNC_KEYS.userId, "7");

  await wipeLocalSession(sync);

  assert.deepEqual(await workouts.list(), []);
  assert.equal(await outbox.count(), 0);
  assert.equal(await syncState.get(SYNC_KEYS.cursor), null);
  assert.equal(await syncState.get(SYNC_KEYS.userId), null);

  // Stopped: new writes don't trigger syncs
  const before = server.calls.length;
  await sync.requestSync();
  assert.equal(server.calls.length, before);
});

test("a sync in flight during logout can't bring data back", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const server = fakeServer({ gate, pullRows: [serverWorkout("22222222-2222-4222-8222-222222222222", "Arrives late")] });
  const sync = new SyncManager({ fetch: server.fetch, getApiUrl: () => "http://api", timers: noTimers });
  await sync.start();
  await workouts.create({ name: "Queued" });

  const run = sync.requestSync(); // blocked on the network
  const wiping = wipeLocalSession(sync, { waitMs: 50 }); // logout doesn't wait for the network
  await wiping;
  release(); // the push and pull responses arrive after the wipe
  await run;
  await sync.whenIdle();

  assert.deepEqual(await workouts.list(), [], "nothing re-inserted");
  assert.equal(await outbox.count(), 0);
  assert.equal(await syncState.get(SYNC_KEYS.cursor), null, "no cursor written after the wipe");
});

test("signing in as a different user wipes the previous user's data", async () => {
  await claimLocalData(1, null);
  await workouts.create({ name: "User 1's workout" });

  assert.equal(await claimLocalData(1, null), false, "same user: kept");
  assert.equal((await workouts.list()).length, 1);

  const stopped = [];
  const fakeSync = { stop: async () => stopped.push(true) };
  assert.equal(await claimLocalData(2, fakeSync), true);
  assert.deepEqual(await workouts.list(), []);
  assert.equal(await outbox.count(), 0);
  assert.equal(stopped.length, 1, "sync stopped before the wipe");
  assert.equal(await syncState.get(SYNC_KEYS.userId), "2");
});

test("a device without a recorded owner keeps its data and records the user", async () => {
  // e.g. an existing user's first launch after the upgrade, then signing in again
  await workouts.create({ name: "Mine" });
  await rememberLocalUser(5);
  assert.equal(await syncState.get(SYNC_KEYS.userId), "5");
  await rememberLocalUser(6); // never overwrites
  assert.equal(await syncState.get(SYNC_KEYS.userId), "5");
  assert.equal(await claimLocalData(5, null), false);
  assert.equal((await workouts.list()).length, 1);
});

test("unsynced changes are counted after one last attempt to push them", async () => {
  assert.equal(await countUnsyncedChanges(null), 0);

  await prs.create({ exercise_name: "Squat", weight: 315 });
  await prs.create({ exercise_name: "Bench Press", weight: 225 });

  // Offline: the last attempt fails, both still count
  const offline = new SyncManager({
    fetch: async () => { throw new TypeError("Network request failed"); },
    getApiUrl: () => "http://api",
    timers: noTimers,
  });
  await offline.start();
  assert.equal(await countUnsyncedChanges(offline), 2);
  await offline.stop();

  // Online: the last attempt pushes them, nothing to warn about
  const online = new SyncManager({ fetch: fakeServer().fetch, getApiUrl: () => "http://api", timers: noTimers });
  await online.start();
  assert.equal(await countUnsyncedChanges(online), 0);
  await online.stop();
});

test("a hung last attempt doesn't block logout", async () => {
  await prs.create({ exercise_name: "Squat", weight: 315 });
  const hung = new SyncManager({ fetch: () => new Promise(() => {}), getApiUrl: () => "http://api", timers: noTimers });
  await hung.start();
  const started = Date.now();
  assert.equal(await countUnsyncedChanges(hung, { waitMs: 50 }), 1);
  await wipeLocalSession(hung, { waitMs: 50 });
  assert.ok(Date.now() - started < 1000);
  assert.equal(await outbox.count(), 0);
});
