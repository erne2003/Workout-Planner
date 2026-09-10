"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function AdminLoginPage() {
    const [secret, setSecret] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch(`${API}/admin/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ secret }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Login failed");
                return;
            }

            localStorage.setItem("adminToken", data.token);
            router.replace("/admin");
        } catch {
            setError("Could not reach the server. Is it running?");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{
            width: "100%", maxWidth: 400,
            background: "var(--admin-card)",
            border: "1px solid var(--admin-border)",
            borderRadius: 20,
            padding: "40px 36px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        }}>
            <div style={{ marginBottom: 32, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "var(--accent-blue)", letterSpacing: "-1px" }}>
                    APEX
                </div>
                <div style={{ fontSize: 13, color: "var(--admin-text-muted)", marginTop: 4 }}>
                    Admin Console
                </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--admin-text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "1px" }}>
                        Admin Secret
                    </label>
                    <input
                        type="password"
                        value={secret}
                        onChange={(e) => setSecret(e.target.value)}
                        placeholder="Enter admin secret"
                        required
                        autoFocus
                        style={{
                            width: "100%", padding: "12px 14px",
                            borderRadius: 10, border: "1px solid var(--admin-border)",
                            background: "var(--admin-surface)", color: "var(--admin-text)",
                            fontSize: 14, outline: "none",
                        }}
                    />
                </div>

                {error && (
                    <div style={{
                        padding: "10px 14px", borderRadius: 10,
                        background: "rgba(255,45,85,0.12)", border: "1px solid rgba(255,45,85,0.25)",
                        color: "var(--accent-red)", fontSize: 13,
                    }}>
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        padding: "12px", borderRadius: 10, border: "none",
                        background: "var(--accent-blue)", color: "#fff",
                        fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.7 : 1,
                    }}
                >
                    {loading ? "Signing in…" : "Sign in"}
                </button>
            </form>
        </div>
    );
}
