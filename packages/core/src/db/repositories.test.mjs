/**
 * Phase 4: local database, repositories and outbox.
 * Run: npm run test:offline --workspace @apex/core
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createNodeSqliteAdapter } from "./testing/nodeSqliteAdapter.mjs";
import { registerDatabase, getDatabase, hasDatabase } from "./database.js";
import { subscribeToChanges } from "./events.js";
import {
  MAX_PUSH_ATTEMPTS,
  workouts,
  workoutSets,
  routines,
  prs,
  bodyMetrics,
  exerciseCache,
  outbox,
  syncState,
  clearLocalData,
} from "./repositories.js";

let adapter;

beforeEach(() => {
  adapter = createNodeSqliteAdapter();
  registerDatabase(adapter);
});

const set = (overrides = {}) => ({
  exercise_id: 1, exercise_name: "Bench Press", muscle_group: "Chest", set_order: 1, reps: 8, weight: 185, rir: 1, ...overrides,
});

/** Run fn and return the outbox entries it added. */
async function outboxAddedBy(fn) {
  const before = (await outbox.all()).map((e) => e.seq);
  const result = await fn();
  const added = (await outbox.all()).filter((e) => !before.includes(e.seq));
  return { result, added };
}

test("migrations build the schema once and record the version", async () => {
  assert.equal(hasDatabase(), true);
  const db = await getDatabase();
  const version = await db.first("PRAGMA user_version");
  assert.equal(version.user_version, 1);
  const tables = (await db.all(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)).map((r) => r.name);
  for (const t of ["body_metrics", "exercises", "outbox", "prs", "routine_exercises", "routines", "sync_state", "workout_sets", "workouts"]) {
    assert.ok(tables.includes(t), t);
  }

  // Re-opening the same file doesn't re-run v1 (which would fail on CREATE TABLE)
  await workouts.create({ name: "Kept" });
  registerDatabase(adapter);
  assert.equal((await workouts.list()).length, 1);
});

test("every single-row write produces exactly one outbox entry", async () => {
  const cases = [
    ["workouts", () => workouts.create({ name: "W" }), (id) => workouts.update(id, { notes: "n" }), (id) => workouts.remove(id)],
    ["routines", () => routines.create({ name: "R" }), (id) => routines.update(id, { name: "R2" }), (id) => routines.remove(id)],
    ["prs", () => prs.create({ exercise_name: "Squat", weight: 315 }), null, (id) => prs.remove(id)],
    ["body_metrics", () => bodyMetrics.create({ weight: 180 }), null, (id) => bodyMetrics.remove(id)],
  ];
  for (const [tbl, create, update, remove] of cases) {
    const created = await outboxAddedBy(create);
    assert.equal(created.added.length, 1, `${tbl} create`);
    assert.deepEqual([created.added[0].tbl, created.added[0].op, created.added[0].uuid], [tbl, "upsert", created.result]);

    if (update) {
      const updated = await outboxAddedBy(() => update(created.result));
      assert.equal(updated.added.length, 1, `${tbl} update`);
      assert.equal(updated.added[0].op, "upsert");
    }

    const removed = await outboxAddedBy(() => remove(created.result));
    assert.equal(removed.added.length, 1, `${tbl} remove`);
    assert.deepEqual([removed.added[0].op, removed.added[0].payload], ["delete", null]);
  }

  const w = await workouts.create({ name: "Parent" });
  const child = await outboxAddedBy(() => workoutSets.create(w, set()));
  assert.equal(child.added.length, 1);
  assert.equal(child.added[0].parent_uuid, w);
  assert.equal((await outboxAddedBy(() => workoutSets.update(child.result, { reps: 9 }))).added.length, 1);
  const childRemoved = await outboxAddedBy(() => workoutSets.remove(child.result));
  assert.equal(childRemoved.added.length, 1);
  assert.equal(childRemoved.added[0].parent_uuid, w, "child deletes carry their parent");
});

test("creating a workout with sets writes one entry per row, parent first", async () => {
  const { result: uuid, added } = await outboxAddedBy(() =>
    workouts.create({
      name: "Push Day",
      notes: "felt good",
      created_at: "2026-09-01T10:00:00.000Z",
      sets: [set({ set_order: 1 }), set({ set_order: 2, reps: "7" }), set({ exercise_id: 2, exercise_name: "Dip", set_order: 3, weight: 0 })],
    })
  );
  assert.equal(added.length, 4);
  assert.deepEqual(added.map((e) => e.tbl), ["workouts", "workout_sets", "workout_sets", "workout_sets"]);
  assert.deepEqual(added[0].payload, { name: "Push Day", notes: "felt good", status: "completed", created_at: "2026-09-01T10:00:00.000Z" });
  assert.ok(added.slice(1).every((e) => e.parent_uuid === uuid));
  assert.deepEqual(added[2].payload, {
    exercise_id: 1, exercise_name: "Bench Press", muscle_group: "Chest", set_order: 2, reps: 7, weight: 185, rir: 1,
  }, "numbers are normalized");
});

