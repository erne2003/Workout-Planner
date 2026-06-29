import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../hooks/useTheme';
import { useData } from '@apex/core';

function CustomTabBar({ state, descriptors, navigation }: any) {
  const router = useRouter();
  const { colors, isLight } = useTheme();

  const { setToken } = useData() as any;

  const handleLogout = () => {
    global.localStorage.removeItem("token");
    global.localStorage.removeItem("userId");
    setToken(null);
    global.localStorage.removeItem("userName");
    router.replace("/login");
  };

  return (
    <View style={[styles.tabBarContainer, { borderTopColor: colors.border }]}>
      <BlurView intensity={30} tint={isLight ? "light" : "dark"} style={styles.blurView}>
        <View style={styles.tabContent}>
          {state.routes.filter((route: any) => route.name !== 'explore' && route.name !== 'strength').map((route: any, index: number) => {
            const { descriptors: allDesc } = descriptors as any || {};
            const descriptor = descriptors[route.key] || {};
            const { options } = descriptor;
            const label =
              options.tabBarLabel !== undefined
                ? options.tabBarLabel
                : options.title !== undefined
                  ? options.title
                  : route.name;

            const isFocused = state.routes[state.index]?.name === route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const color = isFocused ? colors.accentBlue : colors.textTertiary;

            // Custom Icons based on web BottomNav
            let IconComponent;
            switch (route.name) {
              case 'index':
                IconComponent = () => (
                  <Svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <Path d="M3 9.5L11 3l8 6.5V19a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M8 20v-8h6v8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                );
                break;
              case 'workout':
                IconComponent = () => (
                  <Svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <Path d="M3 11h2m12 0h2M5 11l2-4 4 8 4-8 2 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                );
                break;
              case 'recovery':
                IconComponent = () => (
                  <Svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <Path d="M11 3C7.686 3 5 5.686 5 9c0 4 6 10 6 10s6-6 6-10c0-3.314-2.686-6-6-6z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx="11" cy="9" r="2" stroke={color} strokeWidth="1.8" />
                  </Svg>
                );
                break;
              case 'strength':
                IconComponent = () => (
                  <Svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <Rect x="2" y="9" width="3" height="4" rx="1" stroke={color} strokeWidth="1.8" />
                    <Rect x="17" y="9" width="3" height="4" rx="1" stroke={color} strokeWidth="1.8" />
                    <Rect x="6" y="7" width="3" height="8" rx="1" stroke={color} strokeWidth="1.8" />
                    <Rect x="13" y="7" width="3" height="8" rx="1" stroke={color} strokeWidth="1.8" />
                    <Line x1="9" y1="11" x2="13" y2="11" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
                  </Svg>
                );
                break;
              case 'progress':
                IconComponent = () => (
                  <Svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <Polyline points="3,16 7,10 11,13 15,7 19,4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <Line x1="3" y1="19" x2="19" y2="19" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
                  </Svg>
                );
                break;
              default:
                IconComponent = () => null;
            }

            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                style={[
                  styles.tabButton,
                  isFocused && [styles.tabButtonFocused, { backgroundColor: isLight ? 'rgba(10,132,255,0.08)' : 'rgba(10,132,255,0.12)' }]
                ]}
              >
                <IconComponent />
                <Text style={[styles.tabLabel, { color: isFocused ? colors.accentBlue : colors.textTertiary }]}>
                  {label as string}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity onPress={handleLogout} style={styles.tabButton}>
            <Svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <Path d="M9 3H5a1 1 0 00-1 1v14a1 1 0 001 1h4" stroke={colors.textTertiary} strokeWidth="1.8" strokeLinecap="round" />
              <Path d="M15 15l4-4-4-4" stroke={colors.textTertiary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <Line x1="19" y1="11" x2="9" y2="11" stroke={colors.textTertiary} strokeWidth="1.8" strokeLinecap="round" />
            </Svg>
            <Text style={[styles.tabLabel, { color: colors.textTertiary }]}>OUT</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bgBase },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="workout" options={{ title: 'Workout' }} />
      <Tabs.Screen name="recovery" options={{ title: 'Recovery' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  blurView: {
    paddingTop: 10,
    paddingBottom: 28, // SafeArea basically
    paddingHorizontal: 12,
  },
  tabContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabButton: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  tabButtonFocused: {
    // Dynamically overridden
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
