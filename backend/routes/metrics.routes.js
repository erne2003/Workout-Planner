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
// Accepts a full snapshot (onboarding) or a partial update (e.g. just weight) -
// missing fields are carried forward from the user's most recent snapshot.
router.post("/", [
    body("trainingYears").optional({ nullable: true }).isFloat(),
    body("weight").isFloat(),
    body("height").optional().isString().isLength({ max: 255 }),
    body("bodyFat").optional({ nullable: true }).isFloat(),
    body("gender").optional().isString().isLength({ max: 10 }),
    validate
], async (req, res) => {
  const { weight } = req.body;
  let { trainingYears, height, bodyFat, gender } = req.body;
  try {
    if (trainingYears === undefined || height === undefined || gender === undefined) {
      const latest = await metricsQueries.getLatestMetric(req.userId);
      if (trainingYears === undefined) trainingYears = latest?.training_years ?? 0;
      if (height === undefined) height = latest?.height ?? "Not Selected";
      if (gender === undefined) gender = latest?.gender ?? "male";
      if (bodyFat === undefined) bodyFat = latest?.body_fat ?? null;
    }

    const newMetric = await metricsQueries.logMetrics(req.userId, trainingYears, weight, height, bodyFat, gender);
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
