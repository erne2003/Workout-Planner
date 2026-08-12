require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', 1);
// Rate Limiters
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // Increased for dev
    message: { error: "Too many attempts from this IP, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
});

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // Increased for dev
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

const workoutRoutes = require("./routes/workouts.routes");
const exerciseRoutes = require("./routes/exercises.routes");
const authRoutes = require("./routes/auth.routes");
const requireAuth = require("./middleware/requireAuth");
const routinesRoutes = require("./routes/routines.routes");
const prsRoutes = require("./routes/prs.routes");
const metricsRoutes = require("./routes/metrics.routes");

const pool = require("./config/db");

app.use(express.json());

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

app.use("/auth", authLimiter, authRoutes);

// Protected routes
app.use("/workouts", requireAuth, workoutRoutes);
app.use("/exercises", requireAuth, exerciseRoutes);
app.use("/routines", requireAuth, routinesRoutes);
app.use("/prs", requireAuth, prsRoutes);
app.use("/metrics", requireAuth, metricsRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});