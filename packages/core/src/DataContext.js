"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

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

  // Initialize token from localStorage
  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      const savedToken = localStorage.getItem("token");
      setTokenState(savedToken);
    }
  }, []);

  const setToken = useCallback((newToken) => {
    if (typeof localStorage !== "undefined") {
      if (newToken) {
        localStorage.setItem("token", newToken);
      } else {
        localStorage.removeItem("token");
      }
    }
    setTokenState(newToken);
  }, []);

  const fetchResource = useCallback(async (key, endpoint) => {
    const activeToken = token || (typeof localStorage !== "undefined" ? localStorage.getItem("token") : null);
    if (!activeToken) return;

    setLoading((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: null }));

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}${endpoint}`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });

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
  }, [token]);

  const prefetchAll = useCallback(async () => {
    const activeToken = token || (typeof localStorage !== "undefined" ? localStorage.getItem("token") : null);
    if (!activeToken) {
        setData({ workouts: null, routines: null, prs: null, metrics: null });
        setLoading({ workouts: false, routines: false, prs: false, metrics: false });
        return;
    }

    setLoading({ workouts: true, routines: true, prs: true, metrics: true });
    setErrors({ workouts: null, routines: null, prs: null, metrics: null });

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
    const fetchWithAuth = (endpoint) =>
      fetch(`${apiUrl}${endpoint}`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      }).then((res) => {
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
  }, [token]);

  useEffect(() => {
    prefetchAll();
  }, [prefetchAll]);

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
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
