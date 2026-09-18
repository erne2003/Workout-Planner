import React, { useEffect, useRef, useState } from "react";
import { Modal, View, Text, StyleSheet, Pressable, TouchableOpacity, Platform } from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Line } from "react-native-svg";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";

interface ExerciseActionSheetProps {
  visible: boolean;
  exercise: { name: string; muscle?: string; accentColor?: string } | null | undefined;
  completedSets: number;
  onReplace: () => void;
  onRemove: () => void;
  onClose: () => void;
}

const SHEET_OFFSCREEN = 480;
// Extra sheet below the screen edge so the spring's small overshoot never reveals a gap
const SHEET_BLEED = 40;

function SwapIcon({ color }: { color: string }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8 3 4 7l4 4" />
      <Path d="M4 7h16" />
      <Path d="m16 21 4-4-4-4" />
      <Path d="M20 17H4" />
    </Svg>
  );
}

function TrashIcon({ color }: { color: string }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18" />
      <Path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <Path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <Line x1="10" x2="10" y1="11" y2="17" />
      <Line x1="14" x2="14" y1="11" y2="17" />
    </Svg>
  );
}

export default function ExerciseActionSheet({
  visible,
  exercise,
  completedSets,
  onReplace,
  onRemove,
  onClose,
}: ExerciseActionSheetProps) {
  const { colors, isLight } = useTheme();
  const insets = useSafeAreaInsets();
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // The chosen action runs only once the sheet's Modal is gone: iOS can't present
  // the swap Modal while this one is still being dismissed.
  const pendingAction = useRef<(() => void) | null>(null);
  const closing = useRef(false);

  const backdrop = useSharedValue(0);
  const sheetY = useSharedValue(SHEET_OFFSCREEN);

  const runPendingAction = () => {
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  };

  const finishClose = () => {
    setConfirmingRemove(false);
    onClose();
    // Modal's onDismiss is iOS-only; Android can open the next Modal right away
    if (Platform.OS !== "ios") runPendingAction();
  };

  const runDismiss = (action?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    pendingAction.current = action ?? null;
    backdrop.set(withTiming(0, { duration: 180 }));
    sheetY.set(withTiming(SHEET_OFFSCREEN, { duration: 200 }, (finished) => {
      if (finished) runOnJS(finishClose)();
    }));
  };

  // .set() rather than .value writes: same behavior, and the react-hooks lint understands it
  useEffect(() => {
    if (!visible) {
      backdrop.set(0);
      sheetY.set(SHEET_OFFSCREEN);
      return;
    }

    closing.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    backdrop.set(withTiming(1, { duration: 220 }));
    // Damping ratio ~0.8: one small settle (~1% of the travel) instead of a visible bounce.
    // mass must be explicit: Reanimated 4 defaults it to 4, which quietly halves the damping ratio.
    sheetY.set(withSpring(0, { damping: 26, stiffness: 260, mass: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));

  const handleRemovePress = () => {
    if (completedSets > 0) setConfirmingRemove(true);
    else runDismiss(onRemove);
  };

  // `exercise` goes null only after the exit animation, when the sheet is already off-screen
  const accent = exercise?.accentColor || colors.accentGreen;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => runDismiss()}
      onDismiss={runPendingAction}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={() => runDismiss()} accessibilityLabel="Close menu">
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <BlurView intensity={30} tint={isLight ? "light" : "dark"} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isLight ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.5)" }]} />
        </Animated.View>
      </Pressable>

      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          sheetStyle,
          { backgroundColor: colors.bgElevated, borderColor: colors.border, paddingBottom: insets.bottom + 12 + SHEET_BLEED },
        ]}
      >
        <View style={styles.header}>
          <View style={[styles.dot, { backgroundColor: accent }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{exercise?.name}</Text>
            {!!exercise?.muscle && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{exercise.muscle}</Text>}
          </View>
        </View>

        {confirmingRemove ? (
          <View>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>Remove {exercise?.name}?</Text>
            <Text style={[styles.confirmBody, { color: colors.textSecondary }]}>
              {completedSets} completed {completedSets === 1 ? "set" : "sets"} will be discarded from this workout.
            </Text>
            <TouchableOpacity
              onPress={() => runDismiss(onRemove)}
              style={[styles.button, { backgroundColor: colors.accentRed }]}
              accessibilityRole="button"
            >
              <Text style={[styles.buttonText, { color: "#fff" }]}>Remove</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setConfirmingRemove(false)}
              style={[styles.button, { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1 }]}
              accessibilityRole="button"
            >
              <Text style={[styles.buttonText, { color: colors.textPrimary }]}>Keep</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <View style={{ gap: 8 }}>
              <TouchableOpacity
                onPress={() => runDismiss(onReplace)}
                style={[styles.actionRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                accessibilityRole="button"
              >
                <SwapIcon color={colors.textPrimary} />
                <Text style={[styles.actionText, { color: colors.textPrimary }]}>Replace Exercise</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRemovePress}
                style={[styles.actionRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                accessibilityRole="button"
              >
                <TrashIcon color={colors.accentRed} />
                <Text style={[styles.actionText, { color: colors.accentRed }]}>Remove Exercise</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => runDismiss()}
              style={[styles.button, { marginTop: 14, borderColor: colors.border, borderWidth: 1 }]}
              accessibilityRole="button"
            >
              <Text style={[styles.buttonText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -SHEET_BLEED,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "700",
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  confirmBody: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    marginBottom: 16,
  },
  button: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
