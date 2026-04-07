"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageShell from "../../components/PageShell";

export default function SettingsPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("—");
  const [theme, setTheme] = useState("dark");
  const [weightUnit, setWeightUnit] = useState("lbs");
  const [lengthUnit, setLengthUnit] = useState("in");
  const [defaultRIR, setDefaultRIR] = useState(2);
  const [restTimer, setRestTimer] = useState(90);
  const [plateCalc, setPlateCalc] = useState(true);
  const [barWeight, setBarWeight] = useState(45);
  const [autoStartRest, setAutoStartRest] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [timerAlerts, setTimerAlerts] = useState(true);

  // Load from localStorage
  useEffect(() => {
    setUserName(localStorage.getItem("userName") || "");
    setUserEmail(localStorage.getItem("userEmail") || "—");
    
    const savedTheme = localStorage.getItem("theme") || "dark";
    setTheme(savedTheme);
    if (savedTheme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");

    setWeightUnit(localStorage.getItem("weightUnit") || "lbs");
    setLengthUnit(localStorage.getItem("lengthUnit") || "in");
    setDefaultRIR(parseInt(localStorage.getItem("defaultRIR")) || 2);
    setRestTimer(parseInt(localStorage.getItem("restTimer")) || 90);
    setPlateCalc(localStorage.getItem("plateCalc") !== "false");
    setBarWeight(parseFloat(localStorage.getItem("barWeight")) || 45);
    setAutoStartRest(localStorage.getItem("autoStartRest") !== "false");
    
    const notifs = JSON.parse(localStorage.getItem("notifications") || '{"reminders": true, "alerts": true}');
    setReminders(notifs.reminders);
    setTimerAlerts(notifs.alerts);
  }, []);

  // Persistence helpers
  const save = (key, val) => {
    localStorage.setItem(key, val);
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    save("theme", newTheme);
    if (newTheme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  };

  const handleNameBlur = () => {
    save("userName", userName);
  };

  const logout = () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    router.push("/login");
  };

  const sectionLabelStyle = {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-tertiary)",
    textTransform: "uppercase",
    letterSpacing: "1.4px",
    paddingLeft: "4px",
    marginBottom: "8px"
  };

  const rowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 20px"
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    padding: "8px 12px",
    color: "var(--accent-blue)",
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    outline: "none",
    textAlign: "right"
  };

  return (
    <PageShell title="Settings" backAction={() => router.back()}>
      <div style={{ paddingBottom: "120px", display: "flex", flexDirection: "column", gap: "32px" }}>
        
        {/* Profile */}
        <section>
          <div style={sectionLabelStyle}>Profile</div>
          <div className="glass-card" style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: "4px" }}>Display Name</div>
            <input 
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                color: "#fff",
                fontFamily: "var(--font-display)",
                fontSize: "20px",
                fontWeight: 700,
                width: "100%",
                outline: "none"
              }}
              placeholder="Your Name"
            />
          </div>
        </section>

        {/* Appearance */}
        <section>
          <div style={sectionLabelStyle}>Appearance</div>
          <div className="glass-card" style={rowStyle}>
            <span style={{ fontWeight: 600 }}>Dark Mode</span>
            <Toggle active={theme === "dark"} onClick={toggleTheme} color="var(--accent-blue)" />
          </div>
        </section>

        {/* Units */}
        <section>
          <div style={sectionLabelStyle}>Units</div>
          <div className="glass-card" style={{ display: "flex", flexDirection: "column" }}>
            <div style={rowStyle}>
              <span style={{ fontWeight: 600 }}>Weight Unit</span>
              <UnitToggle 
                options={["lbs", "kg"]} 
                active={weightUnit} 
                onChange={(v) => { setWeightUnit(v); save("weightUnit", v); }} 
              />
            </div>
            <div style={{ height: "1px", background: "var(--border)", margin: "0 20px" }} />
            <div style={rowStyle}>
              <span style={{ fontWeight: 600 }}>Length Unit</span>
              <UnitToggle 
                options={["in", "cm"]} 
                active={lengthUnit} 
                onChange={(v) => { setLengthUnit(v); save("lengthUnit", v); }} 
              />
            </div>
          </div>
        </section>

        {/* Workout Defaults */}
        <section>
          <div style={sectionLabelStyle}>Workout Defaults</div>
          <div className="glass-card" style={{ display: "flex", flexDirection: "column" }}>
            <div style={rowStyle}>
              <span style={{ fontWeight: 600 }}>Default RIR Target</span>
              <input 
                type="number" min="0" max="5" value={defaultRIR}
                onChange={(e) => { const v = parseInt(e.target.value); setDefaultRIR(v); save("defaultRIR", v); }}
                style={{ ...inputStyle, width: "70px" }}
              />
            </div>
            <div style={{ height: "1px", background: "var(--border)", margin: "0 20px" }} />
            <div style={rowStyle}>
              <span style={{ fontWeight: 600 }}>Rest Timer (sec)</span>
              <input 
                type="number" value={restTimer}
                onChange={(e) => { const v = parseInt(e.target.value); setRestTimer(v); save("restTimer", v); }}
                style={{ ...inputStyle, width: "80px" }}
              />
            </div>
            <div style={{ height: "1px", background: "var(--border)", margin: "0 20px" }} />
            <div style={rowStyle}>
              <span style={{ fontWeight: 600 }}>Auto-start Rest Timer</span>
              <Toggle active={autoStartRest} onClick={() => { const v = !autoStartRest; setAutoStartRest(v); save("autoStartRest", v); }} color="var(--accent-green)" />
            </div>
            <div style={{ height: "1px", background: "var(--border)", margin: "0 20px" }} />
            <div style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: plateCalc ? "14px" : 0 }}>
                <span style={{ fontWeight: 600 }}>Plate Calculator</span>
                <Toggle active={plateCalc} onClick={() => { const v = !plateCalc; setPlateCalc(v); save("plateCalc", v); }} color="var(--accent-blue)" />
              </div>
              {plateCalc && (
                <div className="animate-fade-in" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}>Bar Weight ({weightUnit})</span>
                  <input 
                    type="number" value={barWeight}
                    onChange={(e) => { const v = parseFloat(e.target.value); setBarWeight(v); save("barWeight", v); }}
                    style={{ ...inputStyle, width: "80px", background: "rgba(255,255,255,0.05)" }}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <div style={sectionLabelStyle}>Notifications</div>
          <div className="glass-card" style={{ display: "flex", flexDirection: "column" }}>
            <div style={rowStyle}>
              <span style={{ fontWeight: 600 }}>Workout Reminders</span>
              <Toggle active={reminders} onClick={() => { 
                const v = !reminders; setReminders(v); save("notifications", JSON.stringify({ reminders: v, alerts: timerAlerts })); 
              }} color="var(--accent-blue)" />
            </div>
            <div style={{ height: "1px", background: "var(--border)", margin: "0 20px" }} />
            <div style={rowStyle}>
              <span style={{ fontWeight: 600 }}>Rest Timer Alerts</span>
              <Toggle active={timerAlerts} onClick={() => { 
                const v = !timerAlerts; setTimerAlerts(v); save("notifications", JSON.stringify({ reminders: reminders, alerts: v })); 
              }} color="var(--accent-blue)" />
            </div>
          </div>
        </section>

        {/* Account */}
        <section>
          <div style={sectionLabelStyle}>Account</div>
          <div className="glass-card" style={{ overflow: "hidden" }}>
            <div style={rowStyle}>
              <span style={{ fontWeight: 600 }}>Email</span>
              <span style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>{userEmail}</span>
            </div>
            <button 
              onClick={logout}
              style={{
                width: "100%",
                padding: "20px",
                background: "rgba(255,45,85,0.08)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                color: "var(--accent-red)",
                fontFamily: "var(--font-display)",
                fontSize: "15px",
                fontWeight: 800,
                cursor: "pointer"
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              <span>Log Out</span>
            </button>
          </div>
        </section>

      </div>
    </PageShell>
  );
}

function Toggle({ active, onClick, color }) {
  return (
    <button 
      onClick={onClick}
      style={{
        width: "48px",
        height: "24px",
        borderRadius: "24px",
        background: active ? color : "rgba(255,255,255,0.1)",
        padding: "3px",
        border: "none",
        cursor: "pointer",
        transition: "background 0.3s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: active ? "flex-end" : "flex-start"
      }}
    >
      <div 
        style={{
          width: "18px",
          height: "18px",
          background: "#fff",
          borderRadius: "50%",
          boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
          transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
        }}
      />
    </button>
  );
}

function UnitToggle({ options, active, onChange }) {
  return (
    <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", padding: "4px", borderRadius: "12px" }}>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding: "6px 14px",
            borderRadius: "9px",
            fontSize: "11px",
            fontWeight: 800,
            textTransform: "uppercase",
            border: "none",
            cursor: "pointer",
            background: active === opt ? "rgba(255,255,255,0.12)" : "transparent",
            color: active === opt ? "#fff" : "var(--text-tertiary)",
            boxShadow: active === opt ? "0 4px 12px rgba(0,0,0,0.2)" : "none",
            transition: "all 0.2s"
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
