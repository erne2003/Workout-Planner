/**
 * Apply rows pulled from GET /sync/pull to the local database.
 *
 * - A row whose uuid has an unpushed outbox entry is skipped: local edits win
 *   until they're pushed (the push then makes the server agree).
 * - A tombstone (deleted_at set) deletes the local row; a parent's tombstone
 *   deletes its children too.
 * - Everything else is upserted by uuid.
 */
import { getDatabase } from "../db/database.js";
import { SYNCED_TABLES } from "../db/schema.js";

// Parents first, so a page reads consistently even mid-apply
const APPLY_ORDER = ["workouts", "routines", "prs", "body_metrics", "workout_sets", "routine_exercises"];
const CHILDREN = { workouts: ["workout_sets", "workout_uuid"], routines: ["routine_exercises", "routine_uuid"] };

/** Server timestamps may carry any UTC offset; store them uniformly so they sort as text. */
function iso(value, fallback) {
  const d = value ? new Date(value) : null;
  if (d && !Number.isNaN(d.getTime())) return d.toISOString();
  return fallback ?? new Date().toISOString();
}

const exerciseName = (row) => row.exercise_name || "Unknown exercise";

/** Server row → local columns, per table. */
const TO_LOCAL = {
  workouts: (r) => ({
    uuid: r.uuid, server_id: r.id ?? null, name: r.name, notes: r.notes ?? null, status: r.status ?? null,
    created_at: iso(r.created_at, iso(r.updated_at)), updated_at: r.updated_at ?? null,
  }),
  workout_sets: (r) => ({
    uuid: r.uuid, server_id: r.id ?? null, workout_uuid: r.workout_uuid, exercise_id: r.exercise_id ?? null,
    exercise_name: exerciseName(r), muscle_group: r.muscle_group ?? null, set_order: r.set_order,
    reps: r.reps, weight: r.weight, rir: r.rir ?? null, updated_at: r.updated_at ?? null,
  }),
  routines: (r) => ({
    uuid: r.uuid, server_id: r.id ?? null, name: r.name,
    created_at: iso(r.created_at, iso(r.updated_at)), updated_at: r.updated_at ?? null,
  }),
  routine_exercises: (r) => ({
    uuid: r.uuid, server_id: r.id ?? null, routine_uuid: r.routine_uuid, exercise_id: r.exercise_id ?? null,
    exercise_name: exerciseName(r), muscle_group: r.muscle_group ?? null, exercise_order: r.exercise_order,
    sets: r.sets ?? 3, reps: r.reps ?? 10, weight: r.weight ?? 0, rir: r.rir ?? 0, updated_at: r.updated_at ?? null,
  }),
  prs: (r) => ({
    uuid: r.uuid, server_id: r.id ?? null, exercise_id: r.exercise_id ?? null, exercise_name: exerciseName(r),
    muscle_group: r.muscle_group ?? null, weight: r.weight,
    achieved_at: iso(r.achieved_at, iso(r.updated_at)), updated_at: r.updated_at ?? null,
  }),
  body_metrics: (r) => ({
    uuid: r.uuid, server_id: r.id ?? null, training_years: r.training_years ?? null, weight: r.weight,
    height: r.height ?? null, body_fat: r.body_fat ?? null, gender: r.gender ?? null,
    logged_at: iso(r.logged_at, iso(r.updated_at)), updated_at: r.updated_at ?? null,
  }),
};

async function upsert(tx, table, record) {
  const cols = Object.keys(record);
  await tx.run(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})
     ON CONFLICT (uuid) DO UPDATE SET ${cols.filter((c) => c !== "uuid").map((c) => `${c} = excluded.${c}`).join(", ")}`,
    cols.map((c) => record[c])
  );
}

/**
 * @param {Record<string, object[]>} changes - a pull page's `changes`
 * @param {Set<string>} pendingUuids - uuids with unpushed local changes
 * @returns {Promise<{ applied: number, skipped: number }>}
 */
export async function applyPulledChanges(changes, pendingUuids) {
  const db = await getDatabase();
  return db.transaction(async (tx) => {
    let applied = 0;
    let skipped = 0;
    const exercises = new Map();

    for (const table of APPLY_ORDER) {
      for (const row of changes?.[table] || []) {
        if (!row?.uuid) continue;
        if (pendingUuids.has(row.uuid)) {
          skipped++;
          continue;
        }
        if (row.deleted_at) {
          await tx.run(`DELETE FROM ${table} WHERE uuid = ?`, [row.uuid]);
          const child = CHILDREN[table];
          if (child) {
            await tx.run(`DELETE FROM ${child[0]} WHERE ${child[1]} = ?`, [row.uuid]);
            tx.touch(child[0]);
          }
        } else {
          await upsert(tx, table, TO_LOCAL[table](row));
          if (Number.isInteger(row.exercise_id) && row.exercise_name) {
            exercises.set(row.exercise_id, [row.exercise_name, row.muscle_group ?? null]);
          }
        }
        tx.touch(table);
        applied++;
      }
    }

    // Exercises seen in the user's data feed the offline search
    for (const [id, [name, muscleGroup]] of exercises) {
      await tx.run(
        `INSERT INTO exercises (id, name, muscle_group) VALUES (?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, muscle_group = COALESCE(excluded.muscle_group, exercises.muscle_group)`,
        [id, name, muscleGroup]
      );
    }
    if (exercises.size) tx.touch("exercises");

    return { applied, skipped };
  }, { source: "sync" });
}

/**
 * Before a full resync (cursor older than the server's tombstone retention):
 * drop every synced row that has no unpushed local change, so rows deleted on
 * the server while this device was away don't linger.
 */
export async function dropSyncedRows() {
  const db = await getDatabase();
  await db.transaction(async (tx) => {
    for (const table of SYNCED_TABLES) {
      await tx.run(`DELETE FROM ${table} WHERE uuid NOT IN (SELECT uuid FROM outbox)`);
    }
    tx.touch(...SYNCED_TABLES);
  }, { source: "sync" });
}
