const express = require("express");

const app = express();
const PORT = 5000;

const workoutRoutes = require("./routes/workouts.routes");

app.use(express.json());

app.use("/workouts", workoutRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});