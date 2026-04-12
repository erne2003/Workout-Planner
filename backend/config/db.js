const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Keep local fallback just in case
    ...( !process.env.DATABASE_URL && {
        user: "postgres",
        host: "localhost",
        database: "workout_planner",
        password: "072803",
        port: 5432,
    })
});

module.exports = pool;