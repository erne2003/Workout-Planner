const pool = require("../config/db");

async function addGenderColumn() {
    try {
        console.log("Checking and adding gender column to body_metrics table...");
        await pool.query(`
            ALTER TABLE body_metrics 
            ADD COLUMN IF NOT EXISTS gender VARCHAR(10) DEFAULT 'male';
        `);
        console.log("Database updated successfully!");
    } catch (e) {
        console.error("Migration failed:", e.message);
    } finally {
        pool.end();
    }
}

addGenderColumn();
