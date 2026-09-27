const pool = require("../config/db");
const { TOMBSTONE_RETENTION_DAYS } = require("../config/sync");
// Rows committed out of order can carry an updated_at slightly older than the
// newest row a client has seen; re-reading this window covers them.
const PULL_OVERLAP_SECONDS = 5;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Table definitions ────────────────────────────────────────────────────────
// fields: payload key → validator. Parents are owned via user_id; children via
// their parent row. `stamp` is the user-facing time the client may supply
// (e.g. when a workout was performed offline); updated_at is always server time.

const str = (max, { required = false, fallback } = {}) => (v) => {
    if (v === undefined || v === null || v === "") {
        if (required) throw new Error("is required");
        return fallback ?? null;
    }
    if (typeof v !== "string") throw new Error("must be a string");
    if (v.length > max) throw new Error(`must be at most ${max} characters`);
    return v;
};
const num = ({ required = false, fallback = null, integer = false } = {}) => (v) => {
    if (v === undefined || v === null || v === "") {
        if (required) throw new Error("is required");
        return fallback;
    }
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error("must be a number");
    return integer ? Math.round(n) : n;
};

const TABLES = {
    workouts: {
        kind: "parent",
        stamp: "created_at",
        fields: {
            name: str(255, { required: true }),
            notes: str(10000),
            status: str(20, { fallback: "completed" }),
        },
    },
    routines: {
        kind: "parent",
        stamp: "created_at",
        fields: {
            name: str(255, { required: true }),
        },
    },
    prs: {
        kind: "parent",
        stamp: "achieved_at",
        exercise: true,
        fields: {
            weight: num({ required: true }),
        },
    },
    body_metrics: {
        kind: "parent",
        stamp: "logged_at",
        fields: {
            training_years: num(),
            weight: num({ required: true }),
            height: str(50, { fallback: "Not Selected" }),
            body_fat: num(),
            gender: str(10, { fallback: "male" }),
        },
    },
    workout_sets: {
        kind: "child",
        parent: "workouts",
        fk: "workout_id",
        exercise: true,
        fields: {
            set_order: num({ required: true, integer: true }),
            reps: num({ required: true, integer: true }),
            weight: num({ required: true }),
            rir: num({ integer: true }),
        },
    },
    routine_exercises: {
        kind: "child",
        parent: "routines",
        fk: "routine_id",
        exercise: true,
        fields: {
            exercise_order: num({ required: true, integer: true }),
            sets: num({ fallback: 3, integer: true }),
            reps: num({ fallback: 10, integer: true }),
            weight: num({ fallback: 0 }),
            rir: num({ fallback: 0, integer: true }),
        },
    },
};

// Pull order within one updated_at instant: parents before their children
const TABLE_RANK = { workouts: 1, routines: 2, prs: 3, body_metrics: 4, workout_sets: 5, routine_exercises: 6 };

class ChangeError extends Error {}

// ── Pull ─────────────────────────────────────────────────────────────────────

// Timestamps: created_at & co. are `timestamp without time zone` holding UTC,
// so they are tagged as UTC before going out. updated_at/deleted_at are timestamptz.
const utc = (col) => `(${col} AT TIME ZONE 'UTC')`;

