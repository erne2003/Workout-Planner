/**
 * Who owns the local database, and wiping it when that changes.
 *
 * - Logout: stop syncing, then drop every local table and the outbox. The UI
 *   warns first when changes haven't reached the server (countUnsyncedChanges).
 * - Different user on the same device: the signed-in user's id is kept in
 *   sync_state; signing in as someone else wipes the previous user's data
 *   before the first sync (claimLocalData).
 * - Account deletion: the app signs out after the server confirms, which wipes.
 */
import { syncState, clearLocalData, outbox } from "../db/repositories.js";
import { SYNC_KEYS } from "./SyncManager.js";

/** Wait for `promise`, but no longer than `ms`. */
function bounded(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Stop syncing and wipe the local data. A run in progress gets up to `waitMs`
 * to finish; either way it can't write after stop() (it re-checks before
 * every write), so the wipe is final.
 */
export async function wipeLocalSession(sync, { waitMs = 3000 } = {}) {
  if (sync) await bounded(sync.stop(), waitMs);
  await clearLocalData();
}

/**
 * Before the first sync after signing in: make sure the local data belongs to
 * `userId`. Another account's data is wiped. Resolves true if it wiped.
 */
export async function claimLocalData(userId, sync) {
  if (userId === null || userId === undefined) return false;
  const id = String(userId);
  const stored = await syncState.get(SYNC_KEYS.userId);
  let wiped = false;
  if (stored && stored !== id) {
    await wipeLocalSession(sync);
    wiped = true;
  }
  if (stored !== id) await syncState.set(SYNC_KEYS.userId, id);
  return wiped;
}

/**
 * Record the owner if none is recorded yet (an existing user's first launch
 * after the upgrade signs in with a stored session, not through login).
 */
export async function rememberLocalUser(userId) {
  if (userId === null || userId === undefined) return;
  if (!(await syncState.get(SYNC_KEYS.userId))) {
    await syncState.set(SYNC_KEYS.userId, String(userId));
  }
}

/**
 * Local changes that haven't reached the server, including ones that failed.
 * Gives them one last sync first (up to `waitMs`), so a logout while online
 * doesn't warn about changes that could simply have been pushed.
 */
export async function countUnsyncedChanges(sync, { waitMs = 5000 } = {}) {
  if ((await outbox.count()) === 0) return 0;
  if (sync) await bounded(sync.requestSync(), waitMs);
  return outbox.count();
}
