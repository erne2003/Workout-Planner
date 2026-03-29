const { Pool } = require("pg");

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "workout_planner",
    password: "072803",
    port: 5432,
});

module.exports = pool;