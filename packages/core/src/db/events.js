/**
 * Change notifications for the local database. Every committed write emits
 * the set of tables it touched, so live queries can re-read and the sync
 * engine can schedule a push.
 *
 * source: "local" — a write made by the app (queued in the outbox)
 *         "sync"  — rows applied from the server
 *         "reset" — local data wiped (logout, user switch, full resync)
 */

const listeners = new Set();

/**
 * @param {(tables: Set<string>, source: "local" | "sync" | "reset") => void} listener
 * @returns {() => void} unsubscribe
 */
export function subscribeToChanges(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitChange(tables, source = "local") {
  const changed = new Set(tables);
  if (changed.size === 0) return;
  for (const listener of [...listeners]) {
    try {
      listener(changed, source);
    } catch (e) {
      console.warn("[db] change listener failed:", e);
    }
  }
}
