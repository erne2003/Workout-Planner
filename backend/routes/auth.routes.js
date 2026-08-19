const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/db");
const { body, validationResult } = require("express-validator");

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

/** Generate a cryptographically random refresh token (opaque string). */
function generateRefreshToken() {
    return crypto.randomBytes(40).toString("hex");
}

/** SHA-256 hash a token for safe database storage. */
function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

/** Generate a short-lived JWT access token. */
function generateAccessToken(userId, name) {
    return jwt.sign(
        { userId, name },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
}

/**
 * Store a new refresh token in the database.
 * @param {number} userId
 * @param {string} rawRefreshToken - The unhashed token to store
 * @param {string} [familyId] - Rotation family ID. If omitted, creates a new family.
 * @returns {Promise<string>} The family ID used
 */
async function storeRefreshToken(userId, rawRefreshToken, familyId) {
    const tokenHash = hashToken(rawRefreshToken);
    const fid = familyId || crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

    await pool.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [userId, tokenHash, fid, expiresAt]
    );

    return fid;
}

// POST /auth/register — create new user, return access + refresh tokens
router.post("/register", [
    body("email").isEmail().withMessage("Invalid email format").isLength({ max: 255 }),
    body("name").isLength({ min: 1, max: 100 }).withMessage("Name must be between 1 and 100 characters"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    validate
], async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Check if email already exists
        const existing = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: "An account with this email already exists." });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email`,
            [name, email, hashedPassword]
        );

        const user = result.rows[0];

        // Generate tokens
        const accessToken = generateAccessToken(user.id, user.name);
        const refreshToken = generateRefreshToken();
        await storeRefreshToken(user.id, refreshToken);

        res.status(201).json({
            accessToken,
            refreshToken,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (err) {
        console.error("POST /auth/register error:", err.message);
        res.status(500).json({ error: "Failed to register" });
    }
});

// POST /auth/login — verify credentials, return access + refresh tokens
router.post("/login", [
    body("email").isEmail().withMessage("Invalid email format"),
    body("password").notEmpty().withMessage("Password is required"),
    validate
], async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        // Generate tokens
        const accessToken = generateAccessToken(user.id, user.name);
        const refreshToken = generateRefreshToken();
        await storeRefreshToken(user.id, refreshToken);

        res.json({
            accessToken,
            refreshToken,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (err) {
        console.error("POST /auth/login error:", err.message);
        res.status(500).json({ error: "Failed to log in" });
    }
});

// POST /auth/refresh — rotate tokens using a valid refresh token
router.post("/refresh", async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token is required" });
    }

    const tokenHash = hashToken(refreshToken);

    try {
        // Look up the token, joining with users to get the user's name
        const result = await pool.query(
            `SELECT rt.*, u.name AS user_name
             FROM refresh_tokens rt
             JOIN users u ON rt.user_id = u.id
             WHERE rt.token_hash = $1`,
            [tokenHash]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid refresh token", code: "INVALID_REFRESH" });
        }

        const storedToken = result.rows[0];

        // ── Reuse detection ─────────────────────────────────────
        // If the token was already revoked, someone is replaying an old token.
        // Revoke the ENTIRE family to protect the user.
        if (storedToken.revoked) {
            await pool.query(
                `UPDATE refresh_tokens SET revoked = true WHERE family_id = $1`,
                [storedToken.family_id]
            );
            console.error(`[Auth] Refresh token reuse detected for user ${storedToken.user_id}, family ${storedToken.family_id}`);
            return res.status(401).json({
                error: "Token reuse detected. All sessions revoked. Please log in again.",
                code: "TOKEN_REUSE"
            });
        }

        // ── Expiration check ────────────────────────────────────
        if (new Date(storedToken.expires_at) < new Date()) {
            await pool.query(`DELETE FROM refresh_tokens WHERE id = $1`, [storedToken.id]);
            return res.status(401).json({ error: "Refresh token expired", code: "REFRESH_EXPIRED" });
        }

        // ── Valid token — rotate ────────────────────────────────
        // 1. Revoke the old token
        await pool.query(
            `UPDATE refresh_tokens SET revoked = true WHERE id = $1`,
            [storedToken.id]
        );

        // 2. Generate new token pair
        const newAccessToken = generateAccessToken(storedToken.user_id, storedToken.user_name);
        const newRefreshToken = generateRefreshToken();

        // 3. Store new refresh token in the SAME family (sliding 30-day window)
        await storeRefreshToken(storedToken.user_id, newRefreshToken, storedToken.family_id);

        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            user: { id: storedToken.user_id, name: storedToken.user_name }
        });
    } catch (err) {
        console.error("POST /auth/refresh error:", err.message);
        res.status(500).json({ error: "Failed to refresh token" });
    }
});

// POST /auth/logout — revoke a refresh token
router.post("/logout", async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token is required" });
    }

    try {
        const tokenHash = hashToken(refreshToken);
        await pool.query(
            `UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`,
            [tokenHash]
        );
        res.json({ message: "Logged out successfully" });
    } catch (err) {
        console.error("POST /auth/logout error:", err.message);
        res.status(500).json({ error: "Failed to log out" });
    }
});

const requireAuth = require("../middleware/requireAuth");

router.post("/delete-account", requireAuth, async (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ error: "Password is required to delete account." });
    }

    const client = await pool.connect();
    try {
        // Fetch user password hash
        const userRes = await client.query("SELECT password FROM users WHERE id = $1", [req.userId]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }

        const match = await bcrypt.compare(password, userRes.rows[0].password);
        if (!match) {
            return res.status(401).json({ error: "Incorrect password. Account deletion aborted." });
        }

        await client.query("BEGIN");
        // Delete all user records in proper dependency order
        await client.query(`DELETE FROM workout_sets WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = $1)`, [req.userId]);
        await client.query(`DELETE FROM workouts WHERE user_id = $1`, [req.userId]);
        await client.query(`DELETE FROM prs WHERE user_id = $1`, [req.userId]);
        await client.query(`DELETE FROM routine_exercises WHERE routine_id IN (SELECT id FROM routines WHERE user_id = $1)`, [req.userId]);
        await client.query(`DELETE FROM routines WHERE user_id = $1`, [req.userId]);
        await client.query(`DELETE FROM body_metrics WHERE user_id = $1`, [req.userId]);
        await client.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [req.userId]);
        await client.query(`DELETE FROM users WHERE id = $1`, [req.userId]);
        await client.query("COMMIT");

        res.json({ message: "Account and all associated data deleted successfully." });
    } catch (e) {
        await client.query("ROLLBACK");
        console.error("Account deletion error:", e.message);
        res.status(500).json({ error: "Failed to delete account." });
    } finally {
        client.release();
    }
});

module.exports = router;