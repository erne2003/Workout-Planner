require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', 1);

// ── Rate Limiters ──────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Too many attempts from this IP, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
});

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { error: "Too many requests from this IP, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(globalLimiter);
app.use(cors({
    origin: (origin, callback) => {
        // Allow all origins dynamically (essential for EAS build, web previews, and local/network development)
        callback(null, true);
    },
    credentials: true
}));
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────────
const workoutRoutes  = require("./routes/workouts.routes");
const exerciseRoutes = require("./routes/exercises.routes");
const authRoutes     = require("./routes/auth.routes");
const requireAuth    = require("./middleware/requireAuth");
const routinesRoutes = require("./routes/routines.routes");
const prsRoutes      = require("./routes/prs.routes");
const metricsRoutes  = require("./routes/metrics.routes");
const adminRoutes    = require("./routes/admin.routes");

const pool = require("./config/db");

// ── Health ─────────────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/health-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json({ ok: true, db: result.rows[0].now });
    } catch (err) {
        console.error("Health-db check failed:", err.message);
        res.status(500).json({ error: "Database health check failed", details: err.message });
    }
});

// ── Auth (rate-limited) ────────────────────────────────────────────────────────
app.use("/auth", authLimiter, authRoutes);

// ── Admin (has its own internal rate limiter on /admin/login) ──────────────────
app.use("/admin", adminRoutes);

// ── Protected user routes ──────────────────────────────────────────────────────
app.use("/workouts",  requireAuth, workoutRoutes);
app.use("/exercises", requireAuth, exerciseRoutes);
app.use("/routines",  requireAuth, routinesRoutes);
app.use("/prs",       requireAuth, prsRoutes);
app.use("/metrics",   requireAuth, metricsRoutes);

// ── Global error capture → admin_info ─────────────────────────────────────────
// Writes unhandled Express errors to admin_info for the dashboard to surface.
// Redacts sensitive fields and is fire-and-forget so a logging failure never
// masks the real error from the user.
const { writeAdminInfo, redact } = require("./routes/admin.routes");

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error("[Unhandled Error]", err.message, err.stack);

    const context = {
        method: req.method,
        path: req.path,
        body: redact(req.body),
        // Redact auth header but keep other headers for debugging
        headers: redact(
            Object.fromEntries(
                Object.entries(req.headers).filter(([k]) => k !== "cookie")
            )
        ),
        status: err.status || 500,
    };

    // Fire-and-forget — must not throw
    writeAdminInfo("log", "error", err.message || "Unknown server error", context);

    if (!res.headersSent) {
        res.status(err.status || 500).json({ error: "Internal server error" });
    }
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});