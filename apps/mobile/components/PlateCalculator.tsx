import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useSettings } from "@apex/core";
import { useTheme } from "../hooks/useTheme";

export default function PlateCalculator() {
  const [targetWeight, setTargetWeight] = useState("135");
  const [plates, setPlates] = useState<number[]>([]);
  
  const ctx = useSettings() as any;
  const unit = ctx?.weightUnit || "lbs";
  const barWeight = ctx?.barWeight || 45;
  const { colors, isLight } = useTheme();

  useEffect(() => {
    calculatePlates(parseFloat(targetWeight) || 0, barWeight);
  }, [targetWeight, barWeight, unit]);

  const calculatePlates = (target: number, bar: number) => {
    let weightPerSide = (target - bar) / 2;
    if (weightPerSide <= 0) {
      setPlates([]);
      return;
    }

    const standardPlates = unit === "lbs" 
      ? [45, 35, 25, 10, 5, 2.5] 
      : [25, 20, 15, 10, 5, 2.5, 1.25];
    
    const needed: number[] = [];
    let remaining = weightPerSide;

    standardPlates.forEach(plate => {
      const count = Math.floor(remaining / plate);
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          needed.push(plate);
        }
        remaining -= count * plate;
      }
    });

    setPlates(needed);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.labelTop, { color: colors.textSecondary }]}>Plate Calculator</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Load Your Bar</Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.targetLabel, { color: colors.textSecondary }]}>Target ({unit})</Text>
          <TextInput 
            keyboardType="numeric"
            value={targetWeight}
            onChangeText={setTargetWeight}
            style={[styles.input, { backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(0,0,0,0.4)", borderColor: colors.border, color: colors.accentBlue }]}
          />
        </View>
      </View>

      {/* Visual Display Area */}
      <View style={styles.displayLabelContainer}>
        <Text style={[styles.displayLabel, { color: colors.textSecondary }]}>Plates Per Side</Text>
      </View>
      
      <View style={[styles.platesContainer, { backgroundColor: isLight ? "rgba(0,0,0,0.02)" : "rgba(0,0,0,0.3)", borderColor: colors.border }]}>
        {plates.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            Enter a weight higher than {barWeight}{unit}
          </Text>
        ) : (
          plates.map((p, i) => {
            const isLarge = p >= 45;
            const isMedium = p >= 25;
            return (
              <View 
                key={i} 
                style={[
                  styles.plateBase,
                  isLarge 
                    ? [styles.plateLarge, { backgroundColor: isLight ? "#fff" : "#0a0a14" }] 
                    : isMedium 
                      ? [styles.plateMedium, { backgroundColor: isLight ? "#f2f2f7" : "#181825" }] 
                      : [styles.plateSmall, { backgroundColor: isLight ? "#e5e5ea" : "#242435", borderColor: colors.borderStrong }]
                ]}
              >
                <Text style={[styles.plateText, { color: colors.textPrimary }]}>{p}</Text>
              </View>
            );
          })
        )}
      </View>

      {/* Footer Info Row */}
      <View style={styles.footerRow}>
        <View style={styles.footerInfo}>
          <View>
            <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>Bar</Text>
            <Text style={[styles.footerValue, { color: colors.textPrimary }]}>{barWeight} <Text style={[styles.footerUnit, { color: colors.textSecondary }]}>{unit}</Text></Text>
          </View>
          <View style={styles.footerInfoSpacing}>
            <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>One Side</Text>
            <Text style={[styles.footerValue, { color: colors.textPrimary }]}>
              {Math.max(0, ((parseFloat(targetWeight) || 0) - barWeight) / 2).toFixed(1)}{" "}
              <Text style={[styles.footerUnit, { color: colors.textSecondary }]}>{unit}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.readyBadge}>
          <View style={styles.readyDot} />
          <Text style={styles.readyText}>READY</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 32,
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  labelTop: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  inputContainer: {
    alignItems: "flex-end",
  },
  targetLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    width: 90,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    textAlign: "right",
    fontSize: 22,
    fontWeight: "900",
  },
  displayLabelContainer: {
    marginBottom: 8,
    alignItems: "center",
  },
  displayLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  platesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 11,
    fontStyle: "italic",
    fontWeight: "500",
  },
  plateBase: {
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  plateLarge: {
    width: 54,
    height: 54,
    borderWidth: 2.5,
    borderColor: "#0A84FF",
  },
  plateMedium: {
    width: 48,
    height: 48,
    borderWidth: 2.5,
    borderColor: "#BF5AF2",
  },
  plateSmall: {
    width: 42,
    height: 42,
    borderWidth: 2.5,
  },
  plateText: {
    fontSize: 12,
    fontWeight: "900",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 4,
  },
  footerInfo: {
    flexDirection: "row",
  },
  footerInfoSpacing: {
    marginLeft: 24,
  },
  footerLabel: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  footerValue: {
    fontSize: 13,
    fontWeight: "800",
  },
  footerUnit: {
    fontSize: 10,
  },
  readyBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(48,209,88,0.1)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(48,209,88,0.2)",
  },
  readyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#30D158",
    marginRight: 6,
  },
  readyText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#30D158",
    letterSpacing: 0.5,
  },
});
