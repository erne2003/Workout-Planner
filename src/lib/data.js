// ─── Shared data constants used across all dashboard screens ───────────────

export const MUSCLE_RECOVERY = {
  chest:      { recovery: 42, status: "sore" },
  shoulders:  { recovery: 78, status: "moderate" },
  biceps:     { recovery: 35, status: "sore" },
  triceps:    { recovery: 88, status: "fresh" },
  lats:       { recovery: 61, status: "moderate" },
  core:       { recovery: 95, status: "fresh" },
  quads:      { recovery: 28, status: "sore" },
  hamstrings: { recovery: 55, status: "moderate" },
  glutes:     { recovery: 70, status: "moderate" },
  calves:     { recovery: 91, status: "fresh" },
};

export const STRENGTH_SCORES = [
  { muscle: "Chest",     score: 82, prev: 78, color: "#0A84FF" },
  { muscle: "Back",      score: 91, prev: 87, color: "#30D158" },
  { muscle: "Shoulders", score: 74, prev: 71, color: "#FF9F0A" },
  { muscle: "Arms",      score: 68, prev: 65, color: "#BF5AF2" },
  { muscle: "Legs",      score: 57, prev: 52, color: "#FF2D55" },
  { muscle: "Core",      score: 88, prev: 84, color: "#FFD60A" },
];

export const OVERALL_STRENGTH_SCORE = 77;

export const PROGRESS_DATA = [
  { week: "W1", bench: 185, squat: 245, deadlift: 315 },
  { week: "W2", bench: 195, squat: 255, deadlift: 325 },
  { week: "W3", bench: 205, squat: 265, deadlift: 335 },
  { week: "W4", bench: 215, squat: 275, deadlift: 345 },
  { week: "W5", bench: 210, squat: 280, deadlift: 355 },
  { week: "W6", bench: 225, squat: 290, deadlift: 365 },
  { week: "W7", bench: 235, squat: 295, deadlift: 375 },
  { week: "W8", bench: 245, squat: 305, deadlift: 385 },
];

export const PERSONAL_RECORDS = {
  bench:    { weight: 265, unit: "lbs", gain: "+20" },
  squat:    { weight: 335, unit: "lbs", gain: "+30" },
  deadlift: { weight: 405, unit: "lbs", gain: "+40" },
};

export const WORKOUT_EXERCISES = [
  {
    id: 1,
    name: "Bench Press",
    muscle: "Chest",
    accentColor: "#0A84FF",
    sets: [
      { reps: 8,  weight: 225, rir: 0 },
      { reps: 8,  weight: 235, rir: 0 },
      { reps: 6,  weight: 245, rir: 0 },
      { reps: 6,  weight: 245, rir: 0 },
    ],
  },
  {
    id: 2,
    name: "Incline DB Press",
    muscle: "Upper Chest",
    accentColor: "#FF9F0A",
    sets: [
      { reps: 10, weight: 75, rir: 0 },
      { reps: 10, weight: 80, rir: 0 },
      { reps: 8,  weight: 80, rir: 0 },
    ],
  },
  {
    id: 3,
    name: "Cable Flies",
    muscle: "Chest",
    accentColor: "#BF5AF2",
    sets: [
      { reps: 12, weight: 40, rir: 0 },
      { reps: 12, weight: 40, rir: 0 },
      { reps: 12, weight: 40, rir: 0 },
    ],
  },
  {
    id: 4,
    name: "Tricep Pushdown",
    muscle: "Triceps",
    accentColor: "#30D158",
    sets: [
      { reps: 12, weight: 55, rir: 0 },
      { reps: 12, weight: 60, rir: 0 },
      { reps: 10, weight: 65, rir: 0 },
    ],
  },
];

export const STATUS_COLOR = {
  fresh:    "#30D158",
  moderate: "#FF9F0A",
  sore:     "#FF2D55",
};

export const STATUS_LABEL = {
  fresh:    "Fresh",
  moderate: "Moderate",
  sore:     "Sore",
};
