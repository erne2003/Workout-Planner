import { Target } from "lucide-react";

const goals = [
  { label: "Bench 110 kg", current: 100, target: 110, unit: "kg", color: "#f97316" },
  { label: "Squat 140 kg", current: 130, target: 140, unit: "kg", color: "#3b82f6" },
  { label: "Body weight 85 kg", current: 87.1, target: 85, unit: "kg", color: "#22c55e", inverse: true },
  { label: "Deadlift 160 kg", current: 152, target: 160, unit: "kg", color: "#a855f7" },
];

export function GoalsProgress() {
  return (
    <div
      className="rounded-xl p-5 border border-border flex flex-col gap-4"
      style={{ background: "var(--card)" }}
    >
      <div className="flex items-center gap-2">
        <Target size={16} style={{ color: "#f97316" }} />
        <h2 style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "var(--foreground)" }}>
          GOALS
        </h2>
      </div>
      <div className="flex flex-col gap-4">
        {goals.map((goal) => {
          const pct = goal.inverse
            ? Math.min(100, Math.round(((goal.current - goal.target) / (87.1 - goal.target)) * 100))
            : Math.min(100, Math.round((goal.current / goal.target) * 100));
          const progress = goal.inverse
            ? Math.min(100, Math.round(((87.1 - goal.current) / (87.1 - goal.target)) * 100))
            : Math.min(100, Math.round((goal.current / goal.target) * 100));

          return (
            <div key={goal.label} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span style={{ fontFamily: "Barlow, sans-serif", fontSize: "0.85rem", color: "var(--foreground)" }}>
                  {goal.label}
                </span>
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", color: goal.color }}>
                  {progress}%
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--muted)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${progress}%`, background: goal.color }}
                />
              </div>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.7rem", color: "var(--muted-foreground)" }}>
                {goal.current} / {goal.target} {goal.unit}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
