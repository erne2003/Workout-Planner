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
import { useChartScrubber } from '../../hooks/useChartScrubber';

/* --- Lift config --------------------------------------------- */
const LIFTS = [
  { key: "bench", label: "Bench Press", color: "#0A84FF", unit: "lbs" },
  { key: "squat", label: "Squat", color: "#FF2D55", unit: "lbs" },
  { key: "deadlift", label: "Deadlift", color: "#FFD60A", unit: "lbs" },
];

const isBench = (name: string) => {
  const n = name?.toLowerCase()?.trim() || "";
  return n === "bench" || n === "bench press" || n === "barbell bench press" || n === "flat bench press" || n === "chest press";
};
const isSquat = (name: string) => {
  const n = name?.toLowerCase()?.trim() || "";
  return n === "squat" || n === "barbell squat" || n === "back squat" || n === "back squats" || n === "squats";
};
const isDeadlift = (name: string) => {
  const n = name?.toLowerCase()?.trim() || "";
  return n === "deadlift" || n === "barbell deadlift" || n === "deadlifts";
};

const matchLiftKey = (name: string, key: string) => {
  if (key === "bench") return isBench(name);
  if (key === "squat") return isSquat(name);
  if (key === "deadlift") return isDeadlift(name);
  return false;
};

/* --- SVG Line Chart ------------------------------------------ */
function LineChart({ data, dataKey, color, width = 340, height = 160 }: any) {
  const { colors: themeColors } = useTheme();
  const values = data.map((d: any) => d[dataKey]);
  const min = values.length ? Math.min(...values) - 20 : 0;
  const max = values.length ? Math.max(...values) + 20 : 100;
  const range = (max - min) || 1;

  const padL = 8, padR = 8, padT = 12, padB = 35;
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

/* --- Strength Trajectory Chart Component ----------------------- */
function StrengthTrajectoryChart({ data, selectedLift, colors, width = 310, height = 200, onScrubChange }: any) {
  const chartWidth = width;
  const padL = 28, padR = 15, padT = 10, padB = 20;
  const innerW = chartWidth - padL - padR;
  const innerH = height - padT - padB;

  const lifts = [
    { key: "bench", color: "#0A84FF", name: "Bench" },
    { key: "squat", color: "#FF2D55", name: "Squat" },
    { key: "deadlift", color: "#FFD60A", name: "Deadlift" },
  ];

  const activeLifts = selectedLift === "all" ? lifts : lifts.filter(l => l.key === selectedLift);

  const allValues = data.flatMap((d: any) =>
    activeLifts.map(l => d[l.key]).filter(v => v > 0)
  );
  
  let min = 0;
  let max = 100;

  if (allValues.length > 0) {
    const rawMax = Math.max(...allValues);
    const rawMin = Math.min(...allValues);
    
    if (selectedLift === "all") {
      min = 0;
      max = rawMax + 15;
    } else {
      const diff = rawMax - rawMin;
      let padding = Math.max(5, diff * 0.2); 
      
      let newMin = Math.max(0, rawMin - padding);
      let newMax = rawMax + padding;
      
      let newRange = newMax - newMin;
      newRange = Math.ceil(newRange / 4) * 4; 
      
      if (newRange < 4) newRange = 4;
      if (diff > 10) {
         newRange = Math.ceil(newRange / 20) * 20;
      } else if (diff > 5) {
         newRange = Math.ceil(newRange / 8) * 8;
      }

      min = Math.floor(newMin);
      max = min + newRange;
    }
  }
  
  const range = (max - min) || 1;

  const toX = (i: number) => padL + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const toY = (v: number) => padT + innerH - ((v - min) / range) * innerH;

  const { panHandlers, displayIndex, isScrubbing } = useChartScrubber(data.length, chartWidth, padL, padR, onScrubChange);
  const activeData = data[displayIndex];

  return (
    <View style={{ width: "100%", position: "relative" }}>
      {data.length > 0 && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8, paddingHorizontal: 10 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textPrimary }}>{activeData.date}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {activeLifts.map(l => activeData[l.key] > 0 ? (
              <View key={l.key} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: l.color }} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textPrimary }}>{activeData[l.key]}</Text>
              </View>
            ) : null)}
          </View>
        </View>
      )}
      <View {...panHandlers} style={{ width: "100%", height, overflow: "visible" }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${height}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((lvl) => {
          const y = padT + innerH * (1 - lvl);
          const val = Math.round(min + range * lvl);
          return (
            <G key={lvl}>
              <Line
                x1={padL} y1={y} x2={padL + innerW} y2={y}
                stroke={colors.border} strokeWidth="1" strokeDasharray="3,3"
              />
              <SvgText x={padL - 4} y={y + 3} fontSize="8" fill={colors.textTertiary} textAnchor="end">
                {val}
              </SvgText>
            </G>
          );
        })}

        {activeLifts.map((l) => {
          const points = data.map((d: any, i: number) => ({ x: toX(i), y: toY(d[l.key] || min), val: d[l.key] }));
          const validPoints = points.filter((p: any) => p.val > 0);
          if (validPoints.length === 0) return null;

          const pathD = validPoints
            .map((p: any, i: number) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
            .join(" ");

          return (
            <G key={l.key}>
              <Path d={pathD} stroke={l.color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {validPoints.map((p: any, idx: number) => (
                <Circle key={idx} cx={p.x} cy={p.y} r="5" fill={l.color} stroke={colors.bgCard || "#1c1c1e"} strokeWidth="2" />
              ))}
            </G>
          );
        })}

        {isScrubbing && activeData && (
          <G>
            <Line x1={toX(displayIndex)} y1={padT} x2={toX(displayIndex)} y2={padT + innerH} stroke={colors.border} strokeWidth="1" strokeDasharray="4,4" />
            {activeLifts.map((l) => {
              const val = activeData[l.key];
              if (!val || val <= 0) return null;
              return (
                <G key={`hl-${l.key}`}>
                  <Circle cx={toX(displayIndex)} cy={toY(val)} r="9" fill="transparent" stroke={l.color} strokeWidth="2" opacity="0.3" />
                  <Circle cx={toX(displayIndex)} cy={toY(val)} r="5" fill={l.color} stroke={colors.bgCard || "#1c1c1e"} strokeWidth="2" />
                </G>
              );
            })}
          </G>
        )}

        {data.length > 0 && [0, Math.floor(data.length / 2), data.length - 1].map((idx) => {
          if (idx >= data.length || idx < 0) return null;
          const d = data[idx];
          return (
            <SvgText
              key={idx}
              x={toX(idx)} y={height - 4}
              textAnchor="middle" fontSize="8"
              fill={colors.textTertiary}
            >
              {d.date}
            </SvgText>
          );
        })}
      </Svg>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 8 }}>
        {lifts.map(l => {
          const active = selectedLift === "all" || selectedLift === l.key;
          return (
            <View key={l.key} style={{ flexDirection: "row", alignItems: "center", gap: 3, opacity: active ? 1 : 0.3 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: l.color }} />
              <Text style={{ fontSize: 9, color: colors.textSecondary }}>{l.name}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* --- Volume & Intensity Chart Component ----------------------- */
function VolumeIntensityChart({ data, colors, width = 310, height = 160, onScrubChange }: any) {
  const padL = 35, padR = 15, padT = 15, padB = 20;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const tonnages = data.map((d: any) => d.tonnage);
  const maxTonnage = Math.max(...tonnages) || 1000;

  const toX = (i: number) => padL + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const toTonnageY = (v: number) => padT + innerH - (maxTonnage > 0 ? (v / maxTonnage) * innerH : 0);

  const tonnagePathD = data
    .map((d: any, i: number) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toTonnageY(d.tonnage).toFixed(1)}`)
    .join(" ");

  const tonnageAreaD = data.length > 0
    ? `${tonnagePathD} L${toX(data.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${toX(0).toFixed(1)},${(padT + innerH).toFixed(1)} Z`
    : "";

  const { panHandlers, displayIndex, isScrubbing } = useChartScrubber(data.length, width, padL, padR, onScrubChange);
  const activeData = data[displayIndex];

  return (
    <View style={{ width: "100%", position: "relative" }}>
      {data.length > 0 && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8, paddingHorizontal: 10 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textPrimary }}>{activeData.week}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#30D158" }} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textPrimary }}>
                {activeData.tonnage >= 1000 ? `${(activeData.tonnage / 1000).toFixed(1)}k` : activeData.tonnage} lbs
              </Text>
            </View>
          </View>
        </View>
      )}
      <View {...panHandlers} style={{ width: "100%", height, overflow: "visible" }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <SvgLinearGradient id="grad-volume" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#30D158" stopOpacity="0.2" />
            <Stop offset="100%" stopColor="#30D158" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>

        {[0, 0.25, 0.5, 0.75, 1].map((lvl) => {
          const y = padT + innerH * (1 - lvl);
          const tonnageVal = Math.round(maxTonnage * lvl);
          return (
            <G key={lvl}>
              <Line
                x1={padL} y1={y} x2={padL + innerW} y2={y}
                stroke={colors.border} strokeWidth="1" strokeDasharray="3,3"
              />
              <SvgText x={padL - 4} y={y + 3} fontSize="8" fill="#30D158" textAnchor="end">
                {tonnageVal >= 1000 ? `${(tonnageVal / 1000).toFixed(1)}k` : tonnageVal}
              </SvgText>
            </G>
          );
        })}

        {data.length > 0 && (
          <G>
            <Path d={tonnageAreaD} fill="url(#grad-volume)" />
            <Path d={tonnagePathD} stroke="#30D158" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {data.map((d: any, i: number) => (
              <Circle
                key={i}
                cx={toX(i)}
                cy={toTonnageY(d.tonnage)}
                r="3"
                fill="#30D158"
                stroke={colors.bgCard || "#1c1c1e"}
                strokeWidth="1"
              />
            ))}
          </G>
        )}

        {isScrubbing && activeData && (
          <G>
            <Line x1={toX(displayIndex)} y1={padT} x2={toX(displayIndex)} y2={padT + innerH} stroke={colors.border} strokeWidth="1" strokeDasharray="4,4" />
            <Circle cx={toX(displayIndex)} cy={toTonnageY(activeData.tonnage)} r="9" fill="transparent" stroke="#30D158" strokeWidth="2" opacity="0.3" />
            <Circle cx={toX(displayIndex)} cy={toTonnageY(activeData.tonnage)} r="5" fill="#30D158" stroke={colors.bgCard || "#1c1c1e"} strokeWidth="2" />
          </G>
        )}

        {data.map((d: any, idx: number) => (
          <SvgText
            key={idx}
            x={toX(idx)} y={height - 4}
            textAnchor="middle" fontSize="8"
            fill={colors.textTertiary}
          >
            {d.week}
          </SvgText>
        ))}
      </Svg>
      </View>
    </View>
  );
}

/* --- Body Composition Chart Component ------------------------- */
function BodyCompositionChart({ data, colors, width = 310, height = 160, onScrubChange }: any) {
  const padL = 30, padR = 25, padT = 15, padB = 20;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const weights = data.map((d: any) => d.weight);
  const minW = Math.max(0, Math.min(...weights) - 5);
  const maxW = Math.max(...weights) + 5;
  const rangeW = (maxW - minW) || 1;

  const toX = (i: number) => padL + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const toWeightY = (v: number) => padT + innerH - ((v - minW) / rangeW) * innerH;
  const toFatY = (v: number) => padT + innerH - (v / 40) * innerH;

  const weightPathD = data
    .map((d: any, i: number) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toWeightY(d.weight).toFixed(1)}`)
    .join(" ");

  const leanPathD = data
    .map((d: any, i: number) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toWeightY(d.leanMass).toFixed(1)}`)
    .join(" ");

  const fatPathD = data
    .map((d: any, i: number) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toFatY(d.bodyFat).toFixed(1)}`)
    .join(" ");

  const { panHandlers, displayIndex, isScrubbing } = useChartScrubber(data.length, width, padL, padR, onScrubChange);
  const activeData = data[displayIndex];

  return (
    <View style={{ width: "100%", position: "relative" }}>
      {data.length > 0 && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8, paddingHorizontal: 10 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textPrimary }}>{activeData.date}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#0A84FF" }} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textPrimary }}>{activeData.weight}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#30D158" }} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textPrimary }}>{activeData.leanMass}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#BF5AF2" }} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textPrimary }}>{activeData.bodyFat}%</Text>
            </View>
          </View>
        </View>
      )}
      <View {...panHandlers} style={{ width: "100%", height, overflow: "visible" }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((lvl) => {
          const y = padT + innerH * (1 - lvl);
          const wVal = Math.round(minW + rangeW * lvl);
          const fatVal = (lvl * 40).toFixed(0);
          return (
            <G key={lvl}>
              <Line
                x1={padL} y1={y} x2={padL + innerW} y2={y}
                stroke={colors.border} strokeWidth="1" strokeDasharray="3,3"
              />
              <SvgText x={padL - 4} y={y + 3} fontSize="8" fill="#0A84FF" textAnchor="end">
                {wVal}
              </SvgText>
              <SvgText x={padL + innerW + 4} y={y + 3} fontSize="8" fill="#BF5AF2" textAnchor="start">
                {fatVal}%
              </SvgText>
            </G>
          );
        })}

        <Path d={weightPathD} stroke="#0A84FF" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Path d={leanPathD} stroke="#30D158" strokeWidth="1.5" strokeDasharray="4,4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Path d={fatPathD} stroke="#BF5AF2" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {data.map((d: any, i: number) => (
          <Circle
            key={i}
            cx={toX(i)}
            cy={toWeightY(d.weight)}
            r="3"
            fill="#0A84FF"
          />
        ))}

        {data.map((d: any, i: number) => (
          <Circle
            key={`fat-${i}`}
            cx={toX(i)}
            cy={toFatY(d.bodyFat)}
            r="3"
            fill="#BF5AF2"
          />
        ))}

        {isScrubbing && activeData && (
          <G>
            <Line x1={toX(displayIndex)} y1={padT} x2={toX(displayIndex)} y2={padT + innerH} stroke={colors.border} strokeWidth="1" strokeDasharray="4,4" />
            
            <Circle cx={toX(displayIndex)} cy={toWeightY(activeData.weight)} r="9" fill="transparent" stroke="#0A84FF" strokeWidth="2" opacity="0.3" />
            <Circle cx={toX(displayIndex)} cy={toWeightY(activeData.weight)} r="5" fill="#0A84FF" stroke={colors.bgCard || "#1c1c1e"} strokeWidth="2" />
            
            <Circle cx={toX(displayIndex)} cy={toWeightY(activeData.leanMass)} r="9" fill="transparent" stroke="#30D158" strokeWidth="2" opacity="0.3" />
            <Circle cx={toX(displayIndex)} cy={toWeightY(activeData.leanMass)} r="5" fill="#30D158" stroke={colors.bgCard || "#1c1c1e"} strokeWidth="2" />
            
            <Circle cx={toX(displayIndex)} cy={toFatY(activeData.bodyFat)} r="9" fill="transparent" stroke="#BF5AF2" strokeWidth="2" opacity="0.3" />
            <Circle cx={toX(displayIndex)} cy={toFatY(activeData.bodyFat)} r="5" fill="#BF5AF2" stroke={colors.bgCard || "#1c1c1e"} strokeWidth="2" />
          </G>
        )}

        {data.length > 0 && [0, Math.floor(data.length / 2), data.length - 1].map((idx) => {
          if (idx >= data.length || idx < 0) return null;
          const d = data[idx];
          return (
            <SvgText
              key={idx}
              x={toX(idx)} y={height - 4}
              textAnchor="middle" fontSize="8"
              fill={colors.textTertiary}
            >
              {d.date}
            </SvgText>
          );
        })}
      </Svg>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#0A84FF" }} />
          <Text style={{ fontSize: 9, color: colors.textSecondary }}>Weight</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#30D158" }} />
          <Text style={{ fontSize: 9, color: colors.textSecondary }}>Lean Mass</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#BF5AF2" }} />
          <Text style={{ fontSize: 9, color: colors.textSecondary }}>Fat %</Text>
        </View>
      </View>
    </View>
  );
}

