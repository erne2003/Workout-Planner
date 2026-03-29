const pool = require("../config/db");

// Create a new workout
const createWorkout = async ({ userId, name, notes }) => {
    const result = await pool.query(
        `INSERT INTO workouts (user_id, name, notes)
     VALUES ($1, $2, $3)
     RETURNING *`,
        [userId, name, notes]
    );
    return result.rows[0];
};

// Get all workouts for a user
const getWorkoutsByUser = async (userId) => {
    const result = await pool.query(
        `SELECT * FROM workouts
     WHERE user_id = $1
     ORDER BY created_at DESC`,
        [userId]
    );
    return result.rows;
};

// Get a single workout by ID
const getWorkoutById = async (workoutId) => {
    const result = await pool.query(
        `SELECT * FROM workouts WHERE id = $1`,
        [workoutId]
    );
    return result.rows[0];
};

// Delete a workout
const deleteWorkout = async (id) => {
    const result = await pool.query(
        `DELETE FROM workouts WHERE id = $1 RETURNING *`,
        [id]
    );
    return result.rows[0];
};

// Delete all sets for a workout (useful before deleting workout if no CASCADE)
const deleteWorkoutSetsByWorkoutId = async (workoutId) => {
    const result = await pool.query(
        `DELETE FROM workout_sets WHERE workout_id = $1 RETURNING *`,
        [workoutId]
    );
    return result.rows;
};

// Create a Workout Set
const createWorkoutSet = async ({ workoutId, exerciseId, setOrder, reps, weight, rir }) => {
    const result = await pool.query(
        `INSERT INTO workout_sets (workout_id, exercise_id, set_order, reps, weight, rir)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [workoutId, exerciseId, setOrder, reps, weight, rir]
    );
    return result.rows[0];
};

// Delete a single Workout Set
const deleteWorkoutSet = async (setId) => {
    const result = await pool.query(
        `DELETE FROM workout_sets WHERE id = $1 RETURNING *`,
        [setId]
    );
    return result.rows[0];
};

// Get all sets for a workout
const getWorkoutSets = async (workoutId) => {
    const result = await pool.query(
        `SELECT ws.*, e.name as exercise_name, e.muscle_group
         FROM workout_sets ws
         JOIN exercises e ON ws.exercise_id = e.id
         WHERE ws.workout_id = $1
         ORDER BY ws.set_order ASC`,
        [workoutId]
    );
    return result.rows;
};

module.exports = { 
    createWorkout, 
    getWorkoutsByUser, 
    getWorkoutById,
    deleteWorkout,
    deleteWorkoutSetsByWorkoutId,
    createWorkoutSet,
    deleteWorkoutSet,
    getWorkoutSets
};