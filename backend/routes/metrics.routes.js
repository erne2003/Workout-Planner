const express = require("express");
const router = express.Router();
const metricsQueries = require("../queries/metrics.queries");
const { body, validationResult } = require("express-validator");

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// POST /metrics
router.post("/", [
    body("trainingYears").isFloat(),
    body("weight").isFloat(),
    body("height").isString().isLength({ max: 255 }),
    body("bodyFat").optional({ nullable: true }).isFloat(),
    validate
], async (req, res) => {
  const { trainingYears, weight, height, bodyFat } = req.body;
  try {
    const newMetric = await metricsQueries.logMetrics(req.userId, trainingYears, weight, height, bodyFat);
    res.status(201).json(newMetric);
  } catch (err) {
    console.error("Failed to log Body Metrics:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// GET /metrics?userId=1
router.get("/", async (req, res) => {
  try {
    const history = await metricsQueries.getHistoricalMetrics(req.userId);
    res.json(history);
  } catch (err) {
    console.error("Failed to fetch Body Metrics history:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;
