"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import StatusBadge from "../../../../components/admin/StatusBadge";
import ConfirmModal from "../../../../components/admin/ConfirmModal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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
    return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function UserDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [modal, setModal] = useState(null); // 'force-logout' | 'disable' | 'enable' | 'delete'
    const [disableReason, setDisableReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState("");
    const [toast, setToast] = useState("");

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

    const fetchDetail = useCallback(async () => {
        try {
            const res = await adminFetch(`/admin/users/${id}`);
            if (res.status === 401) { localStorage.removeItem("adminToken"); window.location.href = "/admin/login"; return; }
            if (res.status === 404) { setError("User not found"); return; }
            const json = await res.json();
            if (!res.ok) { setError(json.error || "Failed to load user"); return; }
            setData(json);
        } catch { setError("Cannot reach server"); }
    }, [id]);

    useEffect(() => { fetchDetail(); }, [fetchDetail]);

    async function executeAction() {
        setActionLoading(true);
        setActionError("");
        try {
            let res;
            if (modal === "force-logout") {
                res = await adminFetch(`/admin/users/${id}/force-logout`, { method: "POST" });
            } else if (modal === "disable") {
                res = await adminFetch(`/admin/users/${id}/disable`, { method: "PATCH", body: JSON.stringify({ reason: disableReason }) });
            } else if (modal === "enable") {
                res = await adminFetch(`/admin/users/${id}/enable`, { method: "PATCH" });
            } else if (modal === "delete") {
                res = await adminFetch(`/admin/users/${id}`, { method: "DELETE" });
            }

            const json = await res.json();
            if (!res.ok) { setActionError(json.error || "Action failed"); return; }

            if (modal === "delete") { router.replace("/admin/users"); return; }
            showToast(json.message || "Done");
            setModal(null);
            setDisableReason("");
            fetchDetail();
        } catch { setActionError("Request failed"); }
        finally { setActionLoading(false); }
    }

    if (error) {
        return (
            <div style={{ color: "var(--accent-red)", padding: 24 }}>
                {error} — <Link href="/admin/users" style={{ color: "var(--accent-blue)" }}>Back to users</Link>
            </div>
        );
    }

    if (!data) {
        return <div style={{ color: "var(--admin-text-muted)", padding: 24 }}>Loading…</div>;
    }

    const { user, stats, sessions } = data;

    const modalConfigs = {
        "force-logout": { title: "Force Logout?", message: `Invalidates all sessions for ${user.name}. They must log in again.`, confirmLabel: "Force Logout", danger: false },
        disable: { title: "Disable Account?", message: `${user.name} will be immediately locked out.`, confirmLabel: "Disable", danger: true },
        enable: { title: "Re-enable Account?", message: `${user.name} will be able to log in again.`, confirmLabel: "Enable", danger: false },
        delete: { title: "Permanently Delete?", message: `This deletes ${user.name}'s account and ALL data. Cannot be undone.`, confirmLabel: "Delete Forever", danger: true },
    };

    return (
        <div style={{ maxWidth: 900 }}>
            {/* Back */}
            <Link href="/admin/users" style={{ color: "var(--admin-text-muted)", fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
                ← Back to Users
            </Link>

            {/* User header card */}
            <div style={{
                background: "var(--admin-card)", border: "1px solid var(--admin-border)",
                borderRadius: 16, padding: "24px 28px", marginBottom: 20,
                display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20,
            }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--admin-text)", margin: 0 }}>{user.name}</h1>
                        <StatusBadge disabled={user.is_disabled} />
                    </div>
                    <div style={{ color: "var(--admin-text-muted)", fontSize: 14, marginBottom: 4 }}>{user.email}</div>
                    <div style={{ color: "var(--admin-text-muted)", fontSize: 12 }}>Joined {formatDate(user.created_at)}</div>
                    {user.disabled_reason && (
                        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(255,45,85,0.1)", color: "var(--accent-red)", fontSize: 13 }}>
                            Reason: {user.disabled_reason}
                        </div>
                    )}
                </div>

                {/* Action panel */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 160 }}>
                    <ActionButton label="⎋ Force Logout" color="var(--accent-blue)" onClick={() => setModal("force-logout")} />
                    {user.is_disabled
                        ? <ActionButton label="✓ Re-enable" color="var(--accent-green)" onClick={() => setModal("enable")} />
                        : <ActionButton label="⊘ Disable" color="var(--accent-orange)" onClick={() => setModal("disable")} />
                    }
                    <ActionButton label="🗑 Delete Account" color="var(--accent-red)" onClick={() => setModal("delete")} />
                </div>
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
                {[
                    { label: "Workouts", value: stats.workout_count },
                    { label: "PRs", value: stats.pr_count },
                    { label: "Metric Entries", value: stats.metrics_count },
                ].map(s => (
                    <div key={s.label} style={{
                        flex: 1, background: "var(--admin-card)", border: "1px solid var(--admin-border)",
                        borderRadius: 12, padding: "16px 20px",
                    }}>
                        <div style={{ fontSize: 10, color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>{s.label}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "var(--admin-text)" }}>{s.value ?? 0}</div>
                    </div>
                ))}
            </div>

            {/* Sessions */}
            <div style={{ background: "var(--admin-card)", border: "1px solid var(--admin-border)", borderRadius: 16, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--admin-border)", fontWeight: 600, fontSize: 14, color: "var(--admin-text)" }}>
                    Active Sessions
                </div>
                {sessions.length === 0 ? (
                    <div style={{ padding: "20px", color: "var(--admin-text-muted)", fontSize: 13 }}>No sessions on record.</div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--admin-border)" }}>
                                {["Family ID", "Tokens", "Last Issued", "Expires", "Status"].map(h => (
                                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map((s, i) => (
                                <tr key={s.family_id} style={{ borderBottom: i < sessions.length - 1 ? "1px solid var(--admin-border)" : "none" }}>
                                    <td style={{ padding: "10px 16px", color: "var(--admin-text-muted)", fontFamily: "monospace", fontSize: 12 }}>{s.family_id.slice(0, 12)}…</td>
                                    <td style={{ padding: "10px 16px", color: "var(--admin-text-muted)" }}>{s.token_count}</td>
                                    <td style={{ padding: "10px 16px", color: "var(--admin-text-muted)" }}>{formatDate(s.last_issued)}</td>
                                    <td style={{ padding: "10px 16px", color: "var(--admin-text-muted)" }}>{formatDate(s.expires_at)}</td>
                                    <td style={{ padding: "10px 16px" }}>
                                        <span style={{
                                            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                                            background: s.any_revoked ? "rgba(255,45,85,0.15)" : "rgba(48,209,88,0.15)",
                                            color: s.any_revoked ? "var(--accent-red)" : "var(--accent-green)",
                                        }}>
                                            {s.any_revoked ? "Revoked" : "Active"}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {modal && (
                <ConfirmModal
                    isOpen={!!modal}
                    onClose={() => { setModal(null); setActionError(""); setDisableReason(""); }}
                    onConfirm={executeAction}
                    title={modalConfigs[modal].title}
                    message={modalConfigs[modal].message}
                    confirmLabel={actionLoading ? "…" : modalConfigs[modal].confirmLabel}
                    danger={modalConfigs[modal].danger}
                >
                    {modal === "disable" && (
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
                    {actionError && <div style={{ marginTop: 8, color: "var(--accent-red)", fontSize: 13 }}>{actionError}</div>}
                </ConfirmModal>
            )}

            {/* Toast */}
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

function ActionButton({ label, color, onClick }) {
    return (
        <button
            onClick={onClick}
            style={{
                width: "100%", padding: "9px 14px", borderRadius: 9,
                border: `1px solid ${color}33`, background: `${color}15`,
                color, cursor: "pointer", fontSize: 13, fontWeight: 600, textAlign: "left",
            }}
        >
            {label}
        </button>
    );
}
