import { useState, useEffect, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import { getStorage } from '@apex/core';

// Standard ES imports - safe on both iOS and Android (library returns mocks on Android)
import {
  requestAuthorization,
  getRequestStatusForAuthorization,
  queryQuantitySamples,
  queryCategorySamples
} from '@kingstinct/react-native-healthkit';

// Sleep analysis category values from Apple HealthKit
const SLEEP_VALUE_MAP = {
  0: 'IN_BED',
  1: 'ASLEEP',    // Legacy unspecified sleep
  2: 'AWAKE',
  3: 'CORE',
  4: 'DEEP',
  5: 'REM',
};

export function useHealthKit() {
  const [hasPermission, setHasPermission] = useState(() => {
    const storage = getStorage();
    if (storage) {
      return storage.getItem('has_connected_healthkit') === 'true';
    }
    return false;
  });

  const [loading, setLoading] = useState(Platform.OS === 'ios');
  const [healthData, setHealthData] = useState(null);
  const [error, setError] = useState(null);

  const fetchHealthData = useCallback(async () => {
    console.log("[HealthKit] fetchHealthData triggered");
    if (Platform.OS !== 'ios') {
      console.log("[HealthKit] fetchHealthData aborted (Not iOS)");
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // ── SLEEP ANALYSIS (14 Days to align sleep intervals with HRV) ──────────
      let sleepData = { sleepStages: null, _sleepSamples: 0, _sleepValues: [] };
      let sleepSamples14d = [];
      try {
        sleepSamples14d = await queryCategorySamples(
          'HKCategoryTypeIdentifierSleepAnalysis',
          {
            filter: {
              date: {
                startDate: fourteenDaysAgo,
                endDate: now,
              }
            },
            limit: 0,
            ascending: false
          }
        ) || [];

        if (sleepSamples14d.length > 0) {
          const uniqueValues = [...new Set(sleepSamples14d.map(s => s.value))];
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const todaySleepSamples = sleepSamples14d.filter(s => new Date(s.startDate) >= oneDayAgo);

          if (todaySleepSamples.length > 0) {
            let deepMinutes = 0;
            let coreMinutes = 0;
            let remMinutes = 0;
            let awakeMinutes = 0;

            todaySleepSamples.forEach((sample) => {
              const start = new Date(sample.startDate).getTime();
              const end = new Date(sample.endDate).getTime();
              const duration = (end - start) / 60000;
              const label = SLEEP_VALUE_MAP[sample.value] || `UNKNOWN(${sample.value})`;

              if (label === 'DEEP') {
                deepMinutes += duration;
              } else if (label === 'CORE') {
                coreMinutes += duration;
              } else if (label === 'REM') {
                remMinutes += duration;
              } else if (label === 'AWAKE') {
                awakeMinutes += duration;
              } else if (label === 'ASLEEP') {
                deepMinutes += duration * 0.20;
                coreMinutes += duration * 0.60;
                remMinutes += duration * 0.20;
              }
            });

            sleepData = {
              sleepStages: { deepMinutes, coreMinutes, remMinutes, awakeMinutes },
              _sleepSamples: todaySleepSamples.length,
              _sleepValues: uniqueValues.map(v => SLEEP_VALUE_MAP[v] || `UNKNOWN(${v})`),
            };
          }
        }
      } catch (e) {
        Alert.alert('⚠️ Sleep Error', `queryCategorySamples(sleepAnalysis) failed:\n${e.message}`);
        sleepData._sleepError = e.message;
      }

      // ── MINDFUL SESSIONS ────────────────────────────────────
      let mindfulIntervals = [];
      try {
        const mindfulSamples = await queryCategorySamples(
          'HKCategoryTypeIdentifierMindfulSession',
          {
            filter: {
              date: {
                startDate: fourteenDaysAgo,
                endDate: now,
              }
            },
            limit: 0,
            ascending: false
          }
        ) || [];
        mindfulIntervals = mindfulSamples.map(s => ({
          start: new Date(s.startDate).getTime(),
          end: new Date(s.endDate).getTime()
        }));
      } catch (e) {
        console.log('[HealthKit] Mindful session query failed/unsupported:', e.message);
      }

      // ── RESTING HEART RATE ──────────────────────────────────
      let rhrData = { todayRHR: null, avg14DayRHR: null, meanRHR: null, stdDevRHR: null, _rhrSamples: 0 };
      try {
        const rhrSamples = await queryQuantitySamples(
          'HKQuantityTypeIdentifierRestingHeartRate',
          {
            filter: {
              date: {
                startDate: fourteenDaysAgo,
                endDate: now,
              }
            },
            limit: 0,
            ascending: false
          }
        );

        if (rhrSamples && rhrSamples.length > 0) {
          const sum = rhrSamples.reduce((acc, s) => acc + s.quantity, 0);
          const rhrValues = rhrSamples.map(s => s.quantity);
          const meanRHR = sum / rhrSamples.length;
          
          let stdDevRHR = 3.0; // typical athletic baseline fallback
          if (rhrValues.length > 1) {
            const sumOfSquares = rhrValues.reduce((acc, val) => acc + Math.pow(val - meanRHR, 2), 0);
            stdDevRHR = Math.sqrt(sumOfSquares / (rhrValues.length - 1));
          }

          rhrData = {
            todayRHR: rhrSamples[0].quantity,
            avg14DayRHR: meanRHR,
            meanRHR,
            stdDevRHR,
            _rhrSamples: rhrSamples.length,
          };
        }
      } catch (e) {
        Alert.alert('⚠️ RHR Error', `queryQuantitySamples(restingHeartRate) failed:\n${e.message}`);
        rhrData._rhrError = e.message;
      }

      // ── HEART RATE VARIABILITY ──────────────────────────────
      let hrvData = { todayHRV: null, avg14DayHRV: null, meanLnHRV: null, stdDevLnHRV: null, _hrvSamples: 0 };
      try {
        const hrvSamples = await queryQuantitySamples(
          'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
          {
            filter: {
              date: {
                startDate: fourteenDaysAgo,
                endDate: now,
              }
            },
            limit: 0,
            ascending: false
          }
        );

        if (hrvSamples && hrvSamples.length > 0) {
          // Extract asleep blocks from sleepSamples14d
          const sleepIntervals = sleepSamples14d
            .filter(s => s.value === 1 || s.value === 3 || s.value === 4 || s.value === 5)
            .map(s => ({
              start: new Date(s.startDate).getTime(),
              end: new Date(s.endDate).getTime()
            }));

          let filteredHRVSamples = hrvSamples;
          const combinedIntervals = [...sleepIntervals, ...mindfulIntervals];

          if (combinedIntervals.length > 0) {
            const sleepMindfulFiltered = hrvSamples.filter(h => {
              const hTime = new Date(h.startDate).getTime();
              // Check if sample timestamp is within any interval (with a 2-minute buffer for safety)
              return combinedIntervals.some(interval => hTime >= (interval.start - 120000) && hTime <= (interval.end + 120000));
            });
            if (sleepMindfulFiltered.length > 0) {
              filteredHRVSamples = sleepMindfulFiltered;
            }
          }

          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);

          const todaySamples = filteredHRVSamples.filter(
            (s) => new Date(s.startDate) >= startOfToday
          );

          let todayHRV;
          if (todaySamples.length > 0) {
            todayHRV = todaySamples.reduce((acc, s) => acc + s.quantity, 0) / todaySamples.length;
          } else {
            // Fall back to averaging all samples from the most recent day we have data for
            const mostRecentDate = new Date(filteredHRVSamples[0].startDate);
            mostRecentDate.setHours(0, 0, 0, 0);
            const mostRecentDaySamples = filteredHRVSamples.filter((s) => {
              const sDate = new Date(s.startDate);
              return sDate >= mostRecentDate && sDate < new Date(mostRecentDate.getTime() + 86400000);
            });
            todayHRV = mostRecentDaySamples.reduce((acc, s) => acc + s.quantity, 0) / mostRecentDaySamples.length;
          }

          const avg14DayHRV = filteredHRVSamples.reduce((acc, s) => acc + s.quantity, 0) / filteredHRVSamples.length;

          // Calculate mean and std dev of log-transformed RMSSD/SDNN samples
          const lnSamples = filteredHRVSamples.map(s => Math.log(s.quantity > 0 ? s.quantity : 1));
          const meanLnHRV = lnSamples.reduce((acc, val) => acc + val, 0) / lnSamples.length;
          
          let stdDevLnHRV = 0.30; // typical athletic baseline fallback
          if (lnSamples.length > 1) {
            const sumOfSquares = lnSamples.reduce((acc, val) => acc + Math.pow(val - meanLnHRV, 2), 0);
            stdDevLnHRV = Math.sqrt(sumOfSquares / (lnSamples.length - 1));
          }

          hrvData = { 
            todayHRV, 
            avg14DayHRV, 
            meanLnHRV,
            stdDevLnHRV,
            _hrvSamples: filteredHRVSamples.length 
          };
        }
      } catch (e) {
        Alert.alert('⚠️ HRV Error', `queryQuantitySamples(heartRateVariabilitySDNN) failed:\n${e.message}`);
        hrvData._hrvError = e.message;
      }

      // ── DIAGNOSTIC ALERT ────────────────────────────────────
      const fmtMin = (m) => `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
      const totalSleepMin = sleepData.sleepStages
        ? sleepData.sleepStages.deepMinutes + sleepData.sleepStages.coreMinutes + sleepData.sleepStages.remMinutes
        : 0;

      const lines = [];
      lines.push(`Fetched: ${new Date().toLocaleTimeString()}`);
      lines.push('');
      lines.push(`📊 RHR (${rhrData._rhrSamples} samples)`);
      lines.push(`  Today: ${rhrData.todayRHR !== null ? Math.round(rhrData.todayRHR) + ' bpm' : 'No data'}`);
      lines.push(`  14d Avg: ${rhrData.avg14DayRHR !== null ? Math.round(rhrData.avg14DayRHR * 10) / 10 + ' bpm' : 'No data'}`);
      if (rhrData._rhrError) lines.push(`  ⚠️ Error: ${rhrData._rhrError}`);
      lines.push('');
      lines.push(`💓 HRV (${hrvData._hrvSamples} samples)`);
      lines.push(`  Today: ${hrvData.todayHRV !== null ? Math.round(hrvData.todayHRV) + ' ms' : 'No data'}`);
      lines.push(`  14d Avg: ${hrvData.avg14DayHRV !== null ? Math.round(hrvData.avg14DayHRV * 10) / 10 + ' ms' : 'No data'}`);
      if (hrvData._hrvError) lines.push(`  ⚠️ Error: ${hrvData._hrvError}`);
      lines.push('');
      lines.push(`🌙 Sleep (${sleepData._sleepSamples} samples from today)`);
      if (sleepData.sleepStages) {
        lines.push(`  Total: ${fmtMin(totalSleepMin)}`);
        lines.push(`  Deep: ${fmtMin(sleepData.sleepStages.deepMinutes)}`);
        lines.push(`  Core: ${fmtMin(sleepData.sleepStages.coreMinutes)}`);
        lines.push(`  REM: ${fmtMin(sleepData.sleepStages.remMinutes)}`);
        lines.push(`  Awake: ${fmtMin(sleepData.sleepStages.awakeMinutes)}`);
      } else {
        lines.push('  No sleep data');
      }
      if (sleepData._sleepError) lines.push(`  ⚠️ Error: ${sleepData._sleepError}`);
      if (sleepData._sleepValues && sleepData._sleepValues.length > 0) lines.push(`  Raw types: ${sleepData._sleepValues.join(', ')}`);

      Alert.alert('🩺 HealthKit Data', lines.join('\n'));

      // Strip debug metadata before setting state
      const { _rhrError, _rhrSamples, ...cleanRhr } = rhrData;
      const { _hrvError, _hrvSamples, ...cleanHrv } = hrvData;
      const { _sleepError, _sleepSamples, _sleepValues, ...cleanSleep } = sleepData;

      setHealthData({
        ...cleanRhr,
        ...cleanHrv,
        ...cleanSleep,
      });
      setLoading(false);

    } catch (err) {
      const msg = err?.message || JSON.stringify(err) || String(err);
      Alert.alert('❌ HealthKit Fetch Failed', `Unexpected error:\n${msg}`);
      console.error('[HealthKit] Error fetching metrics:', err);
      setError(err);
      setLoading(false);
    }
  }, []);

  const requestPermissions = useCallback(async () => {
    console.log("[HealthKit] requestPermissions triggered");
    setLoading(true);
    try {
      // Request read authorization for HRV, RHR, and Sleep
      await requestAuthorization({
        toRead: [
          'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
          'HKQuantityTypeIdentifierRestingHeartRate',
          'HKCategoryTypeIdentifierSleepAnalysis',
          'HKCategoryTypeIdentifierMindfulSession',
        ],
        toShare: []
      });

      getStorage()?.setItem('has_connected_healthkit', 'true');
      setHasPermission(true);
      await fetchHealthData();
    } catch (e) {
      const errStr = e?.message || JSON.stringify(e) || String(e);
      Alert.alert('❌ HealthKit Auth Error', `requestAuthorization failed:\n${errStr}`);
      console.error('[HealthKit] Auth error:', e);
      setError(e);
      setLoading(false);
    }
  }, [fetchHealthData]);

  const disconnect = useCallback(() => {
    console.log("[HealthKit] Disconnecting and clearing state");
    getStorage()?.removeItem('has_connected_healthkit');
    setHasPermission(false);
    setHealthData(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      const alreadyConnected = getStorage()?.getItem('has_connected_healthkit') === 'true';
      if (alreadyConnected) {
        console.log("[HealthKit] Auto-syncing since integration is enabled");
        requestPermissions();
      } else {
        // Check if authorization is already granted
        (async () => {
          try {
            const status = await getRequestStatusForAuthorization({
              toRead: [
                'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
                'HKQuantityTypeIdentifierRestingHeartRate',
                'HKCategoryTypeIdentifierSleepAnalysis',
                'HKCategoryTypeIdentifierMindfulSession',
              ],
              toShare: []
            });
            // status === 1 means "unnecessary" (already authorized)
            if (status === 1) {
              console.log("[HealthKit] Already authorized — auto-syncing");
              getStorage()?.setItem('has_connected_healthkit', 'true');
              setHasPermission(true);
              await fetchHealthData();
            } else {
              setLoading(false);
            }
          } catch (e) {
            console.log("[HealthKit] Auth status check failed:", e.message);
            setLoading(false);
          }
        })();
      }
    } else {
      setLoading(false);
    }
  }, [requestPermissions, fetchHealthData]);

  return {
    hasPermission,
    loading,
    healthData,
    error,
    requestPermissions,
    disconnect,
    refresh: fetchHealthData
  };
}
