import React, { useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import PageShell from "@/components/PageShell";
import { useSettings, useData } from "@apex/core";
import { computeDynamicRecovery, getMuscleSoreness } from "@apex/core/src/recovery";
import Svg, { Circle, Line } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";

/* --- Overall Score Ring -------------------------------------- */
function OverallRing({ score, bw, age, index }: any) {
  const r = 72;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);

  const grade = score >= 90 ? "Elite" : score >= 75 ? "Advanced" : score >= 60 ? "Intermediate" : "Developing";
  const gradeColor = score >= 90 ? "#FFD60A" : score >= 75 ? "#30D158" : score >= 60 ? "#0A84FF" : "#FF9F0A";
  const percentile = score >= 90 ? "2%" : score >= 75 ? "8%" : score >= 60 ? "15%" : "45%";

  return (
    <View style={[styles.card, { padding: 28, alignItems: "center", marginBottom: 12 }]}>
      <View style={styles.ringContainer}>
        <View style={[styles.ringGlow, { backgroundColor: `${gradeColor}22` }]} />
        <Svg width="164" height="164" viewBox="0 0 164 164" style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx="82" cy="82" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
          {[...Array(24)].map((_, i) => {
            const angle = (i / 24) * 360;
            const rad = (angle * Math.PI) / 180;
            const x1 = 82 + (r - 6) * Math.cos(rad);
            const y1 = 82 + (r - 6) * Math.sin(rad);
            const x2 = 82 + (r + 6) * Math.cos(rad);
            const y2 = 82 + (r + 6) * Math.sin(rad);
            return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.03)" strokeWidth="1.5" />;
          })}
          <Circle
            cx="82" cy="82" r={r} fill="none"
            stroke={gradeColor} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
          />
        </Svg>
        <View style={styles.ringCenterText}>
          <Text style={[styles.ringScoreText, { color: gradeColor }]}>{score}</Text>
          <Text style={styles.ringScoreLabel}>Score</Text>
        </View>
      </View>

      <Text style={[styles.gradeText, { color: gradeColor }]}>{grade}</Text>
      <Text style={styles.percentileText}>Top {percentile} of athletes your level</Text>

      <View style={styles.divider} />

      <View style={styles.quickStatsRow}>
        {[
          { label: "Strength Index", val: `${index || "0.0"}×`, color: "#0A84FF" },
          { label: "Body Weight", val: bw ? `${Math.round(bw)} lbs` : "0 lbs", color: "#fff" },
          { label: "Training Age", val: age ? `${age} yrs` : "0 yrs", color: "#FF9F0A" },
        ].map(({ label, val, color }) => (
          <View key={label} style={{ alignItems: "center" }}>
            <Text style={[styles.quickStatVal, { color }]}>{val}</Text>
            <Text style={styles.quickStatLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* --- Lift Card (BW Multiplier) ------------------------------- */
function LiftCard({ liftName, weight, bw }: any) {
  const multiplier = bw > 0 ? (weight / bw) : 0;
  
  let grade = "Unassigned";
  let gradeColor = "rgba(255,255,255,0.4)";
  let pct = 0;

  if (liftName === "bench") {
    if (multiplier >= 1.5)      { grade = "Elite"; gradeColor = "#FFD60A"; pct = 100; }
    else if (multiplier >= 1.2) { grade = "Advanced"; gradeColor = "#30D158"; pct = 80; }
    else if (multiplier >= 1.0) { grade = "Intermediate"; gradeColor = "#0A84FF"; pct = 60; }
    else if (multiplier >= 0.7) { grade = "Novice"; gradeColor = "#BF5AF2"; pct = 40; }
    else                        { grade = "Beginner"; gradeColor = "rgba(255,255,255,0.4)"; pct = weight > 0 ? 20 : 0; }
  } else if (liftName === "squat") {
    if (multiplier >= 2.0)      { grade = "Elite"; gradeColor = "#FFD60A"; pct = 100; }
    else if (multiplier >= 1.5) { grade = "Advanced"; gradeColor = "#30D158"; pct = 80; }
    else if (multiplier >= 1.2) { grade = "Intermediate"; gradeColor = "#0A84FF"; pct = 60; }
    else if (multiplier >= 0.9) { grade = "Novice"; gradeColor = "#BF5AF2"; pct = 40; }
    else                        { grade = "Beginner"; gradeColor = "rgba(255,255,255,0.4)"; pct = weight > 0 ? 20 : 0; }
  } else if (liftName === "deadlift") {
    if (multiplier >= 2.5)      { grade = "Elite"; gradeColor = "#FFD60A"; pct = 100; }
    else if (multiplier >= 2.0) { grade = "Advanced"; gradeColor = "#30D158"; pct = 80; }
    else if (multiplier >= 1.5) { grade = "Intermediate"; gradeColor = "#0A84FF"; pct = 60; }
    else if (multiplier >= 1.1) { grade = "Novice"; gradeColor = "#BF5AF2"; pct = 40; }
    else                        { grade = "Beginner"; gradeColor = "rgba(255,255,255,0.4)"; pct = weight > 0 ? 20 : 0; }
  }

  return (
    <View style={[styles.card, { padding: 16, marginBottom: 12, borderTopWidth: 2, borderTopColor: `${gradeColor}40` }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
        <View>
          <Text style={styles.liftNameLabel}>{liftName}</Text>
          <Text style={styles.liftWeightText}>
            {weight} <Text style={styles.liftWeightUnit}>lbs</Text>
          </Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.liftMultiplierText, { color: gradeColor }]}>{multiplier.toFixed(2)}x BW</Text>
          <Text style={styles.liftGradeLabel}>{grade}</Text>
        </View>
      </View>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: gradeColor, shadowColor: gradeColor, shadowOpacity: 0.6, shadowRadius: 8, elevation: 2 }]} />
      </View>
    </View>
  );
}

/* --- Strength Bar Row ---------------------------------------- */
function StrengthRow({ item }: any) {
  const gain = item.score - item.prev;

  return (
    <View style={styles.strengthRowContainer}>
      <View style={[styles.colorDot, { backgroundColor: item.color, shadowColor: item.color }]} />
      <Text style={styles.strengthMuscleText}>{item.muscle}</Text>
      
      <View style={{ flex: 1 }}>
        <View style={[styles.barTrack, { height: 7 }]}>
          <View style={[styles.barFill, { width: `${item.score}%`, backgroundColor: item.color }]} />
        </View>
      </View>

      <View style={{ alignItems: "flex-end", width: 40 }}>
        <Text style={[styles.strengthScoreText, { color: item.color }]}>{item.score}</Text>
        <Text style={[styles.strengthGainText, { color: gain >= 0 ? "#30D158" : "#FF2D55" }]}>
          {gain > 0 ? `+${gain}` : gain < 0 ? gain : "±0"}
        </Text>
      </View>
    </View>
  );
}

/* --- Personal Record Card ------------------------------------ */
function PRCard({ prData }: any) {
  if (!prData) return null;
  return (
    <View style={[styles.card, { paddingVertical: 16, paddingHorizontal: 20, marginBottom: 12 }]}>
      <Text style={styles.sectionLabel}>Personal Records</Text>
      <View style={styles.prGrid}>
        {Object.entries(prData).map(([lift, data]: any) => (
          <View key={lift} style={{ flex: 1 }}>
            <Text style={styles.prLiftLabel}>{lift}</Text>
            <Text style={styles.prWeightText}>
              {data.weight}<Text style={styles.prWeightUnit}> {data.unit}</Text>
            </Text>
            <Text style={styles.prGainText}>{data.gain} lbs</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* --- Page ---------------------------------------------------- */
export default function StrengthPage() {
  const router = useRouter();
  const ctx = useSettings() as any;
  const unit = ctx?.weightUnit || "lbs";
  const [metrics, setMetrics] = useState({ weight: 0, trainingYears: 0 });
  const [prs, setPrs] = useState({ 
    bench: { weight: 0, unit: "lbs", gain: "+0" }, 
    squat: { weight: 0, unit: "lbs", gain: "+0" }, 
    deadlift: { weight: 0, unit: "lbs", gain: "+0" } 
  });
  
  const [dynamicScores, setDynamicScores] = useState([
      { muscle: "Chest",     score: 0, color: "#0A84FF", prev: 0 },
      { muscle: "Back",      score: 0, color: "#BF5AF2", prev: 0 },
      { muscle: "Shoulders", score: 0, color: "#FF9F0A", prev: 0 },
      { muscle: "Arms",      score: 0, color: "#30D158", prev: 0 },
      { muscle: "Legs",      score: 0, color: "#FFD60A", prev: 0 },
      { muscle: "Core",      score: 0, color: "#FF3B30", prev: 0 },
  ]);

  const { workouts, prs: prData, metrics: metData, loading } = useData() as any;

  useEffect(() => {
      try {
        let bw = 1;
        if (metData && metData.length > 0) {
            const latest = metData[metData.length - 1];
            const rawBw = parseFloat(latest.weight) || 1;
            bw = unit === "kg" ? Math.round(rawBw / 2.205) : rawBw;
            setMetrics({ weight: bw, trainingYears: latest.training_years || 0 });
        }
        
        if (prData) {
            const liftHistory: any = { bench: [], squat: [], deadlift: [] };
            const rawMaxes: any = { bench: 0, squat: 0, deadlift: 0, ohp: 0, rows: 0 };
            
            if (prData.length > 0) {
                prData.forEach((p: any) => {
                    const e = p.exercise_name?.toLowerCase();
                    const rawW = parseFloat(p.weight);
                    const w = unit === "kg" ? Math.round(rawW / 2.205) : rawW;
                    if (["bench press", "bench", "chest press"].includes(e)) {
                        liftHistory.bench.push(w);
                        rawMaxes.bench = Math.max(rawMaxes.bench, w);
                    }
                    else if (["squat", "barbell squat", "back squat"].includes(e)) {
                        liftHistory.squat.push(w);
                        rawMaxes.squat = Math.max(rawMaxes.squat, w);
                    }
                    else if (["deadlift", "barbell deadlift", "rdl"].includes(e)) {
                        liftHistory.deadlift.push(w);
                        rawMaxes.deadlift = Math.max(rawMaxes.deadlift, w);
                    }
                    else if (["ohp", "overhead press", "shoulder press"].includes(e)) rawMaxes.ohp = Math.max(rawMaxes.ohp, w);
                    else if (["rows", "barbell row", "seated row", "pull"].includes(e)) rawMaxes.rows = Math.max(rawMaxes.rows, w);
                });
                const getGain = (arr: any) => {
                    const a = arr || [];
                    if (a.length < 2) return "±0";
                    const diff = a[a.length - 1] - a[a.length - 2];
                    return diff >= 0 ? `+${diff.toFixed(0)}` : `${diff.toFixed(0)}`;
                };

                setPrs({
                    bench: { weight: liftHistory.bench[liftHistory.bench.length - 1] || 0, unit: "lbs", gain: getGain(liftHistory.bench) },
                    squat: { weight: liftHistory.squat[liftHistory.squat.length - 1] || 0, unit: "lbs", gain: getGain(liftHistory.squat) },
                    deadlift: { weight: liftHistory.deadlift[liftHistory.deadlift.length - 1] || 0, unit: "lbs", gain: getGain(liftHistory.deadlift) }
                });
            }

            const ELITE = { bench: 1.5, deadlift: 2.5, ohp: 0.9, squat: 2.0, rows: 1.2 };
            const calcScore = (cur: number, target: number) => Math.min(100, Math.round(((cur / bw) / target) * 100));

            const scores = [
                { muscle: "Chest",     score: calcScore(rawMaxes.bench, ELITE.bench), color: "#0A84FF", prev: 0 },
                { muscle: "Back",      score: calcScore(rawMaxes.deadlift, ELITE.deadlift), color: "#BF5AF2", prev: 0 },
                { muscle: "Shoulders", score: calcScore(rawMaxes.ohp, ELITE.ohp), color: "#FF9F0A", prev: 0 },
                { muscle: "Legs",      score: calcScore(rawMaxes.squat, ELITE.squat), color: "#FFD60A", prev: 0 },
                { 
                  muscle: "Arms",      
                  score: Math.round((calcScore(rawMaxes.bench, ELITE.bench) * 0.5) + (calcScore(rawMaxes.rows, ELITE.rows) * 0.5)), 
                  color: "#30D158", prev: 0 
                },
                { 
                  muscle: "Core",      
                  score: Math.max(0, calcScore(rawMaxes.squat, ELITE.squat) - 15), 
                  color: "#FF3B30", prev: 0 
                },
            ];

            setDynamicScores(scores);
        }
      } catch (e) {
        console.error("Failed processing strength profiles", e);
      }
  }, [unit, workouts, prData, metData]);

  const { strengthIndex, derivedOverall } = useMemo(() => {
    const volScore = Math.round(dynamicScores.reduce((acc, curr) => acc + curr.score, 0) / (dynamicScores.length || 1));
    const bw = metrics.weight || 1;
    const bMultiplier = prs.bench.weight / bw;
    const sMultiplier = prs.squat.weight / bw;
    const dMultiplier = prs.deadlift.weight / bw;
    const rawIndex = (bMultiplier + sMultiplier + dMultiplier) / 3;
    const indexStr = rawIndex.toFixed(1);

    const performanceBasis = (rawIndex / 1.5) * 100;
    const score = Math.min(100, Math.round((performanceBasis * 0.7) + (volScore * 0.3)));
    
    return { strengthIndex: indexStr, derivedOverall: score };
  }, [dynamicScores, metrics, prs]);

  return (
    <PageShell title="Strength" subtitle="Analytics · Big Lifts & Recovery" onSettingsClick={() => router.push("/settings" as any)}>
      {loading.prs || loading.metrics ? (
        <View style={[styles.card, { height: 420, marginBottom: 12 }]} />
      ) : (
        <OverallRing score={derivedOverall} bw={metrics.weight} age={metrics.trainingYears} index={strengthIndex} />
      )}

      <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Big Lifts vs Bodyweight</Text>

      {loading.prs || loading.metrics ? (
        Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={[styles.card, { height: 92, marginBottom: 12 }]} />
        ))
      ) : (
        <View>
          <LiftCard liftName="bench" weight={prs.bench.weight} bw={metrics.weight} />
          <LiftCard liftName="squat" weight={prs.squat.weight} bw={metrics.weight} />
          <LiftCard liftName="deadlift" weight={prs.deadlift.weight} bw={metrics.weight} />
        </View>
      )}

      <View style={{ marginTop: 12 }}>
        {loading.prs ? (
          <View style={[styles.card, { height: 130, marginBottom: 12 }]} />
        ) : (
          <PRCard prData={prs} />
        )}
      </View>

      <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Strength by Muscle Group</Text>

      <View style={styles.muscleGroupContainer}>
        {loading.prs || loading.metrics ? (
          Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={[styles.card, { height: 50 }]} />
          ))
        ) : (
          dynamicScores.map((item) => (
            <StrengthRow key={item.muscle} item={item} />
          ))
        )}
      </View>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 12,
  },
  ringContainer: {
    position: "relative",
    width: 164,
    height: 164,
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  ringGlow: {
    position: "absolute",
    top: 10, bottom: 10, left: 10, right: 10,
    borderRadius: 82,
    opacity: 0.5,
  },
  ringCenterText: {
    position: "absolute",
    top: 0, bottom: 0, left: 0, right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  ringScoreText: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -2,
    lineHeight: 44,
  },
  ringScoreLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  gradeText: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  percentileText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    width: "100%",
    marginVertical: 18,
  },
  quickStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  quickStatVal: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  quickStatLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginTop: 2,
  },
  liftNameLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 2,
  },
  liftWeightText: {
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 28,
    color: "#fff",
  },
  liftWeightUnit: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "500",
  },
  liftMultiplierText: {
    fontSize: 14,
    fontWeight: "700",
  },
  liftGradeLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  barTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  strengthRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.025)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  colorDot: {
    width: 10, height: 10, borderRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 6, elevation: 2,
  },
  strengthMuscleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
    width: 76,
  },
  strengthScoreText: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  strengthGainText: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "right",
  },
  prGrid: {
    flexDirection: "row",
    gap: 10,
  },
  prLiftLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  prWeightText: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 26,
    color: "#fff",
  },
  prWeightUnit: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "500",
    letterSpacing: 0,
  },
  prGainText: {
    fontSize: 11,
    color: "#30D158",
    fontWeight: "600",
    marginTop: 4,
  },
  muscleGroupContainer: {
    gap: 8,
    paddingBottom: 40,
  }
});
