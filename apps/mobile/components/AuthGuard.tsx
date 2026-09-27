import { useEffect } from "react";
import { useRouter, usePathname } from "expo-router";
import { useData } from "@apex/core";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    // isAuthenticated (a stored refresh token), not the access token: the
    // access token arrives in the background and may be missing while offline
    const { isAuthenticated, tokenLoading } = useData() as any;

    useEffect(() => {
        if (tokenLoading) return; // still reading SecureStore, don't redirect yet
        if (!isAuthenticated && pathname !== "/login") {
            router.replace("/login");
        }
    }, [isAuthenticated, tokenLoading, pathname, router]);

    // Don't render protected content while SecureStore is being read or while redirecting
    if (tokenLoading) return null;
    if (!isAuthenticated && pathname !== "/login") return null;
    return <>{children}</>;
}
