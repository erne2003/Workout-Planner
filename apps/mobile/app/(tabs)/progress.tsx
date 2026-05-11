import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from "react-native";
import { useRouter } from "expo-router";
import PageShell from "@/components/PageShell";
import { useSettings, useData, PROGRESS_DATA, PERSONAL_RECORDS } from "@apex/core";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, G, Line, Text as SvgText, Path, Circle } from "react-native-svg";

/* --- Lift config --------------------------------------------- */
const LIFTS = [
  { key: "bench",    label: "Bench Press", color: "#0A84FF", unit: "lbs" },
  { key: "squat",    label: "Back Squat",  color: "#FF2D55", unit: "lbs" },
  { key: "deadlift", label: "Deadlift",    color: "#FFD60A", unit: "lbs" },
];

/* --- SVG Line Chart ------------------------------------------ */
function LineChart({ data, dataKey, color, width = 340, height = 160 }: any) {
  const values = data.map((d: any) => d[dataKey]);
  const min = values.length ? Math.min(...values) - 20 : 0;
  const max = values.length ? Math.max(...values) + 20 : 100;
  const range = (max - min) || 1;

  const padL = 8, padR = 8, padT = 12, padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const toX = (i: number) => padL + (i / (data.length - 1)) * innerW;
  const toY = (v: number) => padT + innerH - ((v - min) / range) * innerH;

  const pathD = values
    .map((v: number, i: number) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(" ");

  const areaD = `${pathD} L${toX(values.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${padL},${(padT + innerH).toFixed(1)} Z`;

  return (
    <View style={{ width: "100%", height, overflow: "visible" }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
          <Defs>
            <SvgLinearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <Stop offset="100%" stopColor={color} stopOpacity="0" />
            </SvgLinearGradient>
          </Defs>

          {[0.25, 0.5, 0.75, 1].map((lvl) => {
            const y = padT + innerH * (1 - lvl);
            const val = Math.round(min + range * lvl);
            return (
              <G key={lvl}>
                <Line
                  x1={padL} y1={y} x2={padL + innerW} y2={y}
                  stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4,4"
                />
                <SvgText
                  x={padL - 4} y={y + 4}
                  fontSize="8" fill="rgba(255,255,255,0.2)"
                  textAnchor="end"
                >
                  {val}
                </SvgText>
              </G>
            );
          })}

          <Path d={areaD} fill={`url(#grad-${dataKey})`} />
          <Path d={pathD} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {values.map((v: number, i: number) => (
            <G key={i}>
              <Circle cx={toX(i)} cy={toY(v)} r="4" fill={color} stroke="rgba(7,7,15,0.9)" strokeWidth="2" />
            </G>
          ))}

          {data.map((d: any, i: number) => (
            <SvgText
              key={i}
              x={toX(i)} y={height - 6}
              textAnchor="middle" fontSize="9"
              fill="rgba(255,255,255,0.25)"
              fontWeight="500"
            >
              {d.week}
            </SvgText>
          ))}
        </Svg>
    </View>
  );
}

/* --- Sparkline (tiny inline chart) -------------------------- */
function Sparkline({ data, dataKey, color, width = 80, height = 32 }: any) {
  const values = data.map((d: any) => d[dataKey]);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 100;
  const range = (max - min) || 1;

  const toX = (i: number) => (i / (values.length - 1)) * width;
  const toY = (v: number) => height - 4 - ((v - min) / range) * (height - 8);

  const pathD = values
    .map((v: number, i: number) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(" ");

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={pathD} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle
        cx={toX(values.length - 1)} cy={toY(values[values.length - 1])}
        r="3" fill={color}
      />
    </Svg>
  );
}

/* --- Direct Muscle Stats Card (NEW) -------------------------- */
function MuscleGroupStats({ workouts, selected, onSelect }: any) {
  const MUSCLE_MAP: any = {
    "Chest": ["chest"],
    "Arms": ["biceps", "triceps"],
    "Legs": ["quadriceps", "hamstrings", "glutes", "calves", "legs"],
    "Back": ["lats", "back", "core"],
    "Shoulders": ["shoulders"]
  };

  const options = ["Total", "Chest", "Arms", "Legs", "Back", "Shoulders"];

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay();
  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - dayOfWeek);
  
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  const filterByGroup = (w: any) => {
    if (selected === "Total") return w.sets || [];
    const targetAnatomy = MUSCLE_MAP[selected] || [];
    return (w.sets || []).filter((s: any) => targetAnatomy.includes(s.muscle_group?.toLowerCase()));
  };

  const thisWeekSets = workouts.filter((w: any) => new Date(w.created_at) >= startOfThisWeek).flatMap(filterByGroup).length;
  const lastWeekSets = workouts.filter((w: any) => {
    const d = new Date(w.created_at);
    return d >= startOfLastWeek && d < startOfThisWeek;
  }).flatMap(filterByGroup).length;

  const delta = thisWeekSets - lastWeekSets;
  const trendColor = delta >= 0 ? "#30D158" : "#FF453A";

  return (
    <View style={[styles.card, { padding: 20 }]}>
      <Text style={styles.cardHeaderSmall}>Weekly Training Volume · Focus</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
        <View style={styles.chipsContainer}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              onPress={() => onSelect(opt)}
              style={[
                styles.chipButton,
                selected === opt ? styles.chipButtonActive : styles.chipButtonInactive
              ]}
            >
              <Text style={selected === opt ? styles.chipTextActive : styles.chipTextInactive}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.volumeRow}>
        <View>
          <Text style={styles.volumeLabel}>Total Sets {selected !== "Total" && `(${selected})`}</Text>
          <View style={styles.volumeNumberContainer}>
            <Text style={styles.volumeNumber}>{thisWeekSets}</Text>
            <Text style={styles.volumeUnit}>sets</Text>
          </View>
        </View>

        <View style={styles.volumeDeltaContainer}>
          <Text style={[styles.volumeDelta, { color: trendColor }]}>
            {delta >= 0 ? `+${delta}` : delta}
          </Text>
          <Text style={styles.volumeDeltaLabel}>vs Last Week</Text>
        </View>
      </View>
    </View>
  );
}

