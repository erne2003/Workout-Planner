const pool = require("./config/db");

async function clearWorkouts() {
    try {
        console.log("Clearing all completed workout sessions and sets from the database...");
        await pool.query("DELETE FROM workout_sets;");
        await pool.query("DELETE FROM workouts;");
        console.log("Successfully wiped all workout sessions! Your routines and exercises are perfectly intact.");
    } catch (err) {
        console.error("Failed to clear workouts:", err);
    } finally {
        process.exit(0);
    }
}

clearWorkouts();
