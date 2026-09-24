import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useData } from "@apex/core";
import { computeOverallReadiness, getMuscleSoreness, setMuscleSoreness } from "@apex/core/src/recovery";
import { useHealthKit } from "./useHealthKit";

/**
 * The readiness score shared by Home and Recovery. Soreness overrides are
 * re-read and the clock re-sampled whenever the screen gains focus, so an
 * override set on one tab is reflected on the other (tabs stay mounted).
 */
export function useReadiness() {
  const { workouts } = useData() as any;
  const health = useHealthKit() as any;
  const [overrides, setOverrides] = useState<Record<string, string>>(() => getMuscleSoreness());
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      setOverrides(getMuscleSoreness());
      setNow(Date.now());
    }, [])
  );

  const setOverride = useCallback((muscle: string, level: string | null) => {
    setMuscleSoreness(muscle, level);
    setOverrides(getMuscleSoreness());
  }, []);

  // `now` is a dependency so recovery percentages advance on refocus.
  const readiness = useMemo(
    () =>
      computeOverallReadiness({
        workouts: workouts || [],
        overrides,
        healthData: health.healthData,
        hasHealthPermission: health.hasPermission,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workouts, overrides, health.healthData, health.hasPermission, now]
  );

  return { ...readiness, overrides, setOverride, now, health };
}