test("lists return the REST shapes, in the REST order", async () => {
  await workouts.create({ name: "Older", created_at: "2026-09-01T10:00:00.000Z", sets: [set({ set_order: 2, reps: 5 }), set({ set_order: 1, reps: 6 })] });
  await workouts.create({ name: "Newer", created_at: "2026-09-03T10:00:00.000Z" });

  const list = await workouts.list();
  assert.deepEqual(list.map((w) => w.name), ["Newer", "Older"]);
  const older = list[1];
  assert.equal(older.id, older.uuid);
  assert.deepEqual(older.sets.map((s) => s.reps), [6, 5], "sets in set_order");
  const s = older.sets[0];
  assert.deepEqual(
    { workout_id: s.workout_id, exercise_id: s.exercise_id, name: s.name, exercise_name: s.exercise_name, muscle_group: s.muscle_group, weight: s.weight },
    { workout_id: older.uuid, exercise_id: 1, name: "Bench Press", exercise_name: "Bench Press", muscle_group: "Chest", weight: 185 }
  );

  await routines.create({ name: "Upper", exercises: [{ exercise_id: 1, exercise_name: "Bench Press", sets: 4 }, { exercise_id: 3, exercise_name: "Row" }] });
  const [routine] = await routines.list();
  assert.deepEqual(routine.exercises.map((e) => [e.name, e.exercise_order, e.sets, e.reps]), [["Bench Press", 0, 4, 10], ["Row", 1, 3, 10]]);

  await prs.create({ exercise_name: "Squat", weight: 300, achieved_at: "2026-02-01T00:00:00.000Z" });
  await prs.create({ exercise_name: "Squat", weight: 315, achieved_at: "2026-01-01T00:00:00.000Z" });
  assert.deepEqual((await prs.list()).map((p) => p.weight), [315, 300], "PRs oldest first");

  await bodyMetrics.create({ weight: 180, height: "5'10\"", logged_at: "2026-01-01T00:00:00.000Z" });
  await bodyMetrics.create({ weight: 182, logged_at: "2026-03-01T00:00:00.000Z" });
  const metrics = await bodyMetrics.list();
  assert.deepEqual(metrics.map((m) => m.weight), [180, 182]);
  assert.equal(metrics[0].gender, "male");
  assert.equal((await bodyMetrics.latest()).weight, 182);
});

test("removing a parent removes its children locally with a single delete entry", async () => {
  const uuid = await workouts.create({ name: "W", sets: [set(), set({ set_order: 2 })] });
  const { added } = await outboxAddedBy(() => workouts.remove(uuid));
  assert.deepEqual(added.map((e) => [e.tbl, e.op]), [["workouts", "delete"]]);
  const db = await getDatabase();
  assert.equal((await db.first(`SELECT COUNT(*) AS n FROM workout_sets`)).n, 0);
  assert.equal(await workouts.remove(uuid), false, "removing again is a no-op");
});

test("updating a routine's exercises replaces them, one entry per row", async () => {
  const uuid = await routines.create({ name: "R", exercises: [{ exercise_name: "A" }, { exercise_name: "B" }] });
  const oldIds = (await routines.list())[0].exercises.map((e) => e.uuid);

  const { added } = await outboxAddedBy(() =>
    routines.update(uuid, { name: "R2", exercises: [{ exercise_name: "C", uuid: oldIds[0] }] })
  );
  assert.deepEqual(added.map((e) => [e.tbl, e.op]), [
    ["routines", "upsert"],
    ["routine_exercises", "delete"],
    ["routine_exercises", "delete"],
    ["routine_exercises", "upsert"],
  ]);
  assert.deepEqual(added[0].payload.name, "R2");
  const [routine] = await routines.list();
  assert.deepEqual(routine.exercises.map((e) => e.name), ["C"]);
  assert.ok(!oldIds.includes(routine.exercises[0].uuid), "replacements get fresh uuids");
});

