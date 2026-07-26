import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { week: "Jan 1", weight: 92.4 },
  { week: "Jan 8", weight: 91.8 },
  { week: "Jan 15", weight: 91.2 },
  { week: "Jan 22", weight: 90.9 },
  { week: "Feb 1", weight: 90.1 },
  { week: "Feb 8", weight: 89.6 },
  { week: "Feb 15", weight: 89.2 },
  { week: "Feb 22", weight: 88.8 },
  { week: "Mar 1", weight: 88.3 },
  { week: "Mar 8", weight: 87.9 },
  { week: "Mar 15", weight: 87.5 },
  { week: "Mar 22", weight: 87.1 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="rounded-lg p-3 border border-border"
        style={{ background: "#1e2126", fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}
      >
        <div style={{ color: "var(--muted-foreground)", marginBottom: 4 }}>{label}</div>
        <div style={{ color: "#22c55e" }}>{payload[0].value} kg</div>
      </div>
    );
  }
  return null;
};

export function BodyWeightChart() {
  const start = data[0].weight;
  const current = data[data.length - 1].weight;
  const lost = (start - current).toFixed(1);

  return (
    <div
      className="rounded-xl p-5 border border-border flex flex-col gap-4"
      style={{ background: "var(--card)" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "var(--foreground)" }}>
            BODY WEIGHT
          </h2>
          <p style={{ color: "var(--muted-foreground)", fontFamily: "Barlow, sans-serif", fontSize: "0.8rem" }}>
            −{lost} kg over 12 weeks
          </p>
        </div>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: "1.5rem", color: "#22c55e" }}>
          {current} kg
        </div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="week"
            tick={{ fill: "#6b7280", fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={3}
          />
          <YAxis
            domain={["dataMin - 1", "dataMax + 1"]}
            tick={{ fill: "#6b7280", fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="weight"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#weightGrad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
