"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getSecureStorage, getStorage } from "./storage.js";
import { fetchWithTimeout } from "./utils.js";
import { hasDatabase } from "./db/database.js";
import {
  workouts as workoutsRepo,
  routines as routinesRepo,
  prs as prsRepo,
  bodyMetrics as bodyMetricsRepo,
  exerciseCache,
  outbox,
} from "./db/repositories.js";
import { useLiveQuery } from "./db/useLiveQuery.js";
import { SyncManager } from "./sync/SyncManager.js";

const DATA_KEYS = ["workouts", "routines", "prs", "metrics"];
const isEmpty = (value) => !Array.isArray(value) || value.length === 0;

/** Normalize an exercise reference from any screen shape (search result, plan entry, set). */
const exerciseRef = (ex) => ({
  exercise_id: ex.exercise_id ?? ex.exerciseId ?? ex.id ?? null,
  exercise_name: ex.exercise_name ?? ex.name,
  muscle_group: ex.muscle_group ?? ex.muscle ?? null,
});

const DataContext = createContext({});

export const useData = () => useContext(DataContext);

export function DataProvider({ children }) {
  const [data, setData] = useState({
    workouts: null,
    routines: null,
    prs: null,
    metrics: null,
  });

  const [loading, setLoading] = useState({
    workouts: true,
    routines: true,
    prs: true,
    metrics: true,
  });

  const [errors, setErrors] = useState({
    workouts: null,
    routines: null,
    prs: null,
    metrics: null,
  });

  // Access token lives in memory only — never persisted to disk
  const [accessToken, setAccessToken] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  // True while a refresh token is stored on the device. This, not the access
  // token, decides whether the user is signed in, so a slow or unreachable
  // backend never logs anyone out.
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Refs for the interceptor engine (must survive re-renders)
  const accessTokenRef = useRef(null);
  const isAuthenticatedRef = useRef(false);
  const refreshPromiseRef = useRef(null); // the in-flight refresh, shared by all callers
  const sessionRef = useRef(0);           // bumped on login/logout so stale refreshes are dropped

  // Offline-first mode: a local database is registered (mobile). Screens then
  // read SQLite and write through the repositories; the sync engine keeps the
  // server in step. Without one (web), data comes straight from the REST API.
  const local = useRef(hasDatabase()).current;

  // Sync engine — created once; it calls the latest authFetch through this ref.
  const authFetchRef = useRef(null);
  const syncRef = useRef(null);
  if (syncRef.current === null && hasDatabase()) {
    syncRef.current = new SyncManager({
      fetch: (url, init) => authFetchRef.current(url, init),
      getApiUrl: () => process.env.NEXT_PUBLIC_API_URL
        || process.env.EXPO_PUBLIC_API_URL
        || "https://workout-planner-production-66ce.up.railway.app",
    });
  }
  const [syncStatus, setSyncStatus] = useState(() => syncRef.current?.getStatus() ?? null);

  // Keep the ref in sync with state so authFetch always reads the latest value
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  const setAuthenticated = useCallback((value) => {
    isAuthenticatedRef.current = value;
    setIsAuthenticated(value);
  }, []);

  // Drop every trace of the session from memory (callers handle SecureStore)
  const clearSession = useCallback(() => {
    setAccessToken(null);
    accessTokenRef.current = null;
    setAuthenticated(false);
    setData({ workouts: null, routines: null, prs: null, metrics: null });
  }, [setAuthenticated]);

  const getApiUrl = useCallback(() => {
    return process.env.NEXT_PUBLIC_API_URL
      || process.env.EXPO_PUBLIC_API_URL
      || "https://workout-planner-production-66ce.up.railway.app";
  }, []);

  // ── Token refresh ──────────────────────────────────────────────────────
  // Exchanges the stored refresh token for a new pair. Resolves to one of:
  //   { status: "ok", accessToken } — new tokens stored
  //   { status: "invalid" }         — server rejected the token (400/401).
  //                                   The only case that deletes it and signs out.
  //   { status: "unreachable" }     — timeout, 5xx or no network. The refresh
  //                                   token is kept so a later attempt can succeed.
  // Concurrent calls share one request, so a refresh token is never rotated twice.
  const refreshTokens = useCallback(() => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const session = sessionRef.current;
    const run = async () => {
      const secureStorage = getSecureStorage();
      if (!secureStorage) return { status: "unreachable" };

      let refreshToken;
      try {
        refreshToken = await secureStorage.getItemAsync("refreshToken");
      } catch (e) {
        console.warn("[DataContext] Failed to read refresh token:", e);
        return { status: "unreachable" };
      }
      if (!refreshToken) {
        if (session === sessionRef.current) clearSession();
        return { status: "invalid" };
      }

      let res;
      try {
        res = await fetchWithTimeout(`${getApiUrl()}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      } catch (e) {
        console.warn("[DataContext] Token refresh unreachable:", e?.message || e);
        return { status: "unreachable" };
      }

      // Logged out or in again while this was in flight — ignore the result
      if (session !== sessionRef.current) return { status: "invalid" };

      if (res.status === 400 || res.status === 401) {
        // Expired, revoked, or reuse detected
        try { await secureStorage.removeItemAsync("refreshToken"); } catch { /* ignore */ }
        clearSession();
        return { status: "invalid" };
      }
      if (!res.ok) return { status: "unreachable" };

      let result;
      try {
        result = await res.json();
      } catch {
        return { status: "unreachable" };
      }
      if (session !== sessionRef.current) return { status: "invalid" };

      // Persist the rotated refresh token
      try {
        await secureStorage.setItemAsync("refreshToken", result.refreshToken);
      } catch (e) {
        console.warn("[DataContext] Failed to store rotated refresh token:", e);
      }

      // Update in-memory access token
      setAccessToken(result.accessToken);
      accessTokenRef.current = result.accessToken;

      // Back online with a valid session: catch up
      syncRef.current?.requestSync();

      return { status: "ok", accessToken: result.accessToken };
    };

    const promise = run().finally(() => {
      if (refreshPromiseRef.current === promise) refreshPromiseRef.current = null;
    });
    refreshPromiseRef.current = promise;
    return promise;
  }, [getApiUrl, clearSession]);

  // ── Boot sequence ──────────────────────────────────────────────────────
  // Only reads SecureStore, then lets the app render straight away. A stored
  // refresh token means the user is signed in; the access token is fetched in
  // the background and authFetch waits for it. No network call blocks boot.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let hasRefreshToken = false;
      try {
        const secureStorage = getSecureStorage();
        if (secureStorage) {
          hasRefreshToken = !!(await secureStorage.getItemAsync("refreshToken"));
          // Clean up legacy single-token storage from before this migration
          try {
            const legacyToken = await secureStorage.getItemAsync("token");
            if (legacyToken) {
              await secureStorage.removeItemAsync("token");
            }
          } catch { /* ignore */ }
        }
      } catch (e) {
        console.warn("[DataContext] Session restore failed:", e);
      }
      if (cancelled) return;
      setAuthenticated(hasRefreshToken);
      setTokenLoading(false);
      if (hasRefreshToken) refreshTokens();
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── authFetch — the interceptor engine ─────────────────────────────────
  // Drop-in replacement for fetch(). Attaches the access token and silently
  // refreshes on 401. With no access token yet it waits for the refresh
  // instead of sending "Bearer null". Throws like fetch() does when the
  // backend can't be reached.
  const authFetch = useCallback(async (url, options = {}) => {
    const makeRequest = (token) =>
      fetchWithTimeout(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });

    const notSignedIn = () =>
      new Response(JSON.stringify({ error: "Not signed in", code: "NOT_AUTHENTICATED" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });

    let token = accessTokenRef.current;
    if (!token) {
      if (!isAuthenticatedRef.current) return notSignedIn();
      const result = await refreshTokens();
      if (result.status === "unreachable") throw new TypeError("Network request failed");
      if (result.status !== "ok") return notSignedIn();
      token = result.accessToken;
    }

    const res = await makeRequest(token);
    if (res.status !== 401) return res;

    // ── 401 received — attempt silent refresh ────────────────────────────
    // Another request may already have refreshed while this one was in flight
    if (accessTokenRef.current && accessTokenRef.current !== token) {
      return makeRequest(accessTokenRef.current);
    }
    const result = await refreshTokens();
    if (result.status === "ok") {
      // Retry the original request with the fresh token
      return makeRequest(result.accessToken);
    }
    // Invalid: refreshTokens already signed the user out.
    // Unreachable: stay signed in and let the caller surface the error.
    return res;
  }, [refreshTokens]);
  authFetchRef.current = authFetch;

  // ── Sync lifecycle ─────────────────────────────────────────────────────
  // Runs while signed in; stops (and finishes any run in progress) on sign-out.
  useEffect(() => {
    const sync = syncRef.current;
    if (!sync) return undefined;
    return sync.subscribe(setSyncStatus);
  }, []);

  useEffect(() => {
    const sync = syncRef.current;
    if (!sync || tokenLoading) return;
    if (isAuthenticated) {
      sync.start().then(() => sync.requestSync());
    } else {
      sync.stop();
    }
  }, [isAuthenticated, tokenLoading]);

  // Trigger a sync now (foreground, back online, pull-to-refresh) and resolve
  // with the sync status when it's done. No-op on web.
  const syncNow = useCallback(async () => {
    const sync = syncRef.current;
    if (!sync || !isAuthenticatedRef.current) return null;
    await sync.start(); // no-op once running; covers a call right after login
    return sync.requestSync();
  }, []);

  // ── Local data (offline-first) ─────────────────────────────────────────
  // Live queries re-read SQLite whenever a table changes (local write or sync).
  const liveWorkouts = useLiveQuery(() => (local ? workoutsRepo.list() : Promise.resolve(null)), ["workouts", "workout_sets"]);
  const liveRoutines = useLiveQuery(() => (local ? routinesRepo.list() : Promise.resolve(null)), ["routines", "routine_exercises"]);
  const livePrs = useLiveQuery(() => (local ? prsRepo.list() : Promise.resolve(null)), ["prs"]);
  const liveMetrics = useLiveQuery(() => (local ? bodyMetricsRepo.list() : Promise.resolve(null)), ["body_metrics"]);

  // ── Login ──────────────────────────────────────────────────────────────
  // Called after a successful /auth/login or /auth/register response.
  const login = useCallback(async (newAccessToken, newRefreshToken, user) => {
    sessionRef.current += 1;
    refreshPromiseRef.current = null;

    // Persist refresh token securely
    const secureStorage = getSecureStorage();
    if (secureStorage) {
      await secureStorage.setItemAsync("refreshToken", newRefreshToken);
      // Clean up legacy token key
      try { await secureStorage.removeItemAsync("token"); } catch { /* ignore */ }
    }

    // Set access token in memory
    setAccessToken(newAccessToken);
    accessTokenRef.current = newAccessToken;
    setAuthenticated(true);

    // Persist user info in general storage
    const storage = getStorage();
    if (storage) {
      if (user?.name) storage.setItem("userName", user.name);
      if (user?.email) storage.setItem("userEmail", user.email);
      storage.removeItem("userId");
    }
  }, [setAuthenticated]);

  // ── Logout ─────────────────────────────────────────────────────────────
  // Revokes the refresh token on the server (best-effort) and clears all
  // local auth state.
  const logout = useCallback(async () => {
    sessionRef.current += 1; // any refresh still in flight is now stale
    refreshPromiseRef.current = null;
    const secureStorage = getSecureStorage();
    let rt = null;
    if (secureStorage) {
      try { rt = await secureStorage.getItemAsync("refreshToken"); } catch { /* ignore */ }
    }

    // Best-effort server-side revocation
    if (rt) {
      try {
        const apiUrl = getApiUrl();
        await fetchWithTimeout(`${apiUrl}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: rt }),
        });
      } catch (e) {
        console.warn("[DataContext] Failed to revoke refresh token on server:", e);
      }
    }

    // Clear local secure storage
    if (secureStorage) {
      try { await secureStorage.removeItemAsync("refreshToken"); } catch { /* ignore */ }
      try { await secureStorage.removeItemAsync("token"); } catch { /* ignore */ } // legacy
    }

    // Clear in-memory state and cached data
    clearSession();

    // Clear general storage
    const storage = getStorage();
    if (storage) {
      storage.removeItem("userName");
      storage.removeItem("userEmail");
      storage.removeItem("userId");
    }
  }, [getApiUrl, clearSession]);

  // ── Backward-compatible setToken ───────────────────────────────────────
  // Existing code calls setToken(null) to log out. We keep this working.
  const setToken = useCallback(async (newToken) => {
    if (newToken) {
      setAccessToken(newToken);
      accessTokenRef.current = newToken;
    } else {
      await logout();
    }
  }, [logout]);

  // ── Data fetching (uses authFetch for automatic refresh) ───────────────
  const fetchResource = useCallback(async (key, endpoint) => {
    if (!isAuthenticatedRef.current) return;

    setLoading((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: null }));

    try {
      const apiUrl = getApiUrl();
      const res = await authFetch(`${apiUrl}${endpoint}`);

      if (res.status === 401) {
        // authFetch already tried to refresh and failed
        throw new Error("Session expired or invalid token. Please log in again.");
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch ${key}`);
      }

      const json = await res.json();
      setData((prev) => ({ ...prev, [key]: json }));
    } catch (err) {
      const message = err.name === 'AbortError'
        ? `Request timed out while fetching ${key}. Please close and reopen the app.`
        : err.message;
      console.error(`Error fetching ${key}:`, message);
      setErrors((prev) => ({ ...prev, [key]: message }));
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  }, [authFetch, getApiUrl]);

  const prefetchAllRemote = useCallback(async () => {
    if (!isAuthenticatedRef.current) {
        setData({ workouts: null, routines: null, prs: null, metrics: null });
        setLoading({ workouts: false, routines: false, prs: false, metrics: false });
        return;
    }

    setLoading({ workouts: true, routines: true, prs: true, metrics: true });
    setErrors({ workouts: null, routines: null, prs: null, metrics: null });

    const apiUrl = getApiUrl();
    const endpoints = {
      workouts: "/workouts",
      routines: "/routines",
      prs: "/prs",
      metrics: "/metrics",
    };

    const fetchEndpoint = (endpoint) =>
      authFetch(`${apiUrl}${endpoint}`).then(async (res) => {
        if (res.status === 401) {
          throw Object.assign(new Error("Unauthorized"), { is401: true });
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });

    // Retry logic: attempt up to 3 times with exponential backoff
    const fetchWithRetry = async (endpoint, maxRetries = 2) => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fetchEndpoint(endpoint);
        } catch (err) {
          if (err.is401 || attempt === maxRetries) throw err;
          // Wait 2s, then 4s before retrying
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt + 1) * 1000));
        }
      }
    };

    const keys = Object.keys(endpoints);
    const results = await Promise.allSettled(
      keys.map((key) => fetchWithRetry(endpoints[key]))
    );

    const newErrors = { workouts: null, routines: null, prs: null, metrics: null };
    const updates = {};

    results.forEach((result, i) => {
      const key = keys[i];
      if (result.status === "fulfilled") {
        updates[key] = result.value;
      } else {
        const err = result.reason;
        newErrors[key] = err.name === 'AbortError'
          ? "Request timed out. Please close and reopen the app."
          : (err.message || "Failed to load");
      }
    });

    // A 401 here means authFetch's refresh already failed. If the refresh
    // token was rejected the user is already signed out; if the server was
    // unreachable they stay signed in. Either way, keep what did load.
    setData((prev) => ({ ...prev, ...updates }));
    setErrors(newErrors);
    setLoading({ workouts: false, routines: false, prs: false, metrics: false });
  }, [authFetch, getApiUrl]);

  // Web only: prefetch once the boot sequence finishes, and again after signing in
  useEffect(() => {
    if (!local && !tokenLoading) {
      prefetchAllRemote();
    }
  }, [local, prefetchAllRemote, tokenLoading, isAuthenticated]);

  // Offline-first: "refresh" means sync (the screens re-read SQLite by themselves)
  const prefetchAll = useCallback(
    () => (local ? syncNow() : prefetchAllRemote()),
    [local, syncNow, prefetchAllRemote]
  );

  const refresh = useCallback((key) => {
    if (local) {
      syncNow();
      return;
    }
    const endpoints = {
      workouts: "/workouts",
      routines: "/routines",
      prs: "/prs",
      metrics: "/metrics",
    };

    if (endpoints[key]) {
      fetchResource(key, endpoints[key]);
    }
  }, [local, syncNow, fetchResource]);

  // ── Writes ─────────────────────────────────────────────────────────────
  // Screens call these instead of the REST API. Offline-first they write
  // SQLite (instant, works offline) and the outbox syncs in the background;
  // on web they call the REST API and refetch.

  const apiRequest = useCallback(async (path, { method = "GET", body } = {}) => {
    const res = await authFetch(`${getApiUrl()}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.error || json?.errors?.[0]?.msg || `Request failed (${res.status})`);
    }
    return json;
  }, [authFetch, getApiUrl]);

  /**
   * Save a finished workout with its sets.
   * sets: [{ exercise_id, exercise_name | name, muscle_group, set_order, reps, weight, rir }]
   * Resolves with the new workout's id.
   */
  const logWorkout = useCallback(async ({ name, notes, created_at, sets = [] }) => {
    if (local) {
      return workoutsRepo.create({
        name,
        notes,
        created_at,
        sets: sets.map((s) => ({
          ...exerciseRef(s),
          set_order: s.set_order,
          reps: s.reps,
          weight: s.weight,
          rir: s.rir,
        })),
      });
    }
    const workout = await apiRequest("/workouts", { method: "POST", body: { name, notes } });
    for (const s of sets) {
      await apiRequest(`/workouts/${workout.id}/sets`, {
        method: "POST",
        body: { exerciseId: exerciseRef(s).exercise_id, setOrder: s.set_order, reps: s.reps, weight: s.weight, rir: s.rir },
      });
    }
    fetchResource("workouts", "/workouts");
    return workout.id;
  }, [local, apiRequest, fetchResource]);

  /**
   * Create a routine, or update one when `id` is given (renames it and
   * replaces its exercises). exercises: [{ exercise_id | id, name, muscle_group, sets, reps, weight, rir }]
   */
  const saveRoutine = useCallback(async ({ id, name, exercises }) => {
    if (local) {
      const rows = exercises.map((ex) => ({
        ...exerciseRef(ex),
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        rir: ex.rir,
      }));
      const existing = await routinesRepo.find(id);
      if (existing) {
        await routinesRepo.update(existing.uuid, { name, exercises: rows });
        return existing.uuid;
      }
      return routinesRepo.create({ name, exercises: rows });
    }
    const payload = {
      name,
      exercises: exercises.map((ex) => ({
        exercise_id: exerciseRef(ex).exercise_id,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        rir: ex.rir,
      })),
    };
    const saved = id != null
      ? await apiRequest(`/routines/${id}`, { method: "PUT", body: payload })
      : await apiRequest("/routines", { method: "POST", body: payload });
    fetchResource("routines", "/routines");
    return saved.id;
  }, [local, apiRequest, fetchResource]);

  const deleteRoutine = useCallback(async (id) => {
    if (local) {
      const existing = await routinesRepo.find(id);
      if (existing) await routinesRepo.remove(existing.uuid);
      return;
    }
    await apiRequest(`/routines/${id}`, { method: "DELETE" });
    fetchResource("routines", "/routines");
  }, [local, apiRequest, fetchResource]);

  const logPR = useCallback(async ({ exerciseName, weight }) => {
    if (local) return prsRepo.create({ exercise_name: exerciseName, weight });
    const pr = await apiRequest("/prs", { method: "POST", body: { exerciseName, weight } });
    fetchResource("prs", "/prs");
    return pr.id;
  }, [local, apiRequest, fetchResource]);

  /**
   * Log a body-metrics snapshot. A partial update (e.g. just weight) carries
   * the other fields forward from the latest snapshot, like POST /metrics.
   */
  const logMetrics = useCallback(async ({ weight, height, trainingYears, bodyFat, gender }) => {
    if (local) return bodyMetricsRepo.log({ weight, height, trainingYears, bodyFat, gender });
    const metric = await apiRequest("/metrics", { method: "POST", body: { weight, height, trainingYears, bodyFat, gender } });
    fetchResource("metrics", "/metrics");
    return metric.id;
  }, [local, apiRequest, fetchResource]);

  /** Sets from the last session that included this exercise ("previous" hints). */
  const getExerciseHistory = useCallback(async (exerciseId) => {
    if (local) return workoutsRepo.lastSetsForExercise(exerciseId);
    try {
      const rows = await apiRequest(`/workouts/history/${exerciseId}`);
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }, [local, apiRequest]);

  /**
   * Search the exercise catalogue. Online results are cached for offline use;
   * offline (or if the server fails) the local cache and history answer instead.
   */
  const searchExercises = useCallback(async (query) => {
    try {
      const results = await apiRequest(`/exercises/search?name=${encodeURIComponent(query)}`);
      const list = Array.isArray(results) ? results : [];
      if (local) exerciseCache.upsertMany(list).catch(() => {});
      return list;
    } catch (e) {
      if (!local) return [];
      return exerciseCache.search(query);
    }
  }, [local, apiRequest]);

  /**
   * After sign-in: does this account still need onboarding (no body metrics)?
   * Offline-first this waits for the first sync and reads SQLite; if that
   * sync can't finish it asks the API, and assumes "no" if both fail.
   */
  const needsOnboarding = useCallback(async () => {
    if (local) {
      const status = await syncNow();
      if (status?.initialSyncDone) return (await bodyMetricsRepo.list()).length === 0;
    }
    try {
      const metrics = await apiRequest("/metrics");
      return Array.isArray(metrics) && metrics.length === 0;
    } catch {
      return false;
    }
  }, [local, syncNow, apiRequest]);

  /** Give changes that stopped retrying (parked) another go. */
  const retryFailedChanges = useCallback(async () => {
    if (!local) return;
    await outbox.retryParked();
    await syncNow();
  }, [local, syncNow]);

  // ── Exposed data ───────────────────────────────────────────────────────
  // Offline-first, a table shows as loading only until SQLite answers — or,
  // on a device's very first sync, until that sync finishes (or fails) while
  // there's nothing local to show yet.
  const firstSyncRunning = local && isAuthenticated && !!syncStatus && !syncStatus.initialSyncDone && !syncStatus.error;
  const liveByKey = { workouts: liveWorkouts, routines: liveRoutines, prs: livePrs, metrics: liveMetrics };
  const exposed = local
    ? {
        data: Object.fromEntries(DATA_KEYS.map((k) => [k, isAuthenticated ? liveByKey[k].data ?? null : null])),
        loading: Object.fromEntries(DATA_KEYS.map((k) => [
          k,
          liveByKey[k].loading || (firstSyncRunning && isEmpty(liveByKey[k].data)),
        ])),
        errors: { workouts: null, routines: null, prs: null, metrics: null },
      }
    : { data, loading, errors };

  const value = {
    ...exposed.data,
    loading: exposed.loading,
    errors: exposed.errors,
    refresh,
    prefetchAll,
    logWorkout,
    saveRoutine,
    deleteRoutine,
    logPR,
    logMetrics,
    getExerciseHistory,
    searchExercises,
    needsOnboarding,
    retryFailedChanges,
    token: accessToken,   // in-memory access token; null until the background refresh lands
    setToken,             // backward compat — old logout code calls setToken(null)
    tokenLoading,         // true only while SecureStore is being read at boot
    isAuthenticated,      // signed in (a refresh token is stored) — gate UI on this, not token
    authFetch,
    syncStatus,           // { syncing, pending, parked, lastSyncedAt, error, initialSyncDone } — null on web
    syncNow,
    login,
    logout,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
