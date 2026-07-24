import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Path, G } from "react-native-svg";
import { ANTERIOR_PATHS, POSTERIOR_PATHS, RECOVERY_COLOR } from "@apex/core";
import { useTheme } from "../hooks/useTheme";

const MUSCLE_LABELS: Record<string, string> = {
  chest: "Chest",
  abs: "Abs",
  biceps: "Biceps",
  triceps: "Triceps",
  deltoids: "Deltoids",
  obliques: "Obliques",
  quadriceps: "Quadriceps",
  calves: "Calves",
  adductors: "Adductors",
  trapezius: "Trapezius",
  forearm: "Forearms",
  knees: "Knees",
  tibialis: "Tibialis",
  serratus: "Serratus",
  hipFlexors: "Hip Flexors",
  upperBack: "Upper Back",
  rearDeltoids: "Rear Delts",
  lowerBack: "Lower Back",
  gluteal: "Glutes",
  hamstring: "Hamstrings",
};

export default function MuscleMap({ view = "front", muscleData = {}, onSelect }: any) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { colors, isLight } = useTheme();
  
  const paths = view === "front" ? ANTERIOR_PATHS : POSTERIOR_PATHS;
  const viewBox = view === "front" ? "0 95 727 1280" : "445 95 727 1280";

  const handlePress = (id: string) => {
    setSelectedId(prev => prev === id ? null : id);
    if (onSelect) onSelect(id);
  };

  const selectedLabel = selectedId ? (MUSCLE_LABELS[selectedId] || selectedId) : null;
  const selectedData = selectedId ? ((muscleData as any)[selectedId] || (muscleData as any)[selectedId?.toLowerCase()]) : null;
  const selectedStatus = selectedData ? selectedData.status : "fully_recovered";
  const selectedColor = selectedStatus ? ((RECOVERY_COLOR as any)[selectedStatus] || RECOVERY_COLOR.fully_recovered) : RECOVERY_COLOR.fully_recovered;

  return (
    <View style={styles.container}>
      {selectedLabel && (
        <View style={[styles.tooltip, { backgroundColor: isLight ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.12)", borderColor: `${selectedColor}60` }]}>
          <View style={[styles.tooltipDot, { backgroundColor: selectedColor }]} />
          <Text style={[styles.tooltipText, { color: isLight ? "#fff" : colors.textPrimary }]}>{selectedLabel}</Text>
          {selectedData && (
            <Text style={[styles.tooltipPct, { color: selectedColor }]}>{selectedData.pct}%</Text>
          )}
        </View>
      )}

      <Svg 
        viewBox={viewBox} 
        style={styles.svg}
      >
        <Defs>
          <RadialGradient id="muscleVol" cx="50%" cy="50%" r="50%" fx="50%" fy="40%">
            <Stop offset="0%" stopColor="white" stopOpacity={isLight ? 0.3 : 0.15} />
            <Stop offset="100%" stopColor="black" stopOpacity={isLight ? 0.1 : 0.4} />
          </RadialGradient>
        </Defs>

        {paths?.map((muscle: any) => {
          // Skip sub-muscles rendered over main muscles
          if (["upperChest", "lowerChest", "innerQuad", "outerQuad", "upperAbs", "lowerAbs", "frontDeltoid"].includes(muscle.id)) {
            return null;
          }

          // Non-muscle body parts (head, hands, feet, etc.)
          if (["head", "hair", "neck", "hands", "feet", "ankles"].includes(muscle.id)) {
            return (
              <Path 
                key={muscle.id} 
                d={muscle.d} 
                fill={isLight ? "#E5E5EA" : "#2C2C2E"} 
                stroke={isLight ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.6)"} 
                strokeWidth="0.5" 
              />
            );
          }

          const mData = (muscleData as any)[muscle.id] || (muscleData as any)[muscle.id.toLowerCase()];
          const status = mData ? mData.status : "fully_recovered";
          const recoveryColor = (RECOVERY_COLOR as any)[status] || RECOVERY_COLOR.fully_recovered;
          
          const isSelected = selectedId === muscle.id;

          return (
            <G 
                key={muscle.id} 
                onPress={() => handlePress(muscle.id)}
            >
              <Path
                d={muscle.d}
                fill={recoveryColor}
                opacity={isSelected ? 1 : 0.7}
                stroke={isSelected ? "#fff" : (isLight ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.8)")}
                strokeWidth={isSelected ? "2" : "0.5"}
              />
              <Path
                d={muscle.d}
                fill="url(#muscleVol)"
                pointerEvents="none"
              />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 400,
    alignItems: "center",
    justifyContent: "center",
  },
  svg: {
    width: "100%",
    height: "100%",
  },
  tooltip: {
    position: "absolute",
    top: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  tooltipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tooltipText: {
    fontSize: 14,
    fontWeight: "700",
  },
  tooltipPct: {
    fontSize: 13,
    fontWeight: "600",
  },
});