/* --- Muscle Radar Chart Component ----------------------------- */
function MuscleRadarChart({ data, colors }: any) {
  const numPoints = 6;
  const width = 310;
  const height = 240;
  const center = width / 2;
  const centerY = height / 2;
  const maxRadius = 80;

  const getCoordinates = (index: number, value: number) => {
    const angle = (index * 2 * Math.PI) / numPoints - Math.PI / 2;
    const x = center + maxRadius * (value / 100) * Math.cos(angle);
    const y = centerY + maxRadius * (value / 100) * Math.sin(angle);
    return { x, y };
  };

  const levels = [25, 50, 75, 100];

  return (
    <View style={{ alignItems: "center", marginVertical: 4 }}>
      <View style={{ width, height, position: "relative" }}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {levels.map((level) => {
            const levelPoints = Array.from({ length: numPoints }, (_, i) => getCoordinates(i, level));
            const path = levelPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
            return (
              <Path
                key={level}
                d={path}
                fill="none"
                stroke={colors.border || "rgba(255,255,255,0.08)"}
                strokeWidth="1"
              />
            );
          })}

          {Array.from({ length: numPoints }).map((_, i) => {
            const outer = getCoordinates(i, 100);
            return (
              <Line
                key={i}
                x1={center} y1={centerY}
                x2={outer.x} y2={outer.y}
                stroke={colors.border || "rgba(255,255,255,0.08)"}
                strokeWidth="1"
              />
            );
          })}

          {(() => {
            const volumePoints = data.map((d: any, i: number) => getCoordinates(i, d.volume));
            const volumePath = volumePoints.map((p: any, i: number) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
            return (
              <Path
                d={volumePath}
                fill="rgba(255, 214, 10, 0.40)"
                stroke="#FFD60A"
                strokeWidth="3.5"
              />
            );
          })()}

          {(() => {
            const freqPoints = data.map((d: any, i: number) => getCoordinates(i, d.frequency));
            const freqPath = freqPoints.map((p: any, i: number) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
            return (
              <Path
                d={freqPath}
                fill="rgba(10, 132, 255, 0.30)"
                stroke="#0A84FF"
                strokeWidth="2.5"
              />
            );
          })()}

          <Circle cx={center} cy={centerY} r="3" fill="#fff" opacity={0.5} />

          {data.map((d: any, i: number) => {
            const labelPos = getCoordinates(i, 120);
            let anchor: "middle" | "start" | "end" = "middle";
            const angle = (i * 2 * Math.PI) / numPoints - Math.PI / 2;
            const cosAngle = Math.cos(angle);
            if (cosAngle > 0.1) anchor = "start";
            else if (cosAngle < -0.1) anchor = "end";

            const textY = labelPos.y + 3;

            return (
              <SvgText
                key={d.subject}
                x={labelPos.x}
                y={textY}
                textAnchor={anchor}
                fontSize="9"
                fontWeight="700"
                fill={colors.textSecondary || "rgba(255,255,255,0.6)"}
              >
                {d.subject}
              </SvgText>
            );
          })}
        </Svg>
      </View>

      <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "#FFD60A" }} />
          <Text style={{ fontSize: 9, fontWeight: "700", color: colors.textSecondary }}>Volume %</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "#0A84FF" }} />
          <Text style={{ fontSize: 9, fontWeight: "700", color: colors.textSecondary }}>Frequency %</Text>
        </View>
      </View>
    </View>
  );
}

