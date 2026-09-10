"use client";
import { useState, useEffect, useCallback } from "react";
import ConfirmModal from "../../../components/admin/ConfirmModal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const POLL_INTERVAL = 30_000;

const LEVEL_CONFIG = {
    error: { color: "var(--accent-red)",    bg: "rgba(255,45,85,0.15)",   label: "Error" },
    warn:  { color: "var(--accent-orange)", bg: "rgba(255,159,10,0.15)",  label: "Warn"  },
    info:  { color: "var(--accent-blue)",   bg: "rgba(10,132,255,0.15)",  label: "Info"  },
};

function adminFetch(path, options = {}) {
    const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;
    return fetch(`${API}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
    });
}

function formatDate(d) {
    return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function ErrorsPage() {
    const [entries, setEntries] = useState([]);
    const [levelFilter, setLevelFilter] = useState("all");
    const [error, setError] = useState("");
    const [lastRefresh, setLastRefresh] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [clearModal, setClearModal] = useState(false);
    const [clearLoading, setClearLoading] = useState(false);
    const [toast, setToast] = useState("");

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

    const fetchEntries = useCallback(async () => {
        try {
            const params = levelFilter !== "all" ? `?kind=log&level=${levelFilter}` : "?kind=log";
            const res = await adminFetch(`/admin/info${params}`);
            if (res.status === 401) { localStorage.removeItem("adminToken"); window.location.href = "/admin/login"; return; }
            const data = await res.json();
            if (!res.ok) { setError(data.error || "Failed to load entries"); return; }
            setEntries(data);
            setLastRefresh(new Date());
        } catch { setError("Cannot reach server"); }
    }, [levelFilter]);

    useEffect(() => {
        fetchEntries();
        const interval = setInterval(fetchEntries, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchEntries]);

    async function handleClearAll() {
        setClearLoading(true);
        try {
            const res = await adminFetch("/admin/info?kind=log", { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) return;
            setClearModal(false);
            showToast("Log cleared");
            fetchEntries();
        } catch { /* silent */ }
        finally { setClearLoading(false); }
    }

    const TABS = ["all", "error", "warn", "info"];

    return (
        <div style={{ maxWidth: 1100 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--admin-text)", margin: 0, letterSpacing: "-0.5px" }}>Error Log</h1>
                    <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 4 }}>
                        {lastRefresh ? `${entries.length} entries · Updated ${lastRefresh.toLocaleTimeString()}` : "Loading…"}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button
                        onClick={fetchEntries}
                        style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid var(--admin-border)", background: "transparent", color: "var(--admin-text-muted)", cursor: "pointer", fontSize: 13 }}
                    >
                        ↻ Refresh
                    </button>
                    <button
                        onClick={() => setClearModal(true)}
                        disabled={entries.length === 0}
                        style={{
                            padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(255,45,85,0.3)",
                            background: "rgba(255,45,85,0.1)", color: "var(--accent-red)",
                            cursor: entries.length === 0 ? "not-allowed" : "pointer",
                            fontSize: 13, fontWeight: 600, opacity: entries.length === 0 ? 0.5 : 1,
                        }}
                    >
                        Clear All
                    </button>
                </div>
            </div>

            {/* Level filter tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {TABS.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setLevelFilter(tab)}
                        style={{
                            padding: "7px 16px", borderRadius: 8,
                            border: "1px solid var(--admin-border)",
                            background: levelFilter === tab ? "var(--admin-active)" : "transparent",
                            color: levelFilter === tab ? "var(--admin-text)" : "var(--admin-text-muted)",
                            cursor: "pointer", fontSize: 13, fontWeight: levelFilter === tab ? 600 : 400,
                            textTransform: "capitalize",
                        }}
                    >
                        {tab === "all" ? "All" : (
                            <span>
                                <span style={{ color: LEVEL_CONFIG[tab]?.color }}>{LEVEL_CONFIG[tab]?.label}</span>
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {error && (
                <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 20, background: "rgba(255,45,85,0.1)", color: "var(--accent-red)", fontSize: 13 }}>
                    {error}
                </div>
            )}

            {/* Log table */}
            <div style={{ background: "var(--admin-card)", border: "1px solid var(--admin-border)", borderRadius: 16, overflow: "hidden" }}>
                {entries.length === 0 ? (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--admin-text-muted)", fontSize: 14 }}>
                        {levelFilter !== "all" ? `No ${levelFilter} entries.` : "No log entries. The system is clean ✓"}
                    </div>
                ) : (
                    entries.map((entry, i) => {
                        const cfg = LEVEL_CONFIG[entry.level] || LEVEL_CONFIG.info;
                        const isExpanded = expandedId === entry.id;

                        return (
                            <div
                                key={entry.id}
                                style={{
                                    borderBottom: i < entries.length - 1 ? "1px solid var(--admin-border)" : "none",
                                    padding: "14px 20px",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                    {/* Level badge */}
                                    <span style={{
                                        flexShrink: 0, padding: "2px 9px", borderRadius: 999,
                                        fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color,
                                        marginTop: 1,
                                    }}>
                                        {cfg.label}
                                    </span>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {/* Message — plain text only, no dangerouslySetInnerHTML */}
                                        <div style={{ color: "var(--admin-text)", fontSize: 13, fontWeight: 500, marginBottom: 4, wordBreak: "break-word" }}>
                                            {entry.message}
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>
                                            {formatDate(entry.created_at)}
                                        </div>

                                        {/* Context expansion */}
                                        {entry.context && (
                                            <>
                                                <button
                                                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                                                    style={{
                                                        marginTop: 6, padding: "3px 8px", borderRadius: 6,
                                                        border: "1px solid var(--admin-border)",
                                                        background: "transparent", color: "var(--admin-text-muted)",
                                                        cursor: "pointer", fontSize: 11,
                                                    }}
                                                >
                                                    {isExpanded ? "Hide context ▲" : "Show context ▼"}
                                                </button>
                                                {isExpanded && (
                                                    <pre style={{
                                                        marginTop: 8, padding: "12px 14px", borderRadius: 8,
                                                        background: "var(--admin-surface)",
                                                        border: "1px solid var(--admin-border)",
                                                        fontSize: 11, color: "var(--admin-text-muted)",
                                                        overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
                                                    }}>
                                                        {JSON.stringify(entry.context, null, 2)}
                                                    </pre>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Clear All modal */}
            <ConfirmModal
                isOpen={clearModal}
                onClose={() => setClearModal(false)}
                onConfirm={handleClearAll}
                title="Clear All Log Entries?"
                message="This permanently removes all entries from the error log. This cannot be undone."
                confirmLabel={clearLoading ? "Clearing…" : "Clear All"}
                danger
            />

            {toast && (
                <div style={{
                    position: "fixed", bottom: 24, right: 24, zIndex: 2000,
                    padding: "12px 20px", borderRadius: 10, background: "var(--accent-green)", color: "#fff",
                    fontSize: 14, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                }}>
                    ✓ {toast}
                </div>
            )}
        </div>
    );
}
