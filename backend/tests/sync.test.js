/**
 * Phase 3: GET /sync/pull and POST /sync/push.
 * See helpers/testServer.js for the database this needs.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { startTestServer } = require("./helpers/testServer");

let t; // test server
let userA;
let userB;

const uuid = () => crypto.randomUUID();
const push = (userId, changes) => t.api(userId, "POST", "/sync/push", { changes });

/** Pull every page from `since`, returning all rows per table, the final `since` and the raw pages. */
async function pullAll(userId, since, limit = 500) {
    const rows = {};
    const pages = [];
    let url = `/sync/pull?limit=${limit}${since ? `&since=${encodeURIComponent(since)}` : ""}`;
    for (;;) {
        const page = await t.api(userId, "GET", url);
        assert.equal(page.status, 200, JSON.stringify(page.body));
        pages.push(page.body);
        for (const [tbl, list] of Object.entries(page.body.changes)) (rows[tbl] ||= []).push(...list);
        if (!page.body.has_more) return { rows, since: page.body.since, pages };
        url = `/sync/pull?limit=${limit}&after=${encodeURIComponent(page.body.next_cursor)}`;
    }
}

/** A workout's name and created_at, read as UTC ISO text (the column has no time zone). */
const workoutRow = async (id) => (await t.pool.query(
    `SELECT name, to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at FROM workouts WHERE uuid = $1`,
    [id]
)).rows[0];

/** Run SQL with triggers off, e.g. to backdate updated_at (which the triggers re-stamp). */
async function withoutTriggers(sql, params) {
    const client = await t.pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SET LOCAL session_replication_role = replica");
        await client.query(sql, params);
        await client.query("COMMIT");
    } finally {
        client.release();
    }
}

const workoutChange = (id, payload = {}) => ({
    tbl: "workouts", op: "upsert", uuid: id,
    payload: { name: "Push Day", notes: null, created_at: "2026-09-01T10:00:00.000Z", ...payload },
});
const setChange = (id, workoutUuid, payload = {}) => ({
    tbl: "workout_sets", op: "upsert", uuid: id, parent_uuid: workoutUuid,
    payload: { exercise_name: "Bench Press", set_order: 1, reps: 8, weight: 185, rir: 1, ...payload },
});

before(async () => {
    t = await startTestServer();
    userA = await t.createUser("A");
    userB = await t.createUser("B");
    await t.pool.query(`INSERT INTO exercises (name, muscle_group) VALUES ('Bench Press', 'Chest'), ('Squat', 'Quadriceps')`);
});

after(async () => {
    await t?.close();
});

test("duplicate push (same change sent twice) creates one row", async () => {
    const w = uuid();
    const s = uuid();
    const batch = [workoutChange(w), setChange(s, w)];

    const first = await push(userA, batch);
    assert.equal(first.status, 200);
    assert.deepEqual(first.body.results.map((r) => r.status), ["ok", "ok"]);
    assert.deepEqual(first.body.results.map((r) => r.uuid), [w, s]);

    const second = await push(userA, batch);
    assert.deepEqual(second.body.results.map((r) => r.status), ["ok", "ok"]);

    const count = await t.pool.query(`SELECT COUNT(*)::int AS n FROM workouts WHERE uuid = $1`, [w]);
    assert.equal(count.rows[0].n, 1);
    const sets = await t.pool.query(`SELECT COUNT(*)::int AS n FROM workout_sets WHERE uuid = $1`, [s]);
    assert.equal(sets.rows[0].n, 1);

    const row = await workoutRow(w);
    assert.equal(row.created_at, "2026-09-01T10:00:00.000Z", "client-supplied performed time is kept (as UTC)");

    // And it's visible through the old REST API too
    const rest = await t.api(userA, "GET", "/workouts");
    const restWorkout = rest.body.find((x) => x.uuid === w || x.name === "Push Day");
    assert.ok(restWorkout);
    assert.equal(restWorkout.sets.length, 1);
});

test("an edit without created_at keeps the original time", async () => {
    const w = uuid();
    await push(userA, [workoutChange(w, { created_at: "2026-08-01T08:00:00.000Z" })]);
    await push(userA, [{ tbl: "workouts", op: "upsert", uuid: w, payload: { name: "Renamed" } }]);
    const row = await workoutRow(w);
    assert.equal(row.name, "Renamed");
    assert.equal(row.created_at, "2026-08-01T08:00:00.000Z");
});

