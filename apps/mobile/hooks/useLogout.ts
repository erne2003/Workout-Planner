import { useCallback } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useData } from "@apex/core";

/**
 * Log out and return to the login screen. Logging out wipes this device's
 * data, so if some changes haven't reached the server yet (offline, or they
 * keep failing), ask first.
 */
export function useLogout() {
  const router = useRouter();
  const { logout, getUnsyncedCount } = useData() as any;

  return useCallback(async () => {
    const signOut = async () => {
      await logout();
      router.replace("/login");
    };

    const unsynced = await getUnsyncedCount().catch(() => 0);
    if (unsynced > 0) {
      Alert.alert(
        "Unsynced changes",
        `${unsynced} unsynced change${unsynced === 1 ? "" : "s"} will be lost if you log out now. Connect to the internet and open the app to sync first.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Log Out Anyway", style: "destructive", onPress: signOut },
        ]
      );
      return;
    }
    await signOut();
  }, [logout, getUnsyncedCount, router]);
}
