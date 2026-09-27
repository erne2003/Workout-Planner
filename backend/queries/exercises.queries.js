const pool = require("../config/db");

// Attaches each user's heaviest-ever set for that exercise (by weight, then reps
// as a tiebreak) so the exercise list can show a computed Best 1RM / Best Set.
const BEST_SET_LATERAL = `
    LEFT JOIN LATERAL (
        SELECT ws.weight, ws.reps
        FROM workout_sets ws
        JOIN workouts w ON w.id = ws.workout_id
        WHERE ws.exercise_id = e.id AND w.user_id = $1
        ORDER BY ws.weight DESC, ws.reps DESC
        LIMIT 1
    ) best ON true
`;

const searchExercises = async (name, userId) => {
    const result = await pool.query(
        `SELECT e.*, best.weight AS best_weight, best.reps AS best_reps
         FROM exercises e
         ${BEST_SET_LATERAL}
         WHERE e.name ILIKE $2`,
        [userId, `%${name}%`]
    );
    return result.rows;
};

const insertExercises = async (exercises) => {
    if (!exercises || exercises.length === 0) return [];

    // Build values string and array for parameterized insertion
    let valuesString = [];
    let valuesArray = [];
    let paramIndex = 1;

    for (const ex of exercises) {
        valuesString.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`);
        valuesArray.push(ex.name, ex.muscle, ex.demo_image_path || null, ex.demo_image_fed_id || null);
        paramIndex += 4;
    }

    const query = `
        INSERT INTO exercises (name, muscle_group, demo_image_path, demo_image_fed_id)
        VALUES ${valuesString.join(", ")}
        RETURNING *
    `;

    const result = await pool.query(query, valuesArray);
    return result.rows;
}

const getUniqueMuscles = async () => {
    const result = await pool.query(
        `SELECT DISTINCT muscle_group FROM exercises WHERE muscle_group IS NOT NULL ORDER BY muscle_group ASC`
    );
    return result.rows.map(r => r.muscle_group);
};

const getAllExercises = async (muscle, userId) => {
    let query = `
        SELECT e.*, best.weight AS best_weight, best.reps AS best_reps
        FROM exercises e
        ${BEST_SET_LATERAL}
    `;
    let params = [userId];
    if (muscle) {
        query += " WHERE e.muscle_group ILIKE $2";
        params.push(`%${muscle}%`);
    }
    query += " ORDER BY e.name ASC";
    const result = await pool.query(query, params);
    return result.rows;
};

const updateMuscleGroup = async (exerciseId, muscleGroup) => {
    const result = await pool.query(
        `UPDATE exercises SET muscle_group = $1 WHERE id = $2 RETURNING *`,
        [muscleGroup, exerciseId]
    );
    return result.rows[0];
};

const getExerciseById = async (exerciseId, userId) => {
    const result = await pool.query(
        `SELECT e.*, best.weight AS best_weight, best.reps AS best_reps
         FROM exercises e
         ${BEST_SET_LATERAL}
         WHERE e.id = $2`,
        [userId, exerciseId]
    );
    return result.rows[0] || null;
};

module.exports = { searchExercises, insertExercises, getUniqueMuscles, getAllExercises, updateMuscleGroup, getExerciseById };