test("cross-user writes are rejected and leave the row untouched", async () => {
    const w = uuid();
    const s = uuid();
    await push(userA, [workoutChange(w, { name: "A's workout" }), setChange(s, w)]);

    const overwrite = await push(userB, [workoutChange(w, { name: "Hijacked" })]);
    assert.equal(overwrite.body.results[0].status, "error");

    const del = await push(userB, [{ tbl: "workouts", op: "delete", uuid: w }]);
    assert.equal(del.body.results[0].status, "error");

    const setOverwrite = await push(userB, [setChange(s, w, { reps: 99 })]);
    assert.equal(setOverwrite.body.results[0].status, "error");

    const setDelete = await push(userB, [{ tbl: "workout_sets", op: "delete", uuid: s }]);
    assert.equal(setDelete.body.results[0].status, "error");

    // B can't adopt A's set into B's own workout either
    const own = uuid();
    await push(userB, [workoutChange(own)]);
    const adopt = await push(userB, [setChange(s, own, { reps: 1 })]);
    assert.equal(adopt.body.results[0].status, "error");

    const row = await t.pool.query(`SELECT user_id, name, deleted_at FROM workouts WHERE uuid = $1`, [w]);
    assert.equal(row.rows[0].user_id, userA);
    assert.equal(row.rows[0].name, "A's workout");
    assert.equal(row.rows[0].deleted_at, null);
    const set = await t.pool.query(
        `SELECT ws.reps, ws.deleted_at, w.uuid AS workout_uuid FROM workout_sets ws JOIN workouts w ON w.id = ws.workout_id WHERE ws.uuid = $1`,
        [s]
    );
    assert.deepEqual(set.rows[0], { reps: 8, deleted_at: null, workout_uuid: w });

    // And B never sees A's rows
    const pulled = await pullAll(userB);
    assert.ok(!(pulled.rows.workouts || []).some((r) => r.uuid === w));
    assert.ok(!(pulled.rows.workout_sets || []).some((r) => r.uuid === s));
});

test("a child pushed before its parent fails alone; retrying after the parent succeeds", async () => {
    const w = uuid();
    const s = uuid();
    const early = await push(userA, [
        setChange(s, w),
        { tbl: "prs", op: "upsert", uuid: uuid(), payload: { exercise_name: "Squat", weight: 315 } },
    ]);
    assert.equal(early.body.results[0].status, "error");
    assert.match(early.body.results[0].error, /parent/i);
    assert.equal(early.body.results[1].status, "ok", "one bad row doesn't block the rest");

    const later = await push(userA, [workoutChange(w), setChange(s, w)]);
    assert.deepEqual(later.body.results.map((r) => r.status), ["ok", "ok"]);
});

test("a delete followed by a pull returns tombstones for the row and its children", async () => {
    const w = uuid();
    const s = uuid();
    await push(userA, [workoutChange(w), setChange(s, w)]);
    const first = await pullAll(userA);
    assert.ok(first.rows.workouts.some((r) => r.uuid === w && r.deleted_at === null));

    // Past the 5 s overlap, so only the delete's rows come back
    await withoutTriggers(`UPDATE workouts SET updated_at = now() - interval '1 minute' WHERE user_id = $1`, [userA]);
    await withoutTriggers(
        `UPDATE workout_sets SET updated_at = now() - interval '1 minute'
          WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = $1)`, [userA]
    );
    const since = new Date(Date.now() - 30 * 1000).toISOString();

    const del = await push(userA, [{ tbl: "workouts", op: "delete", uuid: w }]);
    assert.equal(del.body.results[0].status, "ok");

    const { rows } = await pullAll(userA, since);
    assert.deepEqual((rows.workouts || []).map((r) => r.uuid), [w], "only the changed workout");
    const tombstone = rows.workouts[0];
    const setTombstone = (rows.workout_sets || []).find((r) => r.uuid === s);
    assert.ok(tombstone.deleted_at, "workout tombstone pulled");
    assert.ok(setTombstone?.deleted_at, "set tombstone pulled");
    assert.equal(setTombstone.workout_uuid, w);

    // Deleting again is a no-op, and a late edit doesn't resurrect it
    assert.equal((await push(userA, [{ tbl: "workouts", op: "delete", uuid: w }])).body.results[0].status, "ok");
    const edit = await push(userA, [workoutChange(w, { name: "Too late" }), setChange(uuid(), w)]);
    assert.deepEqual(edit.body.results.map((r) => r.status), ["ok", "ok"]);
    assert.equal(edit.body.results[1].skipped, "parent_deleted");
    const row = await t.pool.query(`SELECT name, deleted_at FROM workouts WHERE uuid = $1`, [w]);
    assert.ok(row.rows[0].deleted_at);
    assert.notEqual(row.rows[0].name, "Too late");
});