/* --- Streak + Activity Card ---------------------------------- */
function ActivityCard({ workoutStats = {} as any }: any) {
  const { workouts = 0, avg = 0, rest = 0, activity = [] } = workoutStats;
  const colors = ["rgba(255,255,255,0.06)", "rgba(10,132,255,0.38)", "#0A84FF"];
  const displayActivity = activity.length ? activity : Array.from({ length: 70 }, () => 0);

  return (
    <View style={styles.card}>
      <View style={styles.activityHeader}>
        <Text style={styles.cardHeaderSmall}>Activity · 10 Weeks</Text>
        <View style={styles.streakBadge}>
          <View style={styles.streakDot} />
          <Text style={styles.streakText}>Streak Active</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {displayActivity.map((intensity: number, i: number) => (
          <View
            key={i}
            style={[styles.gridCell, { backgroundColor: colors[intensity] }]}
          />
        ))}
      </View>

      <View style={styles.activityStats}>
        {[
          { label: "Workouts", val: workouts, color: "#0A84FF" },
          { label: "Avg / week", val: avg, color: "#FF9F0A" },
          { label: "Rest days", val: rest, color: "rgba(255,255,255,0.4)" },
        ].map(({ label, val, color }) => (
          <View key={label} style={styles.activityStatCol}>
            <Text style={[styles.activityStatValue, { color }]}>{val}</Text>
            <Text style={styles.activityStatLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* --- Page ---------------------------------------------------- */
export default function ProgressPage() {
  const router = useRouter();
  const ctx = useSettings() as any;
  const unit = ctx?.weightUnit || "lbs";
  const [selectedLift, setSelectedLift] = useState("bench");
  const [graphData, setGraphData] = useState([{ week: "Start", bench: 0, squat: 0, deadlift: 0 }, { week: "Now", bench: 0, squat: 0, deadlift: 0 }]);
  
  const [workoutStats, setWorkoutStats] = useState({ workouts: 0, avg: "0", rest: 0, activity: [] });
  const [muscleSelection, setMuscleSelection] = useState("Total");

  const { workouts: allWorkouts, prs, refresh, loading: dataLoading } = useData() as any;

  useEffect(() => {
    if (prs) {
      if (prs.length > 0) {
        const sorted = [...prs].sort((a: any, b: any) => new Date(a.achieved_at).getTime() - new Date(b.achieved_at).getTime());
        let runningMax: any = { bench: 0, squat: 0, deadlift: 0 };
        const formatted: any[] = [];
        sorted.forEach((pr: any) => {
          const exName = pr.exercise_name?.toLowerCase();
          const wOriginal = parseFloat(pr.weight);
          const w = unit === "kg" ? Math.round(wOriginal / 2.205) : wOriginal;
          if (exName in runningMax) runningMax[exName] = w;
          formatted.push({
            week: new Date(pr.achieved_at).toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
            bench: runningMax.bench, squat: runningMax.squat, deadlift: runningMax.deadlift,
          });
        });
        if (formatted.length === 1) formatted.push({ ...formatted[0], week: "--" });
        setGraphData(formatted);
      }
    }

    if (allWorkouts) {
      const completed = allWorkouts.filter((w: any) => w.status === 'completed' || w.sets?.length > 0);
      
      if (completed.length > 0) {
        const now = new Date();
        const activity: any = Array.from({ length: 70 }, (_, i) => {
            const d = new Date();
            d.setDate(now.getDate() - (69 - i));
            const dateStr = d.toISOString().split('T')[0];
            const count = completed.filter((w: any) => w.created_at.startsWith(dateStr)).length;
            return Math.min(count, 2);
        });

        const start = new Date(completed[completed.length - 1].created_at);
        const weeks = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000)));
        setWorkoutStats({
          workouts: completed.length,
          avg: (completed.length / weeks).toFixed(1),
          rest: (weeks * 7) - completed.length,
          activity
        });
      }
    }
  }, [prs, allWorkouts, unit]);

  return (
    <PageShell title="Progress" subtitle="Historical · 8 Weeks" onSettingsClick={() => router.push("/settings" as any)}>
      <View style={styles.topCardsRow}>
        {dataLoading.prs ? (
          Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={[styles.card, { flex: 1, height: 135 }]} />
          ))
        ) : (
          LIFTS.map((l, i) => {
            const vals = graphData.map((d: any) => d[l.key]);
            const gain = vals[vals.length - 1] - vals[0];
            const latestWeight = vals[vals.length - 1];
            return (
              <View key={l.key} style={[styles.card, { flex: 1, padding: 12, marginBottom: 16 }]}>
                <Text style={styles.liftCardTitle}>{l.label.split(" ")[0]}</Text>
                <Text style={[styles.liftCardValue, { color: l.color }]}>
                  {latestWeight}
                  <Text style={styles.liftCardUnit}> {unit}</Text>
                </Text>
                <Sparkline data={graphData} dataKey={l.key} color={l.color} />
                <Text style={styles.liftCardGain}>+{gain} {unit}</Text>
              </View>
            );
          })
        )}
      </View>

      {/* Muscle Analytics */}
      {dataLoading.workouts ? (
        <View style={[styles.card, { height: 180 }]} />
      ) : (
        <MuscleGroupStats 
          workouts={allWorkouts || []} 
          selected={muscleSelection} 
          onSelect={setMuscleSelection} 
        />
      )}

      {/* Activity Grid */}
      {dataLoading.workouts ? (
        <View style={[styles.card, { height: 190 }]} />
      ) : (
        <ActivityCard workoutStats={workoutStats} />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 20,
  },
  cardHeaderSmall: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 16,
  },
  topCardsRow: {
    flexDirection: "row",
    gap: 10,
  },
  liftCardTitle: {
    fontSize: 9,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  liftCardValue: {
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24,
    marginBottom: 4,
  },
  liftCardUnit: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "500",
  },
  liftCardGain: {
    fontSize: 10,
    color: "#30D158",
    fontWeight: "600",
    marginTop: 2,
  },
  chipsScroll: {
    marginBottom: 16,
  },
  chipsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  chipButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipButtonActive: {
    backgroundColor: "rgba(10, 132, 255, 0.2)",
    borderColor: "rgba(10, 132, 255, 0.25)",
  },
  chipButtonInactive: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "transparent",
  },
  chipTextActive: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0A84FF",
  },
  chipTextInactive: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.4)",
  },
  volumeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  volumeLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  volumeNumberContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  volumeNumber: {
    fontSize: 42,
    fontWeight: "900",
    color: "#fff",
    lineHeight: 44,
  },
  volumeUnit: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.4)",
  },
  volumeDeltaContainer: {
    alignItems: "flex-end",
  },
  volumeDelta: {
    fontSize: 18,
    fontWeight: "800",
  },
  volumeDeltaLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  streakDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF2D55",
  },
  streakText: {
    fontSize: 11,
    color: "#FF2D55",
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    width: "100%",
  },
  gridCell: {
    width: "8.5%", // approx for 10 columns with gaps
    aspectRatio: 1,
    borderRadius: 3,
  },
  activityStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  activityStatCol: {
    alignItems: "center",
  },
  activityStatValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  activityStatLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
});
