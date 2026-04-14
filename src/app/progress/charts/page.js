"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import PageShell from "../../../components/PageShell";
import { useSettings } from "../../../contexts/SettingsContext";
import { MUSCLE_RECOVERY } from "../../../lib/data";

export default function DetailedChartsPage() {
  const router = useRouter();
  const ctx = useSettings();
  const unit = ctx?.weightUnit || "lbs";

  const [allSets, setAllSets] = useState([]);
  
  // Filters
  const [range, setRange] = useState("3M");
  const [muscle, setMuscle] = useState("Chest");
  const [exercise, setExercise] = useState("");

  const [activeDot, setActiveDot] = useState(null);

  useEffect(() => {
    const fetchAllWorkouts = async () => {
      try {
        const uId = localStorage.getItem("userId") || 1;
        const res = await fetch(`http://localhost:5000/workouts?userId=${uId}`);
        const workouts = res.ok ? await res.json() : [];
        
        const flatSets = [];
        workouts.forEach(w => {
          if (!w.sets) return;
          w.sets.forEach(s => {
            const rawW = parseFloat(s.weight);
            const convW = unit === "kg" ? Math.round(rawW / 2.205) : rawW;
            flatSets.push({
              id: `${w.id}-${s.id || Math.random()}`,
              reps: Number(s.reps),
              weight: convW,
              rir: s.rir,
              date: new Date(w.created_at),
              exercise: s.exercise_name || s.name || "Unknown",
              muscle: s.muscle_group || "Unknown",
            });
          });
        });
        setAllSets(flatSets);
      } catch (err) {
        console.error("Failed to fetch workouts:", err);
      }
    };
    fetchAllWorkouts();
  }, [unit]);

  const rangesMs = {
    "1W": 7 * 24 * 60 * 60 * 1000,
    "1M": 30 * 24 * 60 * 60 * 1000,
    "3M": 90 * 24 * 60 * 60 * 1000,
    "6M": 180 * 24 * 60 * 60 * 1000,
    "1Y": 365 * 24 * 60 * 60 * 1000,
    "ALL": Infinity
  };

  const filteredSets = useMemo(() => {
    let filtered = allSets;

    // Filter time range
    if (range !== "ALL") {
      const cutoff = new Date(Date.now() - rangesMs[range]);
      filtered = filtered.filter(s => s.date >= cutoff);
    }

    // Filter muscle
    if (muscle) {
      filtered = filtered.filter(s => s.muscle?.toLowerCase() === muscle.toLowerCase());
    }

    // Filter exercise
    if (exercise) {
      filtered = filtered.filter(s => s.exercise?.toLowerCase() === exercise.toLowerCase());
    }

    return filtered;
  }, [allSets, range, muscle, exercise]);

  // Derived filter options
  const muscleOptions = useMemo(() => Object.keys(MUSCLE_RECOVERY).map(m => m.charAt(0).toUpperCase() + m.slice(1)), []);
  
  // Dynamically extract distinct exercises from user's actual workout history for the active muscle
  const exerciseOptions = useMemo(() => {
    const opts = new Set();
    allSets.forEach(s => {
      if (s.muscle && muscle && s.muscle.toLowerCase() === muscle.toLowerCase()) {
        opts.add(s.exercise);
      }
    });
    return Array.from(opts);
  }, [allSets, muscle]);

  // Sync selected exercise ensuring we default safely anytime options shift
  useEffect(() => {
    if (exerciseOptions.length > 0) {
      if (!exerciseOptions.includes(exercise)) {
        setExercise(exerciseOptions[0]);
      }
    } else {
      setExercise("");
    }
  }, [exerciseOptions, exercise]);

  // Handle cascading dropdowns
  const handleMuscleChange = (e) => {
    setMuscle(e.target.value);
    setActiveDot(null);
  };

  const handleExerciseChange = (e) => {
    setExercise(e.target.value);
    setActiveDot(null);
  };

  // SVG Chart Engine Config
  const WIDTH = 340;
  const HEIGHT = 260;
  const PADX = 30; // Left/Right padding
  const PADY = 20; // Top/Bottom padding
  
  const innerWidth = WIDTH - PADX * 2;
  const innerHeight = HEIGHT - PADY * 2;

  // Find max boundaries (with safety floors)
  const maxReps = Math.max(...filteredSets.map(s => s.reps), 12);
  const maxWeight = Math.max(...filteredSets.map(s => s.weight), 50);

  // Projection Mappers
  const getX = (reps) => PADX + ((reps / maxReps) * innerWidth);
  const getY = (weight) => PADY + innerHeight - ((weight / maxWeight) * innerHeight);

  const ChevronIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-tertiary)" }}>
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  );

  const CustomSelect = ({ value, options, onChange, defaultLabel }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <div style={{ position: "relative", flex: 1 }} onMouseLeave={() => setIsOpen(false)}>
        <div 
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          style={{ background: "var(--bg-card)", border: isOpen ? "1px solid var(--accent-blue)" : "1px solid var(--border-strong)", padding: "12px 14px", borderRadius: "14px", color: "var(--text-primary)", fontWeight: 700, fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "all 0.2s" }}
        >
          {!value ? defaultLabel : value}
          <div style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "flex" }}>
            <ChevronIcon />
          </div>
        </div>
        
        {isOpen && (
          <div style={{ position: "absolute", zIndex: 1000, top: "100%", left: 0, right: 0, paddingTop: "8px" }}>
            <div 
              className="animate-fade-up"
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-strong)", borderRadius: "14px", overflowY: "auto", maxHeight: "200px", boxShadow: "0 10px 30px rgba(0,0,0,0.8)", opacity: 1 }}
            >
              {options.map((opt, i) => (
                <div 
                  key={opt}
                  onClick={(e) => { e.stopPropagation(); onChange({ target: { value: opt }}); setIsOpen(false); }}
                  style={{ padding: "12px 14px", fontSize: "13px", fontWeight: 600, color: opt === value ? "var(--accent-blue)" : "var(--text-primary)", cursor: "pointer", borderBottom: i === options.length - 1 ? "none" : "1px solid var(--border)", background: opt === value ? "rgba(10,132,255,0.05)" : "transparent" }}
                >
                  {opt}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <PageShell 
      title="Advanced Analytics" 
      subtitle="Intensity-Volume Correlation"
      backAction={() => router.push("/progress")}
    >
      <div className="animate-fade-up delay-1" style={{ padding: "8px 0 40px" }} onClick={(e) => setActiveDot(null)}>
        
        {/* --- Multi-Level Filters --- */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
          <CustomSelect 
            value={muscle} 
            options={muscleOptions} 
            onChange={handleMuscleChange} 
            defaultLabel="Select Muscle" 
          />
          <CustomSelect 
            value={exercise} 
            options={exerciseOptions} 
            onChange={handleExerciseChange} 
            defaultLabel="Loading Exercises..." 
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", background: "var(--bg-card)", padding: "4px", borderRadius: "10px", marginBottom: "20px", border: "1px solid var(--border)" }}>
          {["1W", "1M", "3M", "6M", "1Y", "ALL"].map(r => (
            <button
              key={r}
              onClick={(e) => { e.stopPropagation(); setRange(r); setActiveDot(null); }}
              style={{
                flex: 1,
                padding: "6px 0",
                background: range === r ? "rgba(10,132,255,0.15)" : "transparent",
                color: range === r ? "#0A84FF" : "var(--text-secondary)",
                borderRadius: "8px",
                border: "none",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              {r}
            </button>
          ))}
        </div>

        {/* --- Custom SVG Scatter Chart --- */}
        <div className="glass-card" style={{ padding: "16px", position: "relative" }}>
          
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>
            Rep-Max Curve Scatter
          </div>

          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} style={{ overflow: "visible" }}>
            {/* Grid & Axis Lines */}
            <line x1={PADX} y1={PADY + innerHeight} x2={WIDTH - PADX} y2={PADY + innerHeight} stroke="var(--border)" strokeWidth="1" />
            <line x1={PADX} y1={PADY} x2={PADX} y2={PADY + innerHeight} stroke="var(--border)" strokeWidth="1" />

            {/* Y Axis Guide Lines (Divided by 4) */}
            {[0, 0.25, 0.5, 0.75, 1].map(pct => {
              const y = PADY + innerHeight * (1 - pct);
              const labelWeight = Math.round(maxWeight * pct);
              return (
                <g key={pct}>
                  <line x1={PADX} y1={y} x2={WIDTH - PADX} y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  <text x={PADX - 6} y={y} fill="var(--text-tertiary)" fontSize="9" fontWeight="600" textAnchor="end" dominantBaseline="middle">
                    {labelWeight}
                  </text>
                </g>
              );
            })}

            {/* X Axis Guide Lines */}
            {[0.25, 0.5, 0.75, 1].map(pct => {
              const x = PADX + innerWidth * pct;
              const labelReps = Math.round(maxReps * pct);
              return (
                <g key={pct}>
                  <line x1={x} y1={PADY} x2={x} y2={PADY + innerHeight} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  <text x={x} y={PADY + innerHeight + 14} fill="var(--text-tertiary)" fontSize="9" fontWeight="600" textAnchor="middle">
                    {labelReps}
                  </text>
                </g>
              );
            })}
            
            {/* Legend strings */}
            <text x={WIDTH / 2} y={HEIGHT - 2} fill="var(--text-secondary)" fontSize="8" fontWeight="600" textAnchor="middle" letterSpacing="1px">
              REPS
            </text>
            <text x={-HEIGHT / 2} y={8} fill="var(--text-secondary)" fontSize="8" fontWeight="600" textAnchor="middle" letterSpacing="1px" transform="rotate(-90)">
              WEIGHT ({unit})
            </text>

            {/* Scatter Dots */}
            {filteredSets.map(s => {
              const isActive = activeDot && activeDot.id === s.id;
              const cx = getX(s.reps);
              const cy = getY(s.weight);
              
              return (
                 <circle
                   key={s.id}
                   cx={cx}
                   cy={cy}
                   r={isActive ? "6" : "4"}
                   fill={isActive ? "#30D158" : "#0A84FF"}
                   opacity={isActive ? 1 : 0.6}
                   stroke="var(--bg-card)"
                   strokeWidth="1.5"
                   style={{ cursor: "pointer", transition: "all 0.2s ease" }}
                   onClick={(e) => {
                     e.stopPropagation();
                     setActiveDot({ ...s, cx, cy });
                   }}
                 />
              );
            })}
          </svg>

          {/* Empty State */}
          {filteredSets.length === 0 && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500, pointerEvents: "none" }}>
              No sets found for this filter.
            </div>
          )}

          {/* Active Hover Tooltip Popup Overlay */}
          {activeDot && (
            <div 
              className="animate-fade-up"
              style={{
                position: "absolute",
                // Push tooltip popup over the dot
                left: activeDot.cx,
                top: activeDot.cy - 10,
                transform: "translate(-50%, -100%)",
                background: "var(--bg-base)",
                border: "1px solid var(--border-strong)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                padding: "10px 14px",
                borderRadius: "12px",
                pointerEvents: "none",
                minWidth: "140px",
                zIndex: 50
              }}
            >
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 600, marginBottom: "6px" }}>
                {activeDot.date.toLocaleDateString()}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "4px" }}>
                {activeDot.weight} {unit} <span style={{ color: "var(--text-secondary)" }}>×</span> {activeDot.reps} <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-tertiary)" }}>reps</span>
              </div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-blue)" }}>
                {activeDot.exercise}
              </div>
              <div style={{ fontSize: "10px", color: "#FF9F0A", fontWeight: 600, marginTop: "4px" }}>
                {activeDot.rir > 0 ? `${activeDot.rir} RIR` : "0 RIR (Failure)"}
              </div>
            </div>
          )}

        </div>
      </div>
    </PageShell>
  );
}
