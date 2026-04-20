const pool = require("../config/db");

// ── Workouts ──────────────────────────────────────────────

const createWorkout = async ({ userId, name, notes, status }) => {
    const result = await pool.query(
        `INSERT INTO workouts (user_id, name, notes, status)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, name, notes, status || 'completed']
    );
    return result.rows[0];
};

const getWorkoutsByUser = async (userId) => {
    // Single query to get all workouts and their sets for a user
    const result = await pool.query(
        `SELECT 
            w.id AS workout_id, w.name AS workout_name, w.notes, w.status, w.created_at AS workout_created_at,
            ws.id AS set_id, ws.set_order, ws.reps, ws.weight, ws.rir,
            e.id AS exercise_id, e.name AS exercise_name, e.muscle_group
         FROM workouts w
         LEFT JOIN workout_sets ws ON w.id = ws.workout_id
         LEFT JOIN exercises e ON ws.exercise_id = e.id
         WHERE w.user_id = $1
         ORDER BY w.created_at DESC, ws.set_order ASC`,
        [userId]
    );

    const workoutsMap = new Map();

    for (const row of result.rows) {
        if (!workoutsMap.has(row.workout_id)) {
            workoutsMap.set(row.workout_id, {
                id: row.workout_id,
                user_id: userId,
                name: row.workout_name,
                notes: row.notes,
                status: row.status,
                created_at: row.workout_created_at,
                sets: []
            });
        }

        if (row.set_id) {
            workoutsMap.get(row.workout_id).sets.push({
                id: row.set_id,
                workout_id: row.workout_id,
                exercise_id: row.exercise_id,
                set_order: row.set_order,
                reps: row.reps,
                weight: row.weight,
                rir: row.rir,
                exercise_name: row.exercise_name,
                muscle_group: row.muscle_group,
                name: row.exercise_name // For frontend compatibility
            });
        }
    }

    return Array.from(workoutsMap.values());
};

const getWorkoutById = async (userId, workoutId) => {
    const workoutResult = await pool.query(
        `SELECT * FROM workouts WHERE id = $1 AND user_id = $2`,
        [workoutId, userId]
    );
    const workout = workoutResult.rows[0];
    if (!workout) return null;

    const setsResult = await pool.query(
        `SELECT ws.*, e.name AS exercise_name, e.muscle_group
         FROM workout_sets ws
         JOIN exercises e ON ws.exercise_id = e.id
         WHERE ws.workout_id = $1
         ORDER BY ws.set_order ASC`,
        [workoutId]
    );
    workout.sets = setsResult.rows;
    return workout;
};

const updateWorkout = async (userId, workoutId, { name, notes }) => {
    const result = await pool.query(
        `UPDATE workouts
         SET name  = COALESCE($1, name),
             notes = COALESCE($2, notes)
         WHERE id = $3 AND user_id = $4
         RETURNING *`,
        [name, notes, workoutId, userId]
    );
    return result.rows[0];
};

const deleteWorkout = async (userId, id) => {
    const result = await pool.query(
        `DELETE FROM workouts WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, userId]
    );
    return result.rows[0];
};

// ── Workout Sets ──────────────────────────────────────────

const getWorkoutSets = async (workoutId) => {
    const result = await pool.query(
        `SELECT ws.*, e.name AS exercise_name, e.muscle_group
         FROM workout_sets ws
         JOIN exercises e ON ws.exercise_id = e.id
         WHERE ws.workout_id = $1
         ORDER BY ws.set_order ASC`,
        [workoutId]
    );
    return result.rows;
};

const createWorkoutSet = async ({ workoutId, exerciseId, setOrder, reps, weight, rir }) => {
    const result = await pool.query(
        `INSERT INTO workout_sets (workout_id, exercise_id, set_order, reps, weight, rir)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [workoutId, exerciseId, setOrder, reps, weight, rir ?? null]
    );
    return result.rows[0];
};

const updateWorkoutSet = async (userId, setId, { reps, weight, rir, setOrder }) => {
    const result = await pool.query(
        `UPDATE workout_sets ws
         SET reps      = COALESCE($1, ws.reps),
             weight    = COALESCE($2, ws.weight),
             rir       = COALESCE($3, ws.rir),
             set_order = COALESCE($4, ws.set_order)
         FROM workouts w
         WHERE ws.id = $5 
           AND ws.workout_id = w.id 
           AND w.user_id = $6
         RETURNING ws.*`,
        [reps, weight, rir, setOrder, setId, userId]
    );
    return result.rows[0];
};

const deleteWorkoutSet = async (userId, setId) => {
    const result = await pool.query(
        `DELETE FROM workout_sets ws
         USING workouts w
         WHERE ws.id = $1
           AND ws.workout_id = w.id
           AND w.user_id = $2
         RETURNING ws.*`,
        [setId, userId]
    );
    return result.rows[0];
};

const deleteWorkoutSetsByWorkoutId = async (workoutId) => {
    const result = await pool.query(
        `DELETE FROM workout_sets WHERE workout_id = $1 RETURNING *`,
        [workoutId]
    );
    return result.rows;
};

// ── NEW: Last session sets for a given exercise + user ────
//
// Returns all sets (ordered by set_order) from the most recent
// workout that contains at least one set of this exercise.
// Used by the frontend to show "previous" ghost data on each set row.
//
const getLastSetsForExercise = async (userId, exerciseId) => {
    const result = await pool.query(
        `SELECT ws.set_order, ws.reps, ws.weight, ws.rir
         FROM workout_sets ws
         JOIN workouts w ON ws.workout_id = w.id
         WHERE w.user_id   = $1
           AND ws.exercise_id = $2
           AND w.id = (
               -- most recent workout for this user that has this exercise
               SELECT w2.id
               FROM workouts w2
               JOIN workout_sets ws2 ON ws2.workout_id = w2.id
               WHERE w2.user_id    = $1
                 AND ws2.exercise_id = $2
               ORDER BY w2.created_at DESC
               LIMIT 1
           )
         ORDER BY ws.set_order ASC`,
        [userId, exerciseId]
    );
    return result.rows;
};

module.exports = {
    createWorkout,
    getWorkoutsByUser,
    getWorkoutById,
    updateWorkout,
    deleteWorkout,
    getWorkoutSets,
    createWorkoutSet,
    updateWorkoutSet,
    deleteWorkoutSet,
    deleteWorkoutSetsByWorkoutId,
    getLastSetsForExercise,   // ← NEW
};