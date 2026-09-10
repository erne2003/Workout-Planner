const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const pool = require("../config/db");
const requireAdmin = require("../middleware/requireAdmin");

// ── Rate limiter: stricter than user login (single shared secret = high-value target)
const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: "Too many admin login attempts, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Keys to redact from any context before writing to admin_info */
const SENSITIVE_KEYS = new Set(["password", "authorization", "token", "refreshtoken", "accesstoken", "secret"]);

function redact(obj) {
    if (!obj || typeof obj !== "object") return obj;
    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [
            k,
            SENSITIVE_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : v
        ])
    );
}

/** Write an entry to admin_info. Fire-and-forget — never throws. */
async function writeAdminInfo(kind, level, message, context = null) {
    try {
        await pool.query(
            `INSERT INTO admin_info (kind, level, message, context) VALUES ($1, $2, $3, $4)`,
            [kind, level, message, context ? JSON.stringify(context) : null]
        );
    } catch (e) {
        // Logging failure must never crash the caller
        console.error("[admin_info] Failed to write log entry:", e.message);
    }
}

// ── POST /admin/login ─────────────────────────────────────────────────────────
router.post("/login", adminLoginLimiter, (req, res) => {
    const { secret } = req.body;
    const ADMIN_SECRET = process.env.ADMIN_SECRET;
    const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;

    if (!ADMIN_SECRET || !ADMIN_JWT_SECRET) {
        console.error("[Admin] FATAL: ADMIN_SECRET or ADMIN_JWT_SECRET missing from environment");
        return res.status(500).json({ error: "Admin not configured" });
    }

    if (!secret || typeof secret !== "string") {
        return res.status(400).json({ error: "Secret is required" });
    }

    // Constant-time comparison — prevents timing side-channel on static secret
    let valid = false;
    try {
        const inputBuf = Buffer.from(secret);
        const secretBuf = Buffer.from(ADMIN_SECRET);
        // Buffers must be same length for timingSafeEqual; if not, it's wrong anyway
        if (inputBuf.length === secretBuf.length) {
            valid = crypto.timingSafeEqual(inputBuf, secretBuf);
        }
    } catch {
        valid = false;
    }

    if (!valid) {
        return res.status(401).json({ error: "Invalid admin secret" });
    }

    const token = jwt.sign(
        { role: "admin", adminId: "admin" },
        ADMIN_JWT_SECRET,
        { expiresIn: "2h", algorithm: "HS256" }
    );

    res.json({ token });
});

// ── GET /admin/stats ──────────────────────────────────────────────────────────
router.get("/stats", requireAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM users)                                   AS total_users,
                (SELECT COUNT(*) FROM users WHERE is_disabled = true)          AS disabled_users,
                (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days') AS new_this_week,
                (SELECT COUNT(DISTINCT user_id) FROM workouts WHERE created_at >= NOW() - INTERVAL '24 hours') AS active_today
        `);

        const errorCount = await pool.query(
            `SELECT COUNT(*) FROM admin_info WHERE kind = 'log' AND level = 'error'`
        );

        res.json({
            ...rows[0],
            error_count: parseInt(errorCount.rows[0].count, 10)
        });
    } catch (err) {
        console.error("GET /admin/stats error:", err.message);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// ── GET /admin/users ──────────────────────────────────────────────────────────
router.get("/users", requireAdmin, async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT
                u.id,
                u.name,
                u.email,
                u.is_disabled,
                u.disabled_reason,
                COALESCE(u.created_at, NOW()) AS created_at,
                COALESCE(wc.workout_count, 0) AS workout_count,
                wl.last_active
            FROM users u
            LEFT JOIN (
                SELECT user_id, COUNT(*) AS workout_count
                FROM workouts
                GROUP BY user_id
            ) wc ON wc.user_id = u.id
            LEFT JOIN (
                SELECT user_id, MAX(created_at) AS last_active
                FROM workouts
                GROUP BY user_id
            ) wl ON wl.user_id = u.id
        `;
        const params = [];
        if (search && search.trim()) {
            params.push(`%${search.trim().toLowerCase()}%`);
            query += ` WHERE LOWER(u.name) LIKE $1 OR LOWER(u.email) LIKE $1 `;
        }
        query += ` ORDER BY u.created_at DESC NULLS LAST, u.id DESC `;

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error("GET /admin/users error:", err.message);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// ── GET /admin/users/:id ──────────────────────────────────────────────────────
router.get("/users/:id", requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

    try {
        const userRes = await pool.query(
            `SELECT id, name, email, is_disabled, disabled_reason, COALESCE(created_at, NOW()) AS created_at, token_version FROM users WHERE id = $1`,
            [userId]
        );
        if (userRes.rows.length === 0) return res.status(404).json({ error: "User not found" });

        const [statsRes, sessionsRes, metricsRes] = await Promise.all([
            pool.query(
                `SELECT
                    (SELECT COUNT(*) FROM workouts WHERE user_id = $1)  AS workout_count,
                    (SELECT COUNT(*) FROM prs      WHERE user_id = $1)  AS pr_count`,
                [userId]
            ),
            pool.query(
                `SELECT family_id, MAX(created_at) AS last_issued, MAX(expires_at) AS expires_at,
                        BOOL_OR(revoked) AS any_revoked, COUNT(*) AS token_count
                 FROM refresh_tokens WHERE user_id = $1
                 GROUP BY family_id ORDER BY last_issued DESC LIMIT 10`,
                [userId]
            ),
            pool.query(
                `SELECT COUNT(*) AS metrics_count FROM body_metrics WHERE user_id = $1`,
                [userId]
            ),
        ]);

        res.json({
            user: userRes.rows[0],
            stats: { ...statsRes.rows[0], metrics_count: metricsRes.rows[0].metrics_count },
            sessions: sessionsRes.rows,
        });
    } catch (err) {
        console.error(`GET /admin/users/${userId} error:`, err.message);
        res.status(500).json({ error: "Failed to fetch user details" });
    }
});

