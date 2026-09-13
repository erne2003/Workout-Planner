import React, { useEffect } from "react";
import { Modal, View, Text, StyleSheet, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";

type CelebrationType = "workout" | "pr";

interface CelebrationOverlayProps {
  visible: boolean;
  type: CelebrationType;
  title: string;
  subtitle?: string;
  onDismiss: () => void;
  autoDismissMs?: number;
}

const PARTICLE_COUNT = 10;
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  angle: (360 / PARTICLE_COUNT) * i,
  distance: 68 + (i % 3) * 14,
  size: 6 + (i % 3) * 2,
}));

function Particle({
  burst,
  angle,
  distance,
  size,
  color,
}: {
  burst: SharedValue<number>;
  angle: number;
  distance: number;
  size: number;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const rad = (angle * Math.PI) / 180;
    const travelled = interpolate(burst.value, [0, 1], [0, distance]);
    return {
      opacity: interpolate(burst.value, [0, 0.12, 0.75, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: Math.cos(rad) * travelled },
        { translateY: Math.sin(rad) * travelled },
        { scale: interpolate(burst.value, [0, 0.25, 1], [0.4, 1, 0.5]) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color, marginLeft: -size / 2, marginTop: -size / 2 },
        style,
      ]}
    />
  );
}

export default function CelebrationOverlay({
  visible,
  type,
  title,
  subtitle,
  onDismiss,
  autoDismissMs = 1900,
}: CelebrationOverlayProps) {
  const { colors, isLight } = useTheme();

  const accent = type === "pr" ? colors.accentYellow : colors.accentGreen;
  const icon = type === "pr" ? "🏆" : "🎉";
  const particleColors =
    type === "pr"
      ? [colors.accentYellow, colors.accentOrange, colors.accentGreen]
      : [colors.accentGreen, colors.accentBlue, colors.accentYellow];

  const backdrop = useSharedValue(0);
  const cardScale = useSharedValue(0.6);
  const iconScale = useSharedValue(0);
  const iconRotate = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textY = useSharedValue(10);
  const burst = useSharedValue(0);

  const runDismiss = () => {
    backdrop.value = withTiming(0, { duration: 180 });
    cardScale.value = withTiming(0.9, { duration: 180 }, (finished) => {
      if (finished) runOnJS(onDismiss)();
    });
  };

  useEffect(() => {
    if (!visible) {
      backdrop.value = 0;
      cardScale.value = 0.6;
      iconScale.value = 0;
      iconRotate.value = 0;
      textOpacity.value = 0;
      textY.value = 10;
      burst.value = 0;
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    backdrop.value = withTiming(1, { duration: 220 });
    cardScale.value = withSequence(
      withSpring(1.05, { damping: 9, stiffness: 170 }),
      withSpring(1, { damping: 14, stiffness: 180 })
    );
    iconScale.value = withDelay(
      80,
      withSequence(
        withSpring(1.25, { damping: 6, stiffness: 200 }),
        withSpring(1, { damping: 10, stiffness: 200 })
      )
    );
    iconRotate.value = withDelay(
      80,
      withSequence(
        withTiming(-8, { duration: 90 }),
        withTiming(8, { duration: 120 }),
        withTiming(0, { duration: 120 })
      )
    );
    burst.value = 0;
    burst.value = withDelay(120, withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) }));
    textOpacity.value = withDelay(160, withTiming(1, { duration: 260 }));
    textY.value = withDelay(160, withTiming(0, { duration: 260 }));

    const timer = setTimeout(runDismiss, autoDismissMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }, { rotate: `${iconRotate.value}deg` }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={runDismiss}>
      <Pressable style={StyleSheet.absoluteFill} onPress={runDismiss}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <BlurView intensity={40} tint={isLight ? "light" : "dark"} style={StyleSheet.absoluteFill} />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isLight ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.45)" },
            ]}
          />
        </Animated.View>

        <View style={styles.center} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.card,
              cardStyle,
              { backgroundColor: isLight ? "#ffffff" : "#15151c", borderColor: accent, shadowColor: accent },
            ]}
          >
            <View style={styles.particleField}>
              {PARTICLES.map((p, i) => (
                <Particle key={i} burst={burst} angle={p.angle} distance={p.distance} size={p.size} color={particleColors[i % particleColors.length]} />
              ))}
              <Animated.Text style={[styles.icon, iconStyle]}>{icon}</Animated.Text>
            </View>

            <Animated.View style={textStyle}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
              {!!subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
            </Animated.View>
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 28,
    borderWidth: 1.5,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  particleField: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  particle: {
    position: "absolute",
    left: "50%",
    top: "50%",
  },
  icon: {
    fontSize: 56,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
});
