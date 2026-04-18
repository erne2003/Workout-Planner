// ─── Shared data constants used across all dashboard screens ───────────────

export const MUSCLE_RECOVERY = {
  chest:      { recovery: 42, status: "not_optimal" },
  shoulders:  { recovery: 78, status: "good" },
  biceps:     { recovery: 35, status: "not_optimal" },
  triceps:    { recovery: 88, status: "great" },
  lats:       { recovery: 61, status: "good" },
  core:       { recovery: 95, status: "great" },
  quads:      { recovery: 28, status: "not_optimal" },
  hamstrings: { recovery: 55, status: "good" },
  glutes:     { recovery: 70, status: "good" },
  calves:     { recovery: 91, status: "great" },
};

export const STRENGTH_SCORES = [
  { muscle: "Chest",     score: 0, prev: 0, color: "#0A84FF" },
  { muscle: "Back",      score: 0, prev: 0, color: "#30D158" },
  { muscle: "Shoulders", score: 0, prev: 0, color: "#FF9F0A" },
  { muscle: "Arms",      score: 0, prev: 0, color: "#BF5AF2" },
  { muscle: "Legs",      score: 0, prev: 0, color: "#FF2D55" },
  { muscle: "Core",      score: 0, prev: 0, color: "#FFD60A" },
];

export const OVERALL_STRENGTH_SCORE = 0;

export const PROGRESS_DATA = [
  { week: "W1", bench: 0, squat: 0, deadlift: 0 },
  { week: "W2", bench: 0, squat: 0, deadlift: 0 },
  { week: "W3", bench: 0, squat: 0, deadlift: 0 },
  { week: "W4", bench: 0, squat: 0, deadlift: 0 },
  { week: "W5", bench: 0, squat: 0, deadlift: 0 },
  { week: "W6", bench: 0, squat: 0, deadlift: 0 },
  { week: "W7", bench: 0, squat: 0, deadlift: 0 },
  { week: "W8", bench: 0, squat: 0, deadlift: 0 },
];

export const PERSONAL_RECORDS = {
  bench:    { weight: 0, unit: "lbs", gain: "" },
  squat:    { weight: 0, unit: "lbs", gain: "" },
  deadlift: { weight: 0, unit: "lbs", gain: "" },
};

export const WORKOUT_EXERCISES = [];

export const STATUS_COLOR = {
  great:       "#30D158",
  good:        "#0A84FF",
  not_optimal: "#FF2D55",
};

export const STATUS_LABEL = {
  great:       "Great",
  good:        "Good",
  not_optimal: "Not Optimal",
};
