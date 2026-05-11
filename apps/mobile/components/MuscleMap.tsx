import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Path, G } from "react-native-svg";
import { ANTERIOR_PATHS, POSTERIOR_PATHS, RECOVERY_COLOR } from "@apex/core";

// Make sure to resolve these paths since @apex/core/src might be where they are, or I'll just assume they're exported from @apex/core
// Wait, I will just import from "@apex/core" if they are exported, otherwise I should check if they are exported.
// For now, I'll assume they are exported from "@apex/core". If not, they'll need to be.

export default function MuscleMap({ view = "front", muscleData = {}, onSelect }: any) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const paths = view === "front" ? ANTERIOR_PATHS : POSTERIOR_PATHS;
  const viewBox = view === "front" ? "0 95 727 1280" : "696 95 727 1280";

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(m => m !== id);
      return [...prev, id];
    });
    if (onSelect) onSelect(id);
  };

  return (
    <View style={styles.container}>
      <Svg 
        viewBox={viewBox} 
        style={styles.svg}
      >
        <Defs>
          <RadialGradient id="muscleVol" cx="50%" cy="50%" r="50%" fx="50%" fy="40%">
            <Stop offset="0%" stopColor="white" stopOpacity="0.15" />
            <Stop offset="100%" stopColor="black" stopOpacity="0.4" />
          </RadialGradient>
        </Defs>

        {paths?.map((muscle: any) => {
          // Prevent rendering sub-muscles over the main muscles
          if (["upperChest", "lowerChest", "innerQuad", "outerQuad", "upperAbs", "lowerAbs", "frontDeltoid"].includes(muscle.id)) {
            return null;
          }

          if (["head", "hair", "neck", "hands", "feet", "ankles"].includes(muscle.id)) {
            return <Path key={muscle.id} d={muscle.d} fill="#2C2C2E" stroke="rgba(0,0,0,0.6)" strokeWidth="0.5" />;
          }

          const mData = muscleData[muscle.id] || muscleData[muscle.id.toLowerCase()];
          const status = mData ? mData.status : "fully_recovered";
          
          const isSelected = selectedIds.includes(muscle.id);
          
          const fillColor = isSelected ? (RECOVERY_COLOR[status as keyof typeof RECOVERY_COLOR] || RECOVERY_COLOR.fully_recovered) : "#3A3A3C";

          return (
            <G 
                key={muscle.id} 
                onPress={() => toggleSelect(muscle.id)}
            >
              <Path
                d={muscle.d}
                fill={fillColor}
                stroke="rgba(0,0,0,0.8)"
                strokeWidth="0.5"
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
  }
});
