"use client";

/**
 * StatusBadge — renders a colored pill for user account state.
 */
export default function StatusBadge({ disabled }) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                background: disabled ? "rgba(255,45,85,0.15)" : "rgba(48,209,88,0.15)",
                color: disabled ? "var(--accent-red)" : "var(--accent-green)",
                border: `1px solid ${disabled ? "rgba(255,45,85,0.3)" : "rgba(48,209,88,0.3)"}`,
            }}
        >
            <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: disabled ? "var(--accent-red)" : "var(--accent-green)",
            }} />
            {disabled ? "Disabled" : "Active"}
        </span>
    );
}
