"use client";
import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const POLL_INTERVAL = 30_000;

function formatDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatHeld(seconds) {
    if (seconds == null) return "—";
    const days = Math.floor(seconds / 86400);
    if (days < 1) return "< 1 day";
    if (days < 30) return `${days} day${days === 1 ? "" : "s"}`;
    if (days < 365) {
        const months = Math.floor(days / 30);
        return `${months} month${months === 1 ? "" : "s"}`;
    }
    const years = Math.floor(days / 365);
    const remMonths = Math.floor((days % 365) / 30);
    return remMonths > 0
        ? `${years} year${years === 1 ? "" : "s"}, ${remMonths} month${remMonths === 1 ? "" : "s"}`
        : `${years} year${years === 1 ? "" : "s"}`;
}

function adminFetch(path, options = {}) {
    const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;
    return fetch(`${API}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
    });
}

export default function DeletedAccountsPage() {
    const [accounts, setAccounts] = useState([]);
    const [search, setSearch] = useState("");
    const [error, setError] = useState("");
    const [lastRefresh, setLastRefresh] = useState(null);

    const fetchAccounts = useCallback(async () => {
        try {
            const res = await adminFetch("/admin/deleted-accounts");
            if (res.status === 401) { localStorage.removeItem("adminToken"); window.location.href = "/admin/login"; return; }
            const data = await res.json();
            if (!res.ok) { setError(data.error || "Failed to load deleted accounts"); return; }
            setError("");
            setAccounts(Array.isArray(data) ? data : []);
            setLastRefresh(new Date());
        } catch { setError("Cannot reach server"); }
    }, []);

    useEffect(() => {
        fetchAccounts();
        const interval = setInterval(fetchAccounts, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchAccounts]);

    const filtered = accounts.filter(a => (a.name || "").toLowerCase().includes(search.toLowerCase()));

    return (
        <div style={{ maxWidth: 1000 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--admin-text)", margin: 0, letterSpacing: "-0.5px" }}>
                        Deleted Accounts
                    </h1>
                    <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 4 }}>
                        {lastRefresh ? `${accounts.length} deleted · Updated ${lastRefresh.toLocaleTimeString()}` : "Loading…"}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name…"
                        style={{
                            padding: "9px 14px", borderRadius: 10,
                            border: "1px solid var(--admin-border)",
                            background: "var(--admin-surface)", color: "var(--admin-text)",
                            fontSize: 13, width: 220, outline: "none",
                        }}
                    />
                    <button
                        onClick={fetchAccounts}
                        style={{
                            padding: "9px 16px", borderRadius: 10,
                            border: "1px solid var(--admin-border)",
                            background: "transparent", color: "var(--admin-text-muted)",
                            cursor: "pointer", fontSize: 13,
                        }}
                    >
                        ↻
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 20, background: "rgba(255,45,85,0.1)", color: "var(--accent-red)", fontSize: 13 }}>
                    {error}
                </div>
            )}

            <div style={{ background: "var(--admin-card)", border: "1px solid var(--admin-border)", borderRadius: 16, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                        <tr style={{ borderBottom: "1px solid var(--admin-border)" }}>
                            {["Name", "Held For", "Deleted On"].map(h => (
                                <th key={h} style={{
                                    padding: "12px 16px", textAlign: "left",
                                    fontSize: 11, fontWeight: 600, color: "var(--admin-text-muted)",
                                    textTransform: "uppercase", letterSpacing: "1px",
                                }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((a, i) => (
                            <tr key={`${a.name}-${a.deleted_at}-${i}`} style={{
                                borderBottom: i < filtered.length - 1 ? "1px solid var(--admin-border)" : "none",
                            }}>
                                <td style={{ padding: "12px 16px", fontWeight: 500, color: "var(--admin-text)" }}>{a.name}</td>
                                <td style={{ padding: "12px 16px", color: "var(--admin-text-muted)" }}>{formatHeld(a.held_seconds)}</td>
                                <td style={{ padding: "12px 16px", color: "var(--admin-text-muted)" }}>{formatDate(a.deleted_at)}</td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={3} style={{ padding: "32px 16px", textAlign: "center", color: "var(--admin-text-muted)" }}>
                                    {search ? "No deleted accounts match your search." : "No accounts have been deleted."}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
