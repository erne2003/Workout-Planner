const { getWorkoutsByUser } = require('./backend/queries/workouts.queries');
const pool = require('./backend/config/db');
require('dotenv').config({ path: './.env' }); // or whichever has db connection

async function run() {
    try {
        console.log("DB URL:", process.env.DATABASE_URL); // check if db is there
        const workouts = await getWorkoutsByUser(1);
        console.log("Found workouts:", JSON.stringify(workouts, null, 2));
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
