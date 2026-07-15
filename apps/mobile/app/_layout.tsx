import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { SettingsProvider, DataProvider, registerStorage, registerSecureStorage } from '@apex/core';
import AuthGuard from '../components/AuthGuard';

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
    <SettingsProvider>
      <DataProvider>
        <AuthGuard>
          <AppNavigator />
        </AuthGuard>
      </DataProvider>
    </SettingsProvider>
  );
}
