"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import StatCard from "../../components/admin/StatCard";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const POLL_INTERVAL = 60_000; // 60s for overview

function adminFetch(path) {
    const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;
    return fetch(`${API}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
}

export default function AdminOverviewPage() {
    const [stats, setStats] = useState(null);
    const [error, setError] = useState("");
    const [lastRefresh, setLastRefresh] = useState(null);

    const fetchStats = useCallback(async () => {
        try {
            const res = await adminFetch("/admin/stats");
            if (res.status === 401) {
                localStorage.removeItem("adminToken");
                window.location.href = "/admin/login";
                return;
            }
            const data = await res.json();
            if (!res.ok) { setError(data.error || "Failed to load stats"); return; }
            setStats(data);
            setLastRefresh(new Date());
        } catch {
            setError("Cannot reach server");
        }
    }, []);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchStats]);

    const hasErrors = stats && parseInt(stats.error_count, 10) > 0;

    return (
        <div style={{ maxWidth: 1100 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--admin-text)", letterSpacing: "-0.5px", margin: 0 }}>
                        Overview
                    </h1>
                    <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 4 }}>
                        {lastRefresh ? `Last updated ${lastRefresh.toLocaleTimeString()}` : "Loading…"}
                    </div>
                </div>
                <button
                    onClick={fetchStats}
                    style={{
                        padding: "9px 18px", borderRadius: 10,
                        border: "1px solid var(--admin-border)",
                        background: "transparent", color: "var(--admin-text-muted)",
                        cursor: "pointer", fontSize: 13,
                    }}
                >
                    ↻ Refresh
                </button>
            </div>

            {/* Error alert banner */}
            {hasErrors && (
                <Link href="/admin/errors" style={{ textDecoration: "none" }}>
                    <div style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "14px 20px", borderRadius: 12, marginBottom: 24,
                        background: "rgba(255,45,85,0.1)", border: "1px solid rgba(255,45,85,0.3)",
                        color: "var(--accent-red)", cursor: "pointer",
                    }}>
                        <span style={{ fontSize: 18 }}>⚠</span>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>
                            {stats.error_count} error{stats.error_count !== 1 ? "s" : ""} in the log — click to view
                        </span>
                    </div>
                </Link>
            )}

            {error && (
                <div style={{
                    padding: "12px 16px", borderRadius: 10, marginBottom: 24,
                    background: "rgba(255,45,85,0.1)", color: "var(--accent-red)", fontSize: 13,
                }}>
                    {error}
                </div>
            )}

            {/* KPI Cards */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 40 }}>
                <StatCard
                    label="Total Users"
                    value={stats ? parseInt(stats.total_users, 10).toLocaleString() : null}
                    color="var(--admin-text)"
                    icon="◎"
                />
                <StatCard
                    label="Active Today"
                    value={stats ? parseInt(stats.active_today, 10).toLocaleString() : null}
                    color="var(--accent-green)"
                    icon="✦"
                />
                <StatCard
                    label="New This Week"
                    value={stats ? parseInt(stats.new_this_week, 10).toLocaleString() : null}
                    color="var(--accent-blue)"
                    icon="↑"
                />
                <StatCard
                    label="Disabled Accounts"
                    value={stats ? parseInt(stats.disabled_users, 10).toLocaleString() : null}
                    color={stats && parseInt(stats.disabled_users, 10) > 0 ? "var(--accent-red)" : "var(--admin-text-muted)"}
                    icon="⊘"
                />
            </div>

            {/* Quick-nav cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 600 }}>
                <Link href="/admin/users" style={{ textDecoration: "none" }}>
                    <div style={{
                        padding: "20px 24px", borderRadius: 14,
                        background: "var(--admin-card)", border: "1px solid var(--admin-border)",
                        cursor: "pointer",
                    }}>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>◎</div>
                        <div style={{ fontWeight: 600, color: "var(--admin-text)", marginBottom: 4 }}>User Management</div>
                        <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>Force logout, disable, delete accounts</div>
                    </div>
                </Link>
                <Link href="/admin/errors" style={{ textDecoration: "none" }}>
                    <div style={{
                        padding: "20px 24px", borderRadius: 14,
                        background: "var(--admin-card)", border: "1px solid var(--admin-border)",
                        cursor: "pointer",
                    }}>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>⚠</div>
                        <div style={{ fontWeight: 600, color: "var(--admin-text)", marginBottom: 4 }}>Error Log</div>
                        <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>View and clear server error entries</div>
                    </div>
                </Link>
            </div>
        </div>
    );
}
