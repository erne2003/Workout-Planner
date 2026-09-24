/**
 * SyncManager — keeps the local database and the server in step.
 *
 * One sync runs at a time: push the outbox (FIFO, batches of 100), then pull
 * changes page by page until has_more is false. Requests made while a sync is
 * running are coalesced into one more run afterwards.
 *
 * Push:  ok → the entry leaves the outbox; error → attempts++ (parked after
 *        MAX_PUSH_ATTEMPTS, shown as `parked` in the status).
 * Pull:  rows with an unpushed local change are skipped; tombstones delete.
 * Network failures back off 2 s, 4 s, 8 s … up to 5 min, then retry.
 * A 401 (the refresh token was rejected, or nobody is signed in) pauses sync
 * until the next trigger; sync never signs anyone out.
 *
 * Triggers (wired by the app): after a token refresh, offline → online,
 * app foregrounded, and 2 s after a local write (built in, via change events).
 */
import { subscribeToChanges } from "../db/events.js";
import { outbox, syncState } from "../db/repositories.js";
import { applyPulledChanges, dropSyncedRows } from "./applyChanges.js";

export const SYNC_KEYS = {
  cursor: "cursor",               // `since` for the next pull
  lastSyncedAt: "last_synced_at", // ISO time of the last complete sync
  initialSyncDone: "initial_sync_done",
  userId: "user_id",
};

/** The backend couldn't be reached (offline, timeout, 5xx). Retried with backoff. */
export class SyncNetworkError extends Error {}
/** 401: not signed in, or the session was rejected. Sync pauses. */
export class SyncAuthError extends Error {}
/** Any other non-OK response. */
export class SyncRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const DEFAULTS = {
  pushBatchSize: 100,
  pullLimit: 500,
  debounceMs: 2000,
  backoffBaseMs: 2000,
  backoffMaxMs: 5 * 60 * 1000,
};

