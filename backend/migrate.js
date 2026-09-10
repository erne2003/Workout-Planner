require("dotenv").config();
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
                gender VARCHAR(10) DEFAULT 'male',
                logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            ALTER TABLE body_metrics ADD COLUMN IF NOT EXISTS gender VARCHAR(10) DEFAULT 'male';

            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT NOT NULL UNIQUE,
                family_id TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                revoked BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

            -- Admin infrastructure
            ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 0;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT FALSE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_reason TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

            CREATE TABLE IF NOT EXISTS admin_info (
                id SERIAL PRIMARY KEY,
                kind VARCHAR(20) NOT NULL DEFAULT 'log',
                level VARCHAR(10) NOT NULL DEFAULT 'error',
                message TEXT NOT NULL,
                context JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_users_is_disabled ON users(is_disabled);
            CREATE INDEX IF NOT EXISTS idx_admin_info_created_at ON admin_info(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_admin_info_level ON admin_info(level);
            CREATE INDEX IF NOT EXISTS idx_admin_info_kind ON admin_info(kind);
        `);
        console.log("Migration successful!");
    } catch (e) {
        console.error("Migration failed:", e.message);
    } finally {
        pool.end();
    }
}

migrate();
