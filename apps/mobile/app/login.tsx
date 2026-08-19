import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../hooks/useTheme";
import { useData, getStorage, fetchWithTimeout } from "@apex/core";

export default function LoginPage() {
    const router = useRouter();
    const [isRegister, setIsRegister] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { colors, isLight } = useTheme();
    const { token, tokenLoading, login: doLogin, authFetch } = useData() as any;

    useEffect(() => {
        if (!tokenLoading && token) {
            router.replace("/");
        }
    }, [token, tokenLoading, router]);

    const handle = async () => {
        setError("");
        if (!email.trim()) return setError("Email is required.");
        if (isRegister && !name.trim()) return setError("Name is required.");
        setLoading(true);

        try {
            const endpoint = isRegister ? "/auth/register" : "/auth/login";
            const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
            const res = await fetchWithTimeout(`${apiUrl}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                return setError(data.error || "Authentication failed.");
            }

            const { accessToken, refreshToken, user } = data;
            if (!accessToken || !refreshToken) throw new Error("No tokens returned");

            await doLogin(accessToken, refreshToken, user);
            
            // Check metrics via backend (authFetch handles token attachment)
            try {
                const metricsReq = await authFetch(`${apiUrl}/metrics`);
                const metrics = await metricsReq.json();
                if (Array.isArray(metrics) && metrics.length === 0) {
                    router.replace("/onboarding");
                } else {
                    router.replace("/");
                }
            } catch {
                router.replace("/");
            }
        } catch (err) {
            console.error(err);
            setError("Authentication failed. Please check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.bgBase }]}>
            {/* Logo / title */}
            <View style={styles.titleContainer}>
                <Text style={styles.logo}>Virtus Fitness</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {isRegister ? "Create your account" : "Welcome back"}
                </Text>
            </View>

            {/* Card */}
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                {isRegister && (
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Your name"
                            placeholderTextColor={colors.textTertiary}
                            style={[styles.input, { backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", borderColor: colors.border, color: colors.textPrimary }]}
                        />
                    </View>
                )}

                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@example.com"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={[styles.input, { backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", borderColor: colors.border, color: colors.textPrimary }]}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="••••••••"
                        placeholderTextColor={colors.textTertiary}
                        secureTextEntry
                        style={[styles.input, { backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", borderColor: colors.border, color: colors.textPrimary }]}
                    />
                </View>

                {error ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                <TouchableOpacity
                    onPress={handle}
                    disabled={loading}
                    style={[styles.button, loading && styles.buttonDisabled]}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>
                            {isRegister ? "Create Account" : "Log In"}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Toggle */}
            <TouchableOpacity
                onPress={() => { setIsRegister(!isRegister); setError(""); }}
                style={styles.toggleButton}
            >
                <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
                    {isRegister ? "Already have an account? Log in" : "No account? Register"}
                </Text>
            </TouchableOpacity>
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
    titleContainer: {
        marginBottom: 40,
        alignItems: "center",
    },
    logo: {
        fontSize: 36,
        fontWeight: "900",
        letterSpacing: -1.5,
        color: "#0A84FF", 
    },
    subtitle: {
        fontSize: 13,
        marginTop: 4,
        fontWeight: "500",
    },
    card: {
        width: "100%",
        maxWidth: 360,
        borderWidth: 1,
        borderRadius: 20,
        paddingVertical: 28,
        paddingHorizontal: 24,
        gap: 14,
    },
    inputGroup: {
        gap: 6,
    },
    label: {
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.8,
    },
    input: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
        fontSize: 14,
        fontWeight: "500",
        width: "100%",
    },
    errorContainer: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: "rgba(255,45,85,0.1)",
        borderRadius: 8,
    },
    errorText: {
        fontSize: 12,
        color: "#FF2D55",
        fontWeight: "600",
    },
    button: {
        marginTop: 4,
        padding: 14,
        borderRadius: 14,
        backgroundColor: "#0A84FF",
        alignItems: "center",
        justifyContent: "center",
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "800",
    },
    toggleButton: {
        marginTop: 20,
        padding: 10,
    },
    toggleText: {
        fontSize: 13,
        fontWeight: "500",
    },
});
