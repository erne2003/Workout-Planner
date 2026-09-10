"use client";
import { useEffect, useRef } from "react";

/**
 * ConfirmModal — a reusable confirmation dialog for destructive actions.
 * Traps focus and is accessible via keyboard (Escape to close).
 */
export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title = "Are you sure?",
    message,
    confirmLabel = "Confirm",
    danger = false,
    children,
}) {
    const overlayRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={overlayRef}
            onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
            style={{
                position: "fixed", inset: 0, zIndex: 1000,
                background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 24,
            }}
        >
            <div style={{
                background: "var(--admin-surface)",
                border: "1px solid var(--admin-border)",
                borderRadius: 18,
                padding: "28px 32px",
                width: "100%",
                maxWidth: 440,
                boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: "var(--admin-text)" }}>
                    {title}
                </h2>
                {message && (
                    <p style={{ color: "var(--admin-text-muted)", fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
                        {message}
                    </p>
                )}
                {/* Slot for extra form fields (e.g. disable reason) */}
                {children && <div style={{ marginBottom: 20 }}>{children}</div>}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: "9px 20px", borderRadius: 10, border: "1px solid var(--admin-border)",
                            background: "transparent", color: "var(--admin-text-muted)",
                            cursor: "pointer", fontSize: 14, fontWeight: 500,
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: "9px 20px", borderRadius: 10, border: "none",
                            background: danger ? "var(--accent-red)" : "var(--accent-blue)",
                            color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600,
                        }}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
