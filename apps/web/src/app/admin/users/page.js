"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import StatusBadge from "../../../components/admin/StatusBadge";
import ConfirmModal from "../../../components/admin/ConfirmModal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const POLL_INTERVAL = 30_000;

function adminFetch(path, options = {}) {
    const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;
    return fetch(`${API}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...options.headers,
        },
    });
}

function formatDate(d) {
    if (!d) return "Never";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState("");
    const [error, setError] = useState("");
    const [lastRefresh, setLastRefresh] = useState(null);
    const [actionUser, setActionUser] = useState(null); // { user, action }
    const [disableReason, setDisableReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState("");
    const [toast, setToast] = useState("");

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(""), 3000);
    };

    const fetchUsers = useCallback(async () => {
        try {
            const res = await adminFetch("/admin/users");
            if (res.status === 401) { localStorage.removeItem("adminToken"); window.location.href = "/admin/login"; return; }
            const data = await res.json();
            if (!res.ok) { setError(data.error || "Failed to load users"); return; }
            setUsers(data);
            setLastRefresh(new Date());
        } catch { setError("Cannot reach server"); }
    }, []);

    useEffect(() => {
        fetchUsers();
        const interval = setInterval(fetchUsers, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchUsers]);

    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    async function executeAction() {
        if (!actionUser) return;
        const { user, action } = actionUser;
        setActionLoading(true);
        setActionError("");

        try {
            let res;
            if (action === "force-logout") {
                res = await adminFetch(`/admin/users/${user.id}/force-logout`, { method: "POST" });
            } else if (action === "disable") {
                res = await adminFetch(`/admin/users/${user.id}/disable`, {
                    method: "PATCH",
                    body: JSON.stringify({ reason: disableReason }),
                });
            } else if (action === "enable") {
                res = await adminFetch(`/admin/users/${user.id}/enable`, { method: "PATCH" });
            } else if (action === "delete") {
                res = await adminFetch(`/admin/users/${user.id}`, { method: "DELETE" });
            }

            const data = await res.json();
            if (!res.ok) { setActionError(data.error || "Action failed"); return; }

            showToast(data.message || "Done");
            setActionUser(null);
            setDisableReason("");
            fetchUsers();
        } catch { setActionError("Request failed"); }
        finally { setActionLoading(false); }
    }

    const modalConfig = {
        "force-logout": {
            title: "Force Logout User?",
            message: `This will immediately invalidate all sessions for ${actionUser?.user.name}. They will need to log in again.`,
            confirmLabel: "Force Logout",
            danger: false,
        },
        disable: {
            title: "Disable Account?",
            message: `${actionUser?.user.name} will be locked out immediately and cannot log in until re-enabled.`,
            confirmLabel: "Disable",
            danger: true,
        },
        enable: {
            title: "Re-enable Account?",
            message: `${actionUser?.user.name} will be able to log in again.`,
            confirmLabel: "Enable",
            danger: false,
        },
        delete: {
            title: "Permanently Delete Account?",
            message: `This will delete ${actionUser?.user.name}'s account and ALL associated data (workouts, PRs, routines, metrics). This cannot be undone.`,
            confirmLabel: "Delete Forever",
            danger: true,
        },
    };

    const modal = actionUser ? modalConfig[actionUser.action] : null;

    return (
        <div style={{ maxWidth: 1200 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--admin-text)", margin: 0, letterSpacing: "-0.5px" }}>
                        Users
                    </h1>
                    <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 4 }}>
                        {lastRefresh ? `${users.length} users · Updated ${lastRefresh.toLocaleTimeString()}` : "Loading…"}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name or email…"
                        style={{
                            padding: "9px 14px", borderRadius: 10,
                            border: "1px solid var(--admin-border)",
                            background: "var(--admin-surface)", color: "var(--admin-text)",
                            fontSize: 13, width: 260, outline: "none",
                        }}
                    />
                    <button
                        onClick={fetchUsers}
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

            {/* Table */}
            <div style={{ background: "var(--admin-card)", border: "1px solid var(--admin-border)", borderRadius: 16, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                        <tr style={{ borderBottom: "1px solid var(--admin-border)" }}>
                            {["Name", "Email", "Status", "Workouts", "Last Active", "Joined", "Actions"].map(h => (
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
                        {filtered.map((user, i) => (
                            <tr key={user.id} style={{
                                borderBottom: i < filtered.length - 1 ? "1px solid var(--admin-border)" : "none",
                                transition: "background 0.1s",
                            }}
                                onMouseEnter={e => e.currentTarget.style.background = "var(--admin-row-hover)"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >
                                <td style={{ padding: "12px 16px", fontWeight: 500, color: "var(--admin-text)" }}>
                                    <Link href={`/admin/users/${user.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                                        {user.name}
                                    </Link>
                                </td>
                                <td style={{ padding: "12px 16px", color: "var(--admin-text-muted)" }}>{user.email}</td>
                                <td style={{ padding: "12px 16px" }}><StatusBadge disabled={user.is_disabled} /></td>
                                <td style={{ padding: "12px 16px", color: "var(--admin-text-muted)" }}>{user.workout_count}</td>
                                <td style={{ padding: "12px 16px", color: "var(--admin-text-muted)" }}>{formatDate(user.last_active)}</td>
                                <td style={{ padding: "12px 16px", color: "var(--admin-text-muted)" }}>{formatDate(user.created_at)}</td>
                                <td style={{ padding: "12px 16px" }}>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <ActionBtn label="⎋ Logout"   color="var(--accent-blue)"   onClick={() => setActionUser({ user, action: "force-logout" })} />
                                        {user.is_disabled
                                            ? <ActionBtn label="✓ Enable"  color="var(--accent-green)"  onClick={() => setActionUser({ user, action: "enable" })} />
                                            : <ActionBtn label="⊘ Disable" color="var(--accent-orange)" onClick={() => setActionUser({ user, action: "disable" })} />
                                        }
                                        <ActionBtn label="🗑 Delete"  color="var(--accent-red)"    onClick={() => setActionUser({ user, action: "delete" })} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={7} style={{ padding: "32px 16px", textAlign: "center", color: "var(--admin-text-muted)" }}>
                                    {search ? "No users match your search." : "No users yet."}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Confirm modal */}
            {modal && (
                <ConfirmModal
                    isOpen={!!actionUser}
                    onClose={() => { setActionUser(null); setActionError(""); setDisableReason(""); }}
                    onConfirm={executeAction}
                    title={modal.title}
                    message={modal.message}
                    confirmLabel={actionLoading ? "…" : modal.confirmLabel}
                    danger={modal.danger}
                >
                    {actionUser?.action === "disable" && (
                        <input
                            value={disableReason}
                            onChange={(e) => setDisableReason(e.target.value)}
                            placeholder="Reason (optional)"
                            maxLength={500}
                            style={{
                                width: "100%", padding: "10px 12px", borderRadius: 8,
                                border: "1px solid var(--admin-border)",
                                background: "var(--admin-surface)", color: "var(--admin-text)",
                                fontSize: 13, outline: "none",
                            }}
                        />
                    )}
                    {actionError && (
                        <div style={{ marginTop: 8, color: "var(--accent-red)", fontSize: 13 }}>{actionError}</div>
                    )}
                </ConfirmModal>
            )}

            {/* Toast */}
            {toast && (
                <div style={{
                    position: "fixed", bottom: 24, right: 24, zIndex: 2000,
                    padding: "12px 20px", borderRadius: 10,
                    background: "var(--accent-green)", color: "#fff",
                    fontSize: 14, fontWeight: 600,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                }}>
                    ✓ {toast}
                </div>
            )}
        </div>
    );
}

function ActionBtn({ label, color, onClick }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: "5px 10px", borderRadius: 7, border: `1px solid ${color}22`,
                background: `${color}15`, color, cursor: "pointer",
                fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
            }}
        >
            {label}
        </button>
    );
}
