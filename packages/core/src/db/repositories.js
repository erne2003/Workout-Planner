/**
 * Repository layer over the local database.
 *
 * Every write runs in one transaction that updates the row(s), appends one
 * outbox entry per row written, and announces the change (see events.js).
 * The outbox is what the sync engine pushes to POST /sync/push.
 *
 * Reads return the same shapes as the REST API (GET /workouts, /routines,
 * /prs, /metrics) so screens can switch over unchanged — except that `id` is
 * the row's uuid.
 */
import { getDatabase, newUuid } from "./database.js";
import { SYNCED_TABLES } from "./schema.js";

/** An outbox entry that has failed this many times is parked until retried. */
export const MAX_PUSH_ATTEMPTS = 5;

const nowIso = () => new Date().toISOString();

/**
 * Synced tables. `fields` are the columns a client writes, named as
 * /sync/push expects them in `payload`. Children also carry their parent's
 * uuid in `parentKey`.
 */
export const TABLE_DEFS = {
  workouts: {
    fields: ["name", "notes", "status", "created_at"],
    required: ["name"],
    defaults: () => ({ status: "completed", created_at: nowIso() }),
    child: "workout_sets",
  },
  workout_sets: {
    parent: "workouts",
    parentKey: "workout_uuid",
    fields: ["exercise_id", "exercise_name", "muscle_group", "set_order", "reps", "weight", "rir"],
    required: ["exercise_name", "set_order", "reps", "weight"],
  },
  routines: {
    fields: ["name", "created_at"],
    required: ["name"],
    defaults: () => ({ created_at: nowIso() }),
    child: "routine_exercises",
  },
  routine_exercises: {
    parent: "routines",
    parentKey: "routine_uuid",
    fields: ["exercise_id", "exercise_name", "muscle_group", "exercise_order", "sets", "reps", "weight", "rir"],
    required: ["exercise_name", "exercise_order"],
    defaults: () => ({ sets: 3, reps: 10, weight: 0, rir: 0 }),
  },
  prs: {
    fields: ["exercise_id", "exercise_name", "muscle_group", "weight", "achieved_at"],
    required: ["exercise_name", "weight"],
    defaults: () => ({ achieved_at: nowIso() }),
  },
  body_metrics: {
    fields: ["training_years", "weight", "height", "body_fat", "gender", "logged_at"],
    required: ["weight"],
    defaults: () => ({ gender: "male", logged_at: nowIso() }),
  },
};

const NUMERIC_FIELDS = new Set([
  "set_order", "reps", "weight", "rir", "exercise_order", "sets", "training_years", "body_fat",
]);

function normalize(field, value) {
  if (value === undefined || value === null) return value;
  if (NUMERIC_FIELDS.has(field)) {
    if (value === "") return null;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`${field} must be a number`);
    return n;
  }
  if (field === "exercise_id") {
    // Server ids are integers; anything else (a temporary client id) passes through
    const n = Number(value);
    return Number.isInteger(n) ? n : value;
  }
  return value;
}

/** The writable fields present in `values`, normalized. */
function pick(def, values) {
  const out = {};
  for (const field of def.fields) {
    if (values[field] !== undefined) out[field] = normalize(field, values[field]);
  }
  return out;
}

function validate(table, def, row) {
  for (const field of def.required) {
    const v = row[field];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
      throw new Error(`${table}.${field} is required`);
    }
  }
}