test("a failing write leaves no row, no outbox entry and no change event", async () => {
  const events = [];
  const unsubscribe = subscribeToChanges((tables) => events.push([...tables]));
  try {
    await assert.rejects(() => workouts.create({ name: "" }), /workouts.name is required/);
    await assert.rejects(
      () => workouts.create({ name: "Half", sets: [set(), set({ exercise_name: undefined })] }),
      /workout_sets.exercise_name is required/
    );
    await assert.rejects(() => workoutSets.create(undefined, set()), /workout_uuid is required/);
    await assert.rejects(() => workouts.update("missing", { name: "x" }), /not found/);
    await assert.rejects(() => prs.create({ exercise_name: "Squat", weight: "heavy" }), /weight must be a number/);
  } finally {
    unsubscribe();
  }
  assert.equal((await workouts.list()).length, 0);
  assert.equal(await outbox.count(), 0);
  assert.deepEqual(events, []);
});

test("committed writes announce the tables they touched", async () => {
  const events = [];
  const unsubscribe = subscribeToChanges((tables, source) => events.push([[...tables].sort(), source]));
  try {
    const w = await workouts.create({ name: "W", sets: [set()] });
    await workouts.remove(w);
  } finally {
    unsubscribe();
  }
  assert.deepEqual(events, [
    [["outbox", "workout_sets", "workouts"], "local"],
    [["outbox", "workout_sets", "workouts"], "local"],
  ]);
});

test("concurrent writes are serialized, never interleaved", async () => {
  const uuids = await Promise.all(
    Array.from({ length: 25 }, (_, i) => workouts.create({ name: `W${i}`, sets: [set(), set({ set_order: 2 })] }))
  );
  assert.equal(new Set(uuids).size, 25);
  assert.equal((await workouts.list()).length, 25);
  const entries = await outbox.all();
  assert.equal(entries.length, 75);
  // Each workout's three entries are contiguous: no transaction interleaved with another
  for (let i = 0; i < entries.length; i += 3) {
    assert.equal(entries[i].tbl, "workouts");
    assert.equal(entries[i + 1].parent_uuid, entries[i].uuid);
    assert.equal(entries[i + 2].parent_uuid, entries[i].uuid);
  }
});

test("outbox: peek in order, settle results, park after repeated failures", async () => {
  for (let i = 0; i < 5; i++) await prs.create({ exercise_name: "Squat", weight: 100 + i });
  const all = await outbox.peek();
  assert.equal(all.length, 5);
  assert.deepEqual(all.map((e) => e.payload.weight), [100, 101, 102, 103, 104]);
  assert.deepEqual((await outbox.peek({ afterSeq: all[1].seq, limit: 2 })).map((e) => e.seq), [all[2].seq, all[3].seq]);

  await outbox.settle([{ seq: all[0].seq, ok: true }, { seq: all[1].seq, ok: false, error: "Parent not found" }]);
  assert.equal(await outbox.count(), 4);
  assert.equal((await outbox.all())[0].attempts, 1);
  assert.equal((await outbox.all())[0].last_error, "Parent not found");

  for (let i = 1; i < MAX_PUSH_ATTEMPTS; i++) await outbox.settle([{ seq: all[1].seq, ok: false, error: "still broken" }]);
  assert.equal(await outbox.pendingCount(), 3, "parked entries aren't pending");
  assert.ok(!(await outbox.peek()).some((e) => e.seq === all[1].seq), "parked entries aren't pushed");
  assert.deepEqual((await outbox.parked()).map((e) => e.seq), [all[1].seq]);
  assert.ok((await outbox.pendingUuids()).has(all[1].uuid), "a parked change still protects its row");

  await outbox.retryParked();
  assert.equal(await outbox.pendingCount(), 4);
});

test("exercise search covers the cached catalogue and the user's history", async () => {
  await exerciseCache.upsertMany([
    { id: 1, name: "Bench Press", muscle_group: "Chest" },
    { id: 2, name: "Incline Bench Press", muscle: "Chest" },
    { id: "x", name: "ignored" },
  ]);
  await workouts.create({ name: "W", sets: [set({ exercise_id: 99, exercise_name: "Landmine Press", muscle_group: "Shoulders" }), set({ exercise_id: 1, exercise_name: "bench press" })] });

  assert.equal(await exerciseCache.count(), 2);
  const results = await exerciseCache.search("press");
  assert.deepEqual(results.map((r) => r.name), ["Bench Press", "Incline Bench Press", "Landmine Press"]);
  assert.deepEqual(results[0], { id: 1, name: "Bench Press", muscle_group: "Chest" }, "the catalogue entry wins");
  assert.deepEqual(await exerciseCache.search("%"), [], "LIKE wildcards are literal");
});