const PULL_SELECTS = {
    workouts: `
        SELECT 'workouts' AS tbl, ${TABLE_RANK.workouts} AS rank, t.id, t.updated_at,
               jsonb_build_object(
                   'uuid', t.uuid, 'id', t.id, 'name', t.name, 'notes', t.notes, 'status', t.status,
                   'created_at', ${utc("t.created_at")}, 'updated_at', t.updated_at, 'deleted_at', t.deleted_at
               ) AS row
          FROM workouts t
         WHERE t.user_id = $1`,
    routines: `
        SELECT 'routines' AS tbl, ${TABLE_RANK.routines} AS rank, t.id, t.updated_at,
               jsonb_build_object(
                   'uuid', t.uuid, 'id', t.id, 'name', t.name,
                   'created_at', ${utc("t.created_at")}, 'updated_at', t.updated_at, 'deleted_at', t.deleted_at
               ) AS row
          FROM routines t
         WHERE t.user_id = $1`,
    prs: `
        SELECT 'prs' AS tbl, ${TABLE_RANK.prs} AS rank, t.id, t.updated_at,
               jsonb_build_object(
                   'uuid', t.uuid, 'id', t.id, 'exercise_id', t.exercise_id, 'exercise_name', e.name,
                   'muscle_group', e.muscle_group, 'weight', t.weight::float8,
                   'achieved_at', ${utc("t.achieved_at")}, 'updated_at', t.updated_at, 'deleted_at', t.deleted_at
               ) AS row
          FROM prs t
          LEFT JOIN exercises e ON e.id = t.exercise_id
         WHERE t.user_id = $1`,
    body_metrics: `
        SELECT 'body_metrics' AS tbl, ${TABLE_RANK.body_metrics} AS rank, t.id, t.updated_at,
               jsonb_build_object(
                   'uuid', t.uuid, 'id', t.id, 'training_years', t.training_years::float8,
                   'weight', t.weight::float8, 'height', t.height, 'body_fat', t.body_fat::float8,
                   'gender', t.gender, 'logged_at', ${utc("t.logged_at")},
                   'updated_at', t.updated_at, 'deleted_at', t.deleted_at
               ) AS row
          FROM body_metrics t
         WHERE t.user_id = $1`,
    workout_sets: `
        SELECT 'workout_sets' AS tbl, ${TABLE_RANK.workout_sets} AS rank, t.id, t.updated_at,
               jsonb_build_object(
                   'uuid', t.uuid, 'id', t.id, 'workout_uuid', p.uuid,
                   'exercise_id', t.exercise_id, 'exercise_name', e.name, 'muscle_group', e.muscle_group,
                   'set_order', t.set_order, 'reps', t.reps, 'weight', t.weight::float8, 'rir', t.rir,
                   'updated_at', t.updated_at, 'deleted_at', t.deleted_at
               ) AS row
          FROM workout_sets t
          JOIN workouts p ON p.id = t.workout_id
          LEFT JOIN exercises e ON e.id = t.exercise_id
         WHERE p.user_id = $1`,
    routine_exercises: `
        SELECT 'routine_exercises' AS tbl, ${TABLE_RANK.routine_exercises} AS rank, t.id, t.updated_at,
               jsonb_build_object(
                   'uuid', t.uuid, 'id', t.id, 'routine_uuid', p.uuid,
                   'exercise_id', t.exercise_id, 'exercise_name', e.name, 'muscle_group', e.muscle_group,
                   'exercise_order', t.exercise_order, 'sets', t.sets, 'reps', t.reps,
                   'weight', t.weight::float8, 'rir', t.rir,
                   'updated_at', t.updated_at, 'deleted_at', t.deleted_at
               ) AS row
          FROM routine_exercises t
          JOIN routines p ON p.id = t.routine_id
          LEFT JOIN exercises e ON e.id = t.exercise_id
         WHERE p.user_id = $1`,
};

/**
 * Keyset position in the change stream, ordered by (updated_at, rank, id).
 * Opaque to clients: base64 of "<updated_at µs ISO>|<rank>|<id>".
 */
function encodeCursor(ts, rank, id) {
    return Buffer.from(`${ts}|${rank}|${id}`).toString("base64url");
}

function decodeCursor(cursor) {
    const parts = Buffer.from(String(cursor), "base64url").toString("utf8").split("|");
    const [ts, rank, id] = parts;
    if (parts.length !== 3 || Number.isNaN(Date.parse(ts)) || !/^\d+$/.test(rank) || !/^\d+$/.test(id)) {
        throw new ChangeError("Invalid cursor");
    }
    return { ts, rank: Number(rank), id: Number(id) };
}

/**
 * Parse the `since` a client stored after its last complete pull: an ISO
 * timestamp (as returned in `since`), epoch milliseconds, or 0/empty for a full pull.
 */
function parseSince(since) {
    if (since === undefined || since === null || since === "" || since === "0") return null;
    const date = /^\d+$/.test(String(since)) ? new Date(Number(since)) : new Date(String(since));
    if (Number.isNaN(date.getTime())) throw new ChangeError("Invalid since");
    return date.getTime() === 0 ? null : date;
}

/**
 * Rows of every synced table changed after a point, tombstones included.
 * Either `since` (start of a sync; re-reads a 5 s overlap) or `after` (the
 * next_cursor of the previous page) positions the read.
 */
