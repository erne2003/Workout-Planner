import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Modal, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import PageShell from "@/components/PageShell";
import { useSettings } from "@apex/core";
import Svg, { Path, Polyline, Line } from "react-native-svg";
import { useTheme } from "../hooks/useTheme";

function Toggle({ active, onClick, color }: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onClick}
      style={[
        styles.toggleContainer,
        { backgroundColor: active ? color : colors.borderStrong, justifyContent: active ? "flex-end" : "flex-start" }
      ]}
    >
      <View style={[styles.toggleKnob, { backgroundColor: colors.textPrimary }]} />
    </TouchableOpacity>
  );
}

function UnitToggle({ options, active, onChange }: any) {
  const { colors, isLight } = useTheme();
  return (
    <View style={[styles.unitToggleContainer, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)" }]}>
      {options.map((opt: string) => (
        <TouchableOpacity
          key={opt}
          onPress={() => onChange(opt)}
          style={[
            styles.unitToggleBtn,
            active === opt ? [styles.unitToggleBtnActive, { backgroundColor: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.15)" }] : styles.unitToggleBtnInactive
          ]}
        >
          <Text style={[
            styles.unitToggleText,
            active === opt ? [styles.unitToggleTextActive, { color: colors.textPrimary }] : [styles.unitToggleTextInactive, { color: colors.textSecondary }]
          ]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const { colors, isLight } = useTheme();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!deletePassword) return;
    setIsDeleting(true);
    try {
      const token = global.localStorage?.getItem("token");
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
      const response = await fetch(`${apiUrl}/auth/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert("Success", "Account and all associated data deleted successfully.");
        setShowDeleteModal(false);
        setDeletePassword("");
        logout();
      } else {
        Alert.alert("Error", data.error || "Failed to delete account");
      }
    } catch (err: any) {
      Alert.alert("Error", "Error connecting to server. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const ctx = useSettings() as any;

  useEffect(() => {
    setUserName(global.localStorage?.getItem("userName") || "");
  }, []);

  if (!ctx) return null;
  const {
    theme, setTheme,
    weightUnit, setWeightUnit,
    lengthUnit, setLengthUnit,
    defaultRIR, setDefaultRIR,
    restTimer, setRestTimer,
    plateCalc, setPlateCalc,
    barWeight, setBarWeight,
    autoStartRest, setAutoStartRest,
    notifications, setNotifications
  } = ctx;

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const handleNameBlur = () => {
    global.localStorage?.setItem("userName", userName);
  };

  const logout = () => {
    global.localStorage?.removeItem("userId");
    global.localStorage?.removeItem("token");
    global.localStorage?.removeItem("userName");
    global.localStorage?.removeItem("userEmail");
    router.replace("/login");
  };

  return (
    <PageShell title="Settings" backAction={() => router.back()}>
      <View style={{ paddingBottom: 120, gap: 32 }}>

        {/* Profile */}
        <View>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Profile</Text>
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, padding: 18 }]}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Display Name</Text>
            <TextInput
              value={userName}
              onChangeText={setUserName}
              onBlur={handleNameBlur}
              placeholder="Your Name"
              placeholderTextColor={colors.textTertiary}
              style={[styles.nameInput, { color: colors.textPrimary }]}
            />
          </View>
        </View>

        {/* Appearance */}
        <View>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Appearance</Text>
          <View style={[styles.card, styles.row, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.rowText, { color: colors.textPrimary }]}>Dark Mode</Text>
            <Toggle active={theme === "dark"} onClick={toggleTheme} color="#0A84FF" />
          </View>
        </View>

        {/* Units */}
        <View>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Units</Text>
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.row}>
              <Text style={[styles.rowText, { color: colors.textPrimary }]}>Weight Unit</Text>
              <UnitToggle options={["lbs", "kg"]} active={weightUnit} onChange={setWeightUnit} />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.row}>
              <Text style={[styles.rowText, { color: colors.textPrimary }]}>Length Unit</Text>
              <UnitToggle options={["in", "cm"]} active={lengthUnit} onChange={setLengthUnit} />
            </View>
          </View>
        </View>

        {/* Workout Defaults */}
        <View>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Workout Defaults</Text>
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.row}>
              <Text style={[styles.rowText, { color: colors.textPrimary }]}>Default RIR Target</Text>
              <TextInput
                keyboardType="numeric"
                value={String(defaultRIR)}
                onChangeText={(v) => setDefaultRIR(parseInt(v) || 0)}
                style={[styles.numberInput, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.3)", borderColor: colors.border, color: colors.accentBlue }]}
              />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.row}>
              <Text style={[styles.rowText, { color: colors.textPrimary }]}>Rest Timer (sec)</Text>
              <TextInput
                keyboardType="numeric"
                value={String(restTimer)}
                onChangeText={(v) => setRestTimer(parseInt(v) || 0)}
                style={[styles.numberInput, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.3)", borderColor: colors.border, color: colors.accentBlue }]}
              />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.row}>
              <Text style={[styles.rowText, { color: colors.textPrimary }]}>Auto-start Rest Timer</Text>
              <Toggle active={autoStartRest} onClick={() => setAutoStartRest(!autoStartRest)} color="#30D158" />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={{ padding: 18 }}>
              <View style={[styles.row, { padding: 0, marginBottom: plateCalc ? 14 : 0 }]}>
                <Text style={[styles.rowText, { color: colors.textPrimary }]}>Plate Calculator</Text>
                <Toggle active={plateCalc} onClick={() => setPlateCalc(!plateCalc)} color="#0A84FF" />
              </View>
              {plateCalc && (
                <View style={[styles.plateCalcSubRow, { backgroundColor: isLight ? "rgba(0,0,0,0.02)" : "rgba(0,0,0,0.2)", borderColor: colors.border }]}>
                  <Text style={[styles.plateCalcLabel, { color: colors.textSecondary }]}>Bar Weight ({weightUnit})</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={String(barWeight)}
                    onChangeText={(v) => setBarWeight(parseFloat(v) || 0)}
                    style={[styles.numberInput, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.3)", borderColor: colors.border, color: colors.accentBlue }]}
                  />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Notifications</Text>
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.row}>
              <Text style={[styles.rowText, { color: colors.textPrimary }]}>Workout Reminders</Text>
              <Toggle active={notifications.reminders} onClick={() => setNotifications({ ...notifications, reminders: !notifications.reminders })} color="#0A84FF" />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.row}>
              <Text style={[styles.rowText, { color: colors.textPrimary }]}>Rest Timer Alerts</Text>
              <Toggle active={notifications.alerts} onClick={() => setNotifications({ ...notifications, alerts: !notifications.alerts })} color="#0A84FF" />
            </View>
          </View>
        </View>

        {/* Account */}
        <View>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Account</Text>
          <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, padding: 0 }]}>
            <TouchableOpacity onPress={logout} style={styles.logoutButton}>
              <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF2D55" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <Polyline points="16 17 21 12 16 7" />
                <Line x1="21" y1="12" x2="9" y2="12" />
              </Svg>
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <TouchableOpacity onPress={() => setShowDeleteModal(true)} style={styles.deleteAccountButton}>
              <Text style={styles.deleteAccountText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delete Account Modal */}
        <Modal
          visible={showDeleteModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setShowDeleteModal(false);
            setDeletePassword("");
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.bgBase, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Delete Account?</Text>
              
              <View style={[styles.warningBox, { backgroundColor: isLight ? "#FFEBEB" : "#240E10" }]}>
                <Text style={styles.warningText}>
                  ⚠️ WARNING: This action is permanent! All of your workout logs, routines, personal records, and body metrics will be permanently deleted and cannot be recovered.
                </Text>
              </View>

              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                To confirm, please enter your password:
              </Text>

              <TextInput
                secureTextEntry
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder="Confirm Password"
                placeholderTextColor={colors.textTertiary}
                style={[styles.passwordInput, { color: colors.textPrimary, borderColor: colors.border }]}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  onPress={() => {
                    setShowDeleteModal(false);
                    setDeletePassword("");
                  }}
                  style={[styles.modalButton, styles.cancelBtn]}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textPrimary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDeleteAccount}
                  disabled={isDeleting || !deletePassword}
                  style={[
                    styles.modalButton,
                    styles.confirmBtn,
                    (!deletePassword || isDeleting) && styles.disabledConfirmBtn
                  ]}
                >
                  {isDeleting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Delete Permanently</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    paddingLeft: 4,
    marginBottom: 8,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  rowText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginHorizontal: 20,
  },
  inputLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "600",
    marginBottom: 4,
  },
  nameInput: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    padding: 0,
  },
  numberInput: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    color: "#0A84FF",
    fontWeight: "800",
    fontSize: 14,
    textAlign: "right",
    width: 70,
  },
  toggleContainer: {
    width: 48,
    height: 24,
    borderRadius: 24,
    padding: 3,
    flexDirection: "row",
    alignItems: "center",
  },
  toggleKnob: {
    width: 18,
    height: 18,
    backgroundColor: "#fff",
    borderRadius: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  unitToggleContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 4,
    borderRadius: 12,
  },
  unitToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 9,
  },
  unitToggleBtnActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  unitToggleBtnInactive: {
    backgroundColor: "transparent",
  },
  unitToggleText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  unitToggleTextActive: {
    color: "#fff",
  },
  unitToggleTextInactive: {
    color: "rgba(255,255,255,0.4)",
  },
  plateCalcSubRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  plateCalcLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 20,
    backgroundColor: "rgba(255,45,85,0.08)",
  },
  logoutText: {
    color: "#FF2D55",
    fontSize: 15,
    fontWeight: "800",
  },
  deleteAccountButton: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,59,48,0.05)",
  },
  deleteAccountText: {
    color: "#FF3B30",
    fontSize: 15,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  warningBox: {
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.3)",
    borderRadius: 12,
    padding: 14,
  },
  warningText: {
    color: "#FF3B30",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  confirmBtn: {
    backgroundColor: "#FF3B30",
  },
  disabledConfirmBtn: {
    backgroundColor: "rgba(255, 59, 48, 0.4)",
  },
  confirmBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
