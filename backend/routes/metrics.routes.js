const express = require("express");
const router = express.Router();
const metricsQueries = require("../queries/metrics.queries");

// POST /metrics
router.post("/", async (req, res) => {
  const { userId, trainingYears, weight, height, bodyFat } = req.body;
  try {
    const newMetric = await metricsQueries.logMetrics(userId || 1, trainingYears, weight, height, bodyFat);
    res.status(201).json(newMetric);
  } catch (err) {
    console.error("Failed to log Body Metrics:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// GET /metrics?userId=1
router.get("/", async (req, res) => {
  const { userId } = req.query;
  try {
    const history = await metricsQueries.getHistoricalMetrics(userId || 1);
    res.json(history);
  } catch (err) {
    console.error("Failed to fetch Body Metrics history:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;
