import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const weeklyData = [
  { week: "W1", bench: 80, squat: 100, deadlift: 120 },
  { week: "W2", bench: 82, squat: 102, deadlift: 122 },
  { week: "W3", bench: 82, squat: 105, deadlift: 125 },
  { week: "W4", bench: 85, squat: 107, deadlift: 127 },
  { week: "W5", bench: 87, squat: 110, deadlift: 130 },
  { week: "W6", bench: 87, squat: 112, deadlift: 133 },
  { week: "W7", bench: 90, squat: 115, deadlift: 135 },
  { week: "W8", bench: 92, squat: 117, deadlift: 138 },
  { week: "W9", bench: 92, squat: 120, deadlift: 140 },
  { week: "W10", bench: 95, squat: 122, deadlift: 145 },
  { week: "W11", bench: 97, squat: 125, deadlift: 147 },
  { week: "W12", bench: 100, squat: 130, deadlift: 152 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="rounded-lg p-3 border border-border"
        style={{ background: "#1e2126", fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}
      >
        <div style={{ color: "var(--muted-foreground)", marginBottom: 6 }}>{label}</div>
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
            <span style={{ color: entry.color }}>●</span>
            <span style={{ color: "var(--muted-foreground)", textTransform: "capitalize" }}>{entry.dataKey}</span>
            <span style={{ color: "var(--foreground)", marginLeft: "auto", paddingLeft: 12 }}>{entry.value} kg</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function StrengthChart() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div
      className="rounded-xl p-5 border border-border flex flex-col gap-4"
      style={{ background: "var(--card)" }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "var(--foreground)" }}>
            STRENGTH PROGRESS
          </h2>
          <p style={{ color: "var(--muted-foreground)", fontFamily: "Barlow, sans-serif", fontSize: "0.8rem" }}>
            12-week compound lift progression
          </p>
        </div>
        <div className="flex gap-3">
          {["bench", "squat", "deadlift"].map((key, i) => {
            const colors = ["#f97316", "#22c55e", "#3b82f6"];
            const labels = ["Bench", "Squat", "Deadlift"];
            return (
              <button
                key={key}
                onClick={() => setActive(active === key ? null : key)}
                className="flex items-center gap-1.5 transition-opacity"
                style={{
                  opacity: active && active !== key ? 0.4 : 1,
                  fontFamily: "Barlow, sans-serif",
                  fontSize: "0.75rem",
                  color: "var(--muted-foreground)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: colors[i], display: "inline-block" }} />
                {labels[i]}
              </button>
            );
          })}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="week"
            tick={{ fill: "#6b7280", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#6b7280", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}kg`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="bench"
            stroke="#f97316"
            strokeWidth={active && active !== "bench" ? 1 : 2.5}
            dot={false}
            activeDot={{ r: 4, fill: "#f97316" }}
            opacity={active && active !== "bench" ? 0.3 : 1}
          />
          <Line
            type="monotone"
            dataKey="squat"
            stroke="#22c55e"
            strokeWidth={active && active !== "squat" ? 1 : 2.5}
            dot={false}
            activeDot={{ r: 4, fill: "#22c55e" }}
            opacity={active && active !== "squat" ? 0.3 : 1}
          />
          <Line
            type="monotone"
            dataKey="deadlift"
            stroke="#3b82f6"
            strokeWidth={active && active !== "deadlift" ? 1 : 2.5}
            dot={false}
            activeDot={{ r: 4, fill: "#3b82f6" }}
            opacity={active && active !== "deadlift" ? 0.3 : 1}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
