"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

const SettingsContext = createContext({});

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }) {
  const [theme, setThemeState] = useState("dark");
  const [weightUnit, setWeightUnitState] = useState("lbs");
  const [lengthUnit, setLengthUnitState] = useState("in");
  const [defaultRIR, setDefaultRIRState] = useState(2);
  const [restTimer, setRestTimerState] = useState(90);
  const [plateCalc, setPlateCalcState] = useState(true);
  const [barWeight, setBarWeightState] = useState(45);
  const [autoStartRest, setAutoStartRestState] = useState(true);
  const [notifications, setNotificationsState] = useState({ reminders: true, alerts: true });

  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "dark";
    if (savedTheme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }

    setTimeout(() => {
      setThemeState(savedTheme);
      setWeightUnitState(localStorage.getItem("weightUnit") || "lbs");
      setLengthUnitState(localStorage.getItem("lengthUnit") || "in");
      setDefaultRIRState(parseInt(localStorage.getItem("defaultRIR")) || 2);
      setRestTimerState(parseInt(localStorage.getItem("restTimer")) || 90);
      setPlateCalcState(localStorage.getItem("plateCalc") !== "false");
      setBarWeightState(parseFloat(localStorage.getItem("barWeight")) || 45);
      setAutoStartRestState(localStorage.getItem("autoStartRest") !== "false");

      try {
        const notifs = JSON.parse(localStorage.getItem("notifications") || '{"reminders": true, "alerts": true}');
        setNotificationsState(notifs);
      } catch {
        // Ignored
      }
      
      setIsLoaded(true);
    }, 0);
  }, []);

  const save = (key, val) => {
    localStorage.setItem(key, val);
  };

  const setTheme = (val) => {
    setThemeState(val);
    save("theme", val);
    if (val === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  };

  const setWeightUnit = (val) => {
    setWeightUnitState(val);
    save("weightUnit", val);
  };

  const setLengthUnit = (val) => {
    setLengthUnitState(val);
    save("lengthUnit", val);
  };

  const setDefaultRIR = (val) => {
    setDefaultRIRState(val);
    save("defaultRIR", val);
  };

  const setRestTimer = (val) => {
    setRestTimerState(val);
    save("restTimer", val);
  };

  const setPlateCalc = (val) => {
    setPlateCalcState(val);
    save("plateCalc", val);
  };

  const setBarWeight = (val) => {
    setBarWeightState(val);
    save("barWeight", val);
  };

  const setAutoStartRest = (val) => {
    setAutoStartRestState(val);
    save("autoStartRest", val);
  };

  const setNotifications = (val) => {
    setNotificationsState(val);
    save("notifications", JSON.stringify(val));
  };

  const value = {
    theme, setTheme,
    weightUnit, setWeightUnit,
    lengthUnit, setLengthUnit,
    defaultRIR, setDefaultRIR,
    restTimer, setRestTimer,
    plateCalc, setPlateCalc,
    barWeight, setBarWeight,
    autoStartRest, setAutoStartRest,
    notifications, setNotifications,
    isLoaded
  };

  // Prevent flicker by not rendering children until we have loaded from localStorage constraints
  if (!isLoaded) {
    return <div style={{ width: "100%", height: "100vh", backgroundColor: "var(--bg-base)" }} />;
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
