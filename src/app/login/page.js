"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
    const router = useRouter();
    const [isRegister, setIsRegister] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // If already logged in, skip straight to home
    useEffect(() => {
        if (typeof window !== "undefined" && localStorage.getItem("userId")) {
            router.replace("/");
        }
    }, [router]);

    const handle = async () => {
        setError("");
        if (!email.trim()) return setError("Email is required.");
        if (isRegister && !name.trim()) return setError("Name is required.");
        setLoading(true);

        try {
            let result;
            if (isRegister) {
                // Register with Supabase
                result = await supabase.auth.signUp({
                    email,
                    password: "no-auth-required", // Placeholder since current logic is email-only
                    options: { data: { name } }
                });
            } else {
                // Login with Supabase
                result = await supabase.auth.signInWithPassword({
                    email,
                    password: "no-auth-required"
                });
            }

            if (result.error) {
                return setError(result.error.message);
            }

            const { user } = result.data;
            if (!user) throw new Error("No user returned");

            // Sync with backend if register
            if (isRegister) {
                await fetch(`http://localhost:5000/auth/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, id: user.id }),
                });
            }

            localStorage.setItem("userId", user.id);
            localStorage.setItem("userName", name || user.user_metadata?.name || email);
            
            // Check metrics via backend
            try {
                const metricsReq = await fetch(`http://localhost:5000/metrics?userId=${user.id}`);
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
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
                background: "var(--bg-base, #07070f)",
            }}
        >
            {/* Logo / title */}
            <div style={{ marginBottom: "40px", textAlign: "center" }}>
                <div
                    style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "36px",
                        fontWeight: 900,
                        letterSpacing: "-1.5px",
                        background: "linear-gradient(135deg, #0A84FF, #BF5AF2)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    APEX
                </div>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", marginTop: "4px", fontWeight: 500 }}>
                    {isRegister ? "Create your account" : "Welcome back"}
                </div>
            </div>

            {/* Card */}
            <div
                style={{
                    width: "100%",
                    maxWidth: "360px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: "20px",
                    padding: "28px 24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                }}
            >
                {isRegister && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                            Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            style={inputStyle}
                        />
                    </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                        Email
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        onKeyDown={(e) => e.key === "Enter" && handle()}
                        style={inputStyle}
                    />
                </div>

                {error && (
                    <div style={{ fontSize: "12px", color: "#FF2D55", fontWeight: 600, padding: "8px 12px", background: "rgba(255,45,85,0.1)", borderRadius: "8px" }}>
                        {error}
                    </div>
                )}

                <button
                    onClick={handle}
                    disabled={loading}
                    style={{
                        marginTop: "4px",
                        padding: "14px",
                        borderRadius: "14px",
                        background: "linear-gradient(135deg, #0A84FF, #BF5AF2)",
                        border: "none",
                        color: "#fff",
                        fontFamily: "var(--font-display)",
                        fontSize: "15px",
                        fontWeight: 800,
                        cursor: loading ? "wait" : "pointer",
                        opacity: loading ? 0.7 : 1,
                        transition: "opacity 0.2s",
                    }}
                >
                    {loading ? "Please wait..." : isRegister ? "Create Account" : "Log In"}
                </button>
            </div>

            {/* Toggle */}
            <button
                onClick={() => { setIsRegister(!isRegister); setError(""); }}
                style={{
                    marginTop: "20px",
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.35)",
                    fontSize: "13px",
                    cursor: "pointer",
                    fontWeight: 500,
                }}
            >
                {isRegister ? "Already have an account? Log in" : "No account? Register"}
            </button>
        </div>
    );
}

const inputStyle = {
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(0,0,0,0.4)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 500,
    outline: "none",
    width: "100%",
    fontFamily: "var(--font-display)",
};