async function pullChanges(userId, { since, after, limit }) {
    let from; // { ts, rank, id } — rows strictly after this position
    let sinceDate = null;

    if (after) {
        from = decodeCursor(after);
    } else {
        sinceDate = parseSince(since);
        if (sinceDate) {
            const retentionStart = Date.now() - TOMBSTONE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
            if (sinceDate.getTime() < retentionStart) {
                // Tombstones this client never saw may already be purged
                return { changes: {}, has_more: false, next_cursor: null, since: null, resync_required: true };
            }
            const start = new Date(sinceDate.getTime() - PULL_OVERLAP_SECONDS * 1000);
            from = { ts: start.toISOString(), rank: 0, id: 0 };
        } else {
            from = { ts: "-infinity", rank: 0, id: 0 };
        }
    }

    // Each branch is index-friendly on updated_at and capped at limit + 1, so
    // the page never scans more than it returns; the extra row signals has_more.
    const keyset = `
           AND t.updated_at >= $2::timestamptz
           AND (t.updated_at > $2::timestamptz OR RANK_ > $3::int OR (RANK_ = $3::int AND t.id > $4::int))
         ORDER BY t.updated_at, t.id
         LIMIT $5`;
    const branches = Object.entries(PULL_SELECTS)
        .map(([tbl, select]) => `(${select}${keyset.replace(/RANK_/g, String(TABLE_RANK[tbl]))})`)
        .join("\n UNION ALL \n");

    const { rows } = await pool.query(
        `SELECT tbl, rank, id,
                to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ts,
                row
           FROM (${branches}) page
          ORDER BY updated_at, rank, id
          LIMIT $5`,
        [userId, from.ts, from.rank, from.id, limit + 1]
    );

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const changes = {};
    for (const r of pageRows) {
        (changes[r.tbl] ||= []).push(r.row);
    }

    const last = pageRows[pageRows.length - 1];
    const echoSince = sinceDate ? sinceDate.toISOString() : (after ? from.ts : null);
    return {
        changes,
        has_more: hasMore,
        next_cursor: last ? encodeCursor(last.ts, last.rank, last.id) : (after || null),
        // Store this once has_more is false and send it as `since` next time
        since: last ? last.ts : echoSince,
    };
}

// ── Push ─────────────────────────────────────────────────────────────────────

function validateChange(change) {
    if (!change || typeof change !== "object") throw new ChangeError("Change must be an object");
    const { tbl, op, uuid, parent_uuid: parentUuid, payload } = change;
    const def = TABLES[tbl];
    if (!def) throw new ChangeError(`Unknown table: ${tbl}`);
    if (op !== "upsert" && op !== "delete") throw new ChangeError(`Unknown op: ${op}`);
    if (typeof uuid !== "string" || !UUID_RE.test(uuid)) throw new ChangeError("Invalid uuid");
    if (op === "delete") return { def, tbl, op, uuid };

    if (!payload || typeof payload !== "object") throw new ChangeError("payload is required");
    if (def.kind === "child" && (typeof parentUuid !== "string" || !UUID_RE.test(parentUuid))) {
        throw new ChangeError("Invalid parent_uuid");
    }

    const values = {};
    for (const [field, check] of Object.entries(def.fields)) {
        try {
            values[field] = check(payload[field]);
        } catch (e) {
            throw new ChangeError(`${field} ${e.message}`);
        }
    }

    let stamp = null;
    if (def.stamp && payload[def.stamp] !== undefined && payload[def.stamp] !== null) {
        const d = new Date(payload[def.stamp]);
        if (Number.isNaN(d.getTime())) throw new ChangeError(`${def.stamp} must be a timestamp`);
        stamp = d.toISOString();
    }

    let exercise = null;
    if (def.exercise) {
        const name = typeof payload.exercise_name === "string" ? payload.exercise_name.trim() : "";
        if (!name || name.length > 255) throw new ChangeError("exercise_name is required");
        exercise = {
            name,
            // Offline-created exercises carry a temporary client id (e.g. Date.now())
            id: Number.isInteger(payload.exercise_id) && payload.exercise_id > 0 && payload.exercise_id <= 2147483647
                ? payload.exercise_id
                : null,
            muscleGroup: typeof payload.muscle_group === "string" && payload.muscle_group ? payload.muscle_group.slice(0, 255) : null,
        };
    }

    return { def, tbl, op, uuid, parentUuid, values, stamp, exercise };
}

/**
 * Exercises are shared across users and identified by name. The client's
 * integer id is kept only when it really is that exercise; otherwise the name
 * resolves it, inserting it if unknown (same as logPR).
 */
async function resolveExercise(client, { id, name, muscleGroup }) {
    if (id !== null) {
        const byId = await client.query(
            `SELECT id FROM exercises WHERE id = $1 AND LOWER(name) = LOWER($2)`,
            [id, name]
        );
        if (byId.rows[0]) return byId.rows[0].id;
    }
    const byName = await client.query(
        `SELECT id FROM exercises WHERE LOWER(name) = LOWER($1) ORDER BY id LIMIT 1`,
        [name]
    );
    if (byName.rows[0]) return byName.rows[0].id;
    const inserted = await client.query(
        `INSERT INTO exercises (name, muscle_group) VALUES ($1, $2) RETURNING id`,
        [name, muscleGroup || "other"]
    );
    return inserted.rows[0].id;
}

/** Explain an upsert/delete that matched no row: another user's row → error; tombstoned → no-op. */
async function explainMiss(client, userId, c) {
    const { def, tbl, uuid } = c;
    const { rows } = def.kind === "parent"
        ? await client.query(`SELECT user_id, deleted_at FROM ${tbl} WHERE uuid = $1`, [uuid])
        : await client.query(
            `SELECT p.user_id, t.deleted_at FROM ${tbl} t JOIN ${def.parent} p ON p.id = t.${def.fk} WHERE t.uuid = $1`,
            [uuid]
        );
    const existing = rows[0];
    if (!existing) return { status: "ok" }; // delete of a row the server never had
    if (existing.user_id !== userId) throw new ChangeError("Forbidden");
    if (existing.deleted_at) return { status: "ok", skipped: "deleted" }; // deletes win over edits
    return { status: "ok" };
}

