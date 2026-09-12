const pool = require("../config/db");

// Log a new Body Metric snapshot natively
const logMetrics = async (userId, trainingYears, weight, height, bodyFat, gender) => {
  const result = await pool.query(
    `INSERT INTO body_metrics (user_id, training_years, weight, height, body_fat, gender) 
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId, trainingYears || null, weight, height, bodyFat || null, gender || 'male']
  );
  return result.rows[0];
};

// Retrieve historical metrics for the user mapped chronologically
const getHistoricalMetrics = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM body_metrics
     WHERE user_id = $1
     ORDER BY logged_at ASC`,
    [userId]
  );
  return result.rows;
};

// Retrieve the most recent metrics snapshot for the user, if any
const getLatestMetric = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM body_metrics
     WHERE user_id = $1
     ORDER BY logged_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
};

module.exports = {
  logMetrics,
  getHistoricalMetrics,
  getLatestMetric,
};
