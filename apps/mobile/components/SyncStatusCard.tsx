import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useData } from "@apex/core";
import { useTheme } from "../hooks/useTheme";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Sync indicator for Settings: whether changes made on this device have
 * reached the server, with "Sync Now" and a retry for changes that failed.
 * Renders nothing on web (no local database).
 */
export default function SyncStatusCard() {
  const { syncStatus, syncNow, retryFailedChanges } = useData() as any;
  const { colors } = useTheme();
  if (!syncStatus) return null;

  const { syncing, pending, parked, lastSyncedAt, error } = syncStatus;
  let title: string;
  let detail: string | null = null;
  let dot = colors.accentGreen;

  if (syncing) {
    title = "Syncing…";
    dot = colors.accentBlue;
  } else if (error?.kind === "network") {
    title = "Offline";
    detail = pending
      ? `${plural(pending, "change")} saved on this device, waiting to sync`
      : "Showing data saved on this device";
    dot = colors.accentOrange;
  } else if (error?.kind === "auth") {
    title = "Paused";
    detail = "Sync resumes when your session is restored";
    dot = colors.accentOrange;
  } else if (pending > 0) {
    title = `${plural(pending, "change")} waiting to sync`;
    dot = colors.accentBlue;
  } else {
    title = "All changes synced";
    detail = lastSyncedAt ? `Last synced ${timeAgo(lastSyncedAt)}` : null;
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 16 }}>
          <View style={styles.titleRow}>
            <View style={[styles.dot, { backgroundColor: dot }]} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          </View>
          {detail ? <Text style={[styles.detail, { color: colors.textSecondary }]}>{detail}</Text> : null}
        </View>
        {syncing ? (
          <ActivityIndicator color={colors.accentBlue} />
        ) : (
          <TouchableOpacity onPress={() => syncNow()} style={[styles.button, { borderColor: colors.borderStrong }]}>
            <Text style={[styles.buttonText, { color: colors.accentBlue }]}>Sync Now</Text>
          </TouchableOpacity>
        )}
      </View>

      {parked > 0 && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={[styles.title, { color: colors.accentRed }]}>{`${plural(parked, "change")} couldn't sync`}</Text>
              <Text style={[styles.detail, { color: colors.textSecondary }]}>
                {"They're kept on this device. Retry, or contact support if this keeps happening."}
              </Text>
            </View>
            <TouchableOpacity onPress={() => retryFailedChanges()} style={[styles.button, { borderColor: colors.borderStrong }]}>
              <Text style={[styles.buttonText, { color: colors.accentBlue }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
  },
  detail: {
    fontSize: 11,
    marginTop: 3,
  },
  button: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
  },
});
