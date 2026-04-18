require("dotenv").config({ path: "./.env" });
const pool = require("../config/db");

async function resetUserData() {
    console.log("🚀 Starting secure data reset on Supabase...");
    
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. Clear user-linked training data while preserving 'exercises' and 'users'
        const tablesToClear = [
            "workout_sets",
            "workouts",
            "prs",
            "body_metrics",
            "routine_exercises",
            "routines"
        ];

        console.log(`🧹 Truncating tables: ${tablesToClear.join(", ")}...`);
        
        await client.query(`TRUNCATE TABLE ${tablesToClear.join(", ")} RESTART IDENTITY CASCADE`);

        await client.query("COMMIT");
        console.log("✅ All user-bound data has been reset to zero.");
        console.log("ℹ️ Global exercise library and user accounts were preserved.");
        
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Reset failed:", error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

resetUserData();
