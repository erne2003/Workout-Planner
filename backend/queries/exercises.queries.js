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

module.exports = { searchExercises, insertExercises };
