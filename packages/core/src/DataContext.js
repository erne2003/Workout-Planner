"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getSecureStorage, getStorage } from "./storage.js";
import { fetchWithTimeout } from "./utils.js";

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

  // Refs for the interceptor engine (must survive re-renders)
  const accessTokenRef = useRef(null);
  const isRefreshingRef = useRef(false);
  const refreshSubscribersRef = useRef([]);

  // Keep the ref in sync with state so authFetch always reads the latest value
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  const getApiUrl = useCallback(() => {
    return process.env.NEXT_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
  }, []);

  // ── Token refresh ──────────────────────────────────────────────────────
  // Reads the refresh token from SecureStore, calls /auth/refresh,
  // stores the new refresh token, and updates the in-memory access token.
  // Returns the new access token on success, or null on failure.
  const refreshTokens = useCallback(async () => {
    const secureStorage = getSecureStorage();
    if (!secureStorage) return null;

    let refreshToken;
    try {
      refreshToken = await secureStorage.getItemAsync("refreshToken");
    } catch (e) {
      console.warn("[DataContext] Failed to read refresh token:", e);
      return null;
    }
    if (!refreshToken) return null;

    try {
      const apiUrl = getApiUrl();
      const res = await fetchWithTimeout(`${apiUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        // Refresh failed — token expired, revoked, or reuse detected
        await secureStorage.removeItemAsync("refreshToken");
        return null;
      }

      const result = await res.json();

      // Persist the rotated refresh token
      await secureStorage.setItemAsync("refreshToken", result.refreshToken);

      // Update in-memory access token
      setAccessToken(result.accessToken);
      accessTokenRef.current = result.accessToken;

      return result.accessToken;
    } catch (e) {
      console.warn("[DataContext] Token refresh failed:", e);
      return null;
    }
  }, [getApiUrl]);

  // ── Boot sequence ──────────────────────────────────────────────────────
  // On mount, try to restore a session by exchanging the stored refresh token
  // for a fresh access token. If no refresh token exists (or it's expired),
  // the user will be redirected to login by AuthGuard.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const secureStorage = getSecureStorage();
        if (secureStorage) {
          const rt = await secureStorage.getItemAsync("refreshToken");
          if (rt) {
            const newAccessToken = await refreshTokens();
            if (!newAccessToken && !cancelled) {
              await secureStorage.removeItemAsync("refreshToken");
            }
          }
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
      } finally {
        if (!cancelled) setTokenLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── authFetch — the interceptor engine ─────────────────────────────────
  // Drop-in replacement for fetch(). Attaches the access token and silently
  // refreshes on 401. Concurrent 401s are coalesced into a single refresh call.
  const authFetch = useCallback(async (url, options = {}) => {
    const makeRequest = (token) =>
      fetchWithTimeout(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });

    // First attempt
    const res = await makeRequest(accessTokenRef.current);
    if (res.status !== 401) return res;

    // ── 401 received — attempt silent refresh ────────────────────────────
    if (isRefreshingRef.current) {
      // Another refresh is already in flight — queue this request
      return new Promise((resolve, reject) => {
        refreshSubscribersRef.current.push((newToken) => {
          if (newToken) {
            makeRequest(newToken).then(resolve).catch(reject);
          } else {
            resolve(res); // refresh failed, return the original 401
          }
        });
      });
    }

    // Start the refresh
    isRefreshingRef.current = true;
    try {
      const newToken = await refreshTokens();

      // Drain the subscriber queue
      const subscribers = refreshSubscribersRef.current;
      refreshSubscribersRef.current = [];
      subscribers.forEach((cb) => cb(newToken));

      if (newToken) {
        // Retry the original request with the fresh token
        return makeRequest(newToken);
      }

      // Refresh failed — clear auth state so AuthGuard redirects to login
      setAccessToken(null);
      accessTokenRef.current = null;
      return res; // return the original 401
    } finally {
      isRefreshingRef.current = false;
    }
  }, [refreshTokens]);

  // ── Login ──────────────────────────────────────────────────────────────
  // Called after a successful /auth/login or /auth/register response.
  const login = useCallback(async (newAccessToken, newRefreshToken, user) => {
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

    // Persist user info in general storage
    const storage = getStorage();
    if (storage) {
      if (user?.name) storage.setItem("userName", user.name);
      if (user?.email) storage.setItem("userEmail", user.email);
      storage.removeItem("userId");
    }
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────
  // Revokes the refresh token on the server (best-effort) and clears all
  // local auth state.
  const logout = useCallback(async () => {
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

    // Clear in-memory state
    setAccessToken(null);
    accessTokenRef.current = null;

    // Clear general storage
    const storage = getStorage();
    if (storage) {
      storage.removeItem("userName");
      storage.removeItem("userEmail");
      storage.removeItem("userId");
    }

    // Reset data
    setData({ workouts: null, routines: null, prs: null, metrics: null });
  }, [getApiUrl]);

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
    if (!accessTokenRef.current) return;

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

  const prefetchAll = useCallback(async () => {
    if (!accessTokenRef.current) {
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

    let has401 = false;
    const newErrors = { workouts: null, routines: null, prs: null, metrics: null };
    const updates = {};

    results.forEach((result, i) => {
      const key = keys[i];
      if (result.status === "fulfilled") {
        updates[key] = result.value;
      } else {
        const err = result.reason;
        if (err.is401) has401 = true;
        newErrors[key] = err.name === 'AbortError'
          ? "Request timed out. Please close and reopen the app."
          : (err.message || "Failed to load");
      }
    });

    if (has401) {
      setAccessToken(null);
      accessTokenRef.current = null;
    } else {
      setData((prev) => ({ ...prev, ...updates }));
    }
    setErrors(newErrors);
    setLoading({ workouts: false, routines: false, prs: false, metrics: false });
  }, [authFetch, getApiUrl]);

  // Only prefetch after the boot sequence finishes
  useEffect(() => {
    if (!tokenLoading) {
      prefetchAll();
    }
  }, [prefetchAll, tokenLoading]);

  const refresh = useCallback((key) => {
    const endpoints = {
      workouts: "/workouts",
      routines: "/routines",
      prs: "/prs",
      metrics: "/metrics",
    };

    if (endpoints[key]) {
      fetchResource(key, endpoints[key]);
    }
  }, [fetchResource]);

  const value = {
    ...data,
    loading,
    errors,
    refresh,
    prefetchAll,
    token: accessToken,   // backward compat — AuthGuard checks this
    setToken,             // backward compat — old logout code calls setToken(null)
    tokenLoading,
    authFetch,
    login,
    logout,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