export class SyncManager {
  /**
   * @param {Object} options
   * @param {(url: string, init?: RequestInit) => Promise<Response>} options.fetch - authFetch: attaches
   *   the access token, refreshes on 401, throws when the backend is unreachable
   * @param {() => string} options.getApiUrl
   * @param {Object} [options.timers] - { setTimeout, clearTimeout } (tests use fakes)
   */
  constructor({ fetch, getApiUrl, timers, ...options }) {
    this._fetch = fetch;
    this._getApiUrl = getApiUrl;
    this._timers = timers || { setTimeout: (...a) => setTimeout(...a), clearTimeout: (id) => clearTimeout(id) };
    this._opts = { ...DEFAULTS, ...options };

    this._listeners = new Set();
    this._status = {
      syncing: false,
      phase: null,              // "push" | "pull" while syncing
      pending: 0,               // outbox entries waiting to push
      parked: 0,                // outbox entries that stopped retrying
      lastSyncedAt: null,
      error: null,              // { kind: "network" | "auth" | "request", message } of the last failure
      initialSyncDone: false,
      pulledRows: 0,            // rows applied so far in the current pull (progress)
    };

    this._stopped = true;
    this._generation = 0;
    this._running = null;
    this._again = false;
    this._failures = 0;
    this._retryTimer = null;
    this._debounceTimer = null;
    this._unsubscribe = null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** Begin reacting to local writes and load the persisted status. Idempotent. */
  async start() {
    if (!this._stopped) return;
    this._stopped = false;
    this._generation++;
    this._unsubscribe = subscribeToChanges((tables, source) => {
      if (tables.has("outbox") || source === "reset") this._refreshCounts();
      if (source === "local") this._scheduleDebounced();
    });
    const [lastSyncedAt, initialSyncDone] = await Promise.all([
      syncState.get(SYNC_KEYS.lastSyncedAt),
      syncState.get(SYNC_KEYS.initialSyncDone),
    ]);
    this._setStatus({ lastSyncedAt, initialSyncDone: initialSyncDone === "1" });
    await this._refreshCounts();
  }

  /**
   * Stop syncing: no new runs, and a run in progress stops before its next
   * write. Resolves once that run has finished, so the caller can safely wipe
   * the local database afterwards.
   */
  async stop() {
    this._stopped = true;
    this._generation++;
    this._clearTimer("_retryTimer");
    this._clearTimer("_debounceTimer");
    this._unsubscribe?.();
    this._unsubscribe = null;
    this._again = false;
    if (this._running) await this._running.catch(() => {});
    this._setStatus({ syncing: false, phase: null, error: null, pulledRows: 0 });
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  getStatus() {
    return this._status;
  }

  /** @returns {() => void} unsubscribe */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _setStatus(patch) {
    this._status = { ...this._status, ...patch };
    for (const listener of [...this._listeners]) {
      try {
        listener(this._status);
      } catch (e) {
        console.warn("[sync] status listener failed:", e);
      }
    }
  }

  async _refreshCounts() {
    try {
      const [pending, parked] = await Promise.all([outbox.pendingCount(), outbox.parked()]);
      this._setStatus({ pending, parked: parked.length });
    } catch (e) {
      console.warn("[sync] could not read the outbox:", e);
    }
  }

  // ── Triggers ───────────────────────────────────────────────────────────────

  /**
   * Sync now (or right after the run in progress). Resolves when a run that
   * started after this call has finished. Cancels any pending backoff retry.
   */
  requestSync() {
    if (this._stopped) return Promise.resolve(this._status);
    this._clearTimer("_retryTimer");
    this._clearTimer("_debounceTimer");
    this._again = true;
    if (!this._running) {
      this._running = (async () => {
        while (this._again && !this._stopped) {
          this._again = false;
          await this._runOnce();
        }
      })().finally(() => {
        this._running = null;
      });
    }
    return this._running.then(() => this._status);
  }

  /** Resolves when no sync is running (immediately if idle). */
  whenIdle() {
    return this._running ? this._running.then(() => {}, () => {}) : Promise.resolve();
  }

  _scheduleDebounced() {
    if (this._stopped) return;
    this._clearTimer("_debounceTimer");
    this._debounceTimer = this._timers.setTimeout(() => {
      this._debounceTimer = null;
      this.requestSync();
    }, this._opts.debounceMs);
  }

  _scheduleRetry() {
    if (this._stopped) return;
    this._failures++;
    const delay = Math.min(this._opts.backoffBaseMs * 2 ** (this._failures - 1), this._opts.backoffMaxMs);
    this._clearTimer("_retryTimer");
    this._retryTimer = this._timers.setTimeout(() => {
      this._retryTimer = null;
      this.requestSync();
    }, delay);
    return delay;
  }

  _clearTimer(name) {
    if (this[name]) {
      this._timers.clearTimeout(this[name]);
      this[name] = null;
    }
  }

  // ── One sync ───────────────────────────────────────────────────────────────

  async _runOnce() {
    const generation = this._generation;
    const live = () => generation === this._generation && !this._stopped;
    this._setStatus({ syncing: true, phase: "push", pulledRows: 0 });
    try {
      await this._push(live);
      if (!live()) return;
      this._setStatus({ phase: "pull" });
      await this._pull(live);
      if (!live()) return;

      const now = new Date().toISOString();
      await syncState.set(SYNC_KEYS.lastSyncedAt, now);
      this._failures = 0;
      this._setStatus({ lastSyncedAt: now, error: null });
    } catch (err) {
      if (!live()) return;
      if (err instanceof SyncAuthError) {
        // Paused: the next trigger (a successful sign-in or token refresh) resumes
        this._setStatus({ error: { kind: "auth", message: err.message } });
      } else if (err instanceof SyncRequestError) {
        this._scheduleRetry();
        this._setStatus({ error: { kind: "request", message: err.message } });
      } else {
        this._scheduleRetry();
        this._setStatus({ error: { kind: "network", message: err.message } });
      }
    } finally {
      if (live()) {
        this._setStatus({ syncing: false, phase: null });
        await this._refreshCounts();
      }
    }
  }

  async _request(method, path, body) {
    let res;
    try {
      res = await this._fetch(`${this._getApiUrl()}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new SyncNetworkError(e?.message || "Network request failed");
    }
    if (res.status === 401) throw new SyncAuthError("Not signed in");
    if (res.status >= 500 || res.status === 408 || res.status === 429) {
      throw new SyncNetworkError(`Server unavailable (HTTP ${res.status})`);
    }
    let json = null;
    try {
      json = await res.json();
    } catch {
      if (res.ok) throw new SyncNetworkError("Malformed response");
    }
    if (!res.ok) throw new SyncRequestError(json?.error || `HTTP ${res.status}`, res.status);
    return json;
  }

  async _push(live) {
    let afterSeq = 0;
    for (;;) {
      const batch = await outbox.peek({ afterSeq, limit: this._opts.pushBatchSize });
      if (batch.length === 0 || !live()) return;

      let results;
      try {
        const res = await this._request("POST", "/sync/push", {
          changes: batch.map((e) => ({
            tbl: e.tbl,
            op: e.op,
            uuid: e.uuid,
            ...(e.parent_uuid ? { parent_uuid: e.parent_uuid } : {}),
            ...(e.payload ? { payload: e.payload } : {}),
          })),
        });
        results = Array.isArray(res?.results) ? res.results : [];
      } catch (err) {
        // The whole batch was refused (e.g. 400): count an attempt for each entry
        if (!(err instanceof SyncRequestError)) throw err;
        results = batch.map(() => ({ status: "error", error: err.message }));
      }
      if (!live()) return;

      await outbox.settle(
        batch.map((entry, i) => ({
          seq: entry.seq,
          ok: results[i]?.status === "ok",
          error: results[i]?.error || (results[i] ? null : "No result from server"),
        }))
      );
      afterSeq = batch[batch.length - 1].seq; // each entry is sent at most once per sync
    }
  }

  async _pull(live) {
    let since = await syncState.get(SYNC_KEYS.cursor);
    let resynced = false;
    let pulledRows = 0;
    let url = this._pullUrl({ since });

    for (;;) {
      let page;
      try {
        page = await this._request("GET", url);
      } catch (err) {
        // A cursor the server can't parse: start over with a full pull
        if (err instanceof SyncRequestError && err.status === 400 && !resynced) {
          resynced = true;
          since = null;
          url = this._pullUrl({ since });
          continue;
        }
        throw err;
      }
      if (!live()) return;

      if (page.resync_required) {
        if (resynced) throw new SyncRequestError("Server keeps asking for a full resync");
        // Tombstones this device never saw may be purged: rebuild from scratch
        resynced = true;
        await dropSyncedRows();
        await syncState.set(SYNC_KEYS.cursor, null);
        since = null;
        url = this._pullUrl({ since });
        continue;
      }

      const pending = await outbox.pendingUuids();
      if (!live()) return;
      const { applied } = await applyPulledChanges(page.changes, pending);
      pulledRows += applied;
      this._setStatus({ pulledRows });

      if (!page.has_more) {
        if (!live()) return;
        await syncState.set(SYNC_KEYS.cursor, page.since || since || page.server_time || null);
        if (!this._status.initialSyncDone) {
          await syncState.set(SYNC_KEYS.initialSyncDone, "1");
          this._setStatus({ initialSyncDone: true });
        }
        return;
      }
      url = this._pullUrl({ after: page.next_cursor });
    }
  }

  _pullUrl({ since, after }) {
    const params = [`limit=${this._opts.pullLimit}`];
    if (after) params.push(`after=${encodeURIComponent(after)}`);
    else if (since) params.push(`since=${encodeURIComponent(since)}`);
    return `/sync/pull?${params.join("&")}`;
  }
}