async function applyUpsert(client, userId, c) {
    const { def, tbl, uuid, values, stamp, exercise } = c;

    const cols = ["uuid"];
    const params = [uuid];
    const placeholders = ["$1"];
    const add = (col, value, cast = "") => {
        params.push(value);
        cols.push(col);
        placeholders.push(`$${params.length}${cast}`);
    };

    let ownerCheck;
    if (def.kind === "parent") {
        add("user_id", userId);
        ownerCheck = `${tbl}.user_id = EXCLUDED.user_id`;
    } else {
        const parent = await client.query(
            `SELECT id, user_id, deleted_at FROM ${def.parent} WHERE uuid = $1`,
            [c.parentUuid]
        );
        const p = parent.rows[0];
        if (!p || p.user_id !== userId) throw new ChangeError("Parent not found");
        if (p.deleted_at) return { status: "ok", skipped: "parent_deleted" };
        add(def.fk, p.id);
        params.push(userId);
        ownerCheck = `${tbl}.${def.fk} IN (SELECT id FROM ${def.parent} WHERE user_id = $${params.length})`;
    }

    if (exercise) add("exercise_id", await resolveExercise(client, exercise));
    for (const [field, value] of Object.entries(values)) add(field, value);

    const updates = cols
        .filter((col) => col !== "uuid" && col !== "user_id")
        .map((col) => `${col} = EXCLUDED.${col}`);

    if (def.stamp) {
        // Omitted on an edit → keep the original time; omitted on insert → now
        params.push(stamp);
        const p = `$${params.length}::timestamptz`;
        cols.push(def.stamp);
        placeholders.push(`COALESCE(${p}, now()) AT TIME ZONE 'UTC'`);
        updates.push(`${def.stamp} = COALESCE(${p} AT TIME ZONE 'UTC', ${tbl}.${def.stamp})`);
    }

    // Values list may skip parameter numbers used only in the WHERE clause
    const result = await client.query(
        `INSERT INTO ${tbl} (${cols.join(", ")})
         VALUES (${placeholders.join(", ")})
         ON CONFLICT (uuid) DO UPDATE SET ${updates.join(", ")}
         WHERE ${ownerCheck} AND ${tbl}.deleted_at IS NULL
         RETURNING id`,
        params
    );
    if (result.rowCount === 1) return { status: "ok" };
    return explainMiss(client, userId, c);
}

async function applyDelete(client, userId, c) {
    const { def, tbl, uuid } = c;
    const result = def.kind === "parent"
        ? await client.query(
            `UPDATE ${tbl} SET deleted_at = now()
             WHERE uuid = $1 AND user_id = $2 AND deleted_at IS NULL`,
            [uuid, userId]
        )
        : await client.query(
            `UPDATE ${tbl} t SET deleted_at = now()
               FROM ${def.parent} p
              WHERE t.uuid = $1 AND p.id = t.${def.fk} AND p.user_id = $2 AND t.deleted_at IS NULL`,
            [uuid, userId]
        );
    if (result.rowCount === 1) return { status: "ok" };
    return explainMiss(client, userId, c);
}

/**
 * Apply a batch of client changes in order, in one transaction. Each change
 * runs in its own savepoint, so a bad row fails alone and the rest commit.
 * Upserts are keyed by uuid, so replaying a batch is harmless.
 */
async function pushChanges(userId, changes) {
    const client = await pool.connect();
    const results = [];
    try {
        await client.query("BEGIN");
        for (const raw of changes) {
            const uuid = raw && typeof raw.uuid === "string" ? raw.uuid : null;
            await client.query("SAVEPOINT change");
            try {
                const c = validateChange(raw);
                const outcome = c.op === "upsert"
                    ? await applyUpsert(client, userId, c)
                    : await applyDelete(client, userId, c);
                await client.query("RELEASE SAVEPOINT change");
                results.push({ uuid, ...outcome });
            } catch (err) {
                await client.query("ROLLBACK TO SAVEPOINT change");
                if (!(err instanceof ChangeError)) {
                    console.error("[sync/push] change failed:", err.message);
                }
                results.push({
                    uuid,
                    status: "error",
                    error: err instanceof ChangeError ? err.message : "Server error applying change",
                });
            }
        }
        await client.query("COMMIT");
        return results;
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    pullChanges,
    pushChanges,
    ChangeError,
    SYNCED_TABLES: Object.keys(TABLES),
};