test("deleting a single child tombstones only that child", async () => {
    const w = uuid();
    const keep = uuid();
    const drop = uuid();
    await push(userA, [workoutChange(w), setChange(keep, w), setChange(drop, w, { set_order: 2 })]);
    const res = await push(userA, [{ tbl: "workout_sets", op: "delete", uuid: drop }]);
    assert.equal(res.body.results[0].status, "ok");
    const rows = await t.pool.query(`SELECT uuid, deleted_at IS NOT NULL AS gone FROM workout_sets WHERE uuid = ANY($1)`, [[keep, drop]]);
    const gone = Object.fromEntries(rows.rows.map((r) => [r.uuid, r.gone]));
    assert.deepEqual(gone, { [keep]: false, [drop]: true });
});

test("rows for every table round-trip through push and pull", async () => {
    const user = await t.createUser("Roundtrip");
    const w = uuid(), s = uuid(), r = uuid(), re = uuid(), pr = uuid(), m = uuid();
    const res = await push(user, [
        workoutChange(w, { notes: "felt good", status: "completed" }),
        setChange(s, w, { rir: 2 }),
        { tbl: "routines", op: "upsert", uuid: r, payload: { name: "Upper", created_at: "2026-07-01T00:00:00Z" } },
        { tbl: "routine_exercises", op: "upsert", uuid: re, parent_uuid: r, payload: { exercise_name: "Squat", exercise_order: 0, sets: 4, reps: 6, weight: 225, rir: 1 } },
        { tbl: "prs", op: "upsert", uuid: pr, payload: { exercise_name: "Squat", weight: 405, achieved_at: "2026-06-01T12:00:00Z" } },
        { tbl: "body_metrics", op: "upsert", uuid: m, payload: { weight: 181.5, height: "5'11\"", training_years: 4.5, body_fat: 14.2, gender: "male", logged_at: "2026-05-01T09:30:00Z" } },
    ]);
    assert.deepEqual(res.body.results.map((x) => x.status), ["ok", "ok", "ok", "ok", "ok", "ok"]);

    const { rows } = await pullAll(user);
    const only = (tbl) => {
        assert.equal(rows[tbl]?.length, 1, tbl);
        return rows[tbl][0];
    };
    const workout = only("workouts");
    assert.equal(workout.uuid, w);
    assert.equal(workout.notes, "felt good");
    assert.equal(new Date(workout.created_at).toISOString(), "2026-09-01T10:00:00.000Z");
    assert.ok(Number.isInteger(workout.id), "server id included");

    const set = only("workout_sets");
    assert.deepEqual(
        { uuid: set.uuid, workout_uuid: set.workout_uuid, exercise_name: set.exercise_name, muscle_group: set.muscle_group, reps: set.reps, weight: set.weight, rir: set.rir },
        { uuid: s, workout_uuid: w, exercise_name: "Bench Press", muscle_group: "Chest", reps: 8, weight: 185, rir: 2 }
    );
    assert.ok(Number.isInteger(set.exercise_id));

    const routine = only("routines");
    assert.equal(new Date(routine.created_at).toISOString(), "2026-07-01T00:00:00.000Z");
    const rex = only("routine_exercises");
    assert.deepEqual(
        { routine_uuid: rex.routine_uuid, exercise_name: rex.exercise_name, sets: rex.sets, reps: rex.reps, weight: rex.weight },
        { routine_uuid: r, exercise_name: "Squat", sets: 4, reps: 6, weight: 225 }
    );
    const p = only("prs");
    assert.deepEqual({ exercise_name: p.exercise_name, weight: p.weight }, { exercise_name: "Squat", weight: 405 });
    assert.equal(new Date(p.achieved_at).toISOString(), "2026-06-01T12:00:00.000Z");
    const metric = only("body_metrics");
    assert.deepEqual(
        { weight: metric.weight, height: metric.height, training_years: metric.training_years, body_fat: metric.body_fat },
        { weight: 181.5, height: "5'11\"", training_years: 4.5, body_fat: 14.2 }
    );

    // The same rows through the old REST API
    const restRoutines = await t.api(user, "GET", "/routines");
    assert.equal(restRoutines.body[0].exercises[0].name, "Squat");
    const restPrs = await t.api(user, "GET", "/prs");
    assert.equal(restPrs.body[0].exercise_name, "Squat");
});

test("pull joins exercise names and resolves unknown exercises by name", async () => {
    const w = uuid();
    const res = await push(userA, [
        workoutChange(w),
        setChange(uuid(), w, { exercise_name: "bench press", exercise_id: 1712345678901 }), // temporary client id
        setChange(uuid(), w, { exercise_name: "Cable Fly", muscle_group: "Chest", set_order: 2 }),
    ]);
    assert.deepEqual(res.body.results.map((r) => r.status), ["ok", "ok", "ok"]);
    const bench = await t.pool.query(`SELECT id FROM exercises WHERE LOWER(name) = 'bench press'`);
    assert.equal(bench.rows.length, 1, "matched case-insensitively, no duplicate");
    const fly = await t.pool.query(`SELECT muscle_group FROM exercises WHERE name = 'Cable Fly'`);
    assert.equal(fly.rows[0].muscle_group, "Chest");

    const { rows } = await pullAll(userA);
    const sets = rows.workout_sets.filter((r) => r.workout_uuid === w);
    assert.deepEqual(sets.map((r) => r.exercise_name).sort(), ["Bench Press", "Cable Fly"]);
    assert.equal(typeof sets[0].weight, "number");
});

