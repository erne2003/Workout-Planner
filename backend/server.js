require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = 5000;

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
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true 
}));

const workoutRoutes = require("./routes/workouts.routes");
const exerciseRoutes = require("./routes/exercises.routes");
const authRoutes = require("./routes/auth.routes");
const requireAuth = require("./middleware/requireAuth");
const routinesRoutes = require("./routes/routines.routes");
const prsRoutes = require("./routes/prs.routes");
const metricsRoutes = require("./routes/metrics.routes");

app.use(express.json());

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