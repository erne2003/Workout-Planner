import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import Svg, { Circle, Path, Polyline } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../hooks/useTheme";

export default function PageShell({
  title,
  subtitle,
  badge,
  badgeColor = "blue",
  backAction,
  onSettingsClick,
  children,
}: any) {
  const { colors, isLight } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgBase }]}>
      <StatusBar style={isLight ? "dark" : "light"} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            {backAction && (
              <TouchableOpacity onPress={backAction} style={styles.backButton}>
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.textPrimary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <Polyline points="15 18 9 12 15 6" />
                </Svg>
              </TouchableOpacity>
            )}
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            {badge && (
              <View style={[styles.badge, badgeColor === "blue" ? styles.badgeBlue : {}]}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            )}
          </View>
          {subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
        </View>

        {/* Right Actions */}
        <View style={styles.actions}>
          {/* Avatar */}
          <LinearGradient colors={["#FF2D55", "#0A84FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarBorder}>
            <View style={[styles.avatarInner, { backgroundColor: isLight ? "#fff" : "#111120" }]}>
              <Text style={[styles.avatarText, { color: colors.textPrimary }]}>EC</Text>
            </View>
          </LinearGradient>

          {/* Settings Button */}
          {onSettingsClick && (
            <TouchableOpacity onPress={onSettingsClick} style={[styles.settingsButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <Circle cx="12" cy="12" r="3" />
                <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1 1.51H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </Svg>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Scrollable content */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07070F", // var(--bg-base)
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 14,
    zIndex: 10,
  },
  headerLeft: {
    flex: 1,
    marginRight: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  backButton: {
    paddingRight: 6,
    paddingTop: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: "#fff",
  },
  badge: {
    marginTop: 4,
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeBlue: {
    backgroundColor: "rgba(10,132,255,0.2)",
  },
  badgeText: {
    color: "#0A84FF",
    fontSize: 10,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarBorder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    padding: 2,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#111120",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  settingsButton: {
    marginLeft: 16,
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollArea: {
    flex: 1,
    zIndex: 10,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
});
