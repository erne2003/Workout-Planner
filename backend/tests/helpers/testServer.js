/**
 * Test harness: recreates a disposable local Postgres database, applies the
 * base schema plus the real migrate.js, and serves the app on a random port.
 *
 *   TEST_DATABASE_URL=postgresql://postgres:<password>@localhost:5432/workout_planner_sync_test
 *
 * Refuses to run unless the database is on localhost and its name ends in
 * _test, because it is dropped on every run.
 */
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { Client } = require("pg");
const jwt = require("jsonwebtoken");

const TEST_DB_URL = process.env.TEST_DATABASE_URL
    || "postgresql://postgres:072803@localhost:5432/workout_planner_sync_test";

const backendDir = path.join(__dirname, "..", "..");

function assertDisposable(url) {
    const parsed = new URL(url);
    const dbName = parsed.pathname.slice(1);
    if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || !dbName.endsWith("_test")) {
        throw new Error(`Refusing to run against ${parsed.hostname}/${dbName}: tests drop the database`);
    }
    return dbName;
}

/** Run the real migration script against the test database (throws on failure). */
function migrate() {
    execFileSync(process.execPath, ["migrate.js"], {
        cwd: backendDir,
        env: { ...process.env, DATABASE_URL: TEST_DB_URL },
        stdio: "pipe",
    });
}

/**
 * @param {Object} [options]
 * @param {(client: Client) => Promise<void>} [options.beforeMigrate] - seed rows
 *   into the pre-migration schema (to test backfilling existing data)
 */
async function startTestServer({ beforeMigrate } = {}) {
    const dbName = assertDisposable(TEST_DB_URL);

    // Must be set before config/db is first required
    process.env.DATABASE_URL = TEST_DB_URL;
    process.env.JWT_SECRET = process.env.JWT_SECRET || "sync-test-secret";

    const admin = new Client({ connectionString: TEST_DB_URL.replace(/\/[^/]+$/, "/postgres") });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${dbName}"`);
    await admin.end();

    const setup = new Client({ connectionString: TEST_DB_URL });
    await setup.connect();
    await setup.query(fs.readFileSync(path.join(backendDir, "sql", "workoutData.sql"), "utf8"));
    if (beforeMigrate) await beforeMigrate(setup);
    await setup.end();

    migrate();

    const pool = require("../../config/db");
    const app = require("../../server");
    const server = await new Promise((resolve) => {
        const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    let userSeq = 0;
    const createUser = async (name = "User") => {
        userSeq += 1;
        const { rows } = await pool.query(
            `INSERT INTO users (name, email, password) VALUES ($1, $2, 'x') RETURNING id`,
            [name, `user${userSeq}-${Date.now()}@test.dev`]
        );
        return rows[0].id;
    };

    const tokenFor = (userId) =>
        jwt.sign({ userId, name: "Test", tokenVersion: 0 }, process.env.JWT_SECRET, { algorithm: "HS256" });

    /** Authenticated JSON request as userId. Returns { status, body }. */
    const api = async (userId, method, url, body) => {
        const res = await fetch(`${baseUrl}${url}`, {
            method,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenFor(userId)}` },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        return { status: res.status, body: text ? JSON.parse(text) : null };
    };

    const close = async () => {
        await new Promise((resolve) => server.close(resolve));
        await pool.end();
    };

    return { pool, baseUrl, api, createUser, tokenFor, close };
}

module.exports = { startTestServer, migrate };
