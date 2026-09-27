import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useData } from "@apex/core";
import { useTheme } from "../hooks/useTheme";

/**
 * One-time progress while a device downloads the account's data on its first
 * sync (a new install, or an existing user's first launch after the upgrade).
 * Later launches read the local database instantly and never show this.
 */
export default function FirstSyncBanner() {
  const { syncStatus, isAuthenticated } = useData() as any;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  if (!isAuthenticated || !syncStatus || syncStatus.initialSyncDone || !syncStatus.syncing) return null;

  const rows = syncStatus.pulledRows || 0;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <View style={[styles.pill, { backgroundColor: colors.bgElevated, borderColor: colors.borderStrong }]}>
        <ActivityIndicator size="small" color={colors.accentBlue} />
        <Text style={[styles.text, { color: colors.textPrimary }]}>
          Setting up your data{rows > 0 ? ` · ${rows} items` : "…"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
});
