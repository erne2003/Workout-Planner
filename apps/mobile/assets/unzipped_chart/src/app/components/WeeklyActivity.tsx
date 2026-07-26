import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";

const data = [
  { day: "Mon", duration: 75, type: "Chest" },
  { day: "Tue", duration: 60, type: "Back" },
  { day: "Wed", duration: 0, type: "Rest" },
  { day: "Thu", duration: 80, type: "Legs" },
  { day: "Fri", duration: 65, type: "Shoulders" },
  { day: "Sat", duration: 90, type: "Full Body" },
  { day: "Sun", duration: 0, type: "Rest" },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length && payload[0].value > 0) {
    return (
      <div
        className="rounded-lg p-3 border border-border"
        style={{ background: "#1e2126", fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}
      >
        <div style={{ color: "var(--foreground)" }}>{label} — {payload[0].payload.type}</div>
        <div style={{ color: "#f97316", marginTop: 4 }}>{payload[0].value} min</div>
      </div>
    );
  }
  return null;
};

export function WeeklyActivity() {
  const totalMinutes = data.reduce((s, d) => s + d.duration, 0);
  const sessions = data.filter((d) => d.duration > 0).length;

  return (
    <div
      className="rounded-xl p-5 border border-border flex flex-col gap-4"
      style={{ background: "var(--card)" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "var(--foreground)" }}>
            THIS WEEK
          </h2>
          <p style={{ color: "var(--muted-foreground)", fontFamily: "Barlow, sans-serif", fontSize: "0.8rem" }}>
            {sessions} sessions · {totalMinutes} min total
          </p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: "#6b7280", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#6b7280", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}m`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="duration" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.duration === 0 ? "#1e2126" : "#f97316"}
                opacity={entry.duration === 0 ? 0.5 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