// ── POST /admin/users/:id/force-logout ────────────────────────────────────────
router.post("/users/:id/force-logout", requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

    try {
        // Bump token_version — invalidates ALL outstanding access JWTs for this user
        await pool.query(
            `UPDATE users SET token_version = token_version + 1 WHERE id = $1`,
            [userId]
        );
        // Also revoke all refresh tokens so they can't mint new access tokens
        await pool.query(
            `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false`,
            [userId]
        );

        await writeAdminInfo("audit", "info", `Force-logout executed for user ${userId}`, { userId });
        res.json({ message: "User force-logged out successfully" });
    } catch (err) {
        console.error(`POST /admin/users/${userId}/force-logout error:`, err.message);
        res.status(500).json({ error: "Failed to force logout" });
    }
});

// ── PATCH /admin/users/:id/disable ───────────────────────────────────────────
router.patch("/users/:id/disable", requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

    const reason = typeof req.body.reason === "string" ? req.body.reason.slice(0, 500) : null;

    try {
        const result = await pool.query(
            `UPDATE users SET is_disabled = true, disabled_reason = $2, token_version = token_version + 1
             WHERE id = $1 RETURNING id`,
            [userId, reason]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });

        // Revoke all refresh tokens too
        await pool.query(
            `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false`,
            [userId]
        );

        await writeAdminInfo("audit", "warn", `Account disabled for user ${userId}`, { userId, reason });
        res.json({ message: "Account disabled" });
    } catch (err) {
        console.error(`PATCH /admin/users/${userId}/disable error:`, err.message);
        res.status(500).json({ error: "Failed to disable account" });
    }
});

// ── PATCH /admin/users/:id/enable ────────────────────────────────────────────
router.patch("/users/:id/enable", requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

    try {
        const result = await pool.query(
            `UPDATE users SET is_disabled = false, disabled_reason = NULL WHERE id = $1 RETURNING id`,
            [userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });

        await writeAdminInfo("audit", "info", `Account re-enabled for user ${userId}`, { userId });
        res.json({ message: "Account enabled" });
    } catch (err) {
        console.error(`PATCH /admin/users/${userId}/enable error:`, err.message);
        res.status(500).json({ error: "Failed to enable account" });
    }
});

// ── DELETE /admin/users/:id ───────────────────────────────────────────────────
// Uses explicit ordered transaction — no reliance on ON DELETE CASCADE.
router.delete("/users/:id", requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

    const client = await pool.connect();
    try {
        const check = await client.query("SELECT id, name FROM users WHERE id = $1", [userId]);
        if (check.rows.length === 0) return res.status(404).json({ error: "User not found" });
        const userName = check.rows[0].name;

        await client.query("BEGIN");
        await client.query(`DELETE FROM workout_sets WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = $1)`, [userId]);
        await client.query(`DELETE FROM workouts WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM prs WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM routine_exercises WHERE routine_id IN (SELECT id FROM routines WHERE user_id = $1)`, [userId]);
        await client.query(`DELETE FROM routines WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM body_metrics WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
        await client.query("COMMIT");

        await writeAdminInfo("audit", "warn", `User account deleted: ${userName} (id=${userId})`, { userId, userName });
        res.json({ message: "User and all associated data deleted" });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error(`DELETE /admin/users/${userId} error:`, err.message);
        res.status(500).json({ error: "Failed to delete user" });
    } finally {
        client.release();
    }
});

// ── GET /admin/info ───────────────────────────────────────────────────────────
router.get("/info", requireAdmin, async (req, res) => {
    const { kind, level, limit = 100 } = req.query;
    const params = [];
    const conditions = [];

    if (kind) { params.push(kind); conditions.push(`kind = $${params.length}`); }
    if (level) { params.push(level); conditions.push(`level = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const safeLimit = Math.min(parseInt(limit, 10) || 100, 500);

    try {
        const { rows } = await pool.query(
            `SELECT * FROM admin_info ${where} ORDER BY created_at DESC LIMIT ${safeLimit}`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error("GET /admin/info error:", err.message);
        res.status(500).json({ error: "Failed to fetch info" });
    }
});

// ── DELETE /admin/info ────────────────────────────────────────────────────────
router.delete("/info", requireAdmin, async (req, res) => {
    const { kind } = req.query;
    try {
        if (kind) {
            await pool.query(`DELETE FROM admin_info WHERE kind = $1`, [kind]);
        } else {
            await pool.query(`DELETE FROM admin_info`);
        }
        res.json({ message: "Cleared" });
    } catch (err) {
        console.error("DELETE /admin/info error:", err.message);
        res.status(500).json({ error: "Failed to clear info" });
    }
});

module.exports = router;
module.exports.writeAdminInfo = writeAdminInfo;
module.exports.redact = redact;
