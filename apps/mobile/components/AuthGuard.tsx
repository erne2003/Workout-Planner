import { useEffect, useState } from "react";
import { useRouter, usePathname } from "expo-router";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        const token = global.localStorage?.getItem("token");
        if (!token && pathname !== "/login") {
            setChecked(false);
            router.replace("/login");
        } else {
            setChecked(true);
        }
    }, [pathname, router]);

    if (!checked) return null; // prevent flash of protected content
    return <>{children}</>;
}
