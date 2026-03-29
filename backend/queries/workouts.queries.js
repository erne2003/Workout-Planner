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

module.exports = { createWorkout, getWorkoutsByUser, getWorkoutById };