test("a valid client exercise id is kept even when another exercise has the same name", async () => {
    const dup = await t.pool.query(`INSERT INTO exercises (name, muscle_group) VALUES ('Bench Press', 'Chest') RETURNING id`);
    const w = uuid();
    const s = uuid();
    await push(userA, [workoutChange(w), setChange(s, w, { exercise_id: dup.rows[0].id, exercise_name: "Bench Press" })]);
    const row = await t.pool.query(`SELECT exercise_id FROM workout_sets WHERE uuid = $1`, [s]);
    assert.equal(row.rows[0].exercise_id, dup.rows[0].id);
});

test("pull pages cover every row exactly once", async () => {
    const pageUser = await t.createUser("Pages");
    const ids = [];
    const changes = [];
    for (let i = 0; i < 7; i++) {
        const w = uuid();
        ids.push(w);
        changes.push(workoutChange(w, { name: `W${i}` }));
        changes.push(setChange(uuid(), w));
    }
    await push(pageUser, changes); // one transaction → identical updated_at, exercising the tie-break

    const { rows, pages } = await pullAll(pageUser, null, 3);
    assert.equal(pages.length, 5, "14 rows in pages of 3");
    assert.ok(pages.slice(0, -1).every((p) => p.has_more && p.next_cursor));
    const workouts = rows.workouts.map((r) => r.uuid);
    assert.equal(workouts.length, 7, "no duplicates across pages");
    assert.deepEqual([...workouts].sort(), [...ids].sort());
    assert.equal(rows.workout_sets.length, 7);
    assert.equal(new Set(rows.workout_sets.map((r) => r.uuid)).size, 7);

    // Parents come before their children at the same instant
    const order = pages.flatMap((p) => Object.keys(p.changes));
    assert.equal(order[0], "workouts");

    // Pulling again from the returned `since` only re-reads the 5 s overlap
    const final = pages[pages.length - 1];
    assert.ok(final.since);
    const again = await t.api(pageUser, "GET", `/sync/pull?since=${encodeURIComponent(final.since)}`);
    assert.equal(again.status, 200);
    const later = await t.api(pageUser, "GET", `/sync/pull?since=${encodeURIComponent(new Date(Date.now() + 60000).toISOString())}`);
    assert.deepEqual(later.body.changes, {});
    assert.equal(later.body.has_more, false);
});

test("a cursor older than the tombstone retention asks for a full resync", async () => {
    const old = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    const res = await t.api(userA, "GET", `/sync/pull?since=${encodeURIComponent(old)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.resync_required, true);

    const fresh = await t.api(userA, "GET", `/sync/pull?since=${encodeURIComponent(new Date().toISOString())}`);
    assert.equal(fresh.status, 200);
    assert.equal(fresh.body.resync_required, undefined);
});

test("pull and push validate their input", async () => {
    assert.equal((await t.api(userA, "GET", "/sync/pull?since=not-a-date")).status, 400);
    assert.equal((await t.api(userA, "GET", "/sync/pull?after=garbage")).status, 400);

    assert.equal((await t.api(userA, "POST", "/sync/push", { changes: [] })).status, 400);
    const tooMany = Array.from({ length: 101 }, () => workoutChange(uuid()));
    assert.equal((await t.api(userA, "POST", "/sync/push", { changes: tooMany })).status, 400);

    const res = await push(userA, [
        { tbl: "users", op: "upsert", uuid: uuid(), payload: {} },
        { tbl: "workouts", op: "upsert", uuid: "not-a-uuid", payload: { name: "x" } },
        { tbl: "workouts", op: "upsert", uuid: uuid(), payload: {} },
        { tbl: "workouts", op: "merge", uuid: uuid(), payload: { name: "x" } },
        { tbl: "workout_sets", op: "upsert", uuid: uuid(), payload: { exercise_name: "Squat", set_order: 1, reps: 1, weight: 1 } },
        { tbl: "prs", op: "upsert", uuid: uuid(), payload: { weight: 100 } },
        { tbl: "workouts", op: "upsert", uuid: uuid(), payload: { name: "x", created_at: "yesterday-ish" } },
        null,
    ]);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.results.map((r) => r.status), Array(8).fill("error"));

    const noAuth = await fetch(`${t.baseUrl}/sync/pull`);
    assert.equal(noAuth.status, 401);
});
