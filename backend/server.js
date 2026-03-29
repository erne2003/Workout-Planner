require("dotenv").config();
const express = require("express");

const app = express();
const PORT = 5000;

const workoutRoutes = require("./routes/workouts.routes");
const exerciseRoutes = require("./routes/exercises.routes");

app.use(express.json());

app.use("/workouts", workoutRoutes);
app.use("/exercises", exerciseRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});