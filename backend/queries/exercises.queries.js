const pool = require("../config/db");

const searchExercises = async (name) => {
    const result = await pool.query(
        `SELECT * FROM exercises WHERE name ILIKE $1`,
        [`%${name}%`]
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
        valuesString.push(`($${paramIndex}, $${paramIndex + 1})`);
        valuesArray.push(ex.name, ex.muscle);
        paramIndex += 2;
    }

    const query = `
        INSERT INTO exercises (name, muscle_group)
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

const getAllExercises = async (muscle) => {
    let query = "SELECT * FROM exercises";
    let params = [];
    if (muscle) {
        query += " WHERE muscle_group ILIKE $1";
        params.push(`%${muscle}%`);
    }
    query += " ORDER BY name ASC";
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

module.exports = { searchExercises, insertExercises, getUniqueMuscles, getAllExercises, updateMuscleGroup };
