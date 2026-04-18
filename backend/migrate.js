const pool = require("./config/db");

async function migrate() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS routines (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS routine_exercises (
                id SERIAL PRIMARY KEY,
                routine_id INT NOT NULL,
                exercise_id INT NOT NULL,
                exercise_order INT NOT NULL,
                sets INT NOT NULL DEFAULT 3,
                reps INT NOT NULL DEFAULT 10,
                weight DECIMAL(6,2) DEFAULT 0,
                rir INT DEFAULT 0,
                FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE,
                FOREIGN KEY (exercise_id) REFERENCES exercises(id)
            );

            CREATE TABLE IF NOT EXISTS body_metrics (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                training_years DECIMAL(4,1),
                weight DECIMAL(5,2) NOT NULL,
                height VARCHAR(50) NOT NULL,
                body_fat DECIMAL(5,2),
                logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
        console.log("Migration successful!");
    } catch (e) {
        console.error("Migration failed:", e.message);
    } finally {
        pool.end();
    }
}

migrate();
