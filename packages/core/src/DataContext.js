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

  const fetchResource = useCallback(async (key, endpoint) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setLoading((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: null }));

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
      const res = await fetch(`${apiUrl}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
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
  }, []);

  const prefetchAll = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
        setLoading({ workouts: false, prs: false, metrics: false });
        return;
    }

    setLoading({ workouts: true, routines: true, prs: true, metrics: true });
    setErrors({ workouts: null, routines: null, prs: null, metrics: null });

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
    const fetchWithAuth = (endpoint) =>
      fetch(`${apiUrl}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
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
  }, []);

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
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
