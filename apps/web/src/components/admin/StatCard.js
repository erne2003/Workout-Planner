"use client";

/**
 * StatCard — KPI metric card for the overview dashboard.
 */
export default function StatCard({ label, value, color = "var(--accent-blue)", icon }) {
    return (
        <div style={{
            background: "var(--admin-card)",
            border: "1px solid var(--admin-border)",
            borderRadius: 16,
            padding: "20px 24px",
            flex: 1,
            minWidth: 160,
        }}>
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                fontSize: 12,
                color: "var(--admin-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                fontWeight: 600,
            }}>
                {icon && <span>{icon}</span>}
                {label}
            </div>
            <div style={{
                fontSize: 36,
                fontWeight: 800,
                color,
                letterSpacing: "-1px",
                lineHeight: 1,
            }}>
                {value ?? "—"}
            </div>
        </div>
    );
}