test("lastSetsForExercise returns the most recent session's sets", async () => {
  await workouts.create({ name: "Old", created_at: "2026-01-01T00:00:00.000Z", sets: [set({ weight: 100 })] });
  await workouts.create({ name: "New", created_at: "2026-02-01T00:00:00.000Z", sets: [set({ set_order: 2, weight: 120 }), set({ weight: 110 }), set({ exercise_id: 5, exercise_name: "Other" })] });
  await workouts.create({ name: "Newest, other exercise", created_at: "2026-03-01T00:00:00.000Z", sets: [set({ exercise_id: 5, exercise_name: "Other" })] });
  const last = await workouts.lastSetsForExercise(1);
  assert.deepEqual(last.map((s) => s.weight), [110, 120]);
});

test("sync state and clearLocalData", async () => {
  await syncState.set("cursor", "2026-09-01T00:00:00.000000Z");
  assert.equal(await syncState.get("cursor"), "2026-09-01T00:00:00.000000Z");
  await syncState.set("cursor", null);
  assert.equal(await syncState.get("cursor"), null);

  await exerciseCache.upsertMany([{ id: 1, name: "Bench Press" }]);
  await workouts.create({ name: "W", sets: [set()] });
  await routines.create({ name: "R", exercises: [{ exercise_name: "A" }] });
  await syncState.set("user_id", "7");

  const events = [];
  const unsubscribe = subscribeToChanges((tables, source) => events.push(source));
  await clearLocalData();
  unsubscribe();

  assert.equal((await workouts.list()).length, 0);
  assert.equal((await routines.list()).length, 0);
  assert.equal(await outbox.count(), 0);
  assert.equal(await syncState.get("user_id"), null);
  assert.equal(await exerciseCache.count(), 1, "the shared catalogue survives");
  assert.deepEqual(events, ["reset"]);
});

test("bodyMetrics.log carries missing fields forward from the latest snapshot", async () => {
  // First snapshot with nothing to carry: server-compatible defaults
  await bodyMetrics.log({ weight: 180 });
  let latest = await bodyMetrics.latest();
  assert.deepEqual(
    { weight: latest.weight, height: latest.height, training_years: latest.training_years, gender: latest.gender, body_fat: latest.body_fat },
    { weight: 180, height: "Not Selected", training_years: null, gender: "male", body_fat: null }
  );

  await bodyMetrics.log({ weight: 175, height: "5'10\"", trainingYears: 3, bodyFat: 15, gender: "female" });
  await bodyMetrics.log({ weight: 176 });
  latest = await bodyMetrics.latest();
  assert.deepEqual(
    { weight: latest.weight, height: latest.height, training_years: latest.training_years, gender: latest.gender, body_fat: latest.body_fat },
    { weight: 176, height: "5'10\"", training_years: 3, gender: "female", body_fat: 15 }
  );
  assert.equal((await bodyMetrics.list()).length, 3);
  assert.equal(await outbox.count(), 3);
});

test("routines.find accepts a uuid or a legacy server id", async () => {
  const uuid = await routines.create({ name: "R" });
  const db = await getDatabase();
  await db.transaction(async (tx) => {
    await tx.run(`UPDATE routines SET server_id = 42 WHERE uuid = ?`, [uuid]);
  });
  assert.equal((await routines.find(uuid))?.uuid, uuid);
  assert.equal((await routines.find(42))?.uuid, uuid);
  assert.equal((await routines.find("42"))?.uuid, uuid);
  assert.equal(await routines.find(7), null);
  assert.equal(await routines.find(undefined), null);
});

test("reading a large history from SQLite stays well under the 300 ms cold-start budget", async () => {
  // ~3 years of training: 500 workouts × 20 sets, plus PRs and metrics
  const db = await getDatabase();
  await db.transaction(async (tx) => {
    for (let w = 0; w < 500; w++) {
      const uuid = `00000000-0000-4000-8000-${String(w).padStart(12, "0")}`;
      await tx.run(`INSERT INTO workouts (uuid, name, created_at) VALUES (?, ?, ?)`, [uuid, `W${w}`, new Date(Date.UTC(2024, 0, 1) + w * 86400000).toISOString()]);
      for (let s = 0; s < 20; s++) {
        await tx.run(
          `INSERT INTO workout_sets (uuid, workout_uuid, exercise_id, exercise_name, set_order, reps, weight) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [`${uuid}-${s}`, uuid, s % 8, `Exercise ${s % 8}`, s, 8, 100 + s]
        );
      }
    }
  });

  const started = performance.now();
  const [list] = await Promise.all([workouts.list(), routines.list(), prs.list(), bodyMetrics.list()]);
  const elapsed = performance.now() - started;
  assert.equal(list.length, 500);
  assert.equal(list[0].sets.length, 20);
  console.log(`# cold-start read of 500 workouts / 10,000 sets: ${elapsed.toFixed(0)} ms`);
  assert.ok(elapsed < 300, `took ${elapsed.toFixed(0)} ms`);
});
