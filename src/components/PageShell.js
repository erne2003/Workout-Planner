import BottomNav from "./BottomNav";

export default function PageShell({ title, subtitle, badge, badgeColor = "badge-blue", children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        maxWidth: "430px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        background: "var(--bg-base)",
        overflow: "hidden",
      }}
    >
      {/* Ambient background */}
      <div className="ambient-bg">
        <div className="ambient-orb orb-blue" />
        <div className="ambient-orb orb-red" />
      </div>

      {/* Header */}
      <header
        style={{
          position: "relative",
          zIndex: 10,
          padding: "54px 22px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "24px",
                fontWeight: 800,
                letterSpacing: "-0.6px",
                color: "var(--text-primary)",
              }}
            >
              {title}
            </h1>
            {badge && <span className={`badge ${badgeColor}`}>{badge}</span>}
          </div>
          {subtitle && (
            <p
              style={{
                fontSize: "11px",
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "1.2px",
                fontWeight: 500,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* Avatar */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #FF2D55, #0A84FF)",
            padding: "2px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: "#111120",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-display)",
              fontSize: "13px",
              fontWeight: 800,
              color: "#fff",
            }}
          >
            JD
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          position: "relative",
          zIndex: 10,
          padding: "4px 16px 110px",
        }}
      >
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
