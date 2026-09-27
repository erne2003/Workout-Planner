import React, { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SettingsProvider, DataProvider, registerStorage, registerSecureStorage, useData, fetchWithTimeout } from '@apex/core';
import AuthGuard from '../components/AuthGuard';
import FirstSyncBanner from '../components/FirstSyncBanner';
import { HealthKitProvider } from '../hooks/useHealthKit';
import { registerLocalDatabase } from '../lib/localDatabase';

import { useTheme } from '../hooks/useTheme';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppNavigator() {
  const { colors, isLight } = useTheme();

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgBase } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="onboarding" />
      </Stack>
      <StatusBar style={isLight ? "dark" : "light"} />
    </>
  );
}

/* One HealthKit connection for the whole app; it only syncs once signed in */
function AppHealthKitProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useData() as any;
  return <HealthKitProvider enabled={!!isAuthenticated}>{children}</HealthKitProvider>;
}

/* Sync when the app returns to the foreground or the device comes back online.
   prefetchAll syncs the local database on mobile (refetches from the API on web). */
function SyncTriggers() {
  const { prefetchAll, isAuthenticated } = useData() as any;
  const appState = useRef(AppState.currentState);
  const wasOffline = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === 'active' &&
        isAuthenticated
      ) {
        prefetchAll();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [prefetchAll, isAuthenticated]);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      // isInternetReachable is null while unknown; only a definite false is offline
      const online = !!state.isConnected && state.isInternetReachable !== false;
      if (online && wasOffline.current && isAuthenticated) prefetchAll();
      wasOffline.current = !online;
    });
  }, [prefetchAll, isAuthenticated]);

  return null;
}

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load all AsyncStorage data into a synchronous in-memory cache
        const keys = await AsyncStorage.getAllKeys();
        const pairs = await AsyncStorage.multiGet(keys);

        const cache: Record<string, string> = {};
        pairs.forEach(([key, val]) => {
          if (val !== null) {
            cache[key] = val;
          }
        });

        // ── General storage adapter (settings, UI state, preferences) ──
        // Cache-first reads, fire-and-forget writes. Acceptable because
        // losing a settings write on an immediate kill is low-stakes.
        registerStorage({
          getItem: (key: string) => cache[key] ?? null,
          setItem: (key: string, val: string) => {
            cache[key] = val;
            AsyncStorage.setItem(key, val).catch((e) =>
              console.warn('[storage] write failed', key, e)
            );
          },
          removeItem: (key: string) => {
            delete cache[key];
            AsyncStorage.removeItem(key).catch((e) =>
              console.warn('[storage] remove failed', key, e)
            );
          },
          clear: () => {
            Object.keys(cache).forEach((k) => delete cache[k]);
            AsyncStorage.clear().catch((e) =>
              console.warn('[storage] clear failed', e)
            );
          },
          get length() {
            return Object.keys(cache).length; // live getter, not a stale snapshot
          },
          key: (index: number) => Object.keys(cache)[index] ?? null,
        });

        // ── Secure storage adapter (auth token) ─────────────────────────
        // Encrypted at rest via expo-secure-store. All callers must await
        // writes before treating login/logout as complete.
        registerSecureStorage({
          getItemAsync: (key: string) => SecureStore.getItemAsync(key),
          setItemAsync: (key: string, val: string) => SecureStore.setItemAsync(key, val),
          removeItemAsync: (key: string) => SecureStore.deleteItemAsync(key),
        });

        // ── Local database (offline-first data) ─────────────────────────
        registerLocalDatabase();

        // ── Migration: move token from AsyncStorage (old shim) → SecureStore ──
        // Existing users have their token in AsyncStorage. Move it to
        // SecureStore so they don't get logged out on this update.
        if (cache['token']) {
          const existingSecureToken = await SecureStore.getItemAsync('token');
          if (!existingSecureToken) {
            await SecureStore.setItemAsync('token', cache['token']);
          }
          // Clean up old plaintext token from AsyncStorage
          delete cache['token'];
          await AsyncStorage.removeItem('token');
        }

        // ── Warm up the backend server ──────────────────────────────────
        // The backend may be on a cold-start hosting tier. Fire-and-forget:
        // boot must never wait on the network, or a sleeping or unreachable
        // server holds the splash screen.
        const apiUrl = process.env.EXPO_PUBLIC_API_URL;
        if (apiUrl) {
          fetchWithTimeout(`${apiUrl}/health`, {}, 5000).catch(() => { /* best-effort */ });
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <DataProvider>
          <SyncTriggers />
          <AuthGuard>
            <AppHealthKitProvider>
              <AppNavigator />
            </AppHealthKitProvider>
          </AuthGuard>
          <FirstSyncBanner />
        </DataProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}
