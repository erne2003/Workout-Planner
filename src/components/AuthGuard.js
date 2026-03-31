"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function AuthGuard({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        const userId = localStorage.getItem("userId");
        if (!userId && pathname !== "/login") {
            router.replace("/login");
        } else {
            setChecked(true);
        }
    }, [pathname, router]);

    if (!checked) return null; // prevent flash of protected content
    return children;
}