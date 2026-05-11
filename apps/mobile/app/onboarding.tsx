import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";

export default function OnboardingPage() {
    const router = useRouter();
    const [years, setYears] = useState("");
    const [weight, setWeight] = useState("");
    
    // Explicit Height Metrics constraints
    const [hUnit, setHUnit] = useState<"ft" | "cm">("ft");
    const [feet, setFeet] = useState("");
    const [inches, setInches] = useState("");
    const [cm, setCm] = useState("");
    
    const [bodyFat, setBodyFat] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);

        let finalHeight = "Not Selected";
        if (hUnit === "ft" && (feet || inches)) {
            finalHeight = `${feet || 0}'${inches || 0}"`;
        } else if (hUnit === "cm" && cm) {
            finalHeight = `${cm}cm`;
        }

        try {
            const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
            await fetch(`${apiUrl}/metrics`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${global.localStorage?.getItem("token")}`
                },
                body: JSON.stringify({
                    trainingYears: parseFloat(years) || 0,
                    weight: parseFloat(weight),
                    height: finalHeight,
                    bodyFat: bodyFat ? parseFloat(bodyFat) : null
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
        <View style={styles.container}>
            <View style={styles.card}>
                <View style={styles.headerContainer}>
                    <LinearGradient colors={["#0A84FF", "#BF5AF2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconContainer}>
                        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <Circle cx="12" cy="7" r="4" />
                        </Svg>
                    </LinearGradient>
                    <Text style={styles.title}>Complete Profile</Text>
                    <Text style={styles.subtitle}>Establish your physical baseline constraints.</Text>
                </View>

                <View style={styles.form}>
                    <View>
                        <Text style={styles.label}>Training Age (Years)</Text>
                        <TextInput 
                            keyboardType="numeric" 
                            placeholder="e.g. 2.5" 
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            value={years} 
                            onChangeText={setYears} 
                            style={styles.input} 
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={styles.flex1}>
                            <View style={styles.heightHeaderRow}>
                                <Text style={[styles.label, { marginBottom: 0 }]}>Height</Text>
                                <View style={styles.unitToggleGroup}>
                                    <TouchableOpacity onPress={() => setHUnit("ft")} style={[styles.unitToggleBtn, hUnit === "ft" && styles.unitToggleBtnActive]}>
                                        <Text style={[styles.unitToggleText, hUnit === "ft" && styles.unitToggleTextActive]}>FT / IN</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setHUnit("cm")} style={[styles.unitToggleBtn, hUnit === "cm" && styles.unitToggleBtnActive]}>
                                        <Text style={[styles.unitToggleText, hUnit === "cm" && styles.unitToggleTextActive]}>CM</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            
                            {hUnit === "ft" ? (
                                <View style={styles.rowSmallGap}>
                                    <View style={styles.flex1}>
                                        <TextInput keyboardType="numeric" placeholder="5" placeholderTextColor="rgba(255,255,255,0.3)" value={feet} onChangeText={setFeet} style={styles.input} />
                                        <Text style={styles.inputSuffixText}>ft</Text>
                                    </View>
                                    <View style={styles.flex1}>
                                        <TextInput keyboardType="numeric" placeholder="11" placeholderTextColor="rgba(255,255,255,0.3)" value={inches} onChangeText={setInches} style={styles.input} />
                                        <Text style={styles.inputSuffixText}>in</Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.flex1}>
                                    <TextInput keyboardType="numeric" placeholder="180" placeholderTextColor="rgba(255,255,255,0.3)" value={cm} onChangeText={setCm} style={styles.input} />
                                    <Text style={styles.inputSuffixText}>cm</Text>
                                </View>
                            )}
                        </View>
                        <View style={[styles.flex1, { marginLeft: 12 }]}>
                            <Text style={styles.label}>Weight (lbs)</Text>
                            <TextInput keyboardType="numeric" placeholder="e.g. 185" placeholderTextColor="rgba(255,255,255,0.3)" value={weight} onChangeText={setWeight} style={styles.input} />
                        </View>
                    </View>

                    <View>
                        <Text style={styles.label}>Body Fat % (Optional)</Text>
                        <TextInput keyboardType="numeric" placeholder="e.g. 14" placeholderTextColor="rgba(255,255,255,0.3)" value={bodyFat} onChangeText={setBodyFat} style={styles.input} />
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
        backgroundColor: "#07070F"
    },
    card: {
        width: "100%",
        maxWidth: 400,
        paddingVertical: 32,
        paddingHorizontal: 28,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.09)",
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
        color: "#fff",
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 13,
        color: "rgba(255,255,255,0.4)",
        textAlign: "center",
    },
    form: {
        gap: 16,
    },
    label: {
        fontSize: 11,
        fontWeight: "700",
        color: "rgba(255,255,255,0.4)",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 6,
    },
    input: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        backgroundColor: "rgba(0,0,0,0.5)",
        color: "#fff",
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
        backgroundColor: "rgba(0,0,0,0.4)",
        borderRadius: 6,
        padding: 2,
    },
    unitToggleBtn: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    unitToggleBtnActive: {
        backgroundColor: "rgba(255,255,255,0.15)",
    },
    unitToggleText: {
        fontSize: 9,
        fontWeight: "700",
        color: "rgba(255,255,255,0.3)",
    },
    unitToggleTextActive: {
        color: "#fff",
    },
    inputSuffixText: {
        position: "absolute",
        right: 12,
        top: 14,
        fontSize: 16,
        fontWeight: "700",
        color: "rgba(255,255,255,0.4)",
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
