const pool = require("../config/db");

// Log a new Personal Record
const logPR = async (userId, exerciseName, weight) => {
  // 1. Ensure the exercise structurally exists in DB and grab its specific ID securely
  let exRes = await pool.query(`SELECT id FROM exercises WHERE LOWER(name) = LOWER($1)`, [exerciseName]);
  if (exRes.rows.length === 0) {
    const insertEx = await pool.query(
      `INSERT INTO exercises (name, muscle_group) VALUES ($1, $2) RETURNING id`,
      [exerciseName, "other"]
    );
    exRes = insertEx;
  }
  const exerciseId = exRes.rows[0].id;

  // 2. Insert into the PRs log inherently
  const result = await pool.query(
    `INSERT INTO prs (user_id, exercise_id, weight) 
     VALUES ($1, $2, $3) RETURNING *`,
    [userId, exerciseId, weight]
  );
  return result.rows[0];
};

// Retrieve historical PRs for the user mapped back chronologically
const getHistoricalPRs = async (userId) => {
  const result = await pool.query(
    `SELECT p.id, p.weight, p.achieved_at, e.name as exercise_name 
     FROM prs p
     JOIN exercises e ON p.exercise_id = e.id
     WHERE p.user_id = $1
     ORDER BY p.achieved_at ASC`,
    [userId]
  );
  return result.rows;
};

module.exports = {
  logPR,
  getHistoricalPRs,
};
