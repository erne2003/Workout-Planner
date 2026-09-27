/**
 * Phase 5: applying pulled pages to the local database.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createNodeSqliteAdapter } from "../db/testing/nodeSqliteAdapter.mjs";
import { registerDatabase, getDatabase } from "../db/database.js";
import { subscribeToChanges } from "../db/events.js";
import { workouts, routines, outbox, exerciseCache } from "../db/repositories.js";
import { applyPulledChanges, dropSyncedRows } from "./applyChanges.js";

beforeEach(() => {
  registerDatabase(createNodeSqliteAdapter());
});

const W = "11111111-1111-4111-8111-111111111111";
const S1 = "22222222-2222-4222-8222-222222222222";
const S2 = "33333333-3333-4333-8333-333333333333";

const serverWorkout = (over = {}) => ({
  uuid: W, id: 41, name: "Push", notes: null, status: "completed",
  created_at: "2026-09-01T10:00:00+00:00", updated_at: "2026-09-01T10:00:01.123456+00:00", deleted_at: null, ...over,
});
const serverSet = (uuid, over = {}) => ({
  uuid, id: 7, workout_uuid: W, exercise_id: 3, exercise_name: "Bench Press", muscle_group: "Chest",
  set_order: 1, reps: 8, weight: 185, rir: 1, updated_at: "2026-09-01T10:00:01+00:00", deleted_at: null, ...over,
});

test("pulled rows are upserted in REST shape, children before their parent included", async () => {
  // A page may deliver a child before its parent; nothing is lost
  await applyPulledChanges({ workout_sets: [serverSet(S1)] }, new Set());
  assert.deepEqual(await workouts.list(), [], "orphan set waits for its workout");
  await applyPulledChanges({ workouts: [serverWorkout()] }, new Set());

  const [w] = await workouts.list();
  assert.equal(w.id, W);
  assert.equal(w.server_id, 41);
  assert.equal(w.created_at, "2026-09-01T10:00:00.000Z", "timestamps normalized to ISO UTC");
  assert.deepEqual(w.sets.map((s) => [s.id, s.name, s.weight]), [[S1, "Bench Press", 185]]);

  // Applying the same page twice is harmless (pulls overlap by 5 s)
  const again = await applyPulledChanges({ workouts: [serverWorkout({ name: "Push v2" })], workout_sets: [serverSet(S1)] }, new Set());
  assert.equal(again.applied, 2);
  const list = await workouts.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, "Push v2");
  assert.equal(list[0].sets.length, 1);

  // Exercise ids and names feed the offline search
  assert.deepEqual(await exerciseCache.search("bench"), [{ id: 3, name: "Bench Press", muscle_group: "Chest" }]);
});

test("pulling never writes to the outbox", async () => {
  await applyPulledChanges({ workouts: [serverWorkout()], workout_sets: [serverSet(S1)] }, new Set());
  assert.equal(await outbox.count(), 0);
});

test("rows with unpushed local changes are skipped", async () => {
  const local = await workouts.create({ name: "Local edit" });
  const result = await applyPulledChanges({ workouts: [serverWorkout({ uuid: local, name: "Server version" })] }, await outbox.pendingUuids());
  assert.deepEqual(result, { applied: 0, skipped: 1 });
  assert.equal((await workouts.list())[0].name, "Local edit");
});

test("tombstones delete the local row, and a parent's tombstone its children", async () => {
  await applyPulledChanges({ workouts: [serverWorkout()], workout_sets: [serverSet(S1), serverSet(S2, { set_order: 2 })] }, new Set());
  await applyPulledChanges({ workout_sets: [serverSet(S2, { deleted_at: "2026-09-02T00:00:00+00:00" })] }, new Set());
  assert.deepEqual((await workouts.list())[0].sets.map((s) => s.id), [S1]);

  await applyPulledChanges({ workouts: [serverWorkout({ deleted_at: "2026-09-02T00:00:00+00:00" })] }, new Set());
  assert.deepEqual(await workouts.list(), []);
  const db = await getDatabase();
  assert.equal((await db.first(`SELECT COUNT(*) AS n FROM workout_sets`)).n, 0);

  // A tombstone for a row this device never had is fine
  await applyPulledChanges({ routines: [{ uuid: S2, name: "x", deleted_at: "2026-09-02T00:00:00Z" }] }, new Set());
  assert.deepEqual(await routines.list(), []);
});

test("applied pages announce their tables as sync changes", async () => {
  const events = [];
  const unsubscribe = subscribeToChanges((tables, source) => events.push([[...tables].sort(), source]));
  await applyPulledChanges({ workouts: [serverWorkout()], workout_sets: [serverSet(S1)] }, new Set());
  unsubscribe();
  assert.deepEqual(events, [[["exercises", "workout_sets", "workouts"], "sync"]]);
});

test("dropSyncedRows keeps only rows with unpushed changes", async () => {
  await applyPulledChanges({ workouts: [serverWorkout()], workout_sets: [serverSet(S1)] }, new Set());
  const local = await workouts.create({ name: "Not pushed yet" });
  await dropSyncedRows();
  assert.deepEqual((await workouts.list()).map((w) => w.id), [local]);
});
