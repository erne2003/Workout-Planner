import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import PageShell from "@/components/PageShell";
import {
  RECOVERY_COLOR,
  RECOVERY_LABEL,
  getMuscleSoreness,
  setMuscleSoreness,
  computeDynamicRecovery,
  parseLocalISO,
} from "@apex/core/src/recovery";
import { useData } from "@apex/core";
import MuscleMap from "@/components/MuscleMap";
import { ANTERIOR_PATHS, POSTERIOR_PATHS } from "@apex/core";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "../../hooks/useTheme";

const ALL_MUSCLES = [
  ...new Set([...ANTERIOR_PATHS, ...POSTERIOR_PATHS].map((p: any) => p.id))
];

/* ─── Legend Dot ────────────────────────────────────────────── */
function LegendDot({ color, label }: any) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
      <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

/* ─── Soreness Picker ───────────────────────────────────────── */
const SORENESS_LEVELS = ["fully_recovered", "mostly_recovered", "partially_recovered", "not_recovered"];

function SorenessPicker({ current, muscle, onSelect, onClear }: any) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sorenessPickerContainer, { borderTopColor: colors.border }]}>
      <Text style={[styles.overrideLabel, { color: colors.textSecondary }]}>Override</Text>
      <View style={{ flexDirection: "row", flex: 1, gap: 6 }}>
        {SORENESS_LEVELS.map((level) => {
          const color = (RECOVERY_COLOR as any)[level];
          const isActive = current === level;
          return (
            <TouchableOpacity
              key={level}
              onPress={() => isActive ? onClear(muscle) : onSelect(muscle, level)}
              style={[
                styles.sorenessBtn,
                {
                  borderColor: isActive ? color : colors.border,
                  backgroundColor: isActive ? `${color}20` : "transparent",
                }
              ]}
            >
              <Text style={[styles.sorenessBtnText, { color: isActive ? color : colors.textSecondary }]}>
                {(RECOVERY_LABEL as any)[level]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/* ─── Muscle Row ────────────────────────────────────────────── */
function MuscleRow({ name, data, manualLevel, onSelect, onClear }: any) {
  const [open, setOpen] = useState(false);
  const { colors, isLight } = useTheme();

  const color = (RECOVERY_COLOR as any)[data.status];
  const hours = data.hours ?? 0;
  const hoursLabel = hours >= 24
    ? `${Math.round(hours)}h ago`
    : hours >= 1
    ? `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m ago`
    : "just now";

  return (
    <View style={[styles.muscleRowContainer, { borderColor: data.isManual ? `${color}30` : colors.border, backgroundColor: isLight ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.03)" }]}>
      <TouchableOpacity onPress={() => setOpen(!open)} style={styles.muscleRowHeader}>
        <View style={styles.muscleRowTitleCol}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[styles.muscleName, { color: colors.textPrimary }]}>{name}</Text>
            {data.isManual && (
              <Text style={{ fontSize: 9, color, opacity: 0.7 }}>✎ manual</Text>
            )}
          </View>
          <Text style={[styles.muscleTime, { color: colors.textSecondary }]}>
            {data.isManual ? "Manual override active" : hoursLabel}
          </Text>
        </View>

        <View style={styles.muscleRowRightCol}>
          <View style={[styles.statusBadge, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
            <Text style={[styles.statusBadgeText, { color }]}>{(RECOVERY_LABEL as any)[data.status]}</Text>
          </View>
          <Text style={[styles.pctText, { color }]}>{data.pct}%</Text>
          <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
            <Svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <Path d="M2 4l4 4 4-4" stroke={colors.textSecondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        </View>
      </TouchableOpacity>

      <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.barFill, { width: `${data.pct}%`, backgroundColor: color }]} />
      </View>

      {open && (
        <SorenessPicker
          current={manualLevel}
          muscle={name}
          onSelect={onSelect}
          onClear={onClear}
        />
      )}
    </View>
  );
}

/* ─── Overall Score Ring ────────────────────────────────────── */
function OverallScore({ muscleData }: any) {
  const { colors } = useTheme();
  const values = Object.values(muscleData);
  if (!values.length) return null;
  const avg = Math.round(values.reduce((s: number, m: any) => s + m.pct, 0) / values.length);
  const color = avg >= 75 ? "#30D158" : avg >= 50 ? "#FF9F0A" : "#FF2D55";
  const circumference = 2 * Math.PI * 44;
  const offset = circumference * (1 - avg / 100);

  return (
    <View style={styles.scoreRingContainer}>
      <Svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx="50" cy="50" r="44" fill="none" stroke={colors.border} strokeWidth="7" />
        <Circle
          cx="50" cy="50" r="44" fill="none"
          stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
        />
      </Svg>
      <View style={styles.scoreRingInner}>
        <Text style={[styles.scoreRingText, { color }]}>{avg}</Text>
        <Text style={[styles.scoreRingLabel, { color: colors.textSecondary }]}>Overall</Text>
      </View>
    </View>
  );
}

/* ─── Hours-since label ─────────────────────────────────────── */
function LastWorkoutBanner({ lastTime, onReset }: any) {
  const { colors } = useTheme();
  if (!lastTime) {
    return (
      <View style={[styles.lastWorkoutBanner, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.bannerText, { color: colors.textSecondary }]}>No workout logged yet</Text>
        <TouchableOpacity onPress={onReset}>
          <Text style={[styles.bannerBtnText, { color: "#0A84FF" }]}>Log now</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const hours = (Date.now() - lastTime.getTime()) / 3_600_000;
  const hLabel = hours >= 24
    ? `${Math.round(hours / 24)}d ${Math.round(hours % 24)}h`
    : `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;

  return (
    <View style={[styles.lastWorkoutBanner, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={[styles.bannerText, { color: colors.textSecondary }]}>
        Last workout <Text style={{ color: colors.textPrimary }}>{hLabel} ago</Text>
      </Text>
      <TouchableOpacity onPress={onReset}>
        <Text style={[styles.bannerBtnText, { color: "#FF9F0A" }]}>Reset</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function RecoveryPage() {
  const router = useRouter();
  const [lastTime, setLastTimeState] = useState<Date | null>(null);
  const [manualOverrides, setManualOverrides] = useState<any>({});
  const [muscleData, setMuscleData] = useState<any>({});
  const [view, setView] = useState("front");
  const { colors, isLight } = useTheme();

  const { workouts: data, loading } = useData() as any;

  const updateHeatmap = useCallback(() => {
    try {
      if (!data) return;

      const overrides = getMuscleSoreness();
      setManualOverrides(overrides);

      let latestTime = 0;
      data.forEach((w: any) => {
        const wTime = parseLocalISO(w.created_at);
        if (wTime > latestTime) latestTime = wTime;
      });
      setLastTimeState(latestTime > 0 ? new Date(latestTime) : null);

      const dynData = computeDynamicRecovery(ALL_MUSCLES, data, overrides);
      setMuscleData(dynData);
    } catch (e) {
      console.error("Failed to compute heatmap data", e);
    }
  }, [data]);

  useEffect(() => { updateHeatmap(); }, [updateHeatmap]);

  const handleSelect = (muscle: string, level: string) => {
    setMuscleSoreness(muscle, level);
    updateHeatmap();
  };

  const handleClear = (muscle: string) => {
    setMuscleSoreness(muscle, null);
    updateHeatmap();
  };

  const handleReset = () => {
    router.push("/workout" as any);
  };

  const sortedMuscles = [...ALL_MUSCLES].sort(
    (a, b) => (muscleData[a]?.pct ?? 0) - (muscleData[b]?.pct ?? 0)
  );

  return (
    <PageShell title="Recovery" subtitle="Muscle Readiness · Today" onSettingsClick={() => router.push("/settings" as any)}>
      {loading.workouts ? (
        <View style={[styles.card, { height: 40, marginBottom: 14, backgroundColor: colors.bgCard, borderColor: colors.border }]} />
      ) : (
        <LastWorkoutBanner lastTime={lastTime} onReset={handleReset} />
      )}

      {loading.workouts ? (
        <View style={[styles.card, { height: 450, padding: 20, marginBottom: 12, backgroundColor: colors.bgCard, borderColor: colors.border }]} />
      ) : (
        <View style={[styles.card, { padding: 20, marginBottom: 12, backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.heroHeaderRow}>
            <View>
              <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Muscle Readiness</Text>
              <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>Tap a muscle row to set soreness</Text>
              <View style={[styles.viewToggleGroup, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)" }]}>
                <TouchableOpacity onPress={() => setView("front")} style={[styles.viewToggleBtn, view === "front" && { backgroundColor: "#0A84FF" }]}>
                  <Text style={{ color: view === "front" ? "#fff" : colors.textPrimary, fontSize: 12, fontWeight: "600" }}>Front</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setView("back")} style={[styles.viewToggleBtn, view === "back" && { backgroundColor: "#0A84FF" }]}>
                  <Text style={{ color: view === "back" ? "#fff" : colors.textPrimary, fontSize: 12, fontWeight: "600" }}>Back</Text>
                </TouchableOpacity>
              </View>
            </View>
            <OverallScore muscleData={muscleData} />
          </View>

          <View style={{ alignItems: "center", marginBottom: 32, height: 400 }}>
            <MuscleMap muscleData={muscleData} view={view} />
          </View>

          <View style={styles.legendRow}>
            <LegendDot color="#30D158" label="Fresh" />
            <LegendDot color="#FF9F0A" label="Recovering" />
            <LegendDot color="#FF2D55" label="Taxed" />
          </View>
        </View>
      )}

      <View style={[styles.card, styles.aiCard, { backgroundColor: isLight ? "rgba(10,132,255,0.08)" : "rgba(10,132,255,0.05)", borderColor: "rgba(10,132,255,0.2)" }]}>
        <View style={styles.aiCardHeaderRow}>
          <View style={styles.aiIcon}>
            <Svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <Path d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 2v4l3 1.5" stroke="#0A84FF" strokeWidth="1.5" strokeLinecap="round" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTitle}>APEX Recommendation</Text>
            <Text style={[styles.aiBody, { color: colors.textSecondary }]}>
              Recovery is calculated from time since your last workout. Tap any muscle row to manually override the soreness level if you feel differently.
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Breakdown</Text>

      <View style={styles.muscleRowsContainer}>
        {loading.workouts ? (
          Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={[styles.card, { height: 64, borderRadius: 16, backgroundColor: colors.bgCard, borderColor: colors.border }]} />
          ))
        ) : (
          sortedMuscles.map((name, i) => (
            <MuscleRow
              key={name}
              name={name}
              data={muscleData[name] ?? { status: "fresh", pct: 0, isManual: false, hours: 0 }}
              manualLevel={manualOverrides[name] ?? null}
              onSelect={handleSelect}
              onClear={handleClear}
            />
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
  lastWorkoutBanner: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  bannerText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  bannerBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
  heroHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 12,
  },
  viewToggleGroup: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    padding: 4,
    alignSelf: "flex-start",
  },
  viewToggleBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  scoreRingContainer: {
    alignItems: "center",
    position: "relative",
    width: 100,
    height: 100,
  },
  scoreRingInner: {
    position: "absolute",
    top: 0, bottom: 0, left: 0, right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreRingText: {
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 28,
  },
  scoreRingLabel: {
    fontSize: 9,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
  },
  aiCard: {
    padding: 16,
    marginBottom: 20,
    borderColor: "rgba(10,132,255,0.2)",
    backgroundColor: "rgba(10,132,255,0.05)",
  },
  aiCardHeaderRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  aiIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(10,132,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  aiTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0A84FF",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  aiBody: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 12,
  },
  muscleRowsContainer: {
    gap: 8,
    paddingBottom: 30,
  },
  muscleRowContainer: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
  },
  muscleRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  muscleRowTitleCol: {
    flex: 1,
    gap: 2,
  },
  muscleName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
    textTransform: "capitalize",
  },
  muscleTime: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
  },
  muscleRowRightCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pctText: {
    fontSize: 14,
    fontWeight: "800",
  },
  barTrack: {
    height: 5,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 3,
    marginTop: 10,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  sorenessPickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  overrideLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sorenessBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  sorenessBtnText: {
    fontSize: 8,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
