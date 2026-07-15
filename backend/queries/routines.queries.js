const pool = require("../config/db");

// Fetch all routines for a user, including their exercises
const getRoutinesByUser = async (userId) => {
    const routinesRes = await pool.query(
        `SELECT * FROM routines WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
    );

    const routines = routinesRes.rows;

    for (let routine of routines) {
        const exercisesRes = await pool.query(
            `SELECT re.*, e.name, e.muscle_group 
             FROM routine_exercises re
             JOIN exercises e ON re.exercise_id = e.id
             WHERE re.routine_id = $1
             ORDER BY re.exercise_order ASC`,
            [routine.id]
        );
        routine.exercises = exercisesRes.rows;
    }

    return routines;
};

// Create a new routine
const createRoutine = async ({ userId, name, exercises }) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        
        const routineRes = await client.query(
            `INSERT INTO routines (user_id, name) VALUES ($1, $2) RETURNING *`,
            [userId, name]
        );
        
        const routineId = routineRes.rows[0].id;

        for (let i = 0; i < exercises.length; i++) {
            const ex = exercises[i];
            await client.query(
                `INSERT INTO routine_exercises (routine_id, exercise_id, exercise_order, sets, reps, weight, rir)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [routineId, ex.exercise_id || ex.id, i, ex.sets || 3, ex.reps || 10, ex.weight || 0, ex.rir || 0]
            );
        }

        await client.query("COMMIT");
        return routineRes.rows[0];
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

// Delete a routine
const deleteRoutine = async (routineId, userId) => {
    // ON DELETE CASCADE on the FK handles routine_exercises mapping automatically.
    const result = await pool.query(
        `DELETE FROM routines WHERE id = $1 AND user_id = $2 RETURNING *`,
        [routineId, userId]
    );
    return result.rows[0];
};

// Update an existing routine
const updateRoutine = async ({ userId, routineId, name, exercises }) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const routineRes = await client.query(
            `UPDATE routines SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
            [name, routineId, userId]
        );

        if (routineRes.rowCount === 0) {
            await client.query("ROLLBACK");
            return null;
        }

        // Delete existing exercise mappings
        await client.query(
            `DELETE FROM routine_exercises WHERE routine_id = $1`,
            [routineId]
        );

        // Insert new/updated exercise mappings
        for (let i = 0; i < exercises.length; i++) {
            const ex = exercises[i];
            await client.query(
                `INSERT INTO routine_exercises (routine_id, exercise_id, exercise_order, sets, reps, weight, rir)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [routineId, ex.exercise_id || ex.id, i, ex.sets || 3, ex.reps || 10, ex.weight || 0, ex.rir || 0]
            );
        }

        await client.query("COMMIT");
        return routineRes.rows[0];
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

module.exports = {
    getRoutinesByUser,
    createRoutine,
    deleteRoutine,
    updateRoutine
};