async function enqueue(tx, table, op, uuid, parentUuid, payload) {
  await tx.run(
    `INSERT INTO outbox (tbl, op, uuid, parent_uuid, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [table, op, uuid, parentUuid ?? null, payload ? JSON.stringify(payload) : null, nowIso()]
  );
  tx.touch("outbox");
}

// ── Transaction-level writes (each: row + one outbox entry) ─────────────────

async function createIn(tx, table, values) {
  const def = TABLE_DEFS[table];
  const row = { ...(def.defaults ? def.defaults() : {}), ...pick(def, values) };
  validate(table, def, row);

  const uuid = values.uuid || newUuid();
  const parentUuid = def.parent ? values[def.parentKey] : null;
  if (def.parent && !parentUuid) throw new Error(`${table}.${def.parentKey} is required`);

  const record = { uuid, ...(def.parent ? { [def.parentKey]: parentUuid } : {}), ...row };
  const cols = Object.keys(record);
  await tx.run(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
    cols.map((c) => record[c])
  );
  await enqueue(tx, table, "upsert", uuid, parentUuid, row);
  tx.touch(table);
  return uuid;
}

async function updateIn(tx, table, uuid, patch) {
  const def = TABLE_DEFS[table];
  const current = await tx.first(`SELECT * FROM ${table} WHERE uuid = ?`, [uuid]);
  if (!current) throw new Error(`${table} ${uuid} not found`);

  const changes = pick(def, patch);
  const next = { ...pick(def, current), ...changes };
  validate(table, def, next);

  const cols = Object.keys(changes);
  if (cols.length > 0) {
    await tx.run(
      `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE uuid = ?`,
      [...cols.map((c) => changes[c]), uuid]
    );
  }
  // The payload is the whole row, so the server copy converges on this state
  await enqueue(tx, table, "upsert", uuid, def.parent ? current[def.parentKey] : null, next);
  tx.touch(table);
}

async function removeIn(tx, table, uuid) {
  const def = TABLE_DEFS[table];
  const current = await tx.first(`SELECT * FROM ${table} WHERE uuid = ?`, [uuid]);
  if (!current) return false;

  await tx.run(`DELETE FROM ${table} WHERE uuid = ?`, [uuid]);
  if (def.child) {
    // The server tombstones the children itself when their parent is deleted
    await tx.run(`DELETE FROM ${def.child} WHERE ${TABLE_DEFS[def.child].parentKey} = ?`, [uuid]);
    tx.touch(def.child);
  }
  await enqueue(tx, table, "delete", uuid, def.parent ? current[def.parentKey] : null, null);
  tx.touch(table);
  return true;
}

const write = (fn) => getDatabase().then((db) => db.transaction(fn));
const read = (fn) => getDatabase().then((db) => db.read(fn));

// ── Read shapes (match the REST API) ─────────────────────────────────────────

const setShape = (s) => ({
  id: s.uuid,
  uuid: s.uuid,
  server_id: s.server_id,
  workout_id: s.workout_uuid,
  exercise_id: s.exercise_id,
  set_order: s.set_order,
  reps: s.reps,
  weight: s.weight,
  rir: s.rir,
  exercise_name: s.exercise_name,
  muscle_group: s.muscle_group,
  name: s.exercise_name, // REST compatibility
});

const routineExerciseShape = (re) => ({
  id: re.uuid,
  uuid: re.uuid,
  server_id: re.server_id,
  routine_id: re.routine_uuid,
  exercise_id: re.exercise_id,
  exercise_order: re.exercise_order,
  sets: re.sets,
  reps: re.reps,
  weight: re.weight,
  rir: re.rir,
  name: re.exercise_name,
  exercise_name: re.exercise_name,
  muscle_group: re.muscle_group,
});

async function listWorkoutsIn(conn) {
  const rows = await conn.all(`SELECT * FROM workouts ORDER BY created_at DESC, rowid DESC`);
  const sets = await conn.all(`SELECT * FROM workout_sets ORDER BY set_order ASC, rowid ASC`);
  const byWorkout = new Map(rows.map((w) => [w.uuid, []]));
  for (const s of sets) byWorkout.get(s.workout_uuid)?.push(setShape(s)); // orphans wait for their parent
  return rows.map((w) => ({
    id: w.uuid,
    uuid: w.uuid,
    server_id: w.server_id,
    name: w.name,
    notes: w.notes,
    status: w.status,
    created_at: w.created_at,
    sets: byWorkout.get(w.uuid),
  }));
}

async function listRoutinesIn(conn) {
  const rows = await conn.all(`SELECT * FROM routines ORDER BY created_at DESC, rowid DESC`);
  const exercises = await conn.all(`SELECT * FROM routine_exercises ORDER BY exercise_order ASC, rowid ASC`);
  const byRoutine = new Map(rows.map((r) => [r.uuid, []]));
  for (const re of exercises) byRoutine.get(re.routine_uuid)?.push(routineExerciseShape(re));
  return rows.map((r) => ({
    id: r.uuid,
    uuid: r.uuid,
    server_id: r.server_id,
    name: r.name,
    created_at: r.created_at,
    exercises: byRoutine.get(r.uuid),
  }));
}

const prShape = (p) => ({
  id: p.uuid,
  uuid: p.uuid,
  server_id: p.server_id,
  exercise_id: p.exercise_id,
  exercise_name: p.exercise_name,
  muscle_group: p.muscle_group,
  weight: p.weight,
  achieved_at: p.achieved_at,
});

const metricShape = (m) => ({
  id: m.uuid,
  uuid: m.uuid,
  server_id: m.server_id,
  training_years: m.training_years,
  weight: m.weight,
  height: m.height,
  body_fat: m.body_fat,
  gender: m.gender,
  logged_at: m.logged_at,
});

// ── Repositories ─────────────────────────────────────────────────────────────

export const workouts = {
  /** All workouts, newest first, each with its sets in order. */
  list: () => read(listWorkoutsIn),

  /** Create a workout and its sets. Returns the workout uuid. */
  create: ({ sets = [], ...workout }) =>
    write(async (tx) => {
      const uuid = await createIn(tx, "workouts", workout);
      for (const set of sets) {
        await createIn(tx, "workout_sets", { ...set, workout_uuid: uuid });
      }
      return uuid;
    }),

  update: (uuid, patch) => write((tx) => updateIn(tx, "workouts", uuid, patch)),

  /** Delete a workout and its sets. Resolves false if it didn't exist. */
  remove: (uuid) => write((tx) => removeIn(tx, "workouts", uuid)),

  /** Sets from the most recent workout that includes this exercise (the "previous" hints). */
  lastSetsForExercise: (exerciseId) =>
    read((conn) =>
      conn.all(
        `SELECT s.set_order, s.reps, s.weight, s.rir
           FROM workout_sets s
          WHERE s.exercise_id = ?
            AND s.workout_uuid = (
                SELECT w.uuid FROM workouts w
                  JOIN workout_sets s2 ON s2.workout_uuid = w.uuid
                 WHERE s2.exercise_id = ?
                 ORDER BY w.created_at DESC, w.rowid DESC
                 LIMIT 1)
          ORDER BY s.set_order ASC`,
        [exerciseId, exerciseId]
      )
    ),
};

export const workoutSets = {
  create: (workoutUuid, set) => write((tx) => createIn(tx, "workout_sets", { ...set, workout_uuid: workoutUuid })),
  update: (uuid, patch) => write((tx) => updateIn(tx, "workout_sets", uuid, patch)),
  remove: (uuid) => write((tx) => removeIn(tx, "workout_sets", uuid)),
};

export const routines = {
  /** All routines, newest first, each with its exercises in order. */
  list: () => read(listRoutinesIn),

  /** Create a routine with its exercises (ordered as given). Returns the routine uuid. */
  create: ({ exercises = [], ...routine }) =>
    write(async (tx) => {
      const uuid = await createIn(tx, "routines", routine);
      for (let i = 0; i < exercises.length; i++) {
        await createIn(tx, "routine_exercises", { ...exercises[i], exercise_order: i, routine_uuid: uuid });
      }
      return uuid;
    }),

  /** Rename and/or replace the exercise list (like PUT /routines/:id). */
  update: (uuid, { exercises, ...patch }) =>
    write(async (tx) => {
      await updateIn(tx, "routines", uuid, patch);
      if (exercises) {
        const existing = await tx.all(`SELECT uuid FROM routine_exercises WHERE routine_uuid = ?`, [uuid]);
        for (const child of existing) await removeIn(tx, "routine_exercises", child.uuid);
        for (let i = 0; i < exercises.length; i++) {
          await createIn(tx, "routine_exercises", { ...exercises[i], uuid: undefined, exercise_order: i, routine_uuid: uuid });
        }
      }
    }),

  remove: (uuid) => write((tx) => removeIn(tx, "routines", uuid)),

  /**
   * One routine by its uuid or its server id (a workout started before the
   * offline-first upgrade still refers to the routine by server id).
   */
  find: async (id) => {
    if (id === null || id === undefined) return null;
    const all = await read(listRoutinesIn);
    return all.find((r) => r.uuid === id || (r.server_id != null && String(r.server_id) === String(id))) || null;
  },
};

export const prs = {
  /** All PRs, oldest first (like GET /prs). */
  list: () => read(async (conn) => (await conn.all(`SELECT * FROM prs ORDER BY achieved_at ASC, rowid ASC`)).map(prShape)),
  create: (pr) => write((tx) => createIn(tx, "prs", pr)),
  remove: (uuid) => write((tx) => removeIn(tx, "prs", uuid)),
};

export const bodyMetrics = {
  /** All snapshots, oldest first (like GET /metrics). */
  list: () => read(async (conn) => (await conn.all(`SELECT * FROM body_metrics ORDER BY logged_at ASC, rowid ASC`)).map(metricShape)),
  latest: () => read(async (conn) => {
    const row = await conn.first(`SELECT * FROM body_metrics ORDER BY logged_at DESC, rowid DESC LIMIT 1`);
    return row ? metricShape(row) : null;
  }),
  create: (metric) => write((tx) => createIn(tx, "body_metrics", metric)),
  remove: (uuid) => write((tx) => removeIn(tx, "body_metrics", uuid)),

  /**
   * Log a snapshot like POST /metrics: when trainingYears, height or gender is
   * left undefined, the missing fields (and bodyFat) carry forward from the
   * latest snapshot. Reading it and writing the new one is one transaction.
   */
  log: ({ weight, height, trainingYears, bodyFat, gender }) =>
    write(async (tx) => {
      let carried = { trainingYears, height, bodyFat, gender };
      if (trainingYears === undefined || height === undefined || gender === undefined) {
        const latest = await tx.first(`SELECT * FROM body_metrics ORDER BY logged_at DESC, rowid DESC LIMIT 1`);
        carried = {
          trainingYears: trainingYears ?? latest?.training_years ?? 0,
          height: height ?? latest?.height ?? "Not Selected",
          gender: gender ?? latest?.gender ?? "male",
          bodyFat: bodyFat === undefined ? latest?.body_fat ?? null : bodyFat,
        };
      }
      return createIn(tx, "body_metrics", {
        weight,
        height: carried.height,
        training_years: carried.trainingYears || null,
        body_fat: carried.bodyFat || null,
        gender: carried.gender || "male",
      });
    }),
};

// ── Exercise catalogue cache (shared across users, not synced) ───────────────

const likePattern = (q) => `%${String(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export const exerciseCache = {
  /** Remember exercises seen from the API ({ id, name, muscle_group | muscle }). */
  upsertMany: (list) =>
    getDatabase().then((db) =>
      db.transaction(async (tx) => {
        for (const ex of list || []) {
          const id = Number(ex?.id);
          if (!Number.isInteger(id) || id <= 0 || !ex.name) continue;
          await tx.run(
            `INSERT INTO exercises (id, name, muscle_group) VALUES (?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET name = excluded.name, muscle_group = excluded.muscle_group`,
            [id, ex.name, ex.muscle_group ?? ex.muscle ?? null]
          );
        }
        tx.touch("exercises");
      }, { source: "sync" })
    ),

  /**
   * Offline search by name: the cached catalogue plus every exercise in the
   * user's own history, one row per name.
   */
  search: (query, limit = 25) =>
    read(async (conn) => {
      const p = likePattern(query);
      // With MIN(pri) selected, SQLite takes the other columns from that row,
      // so a catalogue entry wins over the same name from history
      const rows = await conn.all(
        `SELECT id, name, muscle_group, MIN(pri) AS pri FROM (
             SELECT id, name, muscle_group, 0 AS pri FROM exercises WHERE name LIKE ? ESCAPE '\\'
             UNION ALL
             SELECT exercise_id, exercise_name, muscle_group, 1 FROM workout_sets WHERE exercise_name LIKE ? ESCAPE '\\'
             UNION ALL
             SELECT exercise_id, exercise_name, muscle_group, 1 FROM routine_exercises WHERE exercise_name LIKE ? ESCAPE '\\'
             UNION ALL
             SELECT exercise_id, exercise_name, muscle_group, 1 FROM prs WHERE exercise_name LIKE ? ESCAPE '\\'
         )
         GROUP BY LOWER(name)
         ORDER BY pri, name
         LIMIT ?`,
        [p, p, p, p, limit]
      );
      return rows.map(({ id, name, muscle_group }) => ({ id, name, muscle_group }));
    }),

  count: () => read(async (conn) => Number((await conn.first(`SELECT COUNT(*) AS n FROM exercises`)).n)),
};

// ── Outbox ───────────────────────────────────────────────────────────────────

const outboxShape = (row) => ({ ...row, payload: row.payload ? JSON.parse(row.payload) : null });

export const outbox = {
  /** Entries still to push (not parked), oldest first, after `afterSeq`. */
  peek: ({ afterSeq = 0, limit = 100 } = {}) =>
    read(async (conn) =>
      (await conn.all(
        `SELECT * FROM outbox WHERE seq > ? AND attempts < ? ORDER BY seq ASC LIMIT ?`,
        [afterSeq, MAX_PUSH_ATTEMPTS, limit]
      )).map(outboxShape)
    ),

  /**
   * Record push results in one transaction: [{ seq, ok, error }]. ok entries
   * leave the outbox; failed ones count an attempt (parked at MAX_PUSH_ATTEMPTS).
   */
  settle: (results) =>
    getDatabase().then((db) =>
      db.transaction(async (tx) => {
        for (const r of results) {
          if (r.ok) {
            await tx.run(`DELETE FROM outbox WHERE seq = ?`, [r.seq]);
          } else {
            await tx.run(
              `UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE seq = ?`,
              [String(r.error ?? "Unknown error").slice(0, 500), r.seq]
            );
          }
        }
        tx.touch("outbox");
      }, { source: "sync" })
    ),

  /** Entries waiting to be pushed (excludes parked ones). */
  pendingCount: () =>
    read(async (conn) => Number((await conn.first(`SELECT COUNT(*) AS n FROM outbox WHERE attempts < ?`, [MAX_PUSH_ATTEMPTS])).n)),

  /** Entries that failed MAX_PUSH_ATTEMPTS times and stopped retrying. */
  parked: () =>
    read(async (conn) =>
      (await conn.all(`SELECT * FROM outbox WHERE attempts >= ? ORDER BY seq ASC`, [MAX_PUSH_ATTEMPTS])).map(outboxShape)
    ),

  /** Give parked entries another MAX_PUSH_ATTEMPTS tries. */
  retryParked: () =>
    getDatabase().then((db) =>
      db.transaction(async (tx) => {
        await tx.run(`UPDATE outbox SET attempts = 0 WHERE attempts >= ?`, [MAX_PUSH_ATTEMPTS]);
        tx.touch("outbox");
      }, { source: "sync" })
    ),

  /** Uuids with an unpushed local change (parked ones included). */
  pendingUuids: () => read(async (conn) => new Set((await conn.all(`SELECT DISTINCT uuid FROM outbox`)).map((r) => r.uuid))),

  /** Every entry, oldest first (tests and debugging). */
  all: () => read(async (conn) => (await conn.all(`SELECT * FROM outbox ORDER BY seq ASC`)).map(outboxShape)),

  count: () => read(async (conn) => Number((await conn.first(`SELECT COUNT(*) AS n FROM outbox`)).n)),
};

// ── Sync state (key → string) ────────────────────────────────────────────────

export const syncState = {
  get: (key) => read(async (conn) => (await conn.first(`SELECT value FROM sync_state WHERE key = ?`, [key]))?.value ?? null),
  set: (key, value) =>
    getDatabase().then((db) =>
      db.read((conn) =>
        value === null || value === undefined
          ? conn.run(`DELETE FROM sync_state WHERE key = ?`, [key])
          : conn.run(
              `INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
              [key, String(value)]
            )
      )
    ),
};

/**
 * Wipe the user's data: every synced table, the outbox and the sync state.
 * The shared exercise catalogue stays. Used on logout and user switch.
 */
export function clearLocalData() {
  return getDatabase().then((db) =>
    db.transaction(async (tx) => {
      for (const table of SYNCED_TABLES) await tx.run(`DELETE FROM ${table}`);
      await tx.run(`DELETE FROM outbox`);
      await tx.run(`DELETE FROM sync_state`);
      tx.touch(...SYNCED_TABLES, "outbox");
    }, { source: "reset" })
  );
}
