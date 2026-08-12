import { useEffect } from "react";

export default function KeepAlive() {
  useEffect(() => {
    const pingParams = {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    };
    
    // Initial ping on mount
    const ping = async () => {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
        if (!apiUrl) return;
        try {
            await fetch(`${apiUrl}/health`, pingParams);
        } catch (e) {
            // Silently fail, it's just a keep-alive
        }
    };
    
    ping();

    // Ping every 14 minutes (840000 ms) to keep server awake
    const interval = setInterval(() => {
        ping();
    }, 14 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
