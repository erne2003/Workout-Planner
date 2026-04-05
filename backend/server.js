require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5000;
app.use(cors());
const workoutRoutes = require("./routes/workouts.routes");
const exerciseRoutes = require("./routes/exercises.routes");
const authRoutes = require("./routes/auth.routes");
const routinesRoutes = require("./routes/routines.routes");
const prsRoutes = require("./routes/prs.routes");
const metricsRoutes = require("./routes/metrics.routes");

app.use(express.json());

app.use("/auth", authRoutes);
app.use("/workouts", workoutRoutes);
app.use("/exercises", exerciseRoutes);
app.use("/routines", routinesRoutes);
app.use("/prs", prsRoutes);
app.use("/metrics", metricsRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});