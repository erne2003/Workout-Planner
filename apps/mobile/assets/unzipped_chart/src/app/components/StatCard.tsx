import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  accentColor?: string;
}

export function StatCard({ label, value, sub, icon: Icon, trend, trendValue, accentColor = "#f97316" }: StatCardProps) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3 border border-border relative overflow-hidden"
      style={{ background: "var(--card)" }}
    >
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 blur-2xl"
        style={{ background: accentColor }}
      />
      <div className="flex items-center justify-between">
        <span style={{ color: "var(--muted-foreground)", fontFamily: "Barlow, sans-serif", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: accentColor + "22" }}
        >
          <Icon size={16} style={{ color: accentColor }} />
        </div>
      </div>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: "2.25rem", fontWeight: 800, color: "var(--foreground)", lineHeight: 1 }}>
        {value}
      </div>
      <div className="flex items-center gap-2">
        {trend && trendValue && (
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: trend === "up" ? "#22c55e22" : trend === "down" ? "#ef444422" : "#6b728022",
              color: trend === "up" ? "#22c55e" : trend === "down" ? "#ef4444" : "#6b7280",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.7rem",
            }}
          >
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "–"} {trendValue}
          </span>
        )}
        <span style={{ color: "var(--muted-foreground)", fontFamily: "Barlow, sans-serif", fontSize: "0.8rem" }}>
          {sub}
        </span>
      </div>
    </div>
  );
}
