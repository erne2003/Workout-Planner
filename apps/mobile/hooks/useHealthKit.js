import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { getStorage } from '@apex/core';

const createMockHealthKit = () => {
  return {
    Constants: {
      Permissions: {
        HeartRateVariability: 'HeartRateVariability',
        RestingHeartRate: 'RestingHeartRate',
        SleepAnalysis: 'SleepAnalysis',
      }
    },
    initHealthKit: (permissions, callback) => {
      console.log('[HealthKit Mock] initHealthKit called');
      callback(null);
    },
    getAuthStatus: (permissions, callback) => {
      console.log('[HealthKit Mock] getAuthStatus called');
      // Return 1 (Undetermined) so the user gets to tap "Sync" to test the flow
      callback(null, {
        permissions: {
          read: [1, 1, 1]
        }
      });
    },
    getRestingHeartRateSamples: (options, callback) => {
      console.log('[HealthKit Mock] getRestingHeartRateSamples called');
      callback(null, [
        { value: 62, startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
        { value: 58, startDate: new Date().toISOString() },
      ]);
    },
    getHeartRateVariabilitySamples: (options, callback) => {
      console.log('[HealthKit Mock] getHeartRateVariabilitySamples called');
      callback(null, [
        { value: 60, startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
        { value: 65, startDate: new Date().toISOString() },
      ]);
    },
    getSleepSamples: (options, callback) => {
      console.log('[HealthKit Mock] getSleepSamples called');
      const now = Date.now();
      callback(null, [
        { value: 'DEEP', startDate: new Date(now - 8 * 60 * 60 * 1000).toISOString(), endDate: new Date(now - 6.5 * 60 * 60 * 1000).toISOString() },
        { value: 'CORE', startDate: new Date(now - 6.5 * 60 * 60 * 1000).toISOString(), endDate: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
        { value: 'REM', startDate: new Date(now - 2 * 60 * 60 * 1000).toISOString(), endDate: new Date(now - 0.5 * 60 * 60 * 1000).toISOString() },
      ]);
    }
  };
};

let AppleHealthKit = null;
if (Platform.OS === 'ios') {
  try {
    const HealthKitPackage = require('react-native-health');
    const hk = HealthKitPackage.default || HealthKitPackage;
    if (hk && typeof hk.initHealthKit === 'function') {
      AppleHealthKit = hk;
    } else {
      console.warn('[HealthKit] Native methods are not available (expected in Expo Go). Activating developer mock.');
      AppleHealthKit = createMockHealthKit();
    }
  } catch (e) {
    console.warn('[HealthKit] Native package not found (expected in Expo Go / simulator). Activating developer mock. Error:', e.message);
    AppleHealthKit = createMockHealthKit();
  }
}

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

  const fetchHealthData = useCallback(() => {
    console.log("[HealthKit] fetchHealthData triggered");
    if (Platform.OS !== 'ios' || !AppleHealthKit) {
      console.log("[HealthKit] fetchHealthData aborted (Not iOS or AppleHealthKit not loaded)");
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
            resolve({ todayRHR: null, avg14DayRHR: null });
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
            resolve({ todayHRV: null, avg14DayHRV: null });
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
              sleepStages: null
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
    console.log("[HealthKit] requestPermissions triggered");
    if (Platform.OS !== 'ios' || !AppleHealthKit) {
      console.log("[HealthKit] requestPermissions aborted (Not iOS or AppleHealthKit not loaded)");
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

      getStorage()?.setItem('has_connected_healthkit', 'true');
      setHasPermission(true);
      fetchHealthData();
    });
  }, [fetchHealthData]);

  const disconnect = useCallback(() => {
    console.log("[HealthKit] Disconnecting and clearing state");
    getStorage()?.removeItem('has_connected_healthkit');
    setHasPermission(false);
    setHealthData(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'ios' && AppleHealthKit) {
      const alreadyConnected = getStorage()?.getItem('has_connected_healthkit') === 'true';
      if (alreadyConnected) {
        console.log("[HealthKit] Auto-syncing since integration is enabled");
        requestPermissions();
      } else {
        if (typeof AppleHealthKit.getAuthStatus === 'function') {
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
              console.log("[HealthKit] Auto-syncing from fallback AuthStatus authorized check");
              getStorage()?.setItem('has_connected_healthkit', 'true');
              setHasPermission(true);
              requestPermissions();
            } else {
              setLoading(false);
            }
          });
        } else {
          setLoading(false);
        }
      }
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
    disconnect,
    refresh: fetchHealthData
  };
}
