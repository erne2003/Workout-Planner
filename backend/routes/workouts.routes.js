const express = require("express");
const router = express.Router();

/*
 GET all workouts
*/
router.get("/", (req, res) => {
    res.send("All workouts route is working");
});

/*
 CREATE new workout
*/
router.post("/", (req, res) => {
    res.send("Create workout route is working");
});

module.exports = router;