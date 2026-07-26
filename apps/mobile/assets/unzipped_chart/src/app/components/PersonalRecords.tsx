import { Trophy } from "lucide-react";

const records = [
  { lift: "Deadlift", weight: "152 kg", reps: "1RM", date: "Mar 22", prev: "145 kg", delta: "+7" },
  { lift: "Squat", weight: "130 kg", reps: "1RM", date: "Mar 18", prev: "122 kg", delta: "+8" },
  { lift: "Bench Press", weight: "100 kg", reps: "1RM", date: "Mar 15", prev: "95 kg", delta: "+5" },
  { lift: "OHP", weight: "72 kg", reps: "1RM", date: "Mar 10", prev: "70 kg", delta: "+2" },
  { lift: "Romanian DL", weight: "110 kg", reps: "5RM", date: "Mar 5", prev: "105 kg", delta: "+5" },
];

export function PersonalRecords() {
  return (
    <div
      className="rounded-xl p-5 border border-border flex flex-col gap-4"
      style={{ background: "var(--card)" }}
    >
      <div className="flex items-center gap-2">
        <Trophy size={16} style={{ color: "#f97316" }} />
        <h2 style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "var(--foreground)" }}>
          PERSONAL RECORDS
        </h2>
      </div>
      <div className="flex flex-col">
        {records.map((r, i) => (
          <div
            key={r.lift}
            className="flex items-center gap-3 py-3"
            style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
          >
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.7rem",
                color: "var(--muted-foreground)",
                width: 20,
                textAlign: "right",
              }}
            >
              {i + 1}
            </span>
            <span style={{ flex: 1, fontFamily: "Barlow, sans-serif", fontSize: "0.9rem", color: "var(--foreground)" }}>
              {r.lift}
            </span>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.8rem", color: "var(--foreground)" }}>
              {r.weight}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: "#22c55e22",
                color: "#22c55e",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.7rem",
                minWidth: 40,
                textAlign: "center",
              }}
            >
              +{r.delta.replace("+", "")} kg
            </span>
            <span style={{ fontFamily: "Barlow, sans-serif", fontSize: "0.75rem", color: "var(--muted-foreground)", minWidth: 44, textAlign: "right" }}>
              {r.date}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
