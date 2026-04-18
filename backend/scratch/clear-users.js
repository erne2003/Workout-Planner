require("dotenv").config({ path: "./.env" });
const pool = require("../config/db");

async function clearUsers() {
    console.log("🚀 Clearing all users...");
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE");
        await client.query("COMMIT");
        console.log("✅ Users cleared.");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Failed to clear users:", error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

clearUsers();
