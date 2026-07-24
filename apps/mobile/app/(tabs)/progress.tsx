import React, { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Alert } from "react-native";
import { useRouter } from "expo-router";
import PageShell from "@/components/PageShell";
import {
  useSettings,
  useData,
  PROGRESS_DATA,
  PERSONAL_RECORDS,
  getLoggedExercises,
  getExerciseProgressPoints,
} from "@apex/core";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, G, Line, Text as SvgText, Path, Circle, Rect } from "react-native-svg";
import { StrengthContent } from "./strength";
import { useTheme } from "../../hooks/useTheme";

/* --- Lift config --------------------------------------------- */
const LIFTS = [
  { key: "bench", label: "Bench Press", color: "#0A84FF", unit: "lbs" },
  { key: "squat", label: "Back Squat", color: "#FF2D55", unit: "lbs" },
  { key: "deadlift", label: "Deadlift", color: "#FFD60A", unit: "lbs" },
];

/* --- SVG Line Chart ------------------------------------------ */
function LineChart({ data, dataKey, color, width = 340, height = 160 }: any) {
  const { colors: themeColors } = useTheme();
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
                stroke={themeColors.border} strokeWidth="1" strokeDasharray="4,4"
              />
              <SvgText
                x={padL - 4} y={y + 4}
                fontSize="8" fill={themeColors.textTertiary}
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
            <Circle cx={toX(i)} cy={toY(v)} r="4" fill={color} stroke={themeColors.bgBase} strokeWidth="2" />
          </G>
        ))}

        {data.map((d: any, i: number) => (
          <SvgText
            key={i}
            x={toX(i)} y={height - 6}
            textAnchor="middle" fontSize="9"
            fill={themeColors.textTertiary}
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
  const toY = (v: number) => height - 2 - ((v - min) / range) * (height - 4);

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
  const { colors, isLight } = useTheme();
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
    <View style={[styles.card, { padding: 20, backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={[styles.cardHeaderSmall, { color: colors.textSecondary }]}>Weekly Training Volume · Focus</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
        <View style={styles.chipsContainer}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              onPress={() => onSelect(opt)}
              style={[
                styles.chipButton,
                selected === opt ? styles.chipButtonActive : [styles.chipButtonInactive, { backgroundColor: colors.bgCard, borderColor: colors.border }]
              ]}
            >
              <Text style={selected === opt ? styles.chipTextActive : [styles.chipTextInactive, { color: colors.textSecondary }]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.volumeRow}>
        <View>
          <Text style={[styles.volumeLabel, { color: colors.textSecondary }]}>Total Sets {selected !== "Total" && `(${selected})`}</Text>
          <View style={styles.volumeNumberContainer}>
            <Text style={[styles.volumeNumber, { color: colors.textPrimary }]}>{thisWeekSets}</Text>
            <Text style={[styles.volumeUnit, { color: colors.textTertiary }]}>sets</Text>
          </View>
        </View>

        <View style={styles.volumeDeltaContainer}>
          <Text style={[styles.volumeDelta, { color: trendColor }]}>
            {delta >= 0 ? `+${delta}` : delta}
          </Text>
          <Text style={[styles.volumeDeltaLabel, { color: colors.textTertiary }]}>vs Last Week</Text>
        </View>
      </View>
    </View>
  );
}

/* --- Streak + Activity Card ---------------------------------- */
function ActivityCard({ workoutStats = {} as any }: any) {
  const { workouts = 0, avg = 0, rest = 0, activity = [] } = workoutStats;
  const { colors: themeColors, isLight } = useTheme();
  const colors = [isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)", "rgba(10,132,255,0.38)", "#0A84FF"];
  const displayActivity = activity.length ? activity : Array.from({ length: 70 }, () => 0);

  // Group activity into 7 rows of 10 columns
  const rows = [];
  for (let i = 0; i < displayActivity.length; i += 10) {
    rows.push(displayActivity.slice(i, i + 10));
  }

  return (
    <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
      <View style={styles.activityHeader}>
        <Text style={[styles.cardHeaderSmall, { color: themeColors.textSecondary }]}>Activity · 10 Weeks</Text>
        <View style={styles.streakBadge}>
          <View style={styles.streakDot} />
          <Text style={styles.streakText}>Streak Active</Text>
        </View>
      </View>

      <View style={styles.gridContainer}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.gridRow}>
            {row.map((intensity: number, colIndex: number) => (
              <View
                key={colIndex}
                style={[styles.gridCell, { backgroundColor: colors[intensity] }]}
              />
            ))}
          </View>
        ))}
      </View>

      <View style={styles.activityStats}>
        {[
          { label: "Workouts", val: workouts, color: "#0A84FF" },
          { label: "Avg / week", val: avg, color: "#FF9F0A" },
          { label: "Rest days", val: rest, color: themeColors.textTertiary },
        ].map(({ label, val, color }) => (
          <View key={label} style={styles.activityStatCol}>
            <Text style={[styles.activityStatValue, { color }]}>{val}</Text>
            <Text style={[styles.activityStatLabel, { color: themeColors.textTertiary }]}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* --- Exercise Progression Chart -------------------------------- */
function ExerciseTrajectoryChart({ workouts, unit }: { workouts: any[]; unit: string }) {
  const { colors, isLight } = useTheme();
  const [selectedEx, setSelectedEx] = useState("");
  const [metric, setMetric] = useState<"topSetWeight" | "estimated1RM" | "sessionVolume">("topSetWeight");
  const [timeRange, setTimeRange] = useState<"1M" | "3M" | "6M" | "1Y" | "ALL">("3M");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeDot, setActiveDot] = useState<{
    x: number;
    y: number;
    pt: any;
    index: number;
  } | null>(null);

  // 1. Unique logged exercises from @apex/core
  const loggedExercises = useMemo(() => {
    return getLoggedExercises(workouts || []);
  }, [workouts]);

  // 2. Persist & load last selected exercise
  useEffect(() => {
    if (loggedExercises.length > 0) {
      if (!selectedEx) {
        const defaultEx = loggedExercises.find((e: any) =>
          /bench|squat|deadlift/i.test(e.name)
        )?.name || loggedExercises[0].name;
        setSelectedEx(defaultEx);
      }
    }
  }, [loggedExercises, selectedEx]);

  // 3. Compute progress points from @apex/core
  const rawPoints = useMemo(() => {
    if (!selectedEx || !workouts) return [];
    return getExerciseProgressPoints(workouts, selectedEx, timeRange);
  }, [workouts, selectedEx, timeRange]);

  // Unit conversion if kg
  const points = useMemo(() => {
    return rawPoints.map((p) => {
      const topSetWeight = unit === "kg" ? Math.round(p.topSetWeight / 2.205) : p.topSetWeight;
      const estimated1RM = unit === "kg" ? Math.round(p.estimated1RM / 2.205) : p.estimated1RM;
      const sessionVolume = unit === "kg" ? Math.round(p.sessionVolume / 2.205) : p.sessionVolume;
      return {
        ...p,
        topSetWeight,
        estimated1RM,
        sessionVolume,
        formattedDate: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      };
    });
  }, [rawPoints, unit]);

  const [searchQuery, setSearchQuery] = useState("");
  const filteredExercises = useMemo(() => {
    if (!searchQuery) return loggedExercises;
    return loggedExercises.filter((e: any) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [loggedExercises, searchQuery]);

  // Chart dimensions
  const width = 340;
  const height = 200;

  const { yMin, yMax } = useMemo(() => {
    if (points.length === 0) return { yMin: 0, yMax: 100 };
    const vals = points.map((p: any) => p[metric]);
    let minV = Math.min(...vals);
    let maxV = Math.max(...vals);

    let yMinVal = Math.max(0, Math.floor(minV * 0.85));
    let yMaxVal = Math.ceil(maxV * 1.15);

    if (yMaxVal === yMinVal) {
      yMaxVal = yMinVal + 20;
      yMinVal = Math.max(0, yMinVal - 10);
    }
    return { yMin: yMinVal, yMax: yMaxVal };
  }, [points, metric]);

  const padL = 40;
  const padR = 15;
  const padT = 25;
  const padB = 40;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const toX = (idx: number) => padL + (points.length <= 1 ? innerW / 2 : (idx / (points.length - 1)) * innerW);
  const toY = (val: number) => padT + innerH - ((val - yMin) / (yMax - yMin || 1)) * innerH;

  const yGridLines = useMemo(() => {
    const list: number[] = [];
    const step = Math.max(1, Math.round((yMax - yMin) / 4));
    for (let w = Math.ceil(yMin); w <= Math.floor(yMax); w += step) {
      if (!list.includes(w)) list.push(w);
    }
    return list;
  }, [yMin, yMax]);

  return (
    <View style={[styles.card, { padding: 20, backgroundColor: colors.bgCard, borderColor: colors.border, marginBottom: 16 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Text style={[styles.cardHeaderSmall, { color: colors.textSecondary, marginBottom: 0 }]}>
          {metric === "topSetWeight" ? "Top Set Weight" : metric === "estimated1RM" ? "Estimated 1RM (Epley)" : "Session Volume"}
        </Text>

        {/* Metric Toggle */}
        <View style={{ flexDirection: "row", backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)", borderRadius: 8, padding: 2 }}>
          {[
            { id: "topSetWeight", label: "Top Set" },
            { id: "estimated1RM", label: "Est 1RM" },
            { id: "sessionVolume", label: "Vol" },
          ].map((m: any) => (
            <TouchableOpacity
              key={m.id}
              onPress={() => setMetric(m.id)}
              style={{
                paddingVertical: 3,
                paddingHorizontal: 6,
                borderRadius: 6,
                backgroundColor: metric === m.id ? "#0A84FF" : "transparent"
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "700", color: metric === m.id ? "#fff" : colors.textSecondary }}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Time Range Selector */}
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
        {(["1M", "3M", "6M", "1Y", "ALL"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTimeRange(t)}
            style={{
              paddingVertical: 3,
              paddingHorizontal: 8,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: timeRange === t ? "#30D158" : colors.border,
              backgroundColor: timeRange === t ? (isLight ? "rgba(48,209,88,0.12)" : "rgba(48,209,88,0.2)") : "transparent"
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "700", color: timeRange === t ? "#30D158" : colors.textSecondary }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom Expandable Dropdown Selector */}
      <View style={{ position: "relative", zIndex: 100, marginBottom: 16 }}>
        <TouchableOpacity
          onPress={() => {
            const nextState = !isDropdownOpen;
            setIsDropdownOpen(nextState);
            if (!nextState) {
              setSearchQuery(""); // Clear search when closed
            }
          }}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 12,
            borderRadius: 10,
            backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}>
            {selectedEx || "Select Exercise..."}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            {isDropdownOpen ? "▲" : "▼"}
          </Text>
        </TouchableOpacity>

        {isDropdownOpen && (
          <View
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              maxHeight: 250,
              marginTop: 4,
              borderRadius: 10,
              backgroundColor: isLight ? "#ffffff" : "#1c1c1e",
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 5,
            }}
          >
            {/* Search Input */}
            <TextInput
              autoFocus={false}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Type to search..."
              placeholderTextColor={colors.textTertiary}
              clearButtonMode="while-editing"
              style={{
                padding: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                color: colors.textPrimary,
                backgroundColor: isLight ? "rgba(0,0,0,0.01)" : "rgba(255,255,255,0.01)",
                fontSize: 13,
                fontWeight: "600",
              }}
            />
            <ScrollView nestedScrollEnabled style={{ flex: 1 }}>
              {filteredExercises.map((e: any) => (
                <TouchableOpacity
                  key={e.name}
                  onPress={() => {
                    setSelectedEx(e.name);
                    setIsDropdownOpen(false);
                    setSearchQuery("");
                  }}
                  style={{
                    padding: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    backgroundColor: selectedEx === e.name ? (isLight ? "rgba(10,132,255,0.08)" : "rgba(10,132,255,0.12)") : "transparent",
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary }}>
                    {e.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {filteredExercises.length === 0 && (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                    No matching logged exercises
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Empty & Sparse States */}
      {points.length === 0 ? (
        <View style={{ height, justifyContent: "center", alignItems: "center", padding: 20 }}>
          <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: "center" }}>
            No sessions logged for this exercise yet.
          </Text>
        </View>
      ) : points.length === 1 ? (
        <View style={{ height, justifyContent: "center", alignItems: "center", padding: 15 }}>
          <View style={{ backgroundColor: isLight ? "rgba(10,132,255,0.08)" : "rgba(10,132,255,0.15)", borderRadius: 12, padding: 14, alignItems: "center" }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#0A84FF" }}>
              {metric === "topSetWeight" && `${points[0].topSetWeight} ${unit} × ${points[0].topSetReps}`}
              {metric === "estimated1RM" && `${points[0].estimated1RM} ${unit}`}
              {metric === "sessionVolume" && `${points[0].sessionVolume.toLocaleString()} ${unit}`}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
              Logged on {points[0].formattedDate}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: "#FF9F0A", marginTop: 10, fontWeight: "600" }}>
            💡 Log another session to see your progression trend line!
          </Text>
        </View>
      ) : (
        <View style={{ width: "100%", height, overflow: "visible", borderRadius: 16, backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.02)", borderWidth: 1, borderColor: colors.border, paddingVertical: 10 }}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
            <Defs>
              <SvgLinearGradient id="mobileGraphArea" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#0A84FF" stopOpacity={0.25} />
                <Stop offset="100%" stopColor="#0A84FF" stopOpacity={0.0} />
              </SvgLinearGradient>
            </Defs>

            {/* Y Gridlines */}
            {yGridLines.map((w: number) => {
              const y = toY(w);
              return (
                <G key={`y-${w}`}>
                  <Line
                    x1={padL}
                    y1={y}
                    x2={width - padR}
                    y2={y}
                    stroke={colors.border}
                    strokeWidth="1"
                    strokeDasharray="4,4"
                  />
                  <SvgText
                    x={padL - 8}
                    y={y + 4}
                    fontSize="10"
                    fill={colors.textSecondary}
                    textAnchor="end"
                    fontWeight="600"
                  >
                    {w}
                  </SvgText>
                </G>
              );
            })}

            {/* Y Axis Label */}
            <SvgText
              x={10}
              y={padT - 8}
              fontSize="8"
              fill={colors.textTertiary}
              fontWeight="700"
              textAnchor="start"
            >
              {metric === "topSetWeight" ? `TOP SET (${unit.toUpperCase()})` : metric === "estimated1RM" ? `1RM (${unit.toUpperCase()})` : `VOLUME (${unit.toUpperCase()})`}
            </SvgText>

            {/* X Axis Label */}
            <SvgText
              x={padL + innerW / 2}
              y={height - 6}
              fontSize="8"
              fill={colors.textTertiary}
              fontWeight="700"
              textAnchor="middle"
            >
              SESSIONS (CHRONOLOGICAL)
            </SvgText>

            {/* Volume Bars vs Line */}
            {metric === "sessionVolume" ? (
              points.map((pt: any, idx: number) => {
                const cxVal = toX(idx);
                const cyVal = toY(pt.sessionVolume);
                const barW = Math.max(8, Math.min(24, innerW / (points.length * 1.5)));
                const barH = padT + innerH - cyVal;

                return (
                  <G key={`bar-${idx}`}>
                    <Rect
                      x={cxVal - barW / 2}
                      y={cyVal}
                      width={barW}
                      height={Math.max(0, barH)}
                      rx={3}
                      fill="#0A84FF"
                      opacity={0.85}
                    />
                    {points.length <= 15 && (
                      <SvgText
                        x={cxVal}
                        y={cyVal - 6}
                        fontSize="9"
                        fill={colors.textSecondary}
                        textAnchor="middle"
                        fontWeight="600"
                      >
                        {pt.sessionVolume}
                      </SvgText>
                    )}
                  </G>
                );
              })
            ) : (
              <>
                {/* Area Fill */}
                {points.length > 1 && (() => {
                  const firstPt = points[0];
                  const lastPt = points[points.length - 1];
                  const dPath = points.map((pt: any, idx: number) => {
                    const x = toX(idx);
                    const y = toY(pt[metric]);
                    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(" ");
                  const closedPath = `${dPath} L ${toX(points.length - 1)} ${padT + innerH} L ${toX(0)} ${padT + innerH} Z`;
                  return <Path d={closedPath} fill="url(#mobileGraphArea)" />;
                })()}

                {/* Trend Lines */}
                {points.slice(0, -1).map((pt: any, idx: number) => {
                  const nextPt = points[idx + 1];
                  const x1 = toX(idx);
                  const y1 = toY(pt[metric]);
                  const x2 = toX(idx + 1);
                  const y2 = toY(nextPt[metric]);

                  return (
                    <Line
                      key={`line-${idx}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#0A84FF"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  );
                })}

                {/* Point Dots & Rep Labels */}
                {points.map((pt: any, idx: number) => {
                  const isLatest = idx === points.length - 1;
                  const cxVal = toX(idx);
                  const cyVal = toY(pt[metric]);
                  const showLabel = points.length <= 15;

                  return (
                    <G key={`dot-${idx}`}>
                      <Circle
                        cx={cxVal}
                        cy={cyVal}
                        r={isLatest ? 5 : 4}
                        fill="#0A84FF"
                        stroke={colors.bgCard}
                        strokeWidth={2}
                      />
                      {showLabel && (
                        <SvgText
                          x={cxVal}
                          y={cyVal - 8}
                          fontSize="9"
                          fill={colors.textPrimary}
                          textAnchor="middle"
                          fontWeight="700"
                        >
                          {pt.topSetWeight}×{pt.topSetReps}
                        </SvgText>
                      )}
                      {/* Touch overlay */}
                      <Circle
                        cx={cxVal}
                        cy={cyVal}
                        r={20}
                        fill="transparent"
                        onPressIn={() => {
                          setActiveDot({
                            x: cxVal,
                            y: cyVal,
                            pt,
                            index: idx
                          });
                        }}
                        onPressOut={() => {
                          setActiveDot(null);
                        }}
                      />
                    </G>
                  );
                })}
              </>
            )}

            {/* Tooltip Overlay */}
            {activeDot && (() => {
              const boxWidth = 130;
              const boxHeight = 40;
              const tooltipX = Math.max(5, Math.min(width - 5 - boxWidth, activeDot.x - (boxWidth / 2)));
              const tooltipY = activeDot.y < 55 ? activeDot.y + 12 : activeDot.y - 48;
              const pt = activeDot.pt;
              return (
                <G>
                  <Rect
                    x={tooltipX}
                    y={tooltipY}
                    width={boxWidth}
                    height={boxHeight}
                    rx={6}
                    fill={isLight ? "#ffffff" : "#1c1c1e"}
                    stroke={colors.border}
                    strokeWidth={1}
                  />
                  <SvgText
                    x={tooltipX + boxWidth / 2}
                    y={tooltipY + 15}
                    fontSize="9.5"
                    fontWeight="700"
                    fill={colors.textPrimary}
                    textAnchor="middle"
                  >
                    {metric === "topSetWeight" && `${pt.topSetWeight} ${unit} × ${pt.topSetReps} reps`}
                    {metric === "estimated1RM" && `Est 1RM: ${pt.estimated1RM} ${unit}`}
                    {metric === "sessionVolume" && `Volume: ${pt.sessionVolume} ${unit}`}
                  </SvgText>
                  <SvgText
                    x={tooltipX + boxWidth / 2}
                    y={tooltipY + 30}
                    fontSize="8.5"
                    fontWeight="600"
                    fill={colors.textSecondary}
                    textAnchor="middle"
                  >
                    {pt.formattedDate}
                  </SvgText>
                </G>
              );
            })()}
          </Svg>
        </View>
      )}
    </View>
  );
}

/* --- Page Content -------------------------------------------- */
export function ProgressContent() {
  const router = useRouter();
  const ctx = useSettings() as any;
  const unit = ctx?.weightUnit || "lbs";
  const [selectedLift, setSelectedLift] = useState("bench");
  const [graphData, setGraphData] = useState([{ week: "Start", bench: 0, squat: 0, deadlift: 0 }, { week: "Now", bench: 0, squat: 0, deadlift: 0 }]);

  const [workoutStats, setWorkoutStats] = useState({ workouts: 0, avg: "0", rest: 0, activity: [] });
  const [muscleSelection, setMuscleSelection] = useState("Total");
  const { colors, isLight } = useTheme();

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
    <View>
      <View style={styles.topCardsRow}>
        {dataLoading.prs ? (
          Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={[styles.card, { flex: 1, height: 135, backgroundColor: colors.bgCard, borderColor: colors.border }]} />
          ))
        ) : (
          LIFTS.map((l, i) => {
            const vals = graphData.map((d: any) => d[l.key]);
            const gain = vals[vals.length - 1] - vals[0];
            const latestWeight = vals[vals.length - 1];
            return (
              <View key={l.key} style={[styles.card, { flex: 1, padding: 12, marginBottom: 16, backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.liftCardTitle, { color: colors.textSecondary }]}>{l.label.split(" ")[0]}</Text>
                <Text style={[styles.liftCardValue, { color: l.color }]}>
                  {latestWeight}
                  <Text style={[styles.liftCardUnit, { color: colors.textTertiary }]}> {unit}</Text>
                </Text>
                <Sparkline data={graphData} dataKey={l.key} color={l.color} />
                <Text style={styles.liftCardGain}>+{gain} {unit}</Text>
              </View>
            );
          })
        )}
      </View>

      {/* Exercise Trajectory Chart */}
      <ExerciseTrajectoryChart workouts={allWorkouts || []} unit={unit} />

      {/* Muscle Analytics */}
      {dataLoading.workouts ? (
        <View style={[styles.card, { height: 180, backgroundColor: colors.bgCard, borderColor: colors.border }]} />
      ) : (
        <MuscleGroupStats
          workouts={allWorkouts || []}
          selected={muscleSelection}
          onSelect={setMuscleSelection}
        />
      )}

      {/* Activity Grid */}
      {dataLoading.workouts ? (
        <View style={[styles.card, { height: 190, backgroundColor: colors.bgCard, borderColor: colors.border }]} />
      ) : (
        <ActivityCard workoutStats={workoutStats} />
      )}
    </View>
  );
}

export default function ProgressPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"progress" | "strength">("progress");
  const { colors, isLight } = useTheme();

  return (
    <PageShell
      title={activeTab === "progress" ? "Progress" : "Strength"}
      subtitle={activeTab === "progress" ? "Historical · 8 Weeks" : "Analytics · Big Lifts & Recovery"}
      onSettingsClick={() => router.push("/settings" as any)}
    >
      <View style={[styles.segmentContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.segmentButton, activeTab === "progress" && [styles.segmentButtonActive, { backgroundColor: isLight ? "rgba(10,132,255,0.1)" : "rgba(10,132,255,0.15)", borderColor: colors.border }]]}
          onPress={() => setActiveTab("progress")}
        >
          <Text style={[styles.segmentText, activeTab === "progress" ? { color: colors.accentBlue } : { color: colors.textSecondary }]}>Progress</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, activeTab === "strength" && [styles.segmentButtonActive, { backgroundColor: isLight ? "rgba(10,132,255,0.1)" : "rgba(10,132,255,0.15)", borderColor: colors.border }]]}
          onPress={() => setActiveTab("strength")}
        >
          <Text style={[styles.segmentText, activeTab === "strength" ? { color: colors.accentBlue } : { color: colors.textSecondary }]}>Strength</Text>
        </TouchableOpacity>
      </View>

      {activeTab === "progress" ? <ProgressContent /> : <StrengthContent />}
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
  gridContainer: {
    width: "100%",
  },
  gridRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 4,
    width: "100%",
  },
  gridCell: {
    flex: 1,
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
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  segmentButtonActive: {
    backgroundColor: "rgba(10,132,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(10,132,255,0.2)",
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  segmentTextActive: {
    color: "#0A84FF",
  },
  exerciseChip: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  textInput: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  rirChip: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: "center",
  },
  inputLabel: {
    fontSize: 10,
    textTransform: "uppercase",
  },
});
