import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import PageShell from "@/components/PageShell";
import PlateCalculator from "@/components/PlateCalculator";
import { useSettings, useData, getStorage } from "@apex/core";
import { getStatusFromPct, getMuscleSoreness, computeDynamicRecovery, computeMuscleReadiness, RECOVERY_COLOR } from "@apex/core/src/recovery";
import Svg, { Polygon, Polyline } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../hooks/useTheme";

/* --- Helpers ----------------------------------------------- */
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

const RECOVERY_MUSCLES = ["chest", "shoulders", "quads", "lats"];

/* --- Stat Card --------------------------------------------- */
function StatCard({ label, value, unit, color, delay }: any) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: color || colors.textPrimary }]}>
        {value}
        {unit && <Text style={[styles.statUnit, { color: colors.textTertiary }]}> {unit}</Text>}
      </Text>
    </View>
  );
}

/* --- Last Workout Accordion Row ------------------------------ */
function WorkoutExerciseRow({ ex, unit }: any) {
  const [open, setOpen] = useState(false);
  const { colors, isLight } = useTheme();
  return (
    <View style={[styles.exerciseRowContainer, { borderColor: colors.border, backgroundColor: isLight ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.03)" }, open && styles.exerciseRowOpen]}>
      <TouchableOpacity onPress={() => setOpen(!open)} style={styles.exerciseRowHeader}>
        <View style={[styles.exerciseDot, { backgroundColor: ex.accentColor, shadowColor: ex.accentColor }]} />
        <Text style={[styles.exerciseName, { color: colors.textPrimary }]}>{ex.name}</Text>
        <View style={styles.exerciseSetsInfo}>
          <Text style={[styles.exerciseSetsText, { color: colors.textSecondary }]}>{ex.setsLength} sets</Text>
          <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
            <Svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Polyline points="6 9 12 15 18 9" />
            </Svg>
          </View>
        </View>
      </TouchableOpacity>

      {open && (
        <View style={styles.exerciseSetsList}>
          {ex.sets.map((s: any, i: number) => {
            const displayWeight = unit === "kg" ? Math.round(Number(s.weight) / 2.205) : Number(s.weight);
            return (
              <View key={s.id || i} style={[styles.setRow, { backgroundColor: isLight ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)" }]}>
                <Text style={[styles.setLabel, { color: colors.textSecondary }]}>Set {s.set_order || i + 1}</Text>
                <View style={styles.setDetails}>
                  <Text style={[styles.setDetailPrimary, { color: colors.textPrimary }]}>{displayWeight} {unit}</Text>
                  <Text style={[styles.setDetailSecondary, { color: colors.textSecondary }]}>×</Text>
                  <Text style={[styles.setDetailPrimary, { color: colors.textPrimary }]}>{s.reps} reps</Text>
                  <Text style={styles.setDetailRir}>({s.rir ?? 0} rir)</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/* --- Page -------------------------------------------------- */
export default function HomePage() {
  const router = useRouter();
  const ctx = useSettings() as any;
  const unit = ctx?.weightUnit || "lbs";
  const showPlateCalc = ctx?.plateCalc ?? true;
  const { colors, isLight } = useTheme();

  const [sessionCount, setSessionCount] = useState(0);
  const [strengthScore, setStrengthScore] = useState(0);
  const [recoveryScore, setRecoveryScore] = useState(0);
  const [lastWorkout, setLastWorkout] = useState({
    name: "No Sessions Logged",
    subtitle: "Start a workout to see stats here",
    date: "-",
    duration: "0 min",
    volume: `0 ${unit}`,
    sets: 0,
    exercises: [] as any[]
  });

  const { workouts: data, prs: prData, metrics: metData } = useData() as any;

  useEffect(() => {
    if (!data || !prData || !metData) return;

    try {
        let bw = 1;
        if (metData.length > 0) {
            bw = parseFloat(metData[metData.length - 1].weight) || 1;
        }

        const rawMaxes = { bench: 0, squat: 0, deadlift: 0, ohp: 0, rows: 0 };
        prData.forEach((p: any) => {
            const e = p.exercise_name?.toLowerCase();
            const w = parseFloat(p.weight);
            if (["bench press", "bench", "chest press"].includes(e)) rawMaxes.bench = Math.max(rawMaxes.bench, w);
            else if (["squat", "barbell squat", "back squat"].includes(e)) rawMaxes.squat = Math.max(rawMaxes.squat, w);
            else if (["deadlift", "barbell deadlift", "rdl"].includes(e)) rawMaxes.deadlift = Math.max(rawMaxes.deadlift, w);
            else if (["ohp", "overhead press", "shoulder press"].includes(e)) rawMaxes.ohp = Math.max(rawMaxes.ohp, w);
            else if (["rows", "barbell row", "seated row", "pull"].includes(e)) rawMaxes.rows = Math.max(rawMaxes.rows, w);
        });

        const ELITE = { bench: 1.5, deadlift: 2.5, ohp: 0.9, squat: 2.0, rows: 1.2 };
        const calcScore = (cur: number, target: number) => Math.min(100, Math.round(((cur / bw) / target) * 100));

        const benchScore = calcScore(rawMaxes.bench, ELITE.bench);
        const dlScore = calcScore(rawMaxes.deadlift, ELITE.deadlift);
        const ohpScore = calcScore(rawMaxes.ohp, ELITE.ohp);
        const squatScore = calcScore(rawMaxes.squat, ELITE.squat);
        const rowScore = calcScore(rawMaxes.rows, ELITE.rows);

        const muscleScores = [
            benchScore, dlScore, ohpScore, squatScore,
            Math.round((benchScore * 0.5) + (rowScore * 0.5)),
            Math.max(0, squatScore - 15)
        ];
        
        const avgPerf = Math.round(muscleScores.reduce((a, b) => a + b, 0) / muscleScores.length);
        const rawIndex = ((rawMaxes.bench / bw) + (rawMaxes.squat / bw) + (rawMaxes.deadlift / bw)) / 3;
        const perfBasis = (rawIndex / 1.5) * 100;
        
        setStrengthScore(Math.min(100, Math.round((perfBasis * 0.7) + (avgPerf * 0.3))));

        const ALL_MUSCLES = [
            "chest", "shoulders", "biceps", "triceps",
            "lats", "abdominals", "quadriceps", "hamstrings", "glutes", "calves",
        ];
        const overrides = getMuscleSoreness();
        const recData = computeDynamicRecovery(ALL_MUSCLES, data, overrides);
        
        const { score } = computeMuscleReadiness(recData);
        setRecoveryScore(score);

        if (data.length > 0) {
          const now = new Date();
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(now.getDate() - 7);

          let weekSessions = 0;
          data.forEach((w: any) => {
            const wDate = new Date(w.created_at);
            if (wDate >= oneWeekAgo) {
              weekSessions++;
            }
          });
          setSessionCount(weekSessions);

          const lw = data[0];
          let lwVol = 0;
          const exMap: any = {};

          lw.sets?.forEach((s: any) => {
            const w = unit === "kg" ? Math.round(Number(s.weight) / 2.205) : Number(s.weight);
            lwVol += (s.reps * w);
            const nm = s.name || s.exercise_name || "Unknown Exercise";
            if (!exMap[nm]) { exMap[nm] = { length: 0, sets: [] }; }
            exMap[nm].length++;
            exMap[nm].sets.push(s);
          });

          const dMatch = typeof lw.notes === "string" ? lw.notes.match(/in (\d+:\d+)/) : null;
          let dStr = "N/A";
          if (dMatch) {
            const [m, s] = dMatch[1].split(":").map(Number);
            const timeStr = `${m}:${String(s).padStart(2, "0")}`;
            dStr = m === 0 ? `${timeStr} sec` : `${timeStr} min`;
          }

          setLastWorkout({
            name: lw.name || "Workout Session",
            subtitle: Object.keys(exMap).slice(0, 3).join(" · ") || "-",
            date: new Date(lw.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
            duration: dStr,
            volume: `${lwVol.toLocaleString()} ${unit}`,
            sets: lw.sets?.length || 0,
            exercises: Object.entries(exMap).map(([nm, obj]: any, idx) => ({
              id: `ex-${idx}`,
              name: nm,
              setsLength: obj.length,
              sets: obj.sets,
              accentColor: ["#0A84FF", "#FF2D55", "#FFD60A", "#30D158", "#BF5AF2"][idx % 5]
            }))
          });
        }
    } catch (e) {
        console.error("Dashboard calculation failed", e);
    }
  }, [data, prData, metData, unit]);

  return (
    <PageShell 
      title={`${greeting()}, ${getStorage()?.getItem("userName")?.split(" ")[0] || "User"}`} 
      subtitle={formatDate()}
      onSettingsClick={() => router.push("/settings" as any)}
    >
      <View style={styles.quickStats}>
        <StatCard label="This Week" value={sessionCount} unit="sessions" color="#0A84FF" delay={1} />
        <StatCard 
          label="Recovery" 
          value={recoveryScore} 
          unit="%" 
          color={(RECOVERY_COLOR as any)[getStatusFromPct(recoveryScore)]} 
          delay={2} 
        />
        <StatCard 
          label="Strength" 
          value={strengthScore} 
          unit="/ 100" 
          color={strengthScore >= 90 ? "#FFD60A" : strengthScore >= 75 ? "#FF3B30" : strengthScore >= 60 ? "#0A84FF" : "#30D158"} 
          delay={3} 
        />
      </View>

      <TouchableOpacity onPress={() => router.push("/workout" as any)}>
        <LinearGradient colors={["#0A84FF", "#BF5AF2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaButton}>
          <Svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <Polygon points="6,3 17,10 6,17" fill="white" />
          </Svg>
          <Text style={styles.ctaButtonText}>{"Start Today's Workout"}</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Last Workout</Text>

      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{lastWorkout.name}</Text>
          <Text style={[styles.cardDate, { color: colors.textSecondary }]}>{lastWorkout.date}</Text>
        </View>

        <View style={styles.cardStatsRow}>
          {[
            { label: "Duration", value: lastWorkout.duration, align: "flex-start" },
            { label: "Volume", value: lastWorkout.volume, align: "center" },
            { label: "Sets", value: `${lastWorkout.sets} sets`, align: "flex-end" },
          ].map(({ label, value, align }) => (
            <View key={label} style={[styles.cardStatCol, { alignItems: align as any }]}>
              <Text style={[styles.cardStatLabel, { color: colors.textSecondary }]}>{label}</Text>
              <Text style={[styles.cardStatValue, { color: colors.textPrimary }]}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.exercisesList}>
          {lastWorkout.exercises.map((ex) => (
            <WorkoutExerciseRow key={ex.id} ex={ex} unit={unit} />
          ))}
        </View>
      </View>

      {showPlateCalc && <PlateCalculator />}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  quickStats: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 16,
  },
  statLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24,
  },
  statUnit: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "500",
  },
  ctaButton: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
    shadowColor: "#0A84FF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 5,
  },
  ctaButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 10,
  },
  card: {
    padding: 16,
    marginBottom: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 20,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
  },
  cardDate: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "500",
  },
  cardSubtitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 14,
  },
  cardStatsRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  cardStatCol: {
    flex: 1,
  },
  cardStatLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  cardStatValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  exercisesList: {
    gap: 6,
  },
  exerciseRowContainer: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  exerciseRowOpen: {
    paddingBottom: 10,
  },
  exerciseRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  exerciseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  exerciseName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#fff",
  },
  exerciseSetsInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  exerciseSetsText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "500",
  },
  exerciseSetsList: {
    paddingLeft: 28,
    paddingRight: 12,
    gap: 6,
  },
  setRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 6,
  },
  setLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "600",
  },
  setDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  setDetailPrimary: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  setDetailSecondary: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.4)",
  },
  setDetailRir: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FF9F0A",
    marginLeft: 4,
  },
});
