require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const pool = require("../config/db");

async function addExerciseImageColumns() {
    try {
        console.log("Checking and adding demo image columns to exercises table...");
        await pool.query(`
            ALTER TABLE exercises ADD COLUMN IF NOT EXISTS demo_image_path VARCHAR(255);
            ALTER TABLE exercises ADD COLUMN IF NOT EXISTS demo_image_fed_id VARCHAR(255);
        `);
        console.log("Database updated successfully!");
    } catch (e) {
        console.error("Migration failed:", e.message);
    } finally {
        pool.end();
    }
}

addExerciseImageColumns();
