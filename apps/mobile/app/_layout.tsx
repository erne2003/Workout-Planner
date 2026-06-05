import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { SettingsProvider, DataProvider } from '@apex/core';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

import { useTheme } from '../hooks/useTheme';

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
        // Pre-load all AsyncStorage data into a global sync cache to shim localStorage
        const keys = await AsyncStorage.getAllKeys();
        const pairs = await AsyncStorage.multiGet(keys);
        
        const cache: Record<string, string> = {};
        pairs.forEach(([key, val]) => {
          if (val !== null) {
            cache[key] = val;
          }
        });

        if (typeof global.localStorage === 'undefined') {
          global.localStorage = {
            getItem: (key: string) => cache[key] || null,
            setItem: (key: string, val: string) => {
              cache[key] = val;
              AsyncStorage.setItem(key, val);
            },
            removeItem: (key: string) => {
              delete cache[key];
              AsyncStorage.removeItem(key);
            },
            clear: () => {
              Object.keys(cache).forEach(k => delete cache[k]);
              AsyncStorage.clear();
            },
            length: Object.keys(cache).length,
            key: (index: number) => Object.keys(cache)[index] || null
          };
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
        <AppNavigator />
      </DataProvider>
    </SettingsProvider>
  );
}
