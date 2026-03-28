const { Pool } = require("pg");

const pool = new Pool({
    user: "erne",
    host: "localhost",
    database: "workout-planner",
    password: "072803",
    port: 5432,
});

module.exports = pool;