require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5000;
app.use(cors());
const workoutRoutes = require("./routes/workouts.routes");
const exerciseRoutes = require("./routes/exercises.routes");
const authRoutes = require("./routes/auth.routes");

app.use(express.json());

app.use("/auth", authRoutes);
app.use("/workouts", workoutRoutes);
app.use("/exercises", exerciseRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});