/* --- Exercise Progression Chart -------------------------------- */
/* --- Exercise Progression Chart -------------------------------- */
function ExerciseTrajectoryChart({ workouts, unit, onScrubChange }: { workouts: any[]; unit: string; onScrubChange?: (v: boolean) => void }) {
  const { colors, isLight } = useTheme();
  const { prs, metrics } = useData() as any;
  const [activeTab, setActiveTab] = useState<"strength" | "volume" | "body" | "radar">("strength");
  const [selectedLift, setSelectedLift] = useState("all");
  const [selectedWorkout, setSelectedWorkout] = useState("all");

  const strengthChartData = useMemo(() => {
    if (!prs || prs.length === 0) return [];

    const dateMap = new Map<string, { date: string; bench: number; squat: number; deadlift: number }>();
    const sortedPrs = [...prs].sort((a: any, b: any) => new Date(a.achieved_at).getTime() - new Date(b.achieved_at).getTime());

    let runningMax = { bench: 0, squat: 0, deadlift: 0 };

    sortedPrs.forEach((p: any) => {
      const dateStr = new Date(p.achieved_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const name = p.exercise_name?.toLowerCase() || "";
      const rawW = parseFloat(p.weight) || 0;
      const wVal = unit === "kg" ? Math.round(rawW / 2.205) : rawW;

      let dayMax = { ...runningMax };
      let updated = false;

      if (name === "bench" || name === "bench press" || name === "chest press") {
        if (wVal > dayMax.bench) { dayMax.bench = wVal; updated = true; }
      } else if (name === "squat" || name === "back squat" || name === "barbell squat") {
        if (wVal > dayMax.squat) { dayMax.squat = wVal; updated = true; }
      } else if (name === "deadlift" || name === "barbell deadlift") {
        if (wVal > dayMax.deadlift) { dayMax.deadlift = wVal; updated = true; }
      }

      if (updated) {
        runningMax = { ...dayMax };
      }

      dateMap.set(dateStr, {
        date: dateStr,
        ...runningMax
      });
    });

    return Array.from(dateMap.values());
  }, [prs, unit]);

  const workoutTemplates = useMemo(() => {
    if (!workouts || workouts.length === 0) return [];
    const names = new Set<string>();
    workouts.forEach((w: any) => {
      if (w.name) names.add(w.name);
    });
    return Array.from(names);
  }, [workouts]);

  const volumeChartData = useMemo(() => {
    if (!workouts || workouts.length === 0) return [];

    const filteredWorkouts = selectedWorkout === "all"
      ? workouts
      : workouts.filter((w: any) => w.name === selectedWorkout);

    if (filteredWorkouts.length === 0) return [];

    const now = new Date();
    const weeksData = [];

    for (let i = 7; i >= 0; i--) {
      const start = new Date();
      start.setDate(now.getDate() - (i + 1) * 7);
      const end = new Date();
      end.setDate(now.getDate() - i * 7);

      const weekWorkouts = filteredWorkouts.filter((w: any) => {
        const d = new Date(w.created_at || w.date);
        return d >= start && d < end;
      });

      let weeklyTonnage = 0;
      let totalSets = 0;
      let rpeSum = 0;
      let rpeCount = 0;

      weekWorkouts.forEach((w: any) => {
        (w.sets || []).forEach((s: any) => {
          const reps = parseFloat(s.reps) || 0;
          const wOriginal = parseFloat(s.weight) || 0;
          const wVal = unit === "kg" ? Math.round(wOriginal / 2.205) : wOriginal;
          weeklyTonnage += wVal * reps;
          totalSets++;

          if (s.rir !== undefined && s.rir !== null) {
            const rpe = 10 - parseFloat(s.rir);
            rpeSum += rpe;
            rpeCount++;
          }
        });
      });

      const avgRpe = rpeCount > 0 ? parseFloat((rpeSum / rpeCount).toFixed(1)) : 0;
      weeksData.push({
        week: `Wk ${8 - i}`,
        tonnage: weeklyTonnage,
        avgRpe: avgRpe || 7.0,
      });
    }

    return weeksData;
  }, [workouts, selectedWorkout, unit]);

  const bodyChartData = useMemo(() => {
    if (!metrics || metrics.length === 0) return [];

    const sorted = [...metrics].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return sorted.map((m: any) => {
      const wOriginal = parseFloat(m.weight) || 0;
      const w = unit === "kg" ? Math.round(wOriginal / 2.205) : wOriginal;
      const bodyFat = parseFloat(m.body_fat || m.bodyFat) || 0;
      const leanMass = bodyFat > 0 ? parseFloat((w * (1 - bodyFat / 100)).toFixed(1)) : w;

      return {
        date: new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        weight: w,
        bodyFat: bodyFat || 15.0,
        leanMass: leanMass,
      };
    });
  }, [metrics, unit]);

  const radarChartData = useMemo(() => {
    const MUSCLE_TARGETS: any = {
      "Chest": 12,
      "Back": 12,
      "Legs": 16,
      "Shoulders": 8,
      "Arms": 8,
      "Core": 6
    };

    const MUSCLE_MAP: any = {
      "Chest": ["chest"],
      "Back": ["lats", "back", "core"],
      "Legs": ["quadriceps", "hamstrings", "glutes", "calves", "legs"],
      "Shoulders": ["shoulders"],
      "Arms": ["biceps", "triceps"],
      "Core": ["core"]
    };

    const now = new Date();
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(now.getDate() - 28);

    const recentWorkouts = (workouts || []).filter((w: any) => new Date(w.created_at) >= fourWeeksAgo);

    const counts: any = { "Chest": 0, "Back": 0, "Legs": 0, "Shoulders": 0, "Arms": 0, "Core": 0 };
    const frequency: any = { "Chest": 0, "Back": 0, "Legs": 0, "Shoulders": 0, "Arms": 0, "Core": 0 };

    recentWorkouts.forEach((w: any) => {
      const wMuscleGroups = new Set();
      (w.sets || []).forEach((s: any) => {
        const mGroup = s.muscle_group?.toLowerCase();
        Object.keys(MUSCLE_MAP).forEach((subject: string) => {
          if (MUSCLE_MAP[subject].includes(mGroup)) {
            counts[subject]++;
            wMuscleGroups.add(subject);
          }
        });
      });

      wMuscleGroups.forEach((subject: any) => {
        frequency[subject]++;
      });
    });

    return Object.keys(MUSCLE_TARGETS).map((subject: string) => {
      const weeklyVolumeAvg = counts[subject] / 4;
      const target = MUSCLE_TARGETS[subject];
      const volumePct = Math.min(100, Math.round((weeklyVolumeAvg / target) * 100));

      const weeklyFreqAvg = frequency[subject] / 4;
      const freqPct = Math.min(100, Math.round((weeklyFreqAvg / 2) * 100));

      return {
        subject,
        volume: volumePct || 30,
        frequency: freqPct || 40,
      };
    });
  }, [workouts]);

  return (
    <View style={[styles.card, { padding: 16, backgroundColor: colors.bgCard, borderColor: colors.border, marginBottom: 16 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 6, marginBottom: 16 }}>
        {[
          { id: "strength", label: "1RM", color: "#0A84FF" },
          { id: "volume", label: "Volume", color: "#30D158" },
          // Hiding Body Comp Option from visible list
          { id: "radar", label: "Radar", color: "#FFD60A" },
        ].map((tab: any) => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                minWidth: 50,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: active ? `${tab.color}20` : "rgba(255,255,255,0.03)",
                borderWidth: 1,
                borderColor: active ? tab.color : "transparent",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "800", color: active ? tab.color : colors.textSecondary, textTransform: "uppercase" }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === "strength" && (
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, color: colors.textSecondary }}>
              1RM Progression ({unit})
            </Text>

            <View style={{ flexDirection: "row", gap: 4 }}>
              {[
                { id: "all", label: "All" },
                { id: "bench", label: "BP" },
                { id: "squat", label: "SQ" },
                { id: "deadlift", label: "DL" },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setSelectedLift(opt.id)}
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: selectedLift === opt.id ? "#0A84FF" : "transparent"
                  }}
                >
                  <Text style={{ fontSize: 9, fontWeight: "700", color: selectedLift === opt.id ? "#fff" : colors.textSecondary }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {strengthChartData.length === 0 ? (
            <View style={{ height: 200, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>No logs yet. Complete workouts to see graph.</Text>
            </View>
          ) : (
            <StrengthTrajectoryChart data={strengthChartData} selectedLift={selectedLift} colors={colors} width={310} height={200} onScrubChange={onScrubChange} />
          )}
        </View>
      )}

      {activeTab === "volume" && (
        <View>
          <Text style={{ fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, color: colors.textSecondary, marginBottom: 6 }}>
            Weekly Tonnage Volume
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity
                onPress={() => setSelectedWorkout("all")}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 12,
                  backgroundColor: selectedWorkout === "all" ? "rgba(48,209,88,0.2)" : "rgba(255,255,255,0.03)",
                  borderWidth: 1,
                  borderColor: selectedWorkout === "all" ? "#30D158" : "transparent"
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: "700", color: selectedWorkout === "all" ? "#30D158" : colors.textSecondary }}>All Routines</Text>
              </TouchableOpacity>
              {workoutTemplates.map(name => (
                <TouchableOpacity
                  key={name}
                  onPress={() => setSelectedWorkout(name)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 12,
                    backgroundColor: selectedWorkout === name ? "rgba(48,209,88,0.2)" : "rgba(255,255,255,0.03)",
                    borderWidth: 1,
                    borderColor: selectedWorkout === name ? "#30D158" : "transparent"
                  }}
                >
                  <Text style={{ fontSize: 9, fontWeight: "700", color: selectedWorkout === name ? "#30D158" : colors.textSecondary }}>{name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {volumeChartData.some(d => d.tonnage > 0) ? (
            <VolumeIntensityChart data={volumeChartData} colors={colors} width={310} height={160} onScrubChange={onScrubChange} />
          ) : (
            <View style={{ height: 160, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>No volume logs for this routine yet.</Text>
            </View>
          )}
        </View>
      )}

      {activeTab === "body" && (
        <View>
          <Text style={{ fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, color: colors.textSecondary, marginBottom: 10 }}>
            Weight vs Lean Mass vs Body Fat (Hidden)
          </Text>
          {bodyChartData.length > 0 ? (
            <BodyCompositionChart data={bodyChartData} colors={colors} width={310} height={160} onScrubChange={onScrubChange} />
          ) : (
            <View style={{ height: 160, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>No body composition metrics logged yet.</Text>
            </View>
          )}
        </View>
      )}

      {activeTab === "radar" && (
        <View>
          <Text style={{ fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, color: colors.textSecondary, marginBottom: 10 }}>
            Stimulus Volume vs Frequency Score
          </Text>
          <MuscleRadarChart data={radarChartData} colors={colors} />
        </View>
      )}
    </View>
  );
}

/* --- Page Content -------------------------------------------- */
export function ProgressContent({ onScrubChange }: { onScrubChange?: (v: boolean) => void }) {
  const router = useRouter();
  const ctx = useSettings() as any;
  const unit = ctx?.weightUnit || "lbs";
  const [selectedLift, setSelectedLift] = useState("bench");
  const [graphData, setGraphData] = useState([{ week: "Start", bench: 0, squat: 0, deadlift: 0 }, { week: "Now", bench: 0, squat: 0, deadlift: 0 }]);

  const [workoutStats, setWorkoutStats] = useState({ workouts: 0, avg: "0", rest: 0, activity: [] });
  const [muscleSelection, setMuscleSelection] = useState("Total");
  const { colors, isLight } = useTheme();

  const { workouts: allWorkouts, prs, refresh, loading: dataLoading } = useData() as any;

  const getLatestEstimated1RM = (liftKey: string) => {
    if (!prs || prs.length === 0) return 0;
    const liftPrs = prs.filter((p: any) => {
      const name = p.exercise_name?.toLowerCase();
      let match = false;
      if (liftKey === "bench") match = name === "bench" || name === "bench press";
      else if (liftKey === "squat") match = name === "squat" || name === "back squat";
      else if (liftKey === "deadlift") match = name === "deadlift" || name === "barbell deadlift";
      return match;
    });
    if (liftPrs.length === 0) return 0;
    liftPrs.sort((a: any, b: any) => new Date(b.achieved_at).getTime() - new Date(a.achieved_at).getTime());
    const wOriginal = parseFloat(liftPrs[0].weight) || 0;
    return unit === "kg" ? Math.round(wOriginal / 2.205) : wOriginal;
  };

  const getFirstEstimated1RM = (liftKey: string) => {
    if (!prs || prs.length === 0) return 0;
    const liftPrs = prs.filter((p: any) => {
      const name = p.exercise_name?.toLowerCase();
      let match = false;
      if (liftKey === "bench") match = name === "bench" || name === "bench press";
      else if (liftKey === "squat") match = name === "squat" || name === "back squat";
      else if (liftKey === "deadlift") match = name === "deadlift" || name === "barbell deadlift";
      return match;
    });
    if (liftPrs.length === 0) return 0;
    liftPrs.sort((a: any, b: any) => new Date(a.achieved_at).getTime() - new Date(b.achieved_at).getTime());
    const wOriginal = parseFloat(liftPrs[0].weight) || 0;
    return unit === "kg" ? Math.round(wOriginal / 2.205) : wOriginal;
  };

  const getSparklineDataForWorkouts = (liftKey: string) => {
    if (!prs || prs.length === 0) return [{ val: 0 }, { val: 0 }];
    const liftPrs = prs.filter((p: any) => {
      const name = p.exercise_name?.toLowerCase();
      let match = false;
      if (liftKey === "bench") match = name === "bench" || name === "bench press";
      else if (liftKey === "squat") match = name === "squat" || name === "back squat";
      else if (liftKey === "deadlift") match = name === "deadlift" || name === "barbell deadlift";
      return match;
    });
    if (liftPrs.length === 0) return [{ val: 0 }, { val: 0 }];
    liftPrs.sort((a: any, b: any) => new Date(a.achieved_at).getTime() - new Date(b.achieved_at).getTime());
    
    const map = new Map<string, number>();
    liftPrs.forEach((set: any) => {
      const dateStr = new Date(set.achieved_at).toDateString();
      const wOriginal = parseFloat(set.weight) || 0;
      const converted = unit === "kg" ? Math.round(wOriginal / 2.205) : wOriginal;
      const currentMax = map.get(dateStr) || 0;
      if (converted > currentMax) {
        map.set(dateStr, converted);
      }
    });

    const vals = Array.from(map.values()).map(val => ({ val }));
    if (vals.length === 1) return [{ val: vals[0].val }, { val: vals[0].val }];
    return vals;
  };

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
        {dataLoading.workouts ? (
          Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={[styles.card, { position: 'relative', flex: 1, height: 135, backgroundColor: colors.bgCard, borderColor: colors.border }]} />
          ))
        ) : (
          LIFTS.map((l, i) => {
            const latestWeight = getLatestEstimated1RM(l.key);
            const firstWeight = getFirstEstimated1RM(l.key);
            const gain = latestWeight > 0 && firstWeight > 0 ? latestWeight - firstWeight : 0;
            const sparkData = getSparklineDataForWorkouts(l.key);
            return (
              <View key={l.key} style={[styles.card, { flex: 1, padding: 12, marginBottom: 16, backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.liftCardTitle, { color: colors.textSecondary }]}>{l.label.split(" ")[0]}</Text>
                <Text style={[styles.liftCardValue, { color: l.color }]}>
                  {latestWeight}
                  <Text style={[styles.liftCardUnit, { color: colors.textTertiary }]}> {unit}</Text>
                </Text>
                <Sparkline data={sparkData} dataKey="val" color={l.color} />
                <Text style={styles.liftCardGain}>+{gain} {unit}</Text>
              </View>
            );
          })
        )}
      </View>

      {/* Exercise Trajectory Chart */}
      <ExerciseTrajectoryChart workouts={allWorkouts || []} unit={unit} onScrubChange={(scrubbing: boolean) => onScrubChange?.(!scrubbing)} />

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
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const { colors, isLight } = useTheme();

  return (
    <PageShell
      title={activeTab === "progress" ? "Progress" : "Strength"}
      subtitle={activeTab === "progress" ? "Historical · 8 Weeks" : "Analytics · Big Lifts & Recovery"}
      onSettingsClick={() => router.push("/settings" as any)}
      scrollEnabled={scrollEnabled}
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

      {activeTab === "progress" ? <ProgressContent onScrubChange={setScrollEnabled} /> : <StrengthContent />}
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
    justifyContent: "flex-end"
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
