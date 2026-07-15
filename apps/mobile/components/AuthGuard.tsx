import { useEffect } from "react";
import { useRouter, usePathname } from "expo-router";
import { useData } from "@apex/core";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { token, tokenLoading } = useData() as any;

    useEffect(() => {
        if (tokenLoading) return; // still loading from SecureStore, don't redirect yet
        if (!token && pathname !== "/login") {
            router.replace("/login");
        }
    }, [token, tokenLoading, pathname, router]);

    // Don't render protected content while token is loading or while redirecting
    if (tokenLoading) return null;
    if (!token && pathname !== "/login") return null;
    return <>{children}</>;
}
