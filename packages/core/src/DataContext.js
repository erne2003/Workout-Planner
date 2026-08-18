"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getSecureStorage } from "./storage.js";

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

  const [token, setTokenState] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(true);

  // Initialize token from secure storage (async, awaited)
  useEffect(() => {
    (async () => {
      try {
        const secureStorage = getSecureStorage();
        if (secureStorage) {
          const savedToken = await secureStorage.getItemAsync("token");
          setTokenState(savedToken ?? null);
        }
      } catch (e) {
        console.warn("[DataContext] Failed to load token:", e);
      } finally {
        setTokenLoading(false);
      }
    })();
  }, []);

  // Persist token via secure storage — async and awaited by callers
  const setToken = useCallback(async (newToken) => {
    const secureStorage = getSecureStorage();
    if (secureStorage) {
      try {
        if (newToken) {
          await secureStorage.setItemAsync("token", newToken);
        } else {
          await secureStorage.removeItemAsync("token");
        }
      } catch (e) {
        console.warn("[DataContext] Failed to persist token:", e);
      }
    }
    setTokenState(newToken);
  }, []);

  const fetchWithTimeout = useCallback((url, options = {}, timeoutMs = 15000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timer));
  }, []);

  const fetchResource = useCallback(async (key, endpoint) => {
    if (!token) return;

    setLoading((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: null }));

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
      const res = await fetchWithTimeout(`${apiUrl}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        await setToken(null);
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
  }, [token, setToken, fetchWithTimeout]);

  const prefetchAll = useCallback(async () => {
    if (!token) {
        setData({ workouts: null, routines: null, prs: null, metrics: null });
        setLoading({ workouts: false, routines: false, prs: false, metrics: false });
        return;
    }

    setLoading({ workouts: true, routines: true, prs: true, metrics: true });
    setErrors({ workouts: null, routines: null, prs: null, metrics: null });

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
    const endpoints = {
      workouts: "/workouts",
      routines: "/routines",
      prs: "/prs",
      metrics: "/metrics",
    };

    const fetchEndpoint = (endpoint) =>
      fetchWithTimeout(`${apiUrl}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(async (res) => {
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
      await setToken(null);
    } else {
      setData((prev) => ({ ...prev, ...updates }));
    }
    setErrors(newErrors);
    setLoading({ workouts: false, routines: false, prs: false, metrics: false });
  }, [token, setToken, fetchWithTimeout]);

  // Only prefetch after token has been loaded from secure storage
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
    token,
    setToken,
    tokenLoading,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
