"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageShell from "../components/PageShell";
import { OVERALL_STRENGTH_SCORE, WORKOUT_EXERCISES } from "../lib/data";
import {
  RECOVERY_COLOR,
  RECOVERY_LABEL,
  getLastWorkoutTime,
  getMuscleSoreness,
  computeRecovery,
} from "../lib/recovery";

/* ─── Helpers ─────────────────────────────────────────────── */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const LAST_WORKOUT = {
  name: "Push Day",
  subtitle: "Chest · Triceps · Shoulders",
  date: "Yesterday",
  duration: "52 min",
  volume: "8,420 lbs",
  sets: WORKOUT_EXERCISES.reduce((acc, ex) => acc + ex.sets.length, 0),
};

const RECOVERY_MUSCLES = ["chest", "shoulders", "quads", "lats"];

/* ─── Stat Card ───────────────────────────────────────────── */
function StatCard({ label, value, unit, color = "#fff", delay }) {
  return (
    <div
      className={`glass-card animate-fade-up delay-${delay}`}
      style={{ flex: 1, padding: "14px 12px" }}
    >
      <div
        style={{
          fontSize: "10px",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "1px",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "22px",
          fontWeight: 800,
          letterSpacing: "-1px",
          color,
          lineHeight: 1.1,
        }}
      >
        {value}
        {unit && (
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              marginLeft: "2px",
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────── */
export default function HomePage() {
  const router = useRouter();

  // ── Recovery state (time-based, refreshed each render) ──
  const [recoveryData, setRecoveryData] = useState({});
  useEffect(() => {
    const lastTime = getLastWorkoutTime();
    const overrides = getMuscleSoreness();
    setRecoveryData(computeRecovery(RECOVERY_MUSCLES, lastTime, overrides));
  }, []);

  return (
    <PageShell title={`${greeting()}, EC`} subtitle={formatDate()}>
      {/* ── Quick Stats ──────────────────────────────────── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <StatCard label="This Week" value="4" unit="sessions" color="#0A84FF" delay={1} />
        <StatCard label="Volume" value="34.2" unit="k lbs" color="#FFD60A" delay={2} />
        <StatCard label="Strength" value={OVERALL_STRENGTH_SCORE} unit="/ 100" color="#30D158" delay={3} />
      </div>

      {/* ── Start Workout CTA ─────────────────────────────── */}
      <button
        onClick={() => router.push("/workout")}
        className="animate-fade-up delay-4"
        style={{
          width: "100%",
          padding: "18px",
          borderRadius: "18px",
          background: "linear-gradient(135deg, #0A84FF 0%, #BF5AF2 100%)",
          border: "none",
          color: "#fff",
          fontFamily: "var(--font-display)",
          fontSize: "16px",
          fontWeight: 800,
          letterSpacing: "0.3px",
          cursor: "pointer",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          boxShadow: "0 8px 32px rgba(10,132,255,0.25)",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <polygon points="6,3 17,10 6,17" fill="white" />
        </svg>
        Start Today's Workout
      </button>

      {/* ── Section label ─────────────────────────────────── */}
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "1.4px",
          color: "var(--text-tertiary)",
          marginBottom: "10px",
        }}
      >
        Last Workout
      </div>

      {/* ── Last Workout Card ─────────────────────────────── */}
      <div
        className="glass-card animate-fade-up delay-5"
        style={{ padding: "16px", marginBottom: "20px" }}
      >
        {/* Title row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "4px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "17px",
              fontWeight: 800,
            }}
          >
            {LAST_WORKOUT.name}
          </span>
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-tertiary)",
              fontWeight: 500,
            }}
          >
            {LAST_WORKOUT.date}
          </span>
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: "14px",
          }}
        >
          {LAST_WORKOUT.subtitle}
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "0", marginBottom: "14px" }}>
          {[
            { label: "Duration", value: LAST_WORKOUT.duration },
            { label: "Volume", value: LAST_WORKOUT.volume },
            { label: "Sets", value: `${LAST_WORKOUT.sets} sets` },
          ].map(({ label, value }, i) => (
            <div
              key={label}
              style={{
                flex: 1,
                textAlign: i === 1 ? "center" : i === 2 ? "right" : "left",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  marginBottom: "2px",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Exercise list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {WORKOUT_EXERCISES.map((ex) => (
            <div
              key={ex.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.025)",
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: ex.accentColor,
                  boxShadow: `0 0 6px ${ex.accentColor}80`,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: "13px", fontWeight: 500, flex: 1 }}>
                {ex.name}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-tertiary)",
                  fontWeight: 500,
                }}
              >
                {ex.sets.length} sets
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section label ─────────────────────────────────── */}
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "1.4px",
          color: "var(--text-tertiary)",
          marginBottom: "10px",
        }}
      >
        Recovery
      </div>

      {/* ── Recovery Snapshot ─────────────────────────────── */}
      <div
        className="glass-card animate-fade-up delay-6"
        style={{ padding: "14px 16px" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {RECOVERY_MUSCLES.map((muscle) => {
            const d = recoveryData[muscle];
            if (!d) return null;
            const color = RECOVERY_COLOR[d.status];
            return (
              <div
                key={muscle}
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                {/* Dot */}
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: color,
                    boxShadow: `0 0 6px ${color}80`,
                    flexShrink: 0,
                  }}
                />
                {/* Name */}
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    flex: 1,
                    textTransform: "capitalize",
                  }}
                >
                  {muscle}
                </span>
                {/* Bar */}
                <div
                  className="bar-track"
                  style={{ width: "80px", flexShrink: 0 }}
                >
                  <div
                    className="bar-fill"
                    style={{
                      width: `${d.pct}%`,
                      background: color,
                    }}
                  />
                </div>
                {/* Label + manual indicator */}
                <span
                  style={{
                    fontSize: "11px",
                    color,
                    fontWeight: 700,
                    width: d.isManual ? "62px" : "52px",
                    textAlign: "right",
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                    justifyContent: "flex-end",
                  }}
                >
                  {d.isManual && (
                    <span style={{ fontSize: "9px", opacity: 0.6 }}>✎</span>
                  )}
                  {RECOVERY_LABEL[d.status]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
