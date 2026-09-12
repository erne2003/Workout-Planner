"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
    { href: "/admin",        label: "Overview",   icon: "⬡" },
    { href: "/admin/users",  label: "Users",      icon: "◎" },
    { href: "/admin/deleted-accounts", label: "Deleted Accounts", icon: "⌫" },
    { href: "/admin/errors", label: "Error Log",  icon: "⚠" },
];

/**
 * Sidebar — the left navigation for the admin dashboard.
 * Highlights the active route and provides a logout button.
 */
export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    function handleLogout() {
        localStorage.removeItem("adminToken");
        router.replace("/admin/login");
    }

    return (
        <aside style={{
            width: 220,
            minHeight: "100vh",
            background: "var(--admin-sidebar)",
            borderRight: "1px solid var(--admin-border)",
            display: "flex",
            flexDirection: "column",
            padding: "28px 16px",
            gap: 4,
            flexShrink: 0,
        }}>
            {/* Logo / App name */}
            <div style={{
                padding: "0 10px 24px",
                borderBottom: "1px solid var(--admin-border)",
                marginBottom: 12,
            }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-blue)", letterSpacing: "-0.5px" }}>
                    APEX
                </div>
                <div style={{ fontSize: 10, color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "2px", marginTop: 2 }}>
                    Admin Console
                </div>
            </div>

            {/* Nav items */}
            {NAV_ITEMS.map(({ href, label, icon }) => {
                const isActive = pathname === href || (href !== "/admin" && pathname.startsWith(href));
                return (
                    <Link
                        key={href}
                        href={href}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            borderRadius: 10,
                            textDecoration: "none",
                            fontSize: 14,
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? "var(--admin-text)" : "var(--admin-text-muted)",
                            background: isActive ? "var(--admin-active)" : "transparent",
                            transition: "background 0.15s, color 0.15s",
                        }}
                    >
                        <span style={{ fontSize: 16 }}>{icon}</span>
                        {label}
                    </Link>
                );
            })}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Logout */}
            <button
                onClick={handleLogout}
                style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 10,
                    border: "1px solid var(--admin-border)",
                    background: "transparent", cursor: "pointer",
                    fontSize: 14, color: "var(--admin-text-muted)",
                    width: "100%", textAlign: "left",
                }}
            >
                <span>⎋</span> Sign out
            </button>
        </aside>
    );
}
