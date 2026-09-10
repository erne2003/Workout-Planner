"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * AdminGuard — reads adminToken from localStorage.
 * Redirects to /admin/login if no valid token is present.
 * Runs only on the client (localStorage is browser-only).
 */
export default function AdminGuard({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("adminToken");
        const isLoginPage = pathname === "/admin/login";

        if (!token && !isLoginPage) {
            router.replace("/admin/login");
        } else {
            setChecked(true);
        }
    }, [pathname, router]);

    if (!checked) {
        return (
            <div style={{ width: "100%", height: "100vh", background: "var(--admin-bg)" }} />
        );
    }

    return children;
}
