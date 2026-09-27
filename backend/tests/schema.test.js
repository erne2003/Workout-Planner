/**
 * Phase 2: the offline-sync schema migration (uuid, updated_at, deleted_at,
 * triggers, tombstone purge) must leave the existing REST API working.
 * See helpers/testServer.js for the database this needs.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer, migrate } = require("./helpers/testServer");

let t; // test server
let userId;
let benchId;
let squatId;
let legacyUserId;

before(async () => {
    t = await startTestServer({
        // Rows that exist before the migration must be backfilled
        beforeMigrate: async (client) => {
            const u = await client.query(`INSERT INTO users (name, email, password) VALUES ('Legacy', 'legacy@test.dev', 'x') RETURNING id`);
            legacyUserId = u.rows[0].id;
            const e = await client.query(`INSERT INTO exercises (name, muscle_group) VALUES ('Deadlift', 'Back') RETURNING id`);
            const w = await client.query(`INSERT INTO workouts (user_id, name) VALUES ($1, 'Old A'), ($1, 'Old B') RETURNING id`, [legacyUserId]);
            await client.query(
                `INSERT INTO workout_sets (workout_id, exercise_id, set_order, reps, weight) VALUES ($1, $2, 1, 5, 315)`,
                [w.rows[0].id, e.rows[0].id]
            );
        },
    });
    userId = await t.createUser("A");
    const ex = await t.pool.query(`INSERT INTO exercises (name, muscle_group) VALUES ('Bench Press', 'Chest'), ('Squat', 'Quadriceps') RETURNING id`);
    [benchId, squatId] = ex.rows.map((r) => r.id);
});

after(async () => {
    await t?.close();
});

const updatedAt = async (table, where, params) =>
    (await t.pool.query(`SELECT updated_at FROM ${table} WHERE ${where}`, params)).rows[0].updated_at.getTime();

test("existing rows are backfilled with distinct uuids and updated_at", async () => {
    const { rows } = await t.pool.query(`SELECT uuid, updated_at, deleted_at FROM workouts WHERE user_id = $1`, [legacyUserId]);
    assert.equal(rows.length, 2);
    assert.ok(rows.every((r) => r.uuid && r.updated_at && r.deleted_at === null));
    assert.notEqual(rows[0].uuid, rows[1].uuid);

    const sets = await t.pool.query(`SELECT uuid FROM workout_sets`);
    assert.ok(sets.rows.every((r) => r.uuid));

    const list = await t.api(legacyUserId, "GET", "/workouts");
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 2);
});

test("the migration can be run again", () => {
    assert.doesNotThrow(() => migrate());
});

test("REST routes create, list and soft delete workouts and sets", async () => {
    const created = await t.api(userId, "POST", "/workouts", { name: "Legacy", notes: "n" });
    assert.equal(created.status, 201);
    assert.match(created.body.uuid, /^[0-9a-f-]{36}$/);

    const set = await t.api(userId, "POST", `/workouts/${created.body.id}/sets`, {
        exerciseId: squatId, setOrder: 1, reps: 5, weight: 225,
    });
    assert.equal(set.status, 201);
    const set2 = await t.api(userId, "POST", `/workouts/${created.body.id}/sets`, {
        exerciseId: benchId, setOrder: 2, reps: 8, weight: 185,
    });

    // Deleting one set hides only that set
    assert.equal((await t.api(userId, "DELETE", `/workouts/${created.body.id}/sets/${set2.body.id}`)).status, 200);
    let one = await t.api(userId, "GET", `/workouts/${created.body.id}`);
    assert.deepEqual(one.body.sets.map((s) => s.id), [set.body.id]);
    assert.equal((await t.api(userId, "PUT", `/workouts/${created.body.id}/sets/${set2.body.id}`, { reps: 1 })).status, 404);

    let list = await t.api(userId, "GET", "/workouts");
    assert.ok(list.body.some((w) => w.id === created.body.id && w.sets.length === 1));

    assert.equal((await t.api(userId, "DELETE", `/workouts/${created.body.id}`)).status, 200);

    list = await t.api(userId, "GET", "/workouts");
    assert.ok(!list.body.some((w) => w.id === created.body.id), "deleted workout is hidden");
    assert.equal((await t.api(userId, "GET", `/workouts/${created.body.id}`)).status, 404);
    assert.equal((await t.api(userId, "PUT", `/workouts/${created.body.id}`, { name: "x" })).status, 404);
    assert.equal((await t.api(userId, "DELETE", `/workouts/${created.body.id}`)).status, 404);

    const row = await t.pool.query(`SELECT deleted_at FROM workouts WHERE id = $1`, [created.body.id]);
    assert.ok(row.rows[0].deleted_at, "row kept as a tombstone");
    const setRows = await t.pool.query(`SELECT deleted_at FROM workout_sets WHERE workout_id = $1`, [created.body.id]);
    assert.ok(setRows.rows.every((r) => r.deleted_at), "sets tombstoned with their workout");
});

test("exercise history ignores deleted workouts", async () => {
    const keep = await t.api(userId, "POST", "/workouts", { name: "Keep" });
    await t.api(userId, "POST", `/workouts/${keep.body.id}/sets`, { exerciseId: benchId, setOrder: 1, reps: 10, weight: 100 });
    const gone = await t.api(userId, "POST", "/workouts", { name: "Gone" });
    await t.api(userId, "POST", `/workouts/${gone.body.id}/sets`, { exerciseId: benchId, setOrder: 1, reps: 3, weight: 999 });
    await t.api(userId, "DELETE", `/workouts/${gone.body.id}`);

    const history = await t.api(userId, "GET", `/workouts/history/${benchId}`);
    assert.equal(history.status, 200);
    assert.deepEqual(history.body.map((s) => Number(s.weight)), [100]);
});

test("REST routine update tombstones replaced exercises; delete hides the routine", async () => {
    const created = await t.api(userId, "POST", "/routines", { name: "R", exercises: [{ exercise_id: benchId }] });
    assert.equal(created.status, 201);

    const updated = await t.api(userId, "PUT", `/routines/${created.body.id}`, { name: "R2", exercises: [{ exercise_id: squatId }] });
    assert.equal(updated.status, 200);

    let routines = await t.api(userId, "GET", "/routines");
    const r = routines.body.find((x) => x.id === created.body.id);
    assert.equal(r.name, "R2");
    assert.deepEqual(r.exercises.map((e) => e.exercise_id), [squatId]);

    const rows = await t.pool.query(
        `SELECT deleted_at IS NOT NULL AS gone FROM routine_exercises WHERE routine_id = $1 ORDER BY id`,
        [created.body.id]
    );
    assert.deepEqual(rows.rows.map((x) => x.gone), [true, false]);

    assert.equal((await t.api(userId, "DELETE", `/routines/${created.body.id}`)).status, 200);
    routines = await t.api(userId, "GET", "/routines");
    assert.ok(!routines.body.some((x) => x.id === created.body.id));
    assert.equal((await t.api(userId, "PUT", `/routines/${created.body.id}`, { name: "R3", exercises: [{ exercise_id: benchId }] })).status, 404);
    const children = await t.pool.query(`SELECT bool_and(deleted_at IS NOT NULL) AS all_gone FROM routine_exercises WHERE routine_id = $1`, [created.body.id]);
    assert.equal(children.rows[0].all_gone, true);
});

test("PR and metrics routes skip tombstoned rows", async () => {
    assert.equal((await t.api(userId, "POST", "/prs", { exerciseName: "Squat", weight: 315 })).status, 201);
    assert.equal((await t.api(userId, "POST", "/metrics", { weight: 180, height: "5'10\"", trainingYears: 3 })).status, 201);
    assert.equal((await t.api(userId, "POST", "/metrics", { weight: 182 })).status, 201);

    await t.pool.query(`UPDATE prs SET deleted_at = now() WHERE user_id = $1`, [userId]);
    await t.pool.query(`UPDATE body_metrics SET deleted_at = now() WHERE user_id = $1 AND weight = 182`, [userId]);

    assert.deepEqual((await t.api(userId, "GET", "/prs")).body, []);
    const metrics = await t.api(userId, "GET", "/metrics");
    assert.deepEqual(metrics.body.map((m) => Number(m.weight)), [180]);

    // A partial metrics update carries forward from the latest live snapshot
    const next = await t.api(userId, "POST", "/metrics", { weight: 181 });
    assert.equal(Number(next.body.training_years), 3);
});

test("updated_at is stamped on update, and child changes bump the parent", async () => {
    const w = await t.api(userId, "POST", "/workouts", { name: "Stamps" });
    const t0 = await updatedAt("workouts", "id = $1", [w.body.id]);

    await new Promise((r) => setTimeout(r, 15));
    await t.api(userId, "PUT", `/workouts/${w.body.id}`, { name: "Stamps 2" });
    const t1 = await updatedAt("workouts", "id = $1", [w.body.id]);
    assert.ok(t1 > t0, "UPDATE stamps updated_at");

    await new Promise((r) => setTimeout(r, 15));
    const s = await t.api(userId, "POST", `/workouts/${w.body.id}/sets`, { exerciseId: benchId, setOrder: 1, reps: 5, weight: 100 });
    const t2 = await updatedAt("workouts", "id = $1", [w.body.id]);
    assert.ok(t2 > t1, "inserting a set bumps its workout");

    await new Promise((r) => setTimeout(r, 15));
    await t.api(userId, "PUT", `/workouts/${w.body.id}/sets/${s.body.id}`, { reps: 6 });
    const t3 = await updatedAt("workouts", "id = $1", [w.body.id]);
    const setStamp = await updatedAt("workout_sets", "id = $1", [s.body.id]);
    assert.ok(t3 > t2, "editing a set bumps its workout");
    assert.ok(setStamp >= t3 - 1, "the set itself is stamped too");
});

test("purge_sync_tombstones removes only tombstones past retention", async () => {
    const old = await t.api(userId, "POST", "/workouts", { name: "Old tombstone" });
    await t.api(userId, "POST", `/workouts/${old.body.id}/sets`, { exerciseId: benchId, setOrder: 1, reps: 5, weight: 100 });
    const recent = await t.api(userId, "POST", "/workouts", { name: "Recent tombstone" });
    await t.api(userId, "DELETE", `/workouts/${old.body.id}`);
    await t.api(userId, "DELETE", `/workouts/${recent.body.id}`);

    // deleted_at is never touched by the triggers, so it can be backdated
    await t.pool.query(`UPDATE workouts SET deleted_at = now() - interval '100 days' WHERE id = $1`, [old.body.id]);
    await t.pool.query(`UPDATE workout_sets SET deleted_at = now() - interval '100 days' WHERE workout_id = $1`, [old.body.id]);

    const purged = await t.pool.query(`SELECT purge_sync_tombstones(90) AS n`);
    assert.equal(purged.rows[0].n, 2);

    const left = await t.pool.query(`SELECT id FROM workouts WHERE id = ANY($1)`, [[old.body.id, recent.body.id]]);
    assert.deepEqual(left.rows.map((r) => r.id), [recent.body.id]);
});

test("account deletion still removes everything for real", async () => {
    const doomed = await t.createUser("Doomed");
    const bcrypt = require("bcrypt");
    await t.pool.query(`UPDATE users SET password = $1 WHERE id = $2`, [await bcrypt.hash("pw123456", 4), doomed]);
    const w = await t.api(doomed, "POST", "/workouts", { name: "Bye" });
    await t.api(doomed, "POST", `/workouts/${w.body.id}/sets`, { exerciseId: benchId, setOrder: 1, reps: 5, weight: 100 });
    await t.api(doomed, "DELETE", `/workouts/${w.body.id}`); // a tombstone must not survive either

    const res = await t.api(doomed, "POST", "/auth/delete-account", { password: "pw123456" });
    assert.equal(res.status, 200);
    const left = await t.pool.query(`SELECT COUNT(*)::int AS n FROM workouts WHERE user_id = $1`, [doomed]);
    assert.equal(left.rows[0].n, 0);
});
