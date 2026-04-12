import BottomNav from "./BottomNav";

export default function PageShell({ title, subtitle, badge, badgeColor = "badge-blue", backAction, onSettingsClick, children }) {
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
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div style={{ flex: 1, marginRight: "20px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "4px" }}>
            {backAction && (
              <button
                onClick={backAction}
                style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", padding: "6px 4px 0 0" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>
            )}
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "24px",
                fontWeight: 800,
                letterSpacing: "-0.6px",
                color: "var(--text-primary)",
                lineHeight: "1.2",
              }}
            >
              {title}
            </h1>
            {badge && <span className={`badge ${badgeColor}`} style={{ marginTop: "4px" }}>{badge}</span>}
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

        {/* Right Actions (EC + Settings) */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
          {/* Avatar (EC) */}
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #FF2D55, #0A84FF)",
              padding: "2px",
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
                fontSize: "12px",
                fontWeight: 800,
                color: "#fff",
              }}
            >
              EC
            </div>
          </div>

          {/* Settings Button (Engine/Gear) */}
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                width: "38px",
                height: "38px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-tertiary)",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
              onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1 1.51H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
          )}
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
