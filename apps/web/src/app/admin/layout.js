"use client";
import AdminGuard from "../../components/admin/AdminGuard";
import Sidebar from "../../components/admin/Sidebar";
import { usePathname } from "next/navigation";

/**
 * Admin layout — wraps all /admin/* pages with:
 * - AdminGuard (redirects to /admin/login if no token)
 * - Sidebar navigation (hidden on the login page)
 */
export default function AdminLayout({ children }) {
    const pathname = usePathname();
    const isLoginPage = pathname === "/admin/login";

    if (isLoginPage) {
        return (
            <AdminGuard>
                <div style={{ minHeight: "100vh", background: "var(--admin-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {children}
                </div>
            </AdminGuard>
        );
    }

    return (
        <AdminGuard>
            <div style={{ display: "flex", minHeight: "100vh", background: "var(--admin-bg)" }}>
                <Sidebar />
                <main style={{ flex: 1, padding: "32px 36px", overflowY: "auto", maxHeight: "100vh" }}>
                    {children}
                </main>
            </div>
        </AdminGuard>
    );
}
