import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Modal, Alert, Keyboard } from "react-native";
import { useRouter } from "expo-router";
import PageShell from "@/components/PageShell";
import { useSettings, useData, getStorage } from "@apex/core";
import { useTheme } from "../../hooks/useTheme";
import { setLastWorkoutTime } from "@apex/core/src/recovery";
import Svg, { Path, Polyline, Line } from "react-native-svg";

function fmt(secs: number) {
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function totalVolume(exercises: any[], completed: any) {
  let vol = 0;
  exercises.forEach((ex, ei) =>
    ex.sets.forEach((set: any, si: number) => {
      if (completed[`${ei}-${si}`]) vol += set.reps * set.weight;
    })
  );
  return vol;
}

function completedCount(exercises: any[], completed: any) {
  let done = 0, total = 0;
  exercises.forEach((ex, ei) =>
    ex.sets.forEach((_: any, si: number) => { total++; if (completed[`${ei}-${si}`]) done++; })
  );
  return { done, total };
}

/* ─── ExerciseSearch ────────────────────────────────────────── */
function ExerciseSearch({ onAdd }: any) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEx, setSelectedEx] = useState<any>(null);
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState("Chest");
  const { colors, isLight } = useTheme();
  const { token } = useData() as any;

  const MUSCLE_OPTIONS = [
    "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Abs",
    "Quadriceps", "Hamstrings", "Glutes", "Calves", "Forearms", "Traps", "Full Body"
  ];

  useEffect(() => {
    if (query.trim() === "" || (selectedEx && query === selectedEx.name) || isCreatingCustom) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/exercises/search?name=${encodeURIComponent(query)}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = res.ok ? await res.json() : [];
        setResults(data);
      } catch { setResults([]); }
      finally { setIsLoading(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [query, selectedEx, isCreatingCustom]);

  const saveCustomExercise = async () => {
    if (!customName.trim()) return;
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/exercises`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name: customName.trim(), muscle: selectedMuscle })
      });
      const newEx = res.ok ? await res.json() : { id: Date.now(), name: customName.trim(), muscle: selectedMuscle, muscle_group: selectedMuscle };
      onAdd({ ...newEx, muscle: selectedMuscle, muscle_group: selectedMuscle });
      setQuery("");
      setSelectedEx(null);
      setIsCreatingCustom(false);
    } catch {
      const fallbackEx = { id: Date.now(), name: customName.trim(), muscle: selectedMuscle, muscle_group: selectedMuscle };
      onAdd(fallbackEx);
      setQuery("");
      setSelectedEx(null);
      setIsCreatingCustom(false);
    }
  };

  if (isCreatingCustom) {
    return (
      <View style={{ gap: 12, marginBottom: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textPrimary }}>Creating Custom Exercise: "{customName}"</Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary }}>Select Target Muscle Group:</Text>
        <ScrollView style={{ maxHeight: 150, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)" }}>
          {MUSCLE_OPTIONS.map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setSelectedMuscle(m)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: selectedMuscle === m ? (isLight ? "rgba(48,209,88,0.15)" : "rgba(48,209,88,0.2)") : "transparent"
              }}
            >
              <Text style={{ color: selectedMuscle === m ? "#30D158" : colors.textPrimary, fontWeight: selectedMuscle === m ? "700" : "400" }}>{m}</Text>
              {selectedMuscle === m && <Text style={{ color: "#30D158", fontWeight: "800" }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <TouchableOpacity onPress={() => setIsCreatingCustom(false)} style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={saveCustomExercise} style={{ paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, backgroundColor: "#30D158" }}>
            <Text style={{ color: "#000", fontWeight: "700" }}>Save & Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ zIndex: 50, marginBottom: 10 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1, position: "relative" }}>
          <TextInput
            value={query}
            onChangeText={(t) => { setQuery(t); setSelectedEx(null); }}
            placeholder="Type to search exercises..."
            placeholderTextColor={colors.textSecondary}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            style={[styles.searchInput, { backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", borderColor: colors.border, color: colors.textPrimary }]}
          />
          {query.trim() !== "" && !selectedEx && results.length > 0 && (
            <View style={[styles.searchResults, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {results.map((ex: any) => (
                  <TouchableOpacity
                    key={ex.id}
                    onPress={() => {
                      setSelectedEx(ex);
                      setQuery(ex.name);
                    }}
                    style={[styles.searchResultItem, { borderBottomColor: colors.border }]}
                  >
                    <Text style={[styles.searchResultName, { color: colors.textPrimary }]}>{ex.name}</Text>
                    <Text style={[styles.searchResultMuscle, { color: colors.textSecondary }]}>{ex.muscle_group || ex.muscle}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {query.trim() !== "" && !selectedEx && !isLoading && results.length === 0 && (
            <View style={[styles.searchResults, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => {
                  setCustomName(query.trim());
                  setIsCreatingCustom(true);
                }}
                style={[styles.searchResultItem, { paddingVertical: 14 }]}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#30D158" }}>+ Create custom exercise "{query.trim()}"</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={() => {
            if (selectedEx) {
              onAdd(selectedEx);
              setQuery("");
              setSelectedEx(null);
            }
          }}
          disabled={!selectedEx}
          style={[styles.addBtn, { backgroundColor: selectedEx ? "#30D158" : colors.border }]}
        >
          <Text style={[styles.addBtnText, { color: selectedEx ? "#000" : colors.textTertiary }]}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─── ClearOnFocusInput ─────────────────────────────────────── */
function ClearOnFocusInput({ numericValue, onChangeText, placeholder, ...rest }: any) {
  const [isFocused, setIsFocused] = useState(false);
  const [editText, setEditText] = useState('');
  const savedValue = useRef(numericValue);

  const displayValue = isFocused ? editText : (numericValue === 0 ? '' : String(numericValue));

  return (
    <TextInput
      {...rest}
      keyboardType="numeric"
      returnKeyType="done"
      onSubmitEditing={Keyboard.dismiss}
      value={displayValue}
      placeholder={isFocused ? '' : placeholder}
      onFocus={() => {
        savedValue.current = numericValue;
        setEditText('');
        setIsFocused(true);
      }}
      onBlur={() => {
        if (editText === '') {
          onChangeText(String(savedValue.current));
        }
        setIsFocused(false);
      }}
      onChangeText={(t: string) => {
        setEditText(t);
        onChangeText(t);
      }}
    />
  );
}

/* ─── SetRow ────────────────────────────────────────────────── */
function SetRow({ exIdx, setIdx, set, isDone, onToggle, onUpdateSet, onRemoveSet, prevSet }: any) {
  const ctx = useSettings() as any;
  const unit = ctx?.weightUnit || "lbs";
  const { colors, isLight } = useTheme();

  return (
    <View style={styles.setRowContainer}>
      <View
        style={[
          styles.setRowInner,
          {
            backgroundColor: isDone ? "rgba(48,209,88,0.12)" : (isLight ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.03)"),
            borderColor: isDone ? "rgba(48,209,88,0.3)" : colors.border,
          }
        ]}
      >
        <Text style={[styles.setRowIndex, { color: colors.textSecondary }]}>S{setIdx + 1}</Text>

        <View style={[styles.prevSetCol, { borderRightColor: colors.border }]}>
          {prevSet ? (
            <>
              <Text style={[styles.prevSetWeight, { color: colors.textTertiary }]}>{Math.round(prevSet.weight)}<Text style={{ fontSize: 9, fontWeight: "500" }}>{unit}</Text> x {prevSet.reps}</Text>
              {prevSet.rir != null && prevSet.rir !== undefined && prevSet.rir > 0 && <Text style={[styles.prevSetReps, { color: colors.textTertiary }]}>{prevSet.rir}rir</Text>}
            </>
          ) : (
            <Text style={{ fontSize: 10, color: colors.textTertiary }}>—</Text>
          )}
        </View>

        <View style={styles.setInputsRow}>
          <View style={styles.inputGroup}>
            <ClearOnFocusInput
              numericValue={set.weight}
              onChangeText={(t: string) => onUpdateSet(exIdx, setIdx, "weight", t)}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              editable={!isDone}
              style={[styles.setNumInput, { color: isDone ? "#30D158" : colors.textPrimary, backgroundColor: isDone ? "transparent" : (isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.06)"), borderColor: isDone ? "transparent" : colors.border }]}
            />
            <Text style={[styles.inputUnit, { color: colors.textSecondary }]}>{unit}</Text>
          </View>

          <View style={styles.inputGroup}>
            <ClearOnFocusInput
              numericValue={set.reps}
              onChangeText={(t: string) => onUpdateSet(exIdx, setIdx, "reps", t)}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              editable={!isDone}
              style={[styles.setNumInput, { color: isDone ? colors.textSecondary : colors.textPrimary, backgroundColor: isDone ? "transparent" : (isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.06)"), borderColor: isDone ? "transparent" : colors.border }]}
            />
            <Text style={[styles.inputUnit, { color: colors.textSecondary }]}>reps</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => onToggle(exIdx, setIdx)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={[styles.checkCircle, { backgroundColor: isDone ? "#30D158" : "transparent", borderColor: isDone ? "#30D158" : colors.border }]}
        >
          {isDone && (
            <Svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <Path d="M2.5 6l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─── ExerciseCard ──────────────────────────────────────────── */
function ExerciseCard({ exercise, exIdx, completed, onToggle, onUpdateSet, onAddSet, onRemoveSet, onSwapExercise }: any) {
  const [prevSets, setPrevSets] = useState([]);
  const { colors, isLight } = useTheme();
  const { token } = useData() as any;

  useEffect(() => {
    const exerciseId = exercise.exerciseId || exercise.id;
    if (!exerciseId || String(exerciseId).startsWith("e")) return;

    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl) return;

    fetch(`${apiUrl}/workouts/history/${exerciseId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setPrevSets(Array.isArray(data) ? data : [] as any))
      .catch(() => setPrevSets([]));
  }, [exercise.exerciseId, exercise.id]);

  const done = exercise.sets.filter((_: any, si: number) => completed[`${exIdx}-${si}`]).length;
  const pct = (done / exercise.sets.length) * 100;

  return (
    <View style={[styles.exerciseCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.exCardHeader}>
        <View>
          <TouchableOpacity
            onLongPress={() => onSwapExercise && onSwapExercise(exIdx)}
            delayLongPress={800}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <View style={[styles.exColorDot, { backgroundColor: exercise.accentColor || "#30D158" }]} />
            <Text style={[styles.exCardTitle, { color: colors.textPrimary }]}>{exercise.name}</Text>
          </TouchableOpacity>
          <Text style={[styles.exCardMuscle, { color: colors.textSecondary }]}>{exercise.muscle}</Text>
        </View>
        <Text style={[styles.exCardDoneCount, { color: done === exercise.sets.length ? "#30D158" : colors.textSecondary }]}>
          {done}/{exercise.sets.length}
        </Text>
      </View>

      <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: pct === 100 ? "#30D158" : (exercise.accentColor || "#30D158") }]} />
      </View>

      <View style={{ gap: 8 }}>
        {exercise.sets.map((set: any, si: number) => (
          <SetRow
            key={si}
            exIdx={exIdx}
            setIdx={si}
            set={set}
            isDone={!!completed[`${exIdx}-${si}`]}
            onToggle={onToggle}
            onUpdateSet={onUpdateSet}
            onRemoveSet={onRemoveSet}
            prevSet={prevSets[si] ?? null}
          />
        ))}
      </View>

      <TouchableOpacity onPress={() => onAddSet && onAddSet(exIdx)} style={[styles.addSetBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.06)", borderColor: colors.border }]}>
        <Text style={[styles.addSetBtnText, { color: colors.textPrimary }]}>Add set</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function WorkoutPage() {
  const router = useRouter();
  const ctx = useSettings() as any;
  const unit = ctx?.weightUnit || "lbs";
  const { colors, isLight } = useTheme();

  const [started, setStarted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [workoutPlan, setWorkoutPlan] = useState<any[]>([]);
  const [completed, setCompleted] = useState<any>({});
  const [elapsed, setElapsed] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [routines, setRoutines] = useState<any[]>([]);
  const [activeRoutine, setActiveRoutine] = useState<any>(null);
  const [isManagingRoutines, setIsManagingRoutines] = useState(false);
  const [isCreatingRoutine, setIsCreatingRoutine] = useState(false);
  const [isAddingExerciseModal, setIsAddingExerciseModal] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutineConfig, setNewRoutineConfig] = useState<any[]>([]);
  const [expandedOverviewEx, setExpandedOverviewEx] = useState<number | null>(null);

  const [swappingExIdx, setSwappingExIdx] = useState<number | null>(null);
  const [routineModified, setRoutineModified] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  const { workouts, routines: templateRoutines, loading: dataLoading, refresh, token } = useData() as any;

  useEffect(() => {
    if (templateRoutines) {
      const sorted = [...templateRoutines].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRoutines(sorted);
    }
  }, [templateRoutines]);

  useEffect(() => {
    const storage = getStorage();
    if (storage) {
      const saved = storage.getItem("activeWorkout");
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setActiveRoutine(data.activeRoutine);
          setWorkoutPlan(data.workoutPlan);
          setCompleted(data.completed || {});
          setStartTime(data.startTime);
          setRoutineModified(data.routineModified || false);
          setStarted(true);
        } catch (e) {
          console.error("Failed to parse active workout state", e);
        }
      }
    }
  }, []);

  useEffect(() => {
    const storage = getStorage();
    if (!storage) return;

    if (started && activeRoutine) {
      storage.setItem("activeWorkout", JSON.stringify({
        activeRoutine,
        workoutPlan,
        completed,
        startTime,
        routineModified
      }));
    } else if (!started) {
      storage.removeItem("activeWorkout");
    }
  }, [started, activeRoutine, workoutPlan, completed, startTime, routineModified]);

  useEffect(() => {
    if (!started || !startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [started, startTime]);

  useEffect(() => {
    if (!isResting) return;
    if (restTimer <= 0) { setIsResting(false); return; }
    const t = setTimeout(() => setRestTimer((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [isResting, restTimer]);

  const toggle = (ei: number, si: number) => {
    if (isSaving) return;
    const key = `${ei}-${si}`;
    const nowDone = !completed[key];
    setCompleted((prev: any) => ({ ...prev, [key]: nowDone }));
    if (nowDone) { setRestTimer(90); setIsResting(true); }
  };

  const { done, total } = completedCount(workoutPlan, completed);
  const overallPct = total ? (done / total) * 100 : 0;
  const volume = totalVolume(workoutPlan, completed);

  const addSet = (exIdx: number) => {
    const newPlan = [...workoutPlan];
    const sets = newPlan[exIdx].sets;
    const lastSet = sets[sets.length - 1] || { reps: 10, weight: 0, rir: 0 };
    sets.push({ ...lastSet });
    setWorkoutPlan(newPlan);
  };
  const removeSet = (exIdx: number, setIdx: number) => {
    const newPlan = [...workoutPlan];
    newPlan[exIdx].sets.splice(setIdx, 1);
    setWorkoutPlan(newPlan);
  };
  const updateSet = (exIdx: number, setIdx: number, field: string, val: string) => {
    const newPlan = [...workoutPlan];
    newPlan[exIdx].sets[setIdx][field] = field === 'weight' ? Math.round(Number(val)) : Number(val);
    setWorkoutPlan(newPlan);
  };
  const removeExercise = (exIdx: number) => {
    const newPlan = [...workoutPlan];
    newPlan.splice(exIdx, 1);
    setWorkoutPlan(newPlan);
  };
  const addExercise = (exercise: any) => {
    if (!exercise) return;
    const newPlan = [...workoutPlan];
    newPlan.push({
      ...exercise,
      muscle: exercise.muscle_group || exercise.muscle,
      accentColor: "#30D158",
      exerciseId: exercise.id,
      id: Date.now(),
      sets: [{ reps: 10, weight: 0, rir: 0 }],
    });
    setWorkoutPlan(newPlan);
  };

  const swapExercise = (exIdx: number, newExercise: any) => {
    if (!newExercise) return;
    const newPlan = [...workoutPlan];
    const originalEx = newPlan[exIdx];

    const updatedSets = originalEx.sets.map((set: any, si: number) => {
      const isSetDone = !!completed[`${exIdx}-${si}`];
      if (isSetDone) {
        return set;
      }
      return {
        ...set,
        weight: 0,
        reps: 0,
        rir: 0
      };
    });

    newPlan[exIdx] = {
      ...originalEx,
      ...newExercise,
      muscle: newExercise.muscle_group || newExercise.muscle,
      accentColor: originalEx.accentColor || "#30D158",
      exerciseId: newExercise.id,
      name: newExercise.name,
      sets: updatedSets
    };

    setWorkoutPlan(newPlan);
    setRoutineModified(true);
  };

  const saveWorkoutAndFinish = async (shouldUpdateRoutine: boolean) => {
    setIsSaving(true);
    try {
      if (shouldUpdateRoutine && activeRoutine && !activeRoutine.isPastWorkout) {
        const payloadExercises = workoutPlan.map((ex: any) => ({
          exercise_id: ex.exerciseId || ex.id,
          sets: ex.sets.length,
          reps: ex.sets[0]?.reps || 10,
          weight: ex.sets[0]?.weight || 0,
          rir: ex.sets[0]?.rir || 0
        }));

        await fetch(`${process.env.EXPO_PUBLIC_API_URL}/routines/${activeRoutine.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            name: activeRoutine.name,
            exercises: payloadExercises
          }),
        });
        refresh("routines");
      }

      const workoutRes = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/workouts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: activeRoutine?.name || "Workout Session",
          notes: `Finished with ${Math.round(overallPct)}% completion in ${fmt(elapsed)}`,
        }),
      });
      if (!workoutRes.ok) throw new Error("Failed to create workout");
      const { id: workoutId } = await workoutRes.json();

      for (let ei = 0; ei < workoutPlan.length; ei++) {
        const exercise = workoutPlan[ei];
        const exId = exercise.exerciseId || exercise.id || 1;
        for (let si = 0; si < exercise.sets.length; si++) {
          if (completed[`${ei}-${si}`]) {
            const set = exercise.sets[si];
            await fetch(`${process.env.EXPO_PUBLIC_API_URL}/workouts/${workoutId}/sets`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({ exerciseId: exId, setOrder: si + 1, reps: set.reps, weight: unit === "kg" ? Math.round(Number(set.weight) * 2.205) : Number(set.weight), rir: set.rir || 0 }),
            });
          }
        }
      }
      setLastWorkoutTime(new Date());
      refresh("workouts");
      setActiveRoutine(null);
      setStarted(false);
      setElapsed(0);
      setCompleted({});
      setRoutineModified(false);
      setStartTime(null);
    } catch (err) {
      console.error("Error saving workout:", err);
      Alert.alert("Error", "Failed to save workout session.");
    } finally {
      setIsSaving(false);
    }
  };

  const finishWorkout = async () => {
    if (isSaving) return;
    if (routineModified && activeRoutine && !activeRoutine.isPastWorkout) {
      Alert.alert(
        "Update Routine?",
        "You swapped exercises in this workout. Would you like to update the routine template for future sessions?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "No, Only Save Session", onPress: () => saveWorkoutAndFinish(false) },
          { text: "Yes, Update Routine", onPress: () => saveWorkoutAndFinish(true) },
        ]
      );
    } else {
      await saveWorkoutAndFinish(false);
    }
  };

  const cancelWorkout = () => {
    Alert.alert(
      "Cancel Workout",
      "Are you sure you want to cancel this workout? Progress will not be saved.",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Cancel", 
          style: "destructive", 
          onPress: () => {
            setStarted(false);
            setActiveRoutine(null);
            setWorkoutPlan([]);
            setCompleted({});
            setElapsed(0);
            setStartTime(null);
            setRoutineModified(false);
            const storage = getStorage();
            if (storage) storage.removeItem("activeWorkout");
          }
        }
      ]
    );
  };

  const deleteRoutine = async (rId: string) => {
    Alert.alert("Delete", "Delete this routine?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await fetch(`${process.env.EXPO_PUBLIC_API_URL}/routines/${rId}`, {
              method: "DELETE",
              headers: { "Authorization": `Bearer ${token}` }
            });
            refresh("workouts");
            refresh("routines");
          } catch (e) {
            console.error(e);
          }
        }
      }
    ]);
  };

  const saveNewRoutine = async () => {
    if (!newRoutineName.trim() || newRoutineConfig.length === 0) return Alert.alert("Error", "Add a name and exercises!");
    try {
      await fetch(`${process.env.EXPO_PUBLIC_API_URL}/routines`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name: newRoutineName, exercises: newRoutineConfig }),
      });
      setIsCreatingRoutine(false);
      setNewRoutineName("");
      setNewRoutineConfig([]);
      refresh("workouts");
      refresh("routines");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to save routine");
    }
  };

  const selectRoutine = (item: any) => {
    if (isManagingRoutines) return;

    let plan = [];
    const lastSession = workouts.find((w: any) => w.name === item.name);

    if (item.isPastWorkout) {
      const exercisesMap: any = {};
      item.sets.forEach((set: any) => {
        if (!exercisesMap[set.exercise_id]) {
          exercisesMap[set.exercise_id] = {
            id: set.exercise_id,
            name: set.name || set.exercise_name,
            muscle: set.muscle_group,
            accentColor: "#0A84FF",
            sets: []
          };
        }
        exercisesMap[set.exercise_id].sets.push({
          reps: set.reps, weight: unit === "kg" ? Math.round(Number(set.weight) / 2.205) : Number(set.weight), rir: set.rir !== null ? set.rir : 0
        });
      });
      plan = Object.values(exercisesMap);
    } else {
      // It's a template routine. Base the plan on template's exercises.
      // If a lastSession exists, pre-populate individual exercise sets from it.
      plan = item.exercises.map((ex: any) => {
        const exId = ex.exercise_id || ex.id;
        const lastExSets = lastSession 
          ? lastSession.sets.filter((s: any) => s.exercise_id === exId) 
          : [];

        let setsObj = [];
        if (lastExSets.length > 0) {
          setsObj = lastExSets.map((s: any) => ({
            reps: s.reps,
            weight: unit === "kg" ? Math.round(Number(s.weight) / 2.205) : Number(s.weight),
            rir: s.rir !== null ? s.rir : 0
          }));
        } else {
          setsObj = Array(ex.sets || 3).fill(0).map(() => ({
            reps: ex.reps || 10,
            weight: unit === "kg" ? Math.round(Number(ex.weight || 0) / 2.205) : Number(ex.weight || 0),
            rir: ex.rir || 0
          }));
        }

        return {
          ...ex,
          id: exId,
          exerciseId: exId,
          sets: setsObj,
          accentColor: "#0A84FF",
        };
      });
    }

    setActiveRoutine(item);
    setWorkoutPlan(plan);
    setStarted(false);
    setIsEditing(false);
    setElapsed(0);
    setStartTime(null);
  };

  /* ── Routines List View ──────────────────────────────────────── */
  if (!activeRoutine) {
    return (
      <PageShell title="Workouts" subtitle="Choose or build a routine" onSettingsClick={() => router.push("/settings" as any)}>
        <View style={styles.routinesHeaderRow}>
          <TouchableOpacity onPress={() => setIsManagingRoutines(!isManagingRoutines)} style={[styles.manageBtn, { borderColor: colors.border }]}>
            <Text style={[styles.manageBtnText, { color: isManagingRoutines ? "#FF2D55" : colors.textSecondary }]}>
              {isManagingRoutines ? "Done Editing" : "Edit List"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsCreatingRoutine(true)} style={styles.createBtn}>
            <Text style={styles.createBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={isCreatingRoutine} animationType="slide" transparent>
          <View style={[styles.modalOverlay, { backgroundColor: isLight ? "rgba(255,255,255,0.98)" : "rgba(0,0,0,0.95)" }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>New Routine</Text>
              <TouchableOpacity onPress={() => setIsCreatingRoutine(false)}>
                <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              value={newRoutineName}
              onChangeText={setNewRoutineName}
              placeholder="Workout Name (e.g. Pull Day)"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              style={[styles.routineNameInput, { backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.05)", borderColor: colors.border, color: colors.textPrimary }]}
            />

            <ExerciseSearch onAdd={(ex: any) => setNewRoutineConfig([...newRoutineConfig, { ...ex, sets: 3, reps: 10, weight: 0, rir: 0 }])} />

            <ScrollView style={{ flex: 1, marginTop: 10 }}>
              {newRoutineConfig.map((ex, idx) => (
                <View key={idx} style={[styles.card, styles.newRoutineExRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View>
                    <Text style={[styles.newRoutineExName, { color: colors.textPrimary }]}>{ex.name}</Text>
                    <Text style={[styles.newRoutineExDetails, { color: colors.textSecondary }]}>{ex.sets} sets x {ex.reps} reps</Text>
                  </View>
                  <TouchableOpacity onPress={() => setNewRoutineConfig(newRoutineConfig.filter((_, i) => i !== idx))}>
                    <Text style={{ color: "#FF2D55", fontSize: 24, fontWeight: "600" }}>-</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity onPress={saveNewRoutine} style={styles.saveRoutineBtn}>
              <Text style={styles.saveRoutineBtnText}>Save Routine</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        <View style={styles.routinesList}>
          {dataLoading.workouts ? (
            Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={[styles.card, { height: 82, padding: 20, marginBottom: 12, backgroundColor: colors.bgCard, borderColor: colors.border }]} />
            ))
          ) : (
            routines.map(r => {
              const ls = workouts?.find((w: any) => w.name === r.name);
              const lsDate = ls ? new Date(ls.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
              const lsVolume = ls?.sets ? Math.round(ls.sets.reduce((sum: number, s: any) => {
                const w = unit === "kg" ? Math.round(Number(s.weight || 0) / 2.205) : Number(s.weight || 0);
                return sum + (Number(s.reps || 0) * w);
              }, 0)) : 0;

              return (
                <TouchableOpacity
                  key={`item-${r.isPastWorkout ? 'w' : 'r'}-${r.id}`}
                  style={[styles.card, styles.routineCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                  onPress={() => selectRoutine(r)}
                  disabled={isManagingRoutines}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={[styles.routineTitle, { color: colors.textPrimary }]}>{r.name}</Text>
                      {r.isPastWorkout && <Text style={[styles.pastWorkoutBadge, { color: colors.textTertiary }]}>Completed Session</Text>}
                    </View>
                    <View style={styles.routineDetailsCol}>
                      <Text style={[styles.routineDetailsText, { color: colors.textSecondary }]}>
                        {r.isPastWorkout
                          ? `${new Date(r.created_at).toLocaleDateString()} · ${[...new Set(r.sets?.map((s: any) => s.exercise_id))].length} exercises`
                          : `${r.exercises?.length || 0} exercises`}
                      </Text>
                      {ls && !r.isPastWorkout && (
                        <Text style={styles.routineLastSessionText}>
                          Last Session: {lsDate} · {lsVolume.toLocaleString()} {unit} · {ls.sets?.length || 0} sets
                        </Text>
                      )}
                    </View>
                  </View>

                  {isManagingRoutines && !r.isPastWorkout ? (
                    <TouchableOpacity onPress={() => deleteRoutine(r.id)} style={styles.deleteRoutineBtn}>
                      <Text style={styles.deleteRoutineBtnText}>-</Text>
                    </TouchableOpacity>
                  ) : (
                    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2">
                      <Polyline points="9 18 15 12 9 6" />
                    </Svg>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </PageShell>
    );
  }

  /* ── Edit screen ──────────────────────────────────────────────── */
  if (isEditing) {
    return (
      <PageShell title="Edit Workout" subtitle="Customize exercises & sets" onSettingsClick={() => router.push("/settings" as any)}>
        <View style={{ paddingBottom: 100 }}>
          {workoutPlan.map((ex, ei) => (
            <View key={ex.id || ei} style={[styles.card, { padding: 20, marginBottom: 16, backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.editExHeader}>
                <View>
                  <Text style={[styles.editExName, { color: colors.textPrimary }]}>{ex.name}</Text>
                  <Text style={[styles.editExMuscle, { color: colors.textSecondary }]}>{ex.muscle}</Text>
                </View>
                <TouchableOpacity onPress={() => removeExercise(ei)}>
                  <Text style={styles.removeExText}>Remove</Text>
                </TouchableOpacity>
              </View>

              {ex.sets.map((set: any, si: number) => (
                <View key={si} style={styles.editSetRow}>
                  <Text style={[styles.editSetNum, { color: colors.textSecondary }]}>S{si + 1}</Text>

                  <View style={styles.editSetInputGroup}>
                    <ClearOnFocusInput numericValue={set.weight} onChangeText={(t: string) => updateSet(ei, si, "weight", t)} placeholder="0" style={[styles.editSetInput, { backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", borderColor: colors.border, color: colors.textPrimary }]} />
                    <Text style={[styles.editSetInputUnit, { color: colors.textSecondary }]}>{unit}</Text>
                  </View>

                  <View style={styles.editSetInputGroup}>
                    <ClearOnFocusInput numericValue={set.reps} onChangeText={(t: string) => updateSet(ei, si, "reps", t)} placeholder="0" style={[styles.editSetInput, { backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", borderColor: colors.border, color: colors.textPrimary }]} />
                    <Text style={[styles.editSetInputUnit, { color: colors.textSecondary }]}>reps</Text>
                  </View>

                  <View style={styles.editSetInputGroup}>
                    <ClearOnFocusInput numericValue={set.rir !== undefined ? set.rir : 0} onChangeText={(t: string) => updateSet(ei, si, "rir", t)} placeholder="0" style={[styles.editSetInputRir, { backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", borderColor: colors.border, color: colors.accentBlue }]} />
                    <Text style={[styles.editSetInputUnit, { color: colors.textSecondary }]}>RIR</Text>
                  </View>

                  <TouchableOpacity onPress={() => removeSet(ei, si)} style={styles.removeSetBtn}>
                    <Text style={styles.removeSetBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity onPress={() => addSet(ei)} style={[styles.addSetInlineBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.05)", borderColor: colors.border }]}>
                <Text style={[styles.addSetInlineBtnText, { color: colors.textSecondary }]}>+ Add Set</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity onPress={() => setIsAddingExerciseModal(true)} style={[styles.card, { padding: 16, borderStyle: "dashed", borderColor: colors.border, backgroundColor: colors.bgCard, marginBottom: 40, alignItems: "center", justifyContent: "center" }]}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#0A84FF" }}>+ Add Exercise to Workout</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={isAddingExerciseModal} animationType="slide" transparent>
          <View style={[styles.modalOverlay, { backgroundColor: isLight ? "rgba(255,255,255,0.98)" : "rgba(0,0,0,0.95)" }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Add Exercise</Text>
              <TouchableOpacity onPress={() => setIsAddingExerciseModal(false)}>
                <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ExerciseSearch onAdd={(ex: any) => {
              addExercise(ex);
              setIsAddingExerciseModal(false);
            }} />
          </View>
        </Modal>

        <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.doneEditingFloatingBtn}>
          <Text style={styles.doneEditingFloatingBtnText}>Done Editing</Text>
        </TouchableOpacity>
      </PageShell>
    );
  }

  /* ── Pre-workout screen ──────────────────────────────────────── */
  if (!started) {
    const totalSets = workoutPlan.reduce((a, ex) => a + ex.sets.length, 0);
    const estMins = Math.round(workoutPlan.reduce((total, ex) => {
      const n = ex.sets.length;
      return total + (n * 0.5) + (n * 3);
    }, 0));

    return (
      <PageShell title={activeRoutine.name} subtitle="Workout Overview" backAction={() => setActiveRoutine(null)}>
        <View style={[styles.card, { padding: 20, marginBottom: 16, flexDirection: "row", justifyContent: "space-between", backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {[
            { label: "Exercises", value: workoutPlan.length },
            { label: "Total Sets", value: totalSets },
            { label: "Est. Time", value: `~${estMins}m` },
          ].map(({ label, value }) => (
            <View key={label} style={{ alignItems: "center" }}>
              <Text style={[styles.overviewStatLabel, { color: colors.textSecondary }]}>{label}</Text>
              <Text style={[styles.overviewStatValue, { color: colors.textPrimary }]}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.overviewListContainer, { backgroundColor: isLight ? "rgba(0,0,0,0.02)" : "rgba(0,0,0,0.1)", borderColor: colors.border }]}>
          <Text style={[styles.overviewSectionTitle, { color: colors.textSecondary }]}>Exercises</Text>
          {workoutPlan.map((ex, ei) => {
            const isExpanded = expandedOverviewEx === ei;
            return (
              <TouchableOpacity key={ex.id || ei} style={[styles.card, styles.overviewExCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={() => setExpandedOverviewEx(isExpanded ? null : ei)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={[styles.exColorDot, { backgroundColor: ex.accentColor || "#0A84FF" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.overviewExName, { color: colors.textPrimary }]}>{ex.name}</Text>
                    <Text style={[styles.overviewExMuscle, { color: colors.textSecondary }]}>{ex.muscle}</Text>
                  </View>
                  <Text style={[styles.overviewExSetsText, { color: colors.textSecondary }]}>{ex.sets.length} sets {isExpanded ? '▲' : '▼'}</Text>
                </View>

                {isExpanded && (
                  <View style={[styles.overviewExExpandedArea, { borderTopColor: colors.border }]}>
                    {ex.sets.map((set: any, si: number) => (
                      <View key={si} style={styles.overviewSetRow}>
                        <Text style={[styles.overviewSetNum, { color: colors.textSecondary }]}>Set {si + 1}</Text>
                        <Text style={[styles.overviewSetDetails, { color: colors.textSecondary }]}>
                          <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{Math.round(set.weight)}</Text> {unit} × <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{set.reps}</Text> reps
                          {set.rir > 0 && <Text style={{ color: colors.textTertiary }}> (RIR: {set.rir})</Text>}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity onPress={() => { setStarted(true); setStartTime(Date.now()); }} style={styles.startWorkoutBtn}>
          <Text style={styles.startWorkoutBtnText}>Start Workout</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsEditing(true)} style={[styles.editWorkoutBtn, { borderColor: colors.border }]}>
          <Text style={[styles.editWorkoutBtnText, { color: colors.textSecondary }]}>✎ Edit Workout</Text>
        </TouchableOpacity>
      </PageShell>
    );
  }

  /* ── Active workout screen ───────────────────────────────────── */
  return (
    <PageShell title={activeRoutine.name} subtitle="Tracker Active" badge="LIVE" badgeColor="badge-red" onSettingsClick={() => router.push("/settings" as any)}>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <View style={[styles.card, styles.activeStatCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.activeStatLabel, { color: colors.textSecondary }]}>Duration</Text>
          <Text style={[styles.activeStatValue, { color: colors.textPrimary }]}>{fmt(elapsed)}</Text>
        </View>
        <View style={[styles.card, styles.activeStatCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.activeStatLabel, { color: colors.textSecondary }]}>Volume</Text>
          <Text style={[styles.activeStatValue, { color: "#FFD60A" }]}>{volume.toLocaleString()}</Text>
        </View>
        <View style={[styles.card, styles.activeStatCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.activeStatLabel, { color: colors.textSecondary }]}>Sets</Text>
          <Text style={[styles.activeStatValue, { color: "#30D158" }]}>{done}<Text style={{ fontSize: 16, color: colors.textTertiary }}>/{total}</Text></Text>
        </View>
      </View>

      <View style={[styles.card, { padding: 14, marginBottom: 20, backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: "500" }}>Workout Progress</Text>
          <Text style={{ fontSize: 12, fontWeight: "700", color: overallPct === 100 ? "#30D158" : colors.accentBlue }}>{Math.round(overallPct)}%</Text>
        </View>
        <View style={[styles.barTrack, { height: 8, backgroundColor: colors.border }]}>
          <View style={[styles.barFill, { width: `${overallPct}%`, backgroundColor: overallPct === 100 ? "#30D158" : colors.accentBlue }]} />
        </View>
      </View>

      {isResting && (
        <View style={styles.restTimerCard}>
          <View>
            <Text style={styles.restTimerLabel}>Rest Timer</Text>
            <Text style={styles.restTimerValue}>{fmt(restTimer)}</Text>
          </View>
          <TouchableOpacity onPress={() => { setIsResting(false); setRestTimer(0); }} style={styles.skipRestBtn}>
            <Text style={styles.skipRestBtnText}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Exercises</Text>

      <View style={{ gap: 12 }}>
        {workoutPlan.map((ex, ei) => (
          <ExerciseCard key={ex.id} exercise={ex} exIdx={ei} completed={completed} onToggle={toggle} onUpdateSet={updateSet} onAddSet={addSet} onRemoveSet={removeSet} onSwapExercise={setSwappingExIdx} />
        ))}
      </View>

      <TouchableOpacity
        onPress={finishWorkout}
        disabled={isSaving}
        style={[styles.finishWorkoutBtn, { backgroundColor: overallPct === 100 ? "#30D158" : (isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)"), borderColor: overallPct === 100 ? "transparent" : colors.border, opacity: isSaving ? 0.7 : 1 }]}
      >
        <Text style={[styles.finishWorkoutBtnText, { color: overallPct === 100 ? "#000" : colors.textPrimary }]}>
          {isSaving ? "Saving..." : overallPct === 100 ? "🎉 Complete Workout" : `Finish Early (${Math.round(overallPct)}%)`}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={cancelWorkout}
        disabled={isSaving}
        style={{ paddingVertical: 14, alignItems: "center", marginTop: 4, marginBottom: 16 }}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: "600" }}>Cancel Workout</Text>
      </TouchableOpacity>

      <Modal visible={swappingExIdx !== null} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: isLight ? "rgba(255,255,255,0.98)" : "rgba(0,0,0,0.95)" }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Swap Exercise</Text>
            <TouchableOpacity onPress={() => setSwappingExIdx(null)}>
              <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {swappingExIdx !== null && (
            <Text style={{ fontSize: 16, color: colors.textSecondary, marginBottom: 20 }}>
              Replace <Text style={{ fontWeight: "700", color: colors.textPrimary }}>&quot;{workoutPlan[swappingExIdx]?.name}&quot;</Text> with:
            </Text>
          )}

          <ExerciseSearch
            onAdd={(newEx: any) => {
              if (swappingExIdx !== null) {
                swapExercise(swappingExIdx, newEx);
                setSwappingExIdx(null);
              }
            }}
          />
        </View>
      </Modal>
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
  routinesHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  manageBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  manageBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  createBtn: {
    backgroundColor: "#30D158",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  createBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "800",
  },
  routinesList: {
    flex: 1,
    gap: 12,
  },
  routineCard: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  routineTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  pastWorkoutBadge: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "500",
    marginLeft: 8,
    textTransform: "uppercase",
  },
  routineDetailsCol: {
    gap: 4,
  },
  routineDetailsText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },
  routineLastSessionText: {
    fontSize: 11,
    color: "#0A84FF",
    fontWeight: "600",
  },
  deleteRoutineBtn: {
    backgroundColor: "#FF2D55",
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  deleteRoutineBtnText: {
    color: "#fff",
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    padding: 20,
    paddingTop: 60,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
  },
  modalCloseText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 24,
  },
  routineNameInput: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    color: "#fff",
    marginBottom: 20,
    fontSize: 16,
    fontWeight: "700",
  },
  newRoutineExRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  newRoutineExName: {
    color: "#fff",
    fontWeight: "700",
  },
  newRoutineExDetails: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
  },
  saveRoutineBtn: {
    marginTop: "auto",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#30D158",
    alignItems: "center",
    marginBottom: 40,
  },
  saveRoutineBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "800",
  },
  searchInput: {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(0,0,0,0.5)",
    color: "#fff",
    fontWeight: "600",
  },
  searchResults: {
    position: "absolute",
    top: "100%", left: 0, right: 0,
    backgroundColor: "#1c1c1e",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    marginTop: 6,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  searchResultName: {
    fontWeight: "700", color: "#fff", fontSize: 14,
  },
  searchResultMuscle: {
    fontSize: 11, color: "rgba(255,255,255,0.4)",
  },
  addBtn: {
    paddingHorizontal: 20,
    justifyContent: "center",
    borderRadius: 10,
  },
  addBtnText: {
    fontWeight: "800",
  },
  editExHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  editExName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  editExMuscle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
  },
  removeExText: {
    color: "#FF2D55",
    fontSize: 12,
    fontWeight: "700",
  },
  editSetRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  editSetNum: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.4)",
    width: 22,
  },
  editSetInputGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editSetInput: {
    width: 60,
    paddingVertical: 6, paddingHorizontal: 4,
    borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.5)",
    color: "#fff", textAlign: "right", fontWeight: "700",
  },
  editSetInputRir: {
    width: 40,
    paddingVertical: 6, paddingHorizontal: 4,
    borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.5)",
    color: "#0A84FF", textAlign: "center", fontWeight: "700",
  },
  editSetInputUnit: {
    fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: "600",
  },
  removeSetBtn: {
    marginLeft: "auto",
    backgroundColor: "rgba(255,45,85,0.1)",
    borderRadius: 8, width: 24, height: 24,
    alignItems: "center", justifyContent: "center",
  },
  removeSetBtnText: {
    color: "#FF2D55", fontWeight: "700",
  },
  addSetInlineBtn: {
    width: "100%", padding: 10, marginTop: 4, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderStyle: "dashed",
    alignItems: "center",
  },
  addSetInlineBtnText: {
    color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "600",
  },
  doneEditingFloatingBtn: {
    position: "absolute", bottom: 40, left: 20, right: 20,
    padding: 16, borderRadius: 16, backgroundColor: "#30D158",
    alignItems: "center",
  },
  doneEditingFloatingBtnText: {
    color: "#000", fontSize: 16, fontWeight: "800",
  },
  overviewStatLabel: {
    fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4,
  },
  overviewStatValue: {
    fontSize: 24, fontWeight: "800", letterSpacing: -1, color: "#fff",
  },
  overviewListContainer: {
    padding: 8, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.1)", marginBottom: 16,
  },
  overviewSectionTitle: {
    fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.4,
    color: "rgba(255,255,255,0.4)", marginBottom: 10, paddingHorizontal: 8, marginTop: 4,
  },
  overviewExCard: {
    padding: 14, marginBottom: 8,
  },
  overviewExName: {
    fontSize: 14, fontWeight: "700", color: "#fff", marginBottom: 2,
  },
  overviewExMuscle: {
    fontSize: 11, color: "rgba(255,255,255,0.4)",
  },
  overviewExSetsText: {
    fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: "500",
  },
  overviewExExpandedArea: {
    marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)",
  },
  overviewSetRow: {
    flexDirection: "row", justifyContent: "space-between", marginBottom: 8,
  },
  overviewSetNum: {
    fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: "600",
  },
  overviewSetDetails: {
    fontSize: 12, color: "rgba(255,255,255,0.6)",
  },
  startWorkoutBtn: {
    width: "100%", padding: 18, borderRadius: 18, backgroundColor: "#0A84FF",
    alignItems: "center", marginBottom: 12,
  },
  startWorkoutBtnText: {
    color: "#fff", fontSize: 16, fontWeight: "800",
  },
  editWorkoutBtn: {
    width: "100%", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
  },
  editWorkoutBtnText: {
    color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "700",
  },
  activeStatCard: {
    flex: 1, padding: 14,
  },
  activeStatLabel: {
    fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4,
  },
  activeStatValue: {
    fontSize: 28, fontWeight: "800", letterSpacing: -1.5, color: "#fff",
  },
  restTimerCard: {
    padding: 14, marginBottom: 16, borderRadius: 20, borderWidth: 1,
    borderColor: "rgba(255,159,10,0.3)", backgroundColor: "rgba(255,159,10,0.07)",
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  restTimerLabel: {
    fontSize: 11, color: "#FF9F0A", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8,
  },
  restTimerValue: {
    fontSize: 26, fontWeight: "800", letterSpacing: -1, color: "#FF9F0A",
  },
  skipRestBtn: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: "rgba(255,159,10,0.2)", borderWidth: 1, borderColor: "rgba(255,159,10,0.4)",
  },
  skipRestBtnText: {
    color: "#FF9F0A", fontSize: 12, fontWeight: "700", textTransform: "uppercase",
  },
  sectionTitle: {
    fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.4,
    color: "rgba(255,255,255,0.4)", marginBottom: 12,
  },
  exerciseCard: {
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
  },
  exCardHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14,
  },
  exColorDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  exCardTitle: {
    fontSize: 15, fontWeight: "700", color: "#fff",
  },
  exCardMuscle: {
    fontSize: 11, color: "rgba(255,255,255,0.4)", marginLeft: 16,
  },
  exCardDoneCount: {
    fontSize: 12, fontWeight: "700",
  },
  barTrack: {
    height: 4, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 2, marginBottom: 14, overflow: "hidden",
  },
  barFill: {
    height: "100%", borderRadius: 2,
  },
  addSetBtn: {
    alignSelf: "center", marginTop: 15, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  addSetBtnText: {
    color: "#fff", fontWeight: "700", fontSize: 13,
  },
  setRowContainer: {
    width: "100%", borderRadius: 12, overflow: "hidden",
  },
  setRowInner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 1,
  },
  setRowIndex: {
    fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.4)", width: 22, textTransform: "uppercase",
  },
  prevSetCol: {
    alignItems: "flex-end", minWidth: 60, paddingRight: 10,
    borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.07)",
  },
  prevSetWeight: {
    fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.28)",
  },
  prevSetReps: {
    fontSize: 10, color: "rgba(255,255,255,0.2)", fontWeight: "500",
  },
  setInputsRow: {
    flex: 1, flexDirection: "row", gap: 10,
  },
  inputGroup: {
    flexDirection: "row", alignItems: "baseline", gap: 4,
  },
  setNumInput: {
    fontSize: 15, fontWeight: "800", borderWidth: 1, borderRadius: 6,
    paddingVertical: 2, paddingHorizontal: 6, width: 48, textAlign: "center",
  },
  inputUnit: {
    fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: "500",
  },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  finishWorkoutBtn: {
    width: "100%", padding: 16, borderRadius: 16, borderWidth: 1,
    alignItems: "center", marginTop: 20, marginBottom: 40,
  },
  finishWorkoutBtnText: {
    fontSize: 15, fontWeight: "800",
  },
});
