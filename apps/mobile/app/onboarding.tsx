import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../hooks/useTheme";
import { useData, fetchWithTimeout } from "@apex/core";

export default function OnboardingPage() {
    const router = useRouter();
    const { token } = useData() as any;
    const [years, setYears] = useState("");
    const [weight, setWeight] = useState("");
    const [gender, setGender] = useState<"male" | "female">("male");
    
    // Explicit Height Metrics constraints
    const [hUnit, setHUnit] = useState<"ft" | "cm">("ft");
    const [feet, setFeet] = useState("");
    const [inches, setInches] = useState("");
    const [cm, setCm] = useState("");
    
    const [bodyFat, setBodyFat] = useState("");
    const [loading, setLoading] = useState(false);
    const { colors, isLight } = useTheme();
 
    const handleSubmit = async () => {
        setLoading(true);
 
        let finalHeight = "Not Selected";
        if (hUnit === "ft" && (feet || inches)) {
            finalHeight = `${feet || 0}'${inches || 0}"`;
        } else if (hUnit === "cm" && cm) {
            finalHeight = `${cm}cm`;
        }
 
        try {
            const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
            await fetchWithTimeout(`${apiUrl}/metrics`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    trainingYears: parseFloat(years) || 0,
                    weight: parseFloat(weight),
                    height: finalHeight,
                    bodyFat: bodyFat ? parseFloat(bodyFat) : null,
                    gender: gender
                })
            });
            router.replace("/");
        } catch (err) {
            console.error(err);
            Alert.alert("Error", "Failed saving profile.");
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.bgBase }]}>
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={styles.headerContainer}>
                    <LinearGradient colors={["#0A84FF", "#BF5AF2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconContainer}>
                        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <Circle cx="12" cy="7" r="4" />
                        </Svg>
                    </LinearGradient>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Complete Profile</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Establish your physical baseline constraints.</Text>
                </View>

                <View style={styles.form}>
                    <View>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Gender</Text>
                        <View style={[styles.unitToggleGroup, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.4)", width: "100%", height: 46, padding: 3 }]}>
                            <TouchableOpacity onPress={() => setGender("male")} style={[{ flex: 1, justifyContent: "center", alignItems: "center", borderRadius: 4 }, gender === "male" && { backgroundColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.15)" }]}>
                                <Text style={[styles.unitToggleText, { fontSize: 13, color: colors.textSecondary }, gender === "male" && { color: colors.textPrimary, fontWeight: "700" }]}>Male</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setGender("female")} style={[{ flex: 1, justifyContent: "center", alignItems: "center", borderRadius: 4 }, gender === "female" && { backgroundColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.15)" }]}>
                                <Text style={[styles.unitToggleText, { fontSize: 13, color: colors.textSecondary }, gender === "female" && { color: colors.textPrimary, fontWeight: "700" }]}>Female</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Training Age (Years)</Text>
                        <TextInput 
                            keyboardType="numeric" 
                            placeholder="e.g. 2.5" 
                            placeholderTextColor={colors.textTertiary}
                            value={years} 
                            onChangeText={setYears} 
                            style={[styles.input, { backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", borderColor: colors.border, color: colors.textPrimary }]} 
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={styles.flex1}>
                            <View style={styles.heightHeaderRow}>
                                <Text style={[styles.label, { marginBottom: 0, color: colors.textSecondary }]}>Height</Text>
                                <View style={[styles.unitToggleGroup, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.4)" }]}>
                                    <TouchableOpacity onPress={() => setHUnit("ft")} style={[styles.unitToggleBtn, hUnit === "ft" && [styles.unitToggleBtnActive, { backgroundColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.15)" }]]}>
                                        <Text style={[styles.unitToggleText, { color: colors.textSecondary }, hUnit === "ft" && { color: colors.textPrimary }]}>FT / IN</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setHUnit("cm")} style={[styles.unitToggleBtn, hUnit === "cm" && [styles.unitToggleBtnActive, { backgroundColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.15)" }]]}>
                                        <Text style={[styles.unitToggleText, { color: colors.textSecondary }, hUnit === "cm" && { color: colors.textPrimary }]}>CM</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            
                            {hUnit === "ft" ? (
                                <View style={styles.rowSmallGap}>
                                    <View style={styles.flex1}>
                                        <TextInput keyboardType="numeric" placeholder="5" placeholderTextColor={colors.textTertiary} value={feet} onChangeText={setFeet} style={[styles.input, { backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", borderColor: colors.border, color: colors.textPrimary }]} />
                                        <Text style={[styles.inputSuffixText, { color: colors.textTertiary }]}>ft</Text>
                                    </View>
                                    <View style={styles.flex1}>
                                        <TextInput keyboardType="numeric" placeholder="11" placeholderTextColor={colors.textTertiary} value={inches} onChangeText={setInches} style={[styles.input, { backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", borderColor: colors.border, color: colors.textPrimary }]} />
                                        <Text style={[styles.inputSuffixText, { color: colors.textTertiary }]}>in</Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.flex1}>
                                    <TextInput keyboardType="numeric" placeholder="180" placeholderTextColor={colors.textTertiary} value={cm} onChangeText={setCm} style={[styles.input, { backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", borderColor: colors.border, color: colors.textPrimary }]} />
                                    <Text style={[styles.inputSuffixText, { color: colors.textTertiary }]}>cm</Text>
                                </View>
                            )}
                        </View>
                        <View style={[styles.flex1, { marginLeft: 12 }]}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Weight (lbs)</Text>
                            <TextInput keyboardType="numeric" placeholder="e.g. 185" placeholderTextColor={colors.textTertiary} value={weight} onChangeText={setWeight} style={[styles.input, { backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", borderColor: colors.border, color: colors.textPrimary }]} />
                        </View>
                    </View>

                    <View>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Body Fat % (Optional)</Text>
                        <TextInput keyboardType="numeric" placeholder="e.g. 14" placeholderTextColor={colors.textTertiary} value={bodyFat} onChangeText={setBodyFat} style={[styles.input, { backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", borderColor: colors.border, color: colors.textPrimary }]} />
                    </View>

                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={loading || !weight || !years}
                        style={[styles.submitButton, (loading || !weight || !years) && styles.submitButtonDisabled]}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.submitButtonText}>Enter Dashboard</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    card: {
        width: "100%",
        maxWidth: 400,
        paddingVertical: 32,
        paddingHorizontal: 28,
        borderRadius: 20,
        borderWidth: 1,
    },
    headerContainer: {
        alignItems: "center",
        marginBottom: 28,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: "800",
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 13,
        textAlign: "center",
    },
    form: {
        gap: 16,
    },
    label: {
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 6,
    },
    input: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        fontSize: 15,
        fontWeight: "600",
        width: "100%",
    },
    row: {
        flexDirection: "row",
        alignItems: "flex-end",
    },
    rowSmallGap: {
        flexDirection: "row",
        gap: 8,
    },
    flex1: {
        flex: 1,
        position: "relative",
    },
    heightHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
        minHeight: 24,
    },
    unitToggleGroup: {
        flexDirection: "row",
        borderRadius: 6,
        padding: 2,
    },
    unitToggleBtn: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    unitToggleBtnActive: {
    },
    unitToggleText: {
        fontSize: 9,
        fontWeight: "700",
    },
    inputSuffixText: {
        position: "absolute",
        right: 12,
        top: 14,
        fontSize: 16,
        fontWeight: "700",
    },
    submitButton: {
        marginTop: 12,
        padding: 16,
        borderRadius: 14,
        backgroundColor: "#0A84FF",
        alignItems: "center",
        justifyContent: "center",
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitButtonText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "800",
    },
});
