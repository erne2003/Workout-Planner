"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getSecureStorage } from "./storage";

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

  const fetchResource = useCallback(async (key, endpoint) => {
    if (!token) return;

    setLoading((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: null }));

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}${endpoint}`, {
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
      console.error(`Error fetching ${key}:`, err);
      setErrors((prev) => ({ ...prev, [key]: err.message }));
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  }, [token, setToken]);

  const prefetchAll = useCallback(async () => {
    if (!token) {
        setData({ workouts: null, routines: null, prs: null, metrics: null });
        setLoading({ workouts: false, routines: false, prs: false, metrics: false });
        return;
    }

    setLoading({ workouts: true, routines: true, prs: true, metrics: true });
    setErrors({ workouts: null, routines: null, prs: null, metrics: null });

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
    let unauthorizedOccurred = false;

    const fetchWithAuth = (endpoint) =>
      fetch(`${apiUrl}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => {
        if (res.status === 401) {
          unauthorizedOccurred = true;
          throw new Error("Unauthorized - invalid token signature");
        }
        if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
        return res.json();
      });

    try {
      const [workouts, routines, prs, metrics] = await Promise.all([
        fetchWithAuth("/workouts"),
        fetchWithAuth("/routines"),
        fetchWithAuth("/prs"),
        fetchWithAuth("/metrics"),
      ]);

      setData({ workouts, routines, prs, metrics });
    } catch (err) {
      if (unauthorizedOccurred) {
        await setToken(null);
      }
      console.error("Prefetch error:", err);
      setErrors({
          workouts: err.message,
          routines: err.message,
          prs: err.message,
          metrics: err.message,
      });
    } finally {
      setLoading({ workouts: false, routines: false, prs: false, metrics: false });
    }
  }, [token, setToken]);

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
