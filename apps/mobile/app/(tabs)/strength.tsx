import React, { useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import PageShell from "@/components/PageShell";
import { useSettings, useData } from "@apex/core";
import { computeDynamicRecovery, getMuscleSoreness } from "@apex/core/src/recovery";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../hooks/useTheme";

/* --- Lift config --------------------------------------------- */
const LIFTS = [
  { key: "bench",    label: "Bench Press", color: "#0A84FF", unit: "lbs" },
  { key: "squat",    label: "Back Squat",  color: "#FF2D55", unit: "lbs" },
  { key: "deadlift", label: "Deadlift",    color: "#FFD60A", unit: "lbs" },
];

/* --- Overall Score Ring -------------------------------------- */
function OverallRing({ score, bw, age, index }: any) {
  const { colors } = useTheme();
  const r = 72;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);

  const grade = score >= 90 ? "Elite" : score >= 75 ? "Advanced" : score >= 60 ? "Intermediate" : "Novice";
  const gradeColor = score >= 90 ? "#FFD60A" : score >= 75 ? "#FF3B30" : score >= 60 ? "#0A84FF" : "#30D158";
  const percentile = score >= 90 ? "2%" : score >= 75 ? "8%" : score >= 60 ? "15%" : "45%";

  return (
    <View style={[styles.card, { padding: 28, alignItems: "center", marginBottom: 12, backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.ringContainer}>
        <View style={[styles.ringGlow, { backgroundColor: `${gradeColor}22` }]} />
        <Svg width="164" height="164" viewBox="0 0 164 164" style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx="82" cy="82" r={r} fill="none" stroke={colors.border} strokeWidth="10" />
          {[...Array(24)].map((_, i) => {
            const angle = (i / 24) * 360;
            const rad = (angle * Math.PI) / 180;
            const x1 = 82 + (r - 6) * Math.cos(rad);
            const y1 = 82 + (r - 6) * Math.sin(rad);
            const x2 = 82 + (r + 6) * Math.cos(rad);
            const y2 = 82 + (r + 6) * Math.sin(rad);
            return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.border} strokeWidth="1.5" />;
          })}
          <Circle
            cx="82" cy="82" r={r} fill="none"
            stroke={gradeColor} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
          />
        </Svg>
        <View style={styles.ringCenterText}>
          <Text style={[styles.ringScoreText, { color: gradeColor }]}>{score}</Text>
          <Text style={[styles.ringScoreLabel, { color: colors.textSecondary }]}>Score</Text>
        </View>
      </View>

      <Text style={[styles.gradeText, { color: gradeColor }]}>{grade}</Text>
      <Text style={[styles.percentileText, { color: colors.textSecondary }]}>Top {percentile} of athletes your level</Text>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.quickStatsRow}>
        {[
          { label: "Strength Index", val: `${index || "0.0"}×`, color: "#0A84FF" },
          { label: "Body Weight", val: bw ? `${Math.round(bw)} lbs` : "0 lbs", color: colors.textPrimary },
          { label: "Training Age", val: age ? `${age} yrs` : "0 yrs", color: "#FF9F0A" },
        ].map(({ label, val, color }) => (
          <View key={label} style={{ alignItems: "center" }}>
            <Text style={[styles.quickStatVal, { color }]}>{val}</Text>
            <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* --- Biomechanical Classifier Parameters --------------------- */
const MALE_REF_WT = 80.0;
const MALE_REF_HT = 178.0;
const FEMALE_REF_WT = 60.0;
const FEMALE_REF_HT = 163.0;

const MULTIPLIERS = {
  male: {
    squat:    { novice: 1.15, intermediate: 1.50, advanced: 2.00, elite: 2.40 },
    bench:    { novice: 0.85, intermediate: 1.15, advanced: 1.40, elite: 1.75 },
    deadlift: { novice: 1.30, intermediate: 1.75, advanced: 2.25, elite: 2.75 }
  },
  female: {
    squat:    { novice: 0.75, intermediate: 1.10, advanced: 1.50, elite: 1.85 },
    bench:    { novice: 0.50, intermediate: 0.75, advanced: 1.00, elite: 1.25 },
    deadlift: { novice: 0.90, intermediate: 1.30, advanced: 1.75, elite: 2.15 }
  }
};

function parseHeightToCm(heightStr: string | null | undefined): number {
  if (!heightStr) return 178;
  const clean = heightStr.trim().toLowerCase();
  if (clean.endsWith("cm")) {
    return parseFloat(clean) || 178;
  }
  const match = clean.match(/^(\d+)'(\d+)"?$/);
  if (match) {
    const feet = parseInt(match[1]) || 0;
    const inches = parseInt(match[2]) || 0;
    return feet * 30.48 + inches * 2.54;
  }
  const justNum = parseFloat(clean);
  if (!isNaN(justNum)) {
    if (justNum > 100) return justNum;
    return justNum * 30.48;
  }
  return 178;
}

function calculateStrengthTier(gender: string, weight_kg: number, height_cm: number, lift_type: "bench" | "squat" | "deadlift", actual_lift_kg: number) {
  const isFemale = String(gender).toLowerCase() === "female";
  const refWt = isFemale ? FEMALE_REF_WT : MALE_REF_WT;
  const refHt = isFemale ? FEMALE_REF_HT : MALE_REF_HT;
  
  const sAllometric = refWt * Math.pow(Math.max(1, weight_kg) / refWt, 2/3);
  const cRaw = 1.0 - 0.012 * (height_cm - refHt);
  const cLeverage = Math.min(Math.max(cRaw, 0.80), 1.20);
  
  const mults = isFemale ? MULTIPLIERS.female[lift_type] : MULTIPLIERS.male[lift_type];
  if (!mults) return { grade: "Novice", pct: 0, targetKg: 0 };
  
  const tNovice = mults.novice * sAllometric * cLeverage;
  const tIntermediate = mults.intermediate * sAllometric * cLeverage;
  const tAdvanced = mults.advanced * sAllometric * cLeverage;
  const tElite = mults.elite * sAllometric * cLeverage;
  
  let grade = "Novice";
  let gradeColor = "#30D158";
  let pct = 0;
  let targetKg = tNovice;
  
  if (actual_lift_kg < tNovice) {
    grade = "Novice";
    gradeColor = "#30D158";
    pct = (actual_lift_kg / tNovice) * 25;
    targetKg = tNovice;
  } else if (actual_lift_kg < tIntermediate) {
    grade = "Novice";
    gradeColor = "#30D158";
    pct = 25 + ((actual_lift_kg - tNovice) / (tIntermediate - tNovice)) * 25;
    targetKg = tIntermediate;
  } else if (actual_lift_kg < tAdvanced) {
    grade = "Intermediate";
    gradeColor = "#0A84FF";
    pct = 50 + ((actual_lift_kg - tIntermediate) / (tAdvanced - tIntermediate)) * 25;
    targetKg = tAdvanced;
  } else if (actual_lift_kg < tElite) {
    grade = "Advanced";
    gradeColor = "#FF3B30";
    pct = 75 + ((actual_lift_kg - tAdvanced) / (tElite - tAdvanced)) * 25;
    targetKg = tElite;
  } else {
    grade = "Elite";
    gradeColor = "#FFD60A";
    pct = 100;
    targetKg = tElite;
  }
  
  return {
    grade,
    gradeColor,
    pct: Math.round(Math.min(100, Math.max(0, pct))),
    targetKg
  };
}

/* --- Lift Card (BW Multiplier) ------------------------------- */
function LiftCard({ liftName, weight, bw, gender, height, unit }: any) {
  const { colors } = useTheme();
  const multiplier = bw > 0 ? (weight / bw) : 0;
  
  const bwKg = unit === "kg" ? bw : bw / 2.20462262;
  const actualLiftKg = unit === "kg" ? weight : weight / 2.20462262;
  const heightCm = parseHeightToCm(height);
  
  const { grade, gradeColor, pct, targetKg } = calculateStrengthTier(
    gender || "male",
    bwKg,
    heightCm,
    liftName,
    actualLiftKg
  );
  
  const displayTarget = unit === "kg" ? Math.round(targetKg) : Math.round(targetKg * 2.20462262);

  return (
    <View style={[styles.card, { padding: 16, marginBottom: 12, borderTopWidth: 2, borderTopColor: `${gradeColor}40`, backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
        <View>
          <Text style={[styles.liftNameLabel, { color: colors.textSecondary }]}>{liftName}</Text>
          <Text style={[styles.liftWeightText, { color: colors.textPrimary }]}>
            {weight} <Text style={[styles.liftWeightUnit, { color: colors.textTertiary }]}>{unit}</Text>
          </Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          {grade !== "Elite" && targetKg > 0 && (
            <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 2 }}>
              Next Tier Target: {displayTarget} {unit}
            </Text>
          )}
          <Text style={[styles.liftMultiplierText, { color: gradeColor }]}>{multiplier.toFixed(2)}x BW</Text>
          <Text style={[styles.liftGradeLabel, { color: colors.textSecondary }]}>{grade}</Text>
        </View>
      </View>

      <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: gradeColor }]} />
      </View>
    </View>
  );
}

/* --- Strength Bar Row ---------------------------------------- */
function StrengthRow({ item }: any) {
  const { colors } = useTheme();
  const gain = item.score - item.prev;

  return (
    <View style={[styles.strengthRowContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={[styles.colorDot, { backgroundColor: item.color, shadowColor: item.color }]} />
      <Text style={[styles.strengthMuscleText, { color: colors.textSecondary }]}>{item.muscle}</Text>
      
      <View style={{ flex: 1 }}>
        <View style={[styles.barTrack, { height: 7, backgroundColor: colors.border }]}>
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

/* --- Log PR Card Component ----------------------------------- */
function LogPRCard({ refresh, unit }: { refresh: (key: string) => void; unit: string }) {
  const { colors, isLight } = useTheme();
  const { token } = useData() as any;
  const [exercise, setExercise] = useState("bench");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("1");
  const [rir, setRir] = useState("0");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!weight || isNaN(parseFloat(weight))) {
      Alert.alert("Error", "Please enter a valid weight");
      return;
    }
    if (!reps || isNaN(parseInt(reps))) {
      Alert.alert("Error", "Please enter valid reps");
      return;
    }

    setIsSaving(true);
    try {
      const parsedWeight = parseFloat(weight);
      const dbWeight = unit === "kg" ? Math.round(parsedWeight * 2.205) : parsedWeight;
      
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/prs`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          exerciseName: exercise,
          weight: dbWeight
        })
      });

      if (!res.ok) {
        throw new Error("Failed to save PR");
      }

      Alert.alert(
        "Success", 
        `Logged PR: ${LIFTS.find(l => l.key === exercise)?.label || exercise} - ${weight} ${unit}!`
      );
      setWeight("");
      setReps("1");
      setRir("0");
      refresh("prs");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to save PR");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.card, { borderTopWidth: 3, borderTopColor: "rgba(48, 209, 88, 0.4)", backgroundColor: colors.bgCard, borderColor: colors.border, padding: 16, marginBottom: 12 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(48, 209, 88, 0.15)", alignItems: "center", justifyContent: "center" }}>
          <Svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <Path d="M7 2v10M2 7h10" stroke="#30D158" strokeWidth="2" strokeLinecap="round" />
          </Svg>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textPrimary, textTransform: "uppercase", letterSpacing: 1 }}>
            Log New PR
          </Text>
          <Text style={{ fontSize: 11, color: colors.textTertiary }}>
            Record strength milestones
          </Text>
        </View>
      </View>

      {/* Row 1: Exercise Selection Chips */}
      <View style={{ marginBottom: 12 }}>
        <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Exercise</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {LIFTS.map((l) => {
            const isSelected = exercise === l.key;
            return (
              <TouchableOpacity
                key={l.key}
                onPress={() => setExercise(l.key)}
                style={[
                  styles.exerciseChip,
                  {
                    flex: 1,
                    backgroundColor: isSelected ? `${l.color}20` : (isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)"),
                    borderColor: isSelected ? l.color : colors.border,
                  }
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: isSelected ? l.color : colors.textSecondary, textAlign: "center" }}>
                  {l.label.split(" ")[0]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Row 2: Weight & Reps */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Weight ({unit})</Text>
          <TextInput
            keyboardType="numeric"
            placeholder="e.g. 225"
            placeholderTextColor={colors.textTertiary}
            value={weight}
            onChangeText={setWeight}
            style={[
              styles.textInput,
              {
                backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)",
                borderColor: colors.border,
                color: colors.textPrimary,
              }
            ]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Reps</Text>
          <TextInput
            keyboardType="numeric"
            placeholder="e.g. 1"
            placeholderTextColor={colors.textTertiary}
            value={reps}
            onChangeText={setReps}
            style={[
              styles.textInput,
              {
                backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)",
                borderColor: colors.border,
                color: colors.textPrimary,
              }
            ]}
          />
        </View>
      </View>

      {/* Row 3: RIR & Submit */}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>RIR (Buffer)</Text>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {[0, 1, 2, 3, 4].map((r) => {
              const isSelected = rir === String(r);
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRir(String(r))}
                  style={[
                    styles.rirChip,
                    {
                      flex: 1,
                      backgroundColor: isSelected ? "rgba(10,132,255,0.15)" : (isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)"),
                      borderColor: isSelected ? colors.accentBlue : colors.border,
                    }
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: isSelected ? colors.accentBlue : colors.textSecondary, textAlign: "center" }}>
                    {r}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSaving}
          style={[
            styles.submitBtn,
            {
              backgroundColor: "#30D158",
              opacity: isSaving ? 0.7 : 1,
            }
          ]}
        >
          <Text style={{ color: "#000", fontWeight: "800", fontSize: 13, textAlign: "center" }}>
            {isSaving ? "Saving..." : "Save PR"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* --- Personal Record Card ------------------------------------ */
function PRCard({ prData }: any) {
  const { colors } = useTheme();
  if (!prData) return null;
  return (
    <View style={[styles.card, { paddingVertical: 16, paddingHorizontal: 20, marginBottom: 12, backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Personal Records</Text>
      <View style={styles.prGrid}>
        {Object.entries(prData).map(([lift, data]: any) => (
          <View key={lift} style={{ flex: 1 }}>
            <Text style={[styles.prLiftLabel, { color: colors.textSecondary }]}>{lift}</Text>
            <Text style={[styles.prWeightText, { color: colors.textPrimary }]}>
              {data.weight}<Text style={[styles.prWeightUnit, { color: colors.textTertiary }]}> {data.unit}</Text>
            </Text>
            <Text style={styles.prGainText}>{data.gain} lbs</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* --- Page ---------------------------------------------------- */
export function StrengthContent() {
  const router = useRouter();
  const ctx = useSettings() as any;
  const unit = ctx?.weightUnit || "lbs";
  const [metrics, setMetrics] = useState({ weight: 0, trainingYears: 0, gender: "male", height: "Not Selected" });
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

  const { workouts, prs: prData, metrics: metData, loading, refresh, token } = useData() as any;

  useEffect(() => {
      try {
        let bw = 1;
        if (metData && metData.length > 0) {
            const latest = metData[metData.length - 1];
            const rawBw = parseFloat(latest.weight) || 1;
            bw = unit === "kg" ? Math.round(rawBw / 2.205) : rawBw;
            
            const firstMetric = metData[0];
            let trainingYears = parseFloat(firstMetric.training_years) || 0;
            if (firstMetric.logged_at) {
                const startDate = new Date(firstMetric.logged_at);
                const now = new Date();
                const diffYears = now.getFullYear() - startDate.getFullYear();
                const diffMonths = now.getMonth() - startDate.getMonth();
                let monthsElapsed = diffYears * 12 + diffMonths;
                if (now.getDate() < startDate.getDate()) {
                    monthsElapsed--;
                }
                trainingYears = Math.max(0, trainingYears + (Math.max(0, monthsElapsed) / 12));
            }
            setMetrics({ 
                weight: bw, 
                trainingYears: parseFloat(trainingYears.toFixed(1)),
                gender: latest.gender || "male",
                height: latest.height || "Not Selected"
            });
        }
        
        if (prData) {
            const liftHistory: any = { bench: [], squat: [], deadlift: [] };
            const rawMaxes: any = { bench: 0, squat: 0, deadlift: 0, rows: 0 };
            
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

            const latest = (metData && metData.length > 0) ? metData[metData.length - 1] : { gender: "male", height: "178cm" };
            const isFemale = String(latest.gender || "male").toLowerCase() === "female";
            const refWt = isFemale ? FEMALE_REF_WT : MALE_REF_WT;
            const refHt = isFemale ? FEMALE_REF_HT : MALE_REF_HT;
            
            const bwKg = unit === "kg" ? bw : bw / 2.20462262;
            const heightCm = parseHeightToCm(latest.height);
            
            const sAllometric = refWt * Math.pow(Math.max(1, bwKg) / refWt, 2/3);
            const cRaw = 1.0 - 0.012 * (heightCm - refHt);
            const cLeverage = Math.min(Math.max(cRaw, 0.80), 1.20);
            
            const mults = isFemale ? MULTIPLIERS.female : MULTIPLIERS.male;
            
            const tEliteBench = mults.bench.elite * sAllometric * cLeverage;
            const tEliteSquat = mults.squat.elite * sAllometric * cLeverage;
            const tEliteDeadlift = mults.deadlift.elite * sAllometric * cLeverage;
            
            const tEliteBenchUnit = unit === "kg" ? tEliteBench : tEliteBench * 2.20462262;
            const tEliteSquatUnit = unit === "kg" ? tEliteSquat : tEliteSquat * 2.20462262;
            const tEliteDeadliftUnit = unit === "kg" ? tEliteDeadlift : tEliteDeadlift * 2.20462262;
            
            const tEliteRowsUnit = tEliteBenchUnit * 0.8;
            
            const calcScore = (cur: number, target: number) => target > 0 ? Math.min(100, Math.round((cur / target) * 100)) : 0;

            const scores = [
                { muscle: "Chest",     score: calcScore(rawMaxes.bench, tEliteBenchUnit), color: "#0A84FF", prev: 0 },
                { muscle: "Back",      score: calcScore(rawMaxes.deadlift, tEliteDeadliftUnit), color: "#BF5AF2", prev: 0 },
                { muscle: "Shoulders", score: Math.round(calcScore(rawMaxes.bench, tEliteBenchUnit) * 0.75), color: "#FF9F0A", prev: 0 },
                { muscle: "Legs",      score: calcScore(rawMaxes.squat, tEliteSquatUnit), color: "#FFD60A", prev: 0 },
                { 
                  muscle: "Arms",      
                  score: Math.round((calcScore(rawMaxes.bench, tEliteBenchUnit) * 0.5) + (calcScore(rawMaxes.rows, tEliteRowsUnit) * 0.5)), 
                  color: "#30D158", prev: 0 
                },
                { 
                  muscle: "Core",      
                  score: Math.max(0, calcScore(rawMaxes.squat, tEliteSquatUnit) - 15), 
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
    const bw = metrics.weight || 1;
    const bMultiplier = prs.bench.weight / bw;
    const sMultiplier = prs.squat.weight / bw;
    const dMultiplier = prs.deadlift.weight / bw;
    const rawIndex = (bMultiplier + sMultiplier + dMultiplier) / 3;
    const indexStr = rawIndex.toFixed(1);

    const isFemale = String(metrics.gender).toLowerCase() === "female";
    const refWt = isFemale ? FEMALE_REF_WT : MALE_REF_WT;
    const refHt = isFemale ? FEMALE_REF_HT : MALE_REF_HT;
    
    const bwKg = unit === "kg" ? bw : bw / 2.20462262;
    const heightCm = parseHeightToCm(metrics.height);
    
    const sAllometric = refWt * Math.pow(Math.max(1, bwKg) / refWt, 2/3);
    const cRaw = 1.0 - 0.012 * (heightCm - refHt);
    const cLeverage = Math.min(Math.max(cRaw, 0.80), 1.20);
    
    const getProgress = (liftKey: "bench" | "squat" | "deadlift", weightVal: number) => {
      if (bw <= 0 || weightVal <= 0) return 0;
      const actualLiftKg = unit === "kg" ? weightVal : weightVal / 2.20462262;
      const mults = isFemale ? MULTIPLIERS.female[liftKey] : MULTIPLIERS.male[liftKey];
      
      const tNovice = mults.novice * sAllometric * cLeverage;
      const tIntermediate = mults.intermediate * sAllometric * cLeverage;
      const tAdvanced = mults.advanced * sAllometric * cLeverage;
      const tElite = mults.elite * sAllometric * cLeverage;
      
      if (actualLiftKg < tNovice) {
        return (actualLiftKg / tNovice) * 25;
      } else if (actualLiftKg < tIntermediate) {
        return 25 + ((actualLiftKg - tNovice) / (tIntermediate - tNovice)) * 25;
      } else if (actualLiftKg < tAdvanced) {
        return 50 + ((actualLiftKg - tIntermediate) / (tAdvanced - tIntermediate)) * 25;
      } else if (actualLiftKg < tElite) {
        return 75 + ((actualLiftKg - tAdvanced) / (tElite - tAdvanced)) * 25;
      } else {
        return 100;
      }
    };
    
    const benchProgress = getProgress("bench", prs.bench.weight);
    const squatProgress = getProgress("squat", prs.squat.weight);
    const deadliftProgress = getProgress("deadlift", prs.deadlift.weight);
    
    const score = Math.round((benchProgress + squatProgress + deadliftProgress) / 3);
    
    return { strengthIndex: indexStr, derivedOverall: score };
  }, [metrics, prs, unit]);

  const { colors } = useTheme();

  return (
    <View>
      {loading.prs || loading.metrics ? (
        <View style={[styles.card, { height: 420, marginBottom: 12, backgroundColor: colors.bgCard, borderColor: colors.border }]} />
      ) : (
        <OverallRing score={derivedOverall} bw={metrics.weight} age={metrics.trainingYears} index={strengthIndex} />
      )}

      <Text style={[styles.sectionLabel, { marginTop: 16, color: colors.textSecondary }]}>Big Lifts vs Bodyweight</Text>

      {loading.prs || loading.metrics ? (
        Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={[styles.card, { height: 92, marginBottom: 12, backgroundColor: colors.bgCard, borderColor: colors.border }]} />
        ))
      ) : (
        <View>
          <LiftCard liftName="bench" weight={prs.bench.weight} bw={metrics.weight} gender={metrics.gender} height={metrics.height} unit={unit} />
          <LiftCard liftName="squat" weight={prs.squat.weight} bw={metrics.weight} gender={metrics.gender} height={metrics.height} unit={unit} />
          <LiftCard liftName="deadlift" weight={prs.deadlift.weight} bw={metrics.weight} gender={metrics.gender} height={metrics.height} unit={unit} />
        </View>
      )}

      <View style={{ marginTop: 12 }}>
        {loading.prs ? (
          <View style={[styles.card, { height: 130, marginBottom: 12, backgroundColor: colors.bgCard, borderColor: colors.border }]} />
        ) : (
          <PRCard prData={prs} />
        )}
      </View>

      <LogPRCard refresh={refresh} unit={unit} />

      <Text style={[styles.sectionLabel, { marginTop: 16, color: colors.textSecondary }]}>Strength by Muscle Group</Text>

      <View style={styles.muscleGroupContainer}>
        {loading.prs || loading.metrics ? (
          Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={[styles.card, { height: 50, backgroundColor: colors.bgCard, borderColor: colors.border }]} />
          ))
        ) : (
          dynamicScores.map((item) => (
            <StrengthRow key={item.muscle} item={item} />
          ))
        )}
      </View>
    </View>
  );
}

export default function StrengthPage() {
  const router = useRouter();
  return (
    <PageShell title="Strength" subtitle="Analytics · Big Lifts & Recovery" onSettingsClick={() => router.push("/settings" as any)}>
      <StrengthContent />
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
    letterSpacing: 0.8,
    marginBottom: 4,
    fontWeight: "700",
  },
});
