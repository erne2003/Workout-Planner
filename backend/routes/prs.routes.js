const express = require("express");
const router = express.Router();
const prsQueries = require("../queries/prs.queries");
const { body, validationResult } = require("express-validator");

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// POST /prs
router.post("/", [
    body("exerciseName").isString().isLength({ min: 1, max: 255 }),
    body("weight").isFloat(),
    validate
], async (req, res) => {
  const { exerciseName, weight } = req.body;
  try {
    const newPr = await prsQueries.logPR(req.userId, exerciseName, weight);
    res.status(201).json(newPr);
  } catch (err) {
    console.error("Failed to log PR:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// GET /prs?userId=1
router.get("/", async (req, res) => {
  try {
    const history = await prsQueries.getHistoricalPRs(req.userId);
    res.json(history);
  } catch (err) {
    console.error("Failed to fetch PR history:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;
