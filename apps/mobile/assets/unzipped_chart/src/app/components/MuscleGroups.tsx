import { RadialBarChart, RadialBar, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { name: "Legs", value: 28, fill: "#3b82f6" },
  { name: "Back", value: 22, fill: "#22c55e" },
  { name: "Chest", value: 18, fill: "#f97316" },
  { name: "Shoulders", value: 14, fill: "#a855f7" },
  { name: "Arms", value: 11, fill: "#eab308" },
  { name: "Core", value: 7, fill: "#6b7280" },
];

export function MuscleGroups() {
  return (
    <div
      className="rounded-xl p-5 border border-border flex flex-col gap-4"
      style={{ background: "var(--card)" }}
    >
      <div>
        <h2 style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "var(--foreground)" }}>
          MUSCLE FOCUS
        </h2>
        <p style={{ color: "var(--muted-foreground)", fontFamily: "Barlow, sans-serif", fontSize: "0.8rem" }}>
          % of volume this month
        </p>
      </div>
      <div className="flex gap-4 items-center">
        <ResponsiveContainer width={120} height={120}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius={20}
            outerRadius={55}
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar dataKey="value" background={{ fill: "#1e2126" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-2 flex-1">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.fill, display: "inline-block", flexShrink: 0 }} />
              <span style={{ color: "var(--muted-foreground)", fontFamily: "Barlow, sans-serif", fontSize: "0.78rem", flex: 1 }}>
                {item.name}
              </span>
              <span style={{ color: "var(--foreground)", fontFamily: "JetBrains Mono, monospace", fontSize: "0.78rem" }}>
                {item.value}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
