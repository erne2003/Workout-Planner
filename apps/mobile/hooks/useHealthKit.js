import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

let AppleHealthKit = null;
if (Platform.OS === 'ios') {
  try {
    AppleHealthKit = require('react-native-health').default;
  } catch (e) {
    console.warn('Failed to load react-native-health package:', e);
  }
}

export function useHealthKit() {
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(Platform.OS === 'ios');
  const [healthData, setHealthData] = useState(null);
  const [error, setError] = useState(null);

  const fetchHealthData = useCallback(() => {
    if (Platform.OS !== 'ios' || !AppleHealthKit) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const hrvOptions = {
      startDate: fourteenDaysAgo.toISOString(),
      endDate: now.toISOString(),
    };

    const rhrOptions = {
      startDate: fourteenDaysAgo.toISOString(),
      endDate: now.toISOString(),
    };

    const sleepOptions = {
      startDate: oneDayAgo.toISOString(),
      endDate: now.toISOString(),
    };

    Promise.all([
      // RESTING HEART RATE (RHR)
      new Promise((resolve) => {
        AppleHealthKit.getRestingHeartRateSamples(rhrOptions, (err, results) => {
          if (err || !results || results.length === 0) {
            resolve({ todayRHR: 60, avg14DayRHR: 60 });
            return;
          }

          const sum = results.reduce((acc, sample) => acc + sample.value, 0);
          const avg14DayRHR = sum / results.length;
          const todayRHR = results[results.length - 1].value;

          resolve({ todayRHR, avg14DayRHR });
        });
      }),
      // HEART RATE VARIABILITY (HRV)
      new Promise((resolve) => {
        AppleHealthKit.getHeartRateVariabilitySamples(hrvOptions, (err, results) => {
          if (err || !results || results.length === 0) {
            resolve({ todayHRV: 50, avg14DayHRV: 50 });
            return;
          }

          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);

          const todaySamples = results.filter(
            (sample) => new Date(sample.startDate) >= startOfToday
          );

          const todayHRV = todaySamples.length > 0
            ? todaySamples.reduce((acc, sample) => acc + sample.value, 0) / todaySamples.length
            : results[results.length - 1].value;

          const avg14DayHRV = results.reduce((acc, sample) => acc + sample.value, 0) / results.length;

          resolve({ todayHRV, avg14DayHRV });
        });
      }),
      // SLEEP ANALYSIS
      new Promise((resolve) => {
        AppleHealthKit.getSleepSamples(sleepOptions, (err, results) => {
          if (err || !results || results.length === 0) {
            resolve({
              sleepStages: { deepMinutes: 0, coreMinutes: 0, remMinutes: 0, awakeMinutes: 0 }
            });
            return;
          }

          let deepMinutes = 0;
          let coreMinutes = 0;
          let remMinutes = 0;
          let awakeMinutes = 0;

          results.forEach((sample) => {
            const start = new Date(sample.startDate).getTime();
            const end = new Date(sample.endDate).getTime();
            const duration = (end - start) / 60000;

            if (sample.value === 'DEEP') {
              deepMinutes += duration;
            } else if (sample.value === 'CORE') {
              coreMinutes += duration;
            } else if (sample.value === 'REM') {
              remMinutes += duration;
            } else if (sample.value === 'AWAKE') {
              awakeMinutes += duration;
            } else if (sample.value === 'ASLEEP') {
              deepMinutes += duration * 0.20;
              coreMinutes += duration * 0.60;
              remMinutes += duration * 0.20;
            }
          });

          resolve({
            sleepStages: { deepMinutes, coreMinutes, remMinutes, awakeMinutes }
          });
        });
      })
    ]).then(([rhrData, hrvData, sleepData]) => {
      console.log("[HealthKit] Fetched Raw Metrics:", {
        rhr: rhrData,
        hrv: hrvData,
        sleep: sleepData,
      });
      setHealthData({
        ...rhrData,
        ...hrvData,
        ...sleepData,
      });
      setLoading(false);
    }).catch((err) => {
      console.error('[HealthKit] Error fetching HealthKit metrics:', err);
      setError(err);
      setLoading(false);
    });
  }, []);

  const requestPermissions = useCallback(() => {
    if (Platform.OS !== 'ios' || !AppleHealthKit) {
      setLoading(false);
      return;
    }

    const permissions = {
      permissions: {
        read: [
          AppleHealthKit.Constants.Permissions.HeartRateVariability,
          AppleHealthKit.Constants.Permissions.RestingHeartRate,
          AppleHealthKit.Constants.Permissions.SleepAnalysis,
        ],
        write: [],
      },
    };

    setLoading(true);
    AppleHealthKit.initHealthKit(permissions, (initErr) => {
      if (initErr) {
        console.error('[HealthKit] Init error:', initErr);
        setError(initErr);
        setLoading(false);
        return;
      }

      setHasPermission(true);
      fetchHealthData();
    });
  }, [fetchHealthData]);

  useEffect(() => {
    if (Platform.OS === 'ios' && AppleHealthKit) {
      AppleHealthKit.getAuthStatus({
        permissions: {
          read: [
            AppleHealthKit.Constants.Permissions.HeartRateVariability,
            AppleHealthKit.Constants.Permissions.RestingHeartRate,
            AppleHealthKit.Constants.Permissions.SleepAnalysis,
          ],
          write: [],
        }
      }, (err, results) => {
        if (!err && results && results.permissions && results.permissions.read && results.permissions.read.every(status => status === 2)) {
          requestPermissions();
        } else {
          setLoading(false);
        }
      });
    } else {
      setLoading(false);
    }
  }, [requestPermissions]);

  return {
    hasPermission,
    loading,
    healthData,
    error,
    requestPermissions,
    refresh: fetchHealthData
  };
}
