import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";

// "Jupiter's strike": a bolt hits the card, a laurel wreath grows, the bolt morphs into a check,
// and the session stats count up. Everything is driven by one clock, `t`, in seconds.

const APath = Animated.createAnimatedComponent(Path);

const C = {
  card: "#1b1d2a",
  text: "#e9e9ed",
  accent: "#9184d9",
  accent300: "#d2cefd",
  accent400: "#b5abfc",
  accent700: "#5d5294",
  accent900: "#2b2741",
  neutral500: "#9397ab",
  neutral600: "#75798c",
  neutral800: "#3f424d",
};

const STRIKE = 0.32;
const HIT = STRIKE + 0.09;
const MORPH = HIT + 0.95;
const CLOSE_MS = 260;
const EMBLEM = 140;

const cl = (x: number) => { "worklet"; return Math.max(0, Math.min(1, x)); };
const lin = (t: number, s: number, e: number) => { "worklet"; return cl((t - s) / (e - s)); };
const oc = (x: number) => { "worklet"; return 1 - Math.pow(1 - x, 3); };
const oq = (x: number) => { "worklet"; return 1 - Math.pow(1 - x, 4); };
const io = (x: number) => { "worklet"; return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const back = (k: number, x: number) => { "worklet"; return 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2); };
const spring = (x: number) => { "worklet"; return x >= 1 ? 1 : 1 - Math.exp(-6 * x) * Math.cos(x * 14); };
const pulse = (t: number, at: number, w: number) => {
  "worklet";
  const x = (t - at) / w;
  return x < 0 || x > 1 ? 0 : Math.sin(Math.PI * x) * (1 - x);
};
const hitAt = (t: number) => { "worklet"; return pulse(t, HIT, 0.4); };

const LEAVES = (() => {
  const out: { x: number; y: number; rot: number; start: number }[] = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 8; i++) {
      const deg = 90 - side * (22 + i * 17);
      const R = 52 + (i % 2 ? 7 : -7);
      const r = (deg * Math.PI) / 180;
      out.push({
        x: 70 + R * Math.cos(r),
        y: 70 + R * Math.sin(r),
        rot: Math.round(deg + side * (i % 2 ? -28 : 28)),
        start: HIT + 0.2 + i * 0.07,
      });
    }
  }
  return out;
})();

const SPARKS = Array.from({ length: 10 }, (_, i) => ({
  ang: 36 * i + 18,
  dur: 0.45 + (i % 3) * 0.08,
  reach: i % 2 ? 70 : 90,
  len: i % 2 ? 10 : 16,
}));

// 24 thin wedges, as in the source's repeating conic gradient (3° on, 12° off)
const RAY_PATH = (() => {
  const R = 270;
  let d = "";
  for (let k = 0; k < 24; k++) {
    const a0 = ((k * 15 - 90) * Math.PI) / 180;
    const a1 = ((k * 15 + 3 - 90) * Math.PI) / 180;
    d += `M${R} ${R} L${(R + R * Math.cos(a0)).toFixed(1)} ${(R + R * Math.sin(a0)).toFixed(1)} A${R} ${R} 0 0 1 ${(R + R * Math.cos(a1)).toFixed(1)} ${(R + R * Math.sin(a1)).toFixed(1)} Z `;
  }
  return d;
})();

const STAT_START = [1.55, 1.65, 1.75];

function durationText(secs: number) {
  const s = Math.max(0, Math.round(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function Leaf({ t, leaf }: { t: SharedValue<number>; leaf: (typeof LEAVES)[number] }) {
  const style = useAnimatedStyle(() => ({
    opacity: oc(lin(t.value, leaf.start, leaf.start + 0.08)),
    transform: [{ rotate: `${leaf.rot}deg` }, { scale: Math.max(0, back(2.4, lin(t.value, leaf.start, leaf.start + 0.3))) }],
  }));
  return <Animated.View style={[styles.leaf, { left: leaf.x - 4.5, top: leaf.y - 10 }, style]} />;
}

function Spark({ t, spark }: { t: SharedValue<number>; spark: (typeof SPARKS)[number] }) {
  const style = useAnimatedStyle(() => {
    const p = cl((t.value - HIT) / spark.dur);
    return {
      height: Math.max(0, spark.len * (1 - p)),
      opacity: p <= 0 || p >= 1 ? 0 : 1 - p * p,
      transform: [{ rotate: `${spark.ang}deg` }, { translateY: -(40 + spark.reach * oq(p)) }],
    };
  });
  return <Animated.View style={[styles.spark, style]} />;
}

function Stat({ t, index, value, label }: { t: SharedValue<number>; index: number; value: string; label: string }) {
  const s = STAT_START[index];
  const style = useAnimatedStyle(() => {
    const land = pulse(t.value, s + 0.55, 0.25);
    return {
      opacity: oc(lin(t.value, s, s + 0.15)),
      transform: [
        { translateY: 20 * (1 - back(2, lin(t.value, s, s + 0.4))) },
        { scale: 0.8 + 0.2 * back(2.4, lin(t.value, s, s + 0.4)) + 0.08 * land },
      ],
    };
  });
  const valueStyle = useAnimatedStyle(() => ({ color: pulse(t.value, s + 0.55, 0.25) > 0.05 ? C.accent300 : C.text }));
  return (
    <Animated.View style={[styles.stat, style]}>
      <Animated.Text style={[styles.statValue, valueStyle]} numberOfLines={1} adjustsFontSizeToFit>{value}</Animated.Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

interface WorkoutCompleteOverlayProps {
  visible: boolean;
  kicker: string;
  durationSecs: number;
  volume: number;
  sets: number;
  unit: string;
  actionLabel?: string;
  onDismiss: () => void;
}

export default function WorkoutCompleteOverlay({ visible, kicker, durationSecs, volume, sets, unit, actionLabel = "Done", onDismiss }: WorkoutCompleteOverlayProps) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  const out = useSharedValue(0);
  const closing = useRef(false);
  const [counts, setCounts] = useState([0, 0, 0]);

  useEffect(() => {
    if (!visible) return;
    closing.current = false;
    out.set(0);
    if (reduce) {
      t.set(3);
      return;
    }
    t.set(0);
    t.set(withTiming(30, { duration: 30000, easing: Easing.linear }));
    const timers = [
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), HIT * 1000),
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), (MORPH + 0.3) * 1000),
    ];
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimation(t);
    };
  }, [visible, reduce, t, out]);

  useAnimatedReaction(
    () => STAT_START.map((s) => Math.round(oq(lin(t.value, s, s + 0.55)) * 60) / 60),
    (next, prev) => {
      if (!prev || next[0] !== prev[0] || next[1] !== prev[1] || next[2] !== prev[2]) runOnJS(setCounts)(next);
    },
  );

  const dismiss = () => {
    if (closing.current) return;
    closing.current = true;
    out.set(withTiming(1, { duration: reduce ? 1 : CLOSE_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onDismiss)();
    }));
  };

  const stats = useMemo(() => [
    { label: "Duration", value: durationText(durationSecs * counts[0]) },
    { label: "Volume", value: `${Math.round(volume * counts[1]).toLocaleString("en-US")} ${unit}` },
    { label: "Sets", value: String(Math.round(sets * counts[2])) },
  ], [counts, durationSecs, volume, sets, unit]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: oc(lin(t.value, 0, 0.3)) * (1 - out.value) }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, (pulse(t.value, HIT - 0.02, 0.35) * 1.4 + pulse(t.value, HIT + 0.2, 0.2) * 0.6) * (1 - out.value)),
  }));

  const cardStyle = useAnimatedStyle(() => {
    const tv = t.value;
    const o = out.value;
    const hit = hitAt(tv);
    const cardP = spring(lin(tv, HIT - 0.02, HIT + 0.6));
    const shake = hit * 4 + pulse(tv, HIT + 0.2, 0.2) * 2;
    return {
      opacity: oc(lin(tv, HIT - 0.04, HIT + 0.08)) * (1 - o),
      borderColor: tv > HIT && tv < HIT + 0.6 ? C.accent700 : C.neutral800,
      shadowRadius: 12 + 25 * hit,
      shadowOpacity: 0.3 + 0.5 * hit,
      transform: [
        { translateX: Math.sin(tv * 90) * shake },
        { translateY: 40 * (1 - cardP) + 30 * o + Math.cos(tv * 70) * shake },
        { scale: (0.82 + 0.18 * cardP) * (1 + 0.03 * hit) - 0.04 * o },
      ],
    };
  });

  const raysStyle = useAnimatedStyle(() => {
    const tv = t.value;
    return {
      opacity: io(lin(tv, HIT + 0.1, HIT + 1.0)) * (0.85 + 0.15 * Math.sin(tv * 3)) * (1 - oc(lin(tv, 2.1, 2.4))),
      transform: [{ rotate: `${tv * 10}deg` }, { scale: 0.7 + 0.3 * oq(lin(tv, HIT + 0.1, HIT + 1.1)) }],
    };
  });
  const glowStyle = useAnimatedStyle(() => {
    const tv = t.value;
    return { opacity: oc(lin(tv, HIT, HIT + 0.4)) * (0.6 + 0.4 * Math.min(1, hitAt(tv) * 3)) + 0.1 * Math.sin(tv * 4) * oc(lin(tv, 1.4, 1.8)) };
  });
  const waveStyle = useAnimatedStyle(() => {
    const p = cl((t.value - HIT) / 0.7);
    return {
      opacity: p <= 0 || p >= 1 ? 0 : (1 - p) * 0.9,
      transform: [{ scale: 0.6 + 1.8 * oq(lin(t.value, HIT, HIT + 0.7)) }],
    };
  });
  const boltStyle = useAnimatedStyle(() => {
    const tv = t.value;
    const life = cl((tv - STRIKE) / 0.6);
    const flick = Math.abs(Math.sin(tv * 70)) > 0.5 ? 1 : 0.35;
    return { opacity: tv < STRIKE || life >= 1 ? 0 : (1 - life * life) * flick };
  });
  const boltProps = useAnimatedProps(() => ({ strokeDashoffset: 560 * (1 - lin(t.value, STRIKE, HIT)) }));
  const branchProps = useAnimatedProps(() => ({ strokeDashoffset: 120 * (1 - lin(t.value, STRIKE + 0.05, HIT + 0.04)) }));
  const branch2Props = useAnimatedProps(() => ({ strokeDashoffset: 90 * (1 - lin(t.value, STRIKE + 0.07, HIT + 0.06)) }));
  const stemProps = useAnimatedProps(() => ({ strokeDashoffset: 128 * (1 - io(lin(t.value, HIT + 0.15, HIT + 0.85))) }));

  const emblemStyle = useAnimatedStyle(() => {
    const tv = t.value;
    const m = lin(tv, MORPH, MORPH + 0.22);
    return {
      opacity: 1 - oc(lin(tv, MORPH + 0.02, MORPH + 0.2)),
      shadowRadius: (4 + 10 * hitAt(tv) + 3 * (0.5 + 0.5 * Math.sin(tv * 5))) / 2,
      transform: [{ scale: (0.5 + 0.5 * back(2.6, lin(tv, HIT, HIT + 0.45))) * (1 - 0.6 * m * m) }, { rotate: `${25 * m * m}deg` }],
    };
  });
  const emblemProps = useAnimatedProps(() => ({
    strokeDashoffset: 200 * (1 - oc(lin(t.value, HIT, HIT + 0.35))),
    fillOpacity: Math.round(oc(lin(t.value, HIT + 0.25, HIT + 0.6)) * 45) / 100,
  }));
  const checkStyle = useAnimatedStyle(() => {
    const tv = t.value;
    return {
      opacity: oc(lin(tv, MORPH + 0.1, MORPH + 0.2)),
      shadowRadius: (4 + 14 * pulse(tv, MORPH + 0.3, 0.5) + 3 * (0.5 + 0.5 * Math.sin(tv * 5))) / 2,
      transform: [{ scale: tv < MORPH + 0.1 ? 0.6 : 0.6 + 0.4 * back(2.8, lin(tv, MORPH + 0.1, MORPH + 0.5)) }],
    };
  });
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: 64 * (1 - oc(lin(t.value, MORPH + 0.12, MORPH + 0.38))) }));

  const kickerStyle = useAnimatedStyle(() => ({
    opacity: oc(lin(t.value, 1.2, 1.45)),
    letterSpacing: 7 - 5 * oq(lin(t.value, 1.2, 1.75)),
  }));
  const titleStyle = useAnimatedStyle(() => {
    const p = lin(t.value, 1.15, 1.55);
    return {
      opacity: oc(lin(t.value, 1.15, 1.32)),
      transform: [{ translateY: 24 * (1 - back(1.8, p)) }, { scale: 0.85 + 0.15 * back(2.2, p) }],
    };
  });
  const subStyle = useAnimatedStyle(() => ({
    opacity: oc(lin(t.value, 1.35, 1.65)),
    transform: [{ translateY: 8 * (1 - oq(lin(t.value, 1.35, 1.7))) }],
  }));
  const ruleStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: oq(lin(t.value, 1.35, 1.75)) }] }));
  const buttonStyle = useAnimatedStyle(() => {
    const tv = t.value;
    return {
      opacity: oc(lin(tv, 2.0, 2.25)),
      shadowRadius: (18 * (0.5 + 0.5 * Math.sin((tv - 2.35) * 4)) * oc(lin(tv, 2.35, 2.65))) / 2,
      transform: [{ translateY: 16 * (1 - back(1.6, lin(tv, 2.0, 2.35))) }],
    };
  });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Dismiss" accessibilityRole="button">
            <Svg width="100%" height="100%">
              <Defs>
                <RadialGradient id="backdrop" cx="50%" cy="30%" r="75%">
                  <Stop offset="0" stopColor="#2b2741" stopOpacity={0.85} />
                  <Stop offset="0.7" stopColor="#0a0b12" stopOpacity={0.9} />
                  <Stop offset="1" stopColor="#0a0b12" stopOpacity={0.9} />
                </RadialGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#backdrop)" />
            </Svg>
          </Pressable>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, flashStyle]}>
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="flash" cx="50%" cy="0%" rx="75%" ry="75%">
                <Stop offset="0" stopColor={C.accent300} stopOpacity={0.55} />
                <Stop offset="0.4" stopColor={C.accent} stopOpacity={0.18} />
                <Stop offset="1" stopColor="#161826" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#flash)" />
          </Svg>
        </Animated.View>

        <View style={styles.center} pointerEvents="box-none">
          <Animated.View style={[styles.card, cardStyle]}>
            <View style={{ alignItems: "center" }}>
              <View style={styles.emblemBox}>
                <View pointerEvents="none" style={styles.anchor}>
                  <Animated.View style={[styles.rays, raysStyle]}>
                    <Svg width={540} height={540}>
                      <Defs>
                        <RadialGradient id="rays" cx="270" cy="270" r="382" gradientUnits="userSpaceOnUse">
                          <Stop offset="0.12" stopColor={C.accent} stopOpacity={0.22} />
                          <Stop offset="0.62" stopColor={C.accent} stopOpacity={0} />
                        </RadialGradient>
                      </Defs>
                      <Path d={RAY_PATH} fill="url(#rays)" />
                    </Svg>
                  </Animated.View>
                  <Animated.View style={[styles.glow, glowStyle]}>
                    <Svg width={300} height={300}>
                      <Defs>
                        <RadialGradient id="glow" cx="150" cy="150" r="212" gradientUnits="userSpaceOnUse">
                          <Stop offset="0" stopColor={C.accent400} stopOpacity={0.45} />
                          <Stop offset="0.62" stopColor={C.card} stopOpacity={0} />
                        </RadialGradient>
                      </Defs>
                      <Circle cx={150} cy={150} r={150} fill="url(#glow)" />
                    </Svg>
                  </Animated.View>
                  <Animated.View style={[styles.wave, waveStyle]} />
                  <Animated.View style={[styles.bolt, boltStyle]}>
                    <Svg width={140} height={480} viewBox="0 -60 140 480">
                      <APath animatedProps={boltProps} d="M92 -60 L64 40 L88 58 L50 150 L80 170 L44 262 L74 282 L60 340 L70 420" fill="none" stroke={C.text} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="560" />
                      <APath animatedProps={branchProps} d="M88 58 L120 96 L112 120 L132 150" fill="none" stroke={C.accent300} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="120" />
                      <APath animatedProps={branch2Props} d="M80 170 L42 196 L30 230" fill="none" stroke={C.accent300} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="90" />
                    </Svg>
                  </Animated.View>
                  {SPARKS.map((sp, i) => <Spark key={i} t={t} spark={sp} />)}
                </View>

                <Svg width={EMBLEM} height={EMBLEM} style={StyleSheet.absoluteFill}>
                  <APath animatedProps={stemProps} d="M79 121.2 A52 52 0 0 0 96 25" fill="none" stroke={C.accent} strokeWidth={1.6} strokeLinecap="round" strokeDasharray="128" />
                  <APath animatedProps={stemProps} d="M61 121.2 A52 52 0 0 1 44 25" fill="none" stroke={C.accent} strokeWidth={1.6} strokeLinecap="round" strokeDasharray="128" />
                </Svg>
                {LEAVES.map((lf, i) => <Leaf key={i} t={t} leaf={lf} />)}

                <Animated.View style={[StyleSheet.absoluteFill, styles.glowShadow, emblemStyle]}>
                  <Svg width={EMBLEM} height={EMBLEM}>
                    <APath animatedProps={emblemProps} d="M80 36 L56 76 L71 76 L60 106 L86 64 L71 64 Z" fill={C.accent} stroke={C.text} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="200" />
                  </Svg>
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, styles.glowShadow, checkStyle]}>
                  <Svg width={EMBLEM} height={EMBLEM}>
                    <APath animatedProps={checkProps} d="M49 71 L63 85 L92 55" fill="none" stroke={C.text} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="64" />
                  </Svg>
                </Animated.View>
              </View>

              <Animated.Text style={[styles.kicker, kickerStyle]} numberOfLines={1}>{kicker}</Animated.Text>
              <Animated.Text style={[styles.title, titleStyle]} accessibilityRole="header">Workout Completed</Animated.Text>
              <Animated.Text style={[styles.sub, subStyle]}>Per aspera ad astra</Animated.Text>
            </View>

            <Animated.View style={[styles.rule, ruleStyle]}>
              <LinearGradient colors={["transparent", C.accent, C.accent, "transparent"]} locations={[0, 0.3, 0.7, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </Animated.View>

            <View style={styles.stats}>
              {stats.map((st, i) => <Stat key={st.label} t={t} index={i} value={st.value} label={st.label} />)}
            </View>

            <Animated.View style={[styles.buttonWrap, buttonStyle]}>
              <Pressable onPress={dismiss} accessibilityRole="button" style={({ pressed }) => [styles.button, pressed && { backgroundColor: "rgba(145,132,217,0.22)" }]}>
                <Text style={styles.buttonText}>{actionLabel}</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "center", paddingHorizontal: 20 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: C.card,
    paddingTop: 22,
    paddingHorizontal: 24,
    paddingBottom: 22,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  emblemBox: { width: EMBLEM, height: EMBLEM },
  anchor: { position: "absolute", left: EMBLEM / 2, top: EMBLEM / 2, width: 0, height: 0 },
  rays: { position: "absolute", left: -270, top: -270, width: 540, height: 540 },
  glow: { position: "absolute", left: -150, top: -150, width: 300, height: 300 },
  wave: { position: "absolute", left: -70, top: -70, width: 140, height: 140, borderRadius: 70, borderWidth: 2, borderColor: C.accent300 },
  bolt: {
    position: "absolute",
    left: -70,
    top: -480,
    width: 140,
    height: 480,
    shadowColor: C.accent400,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  spark: { position: "absolute", left: -1, top: 0, width: 2, borderRadius: 2, backgroundColor: C.accent300, transformOrigin: "50% 0%" },
  leaf: { position: "absolute", width: 9, height: 20, borderRadius: 10, backgroundColor: C.accent900, borderWidth: 1.5, borderColor: C.accent400 },
  glowShadow: { shadowColor: C.accent400, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9 },
  kicker: { marginTop: 14, fontSize: 11, textTransform: "uppercase", color: C.accent300 },
  title: { marginTop: 8, fontSize: 30, fontWeight: "500", letterSpacing: -0.6, color: C.text, textAlign: "center" },
  sub: { marginTop: 6, fontSize: 13, fontStyle: "italic", color: C.neutral500, textAlign: "center" },
  rule: { height: 1, marginTop: 22, marginHorizontal: -24, opacity: 0.6 },
  stats: { flexDirection: "row", gap: 8, paddingTop: 18, paddingBottom: 22 },
  stat: { flex: 1, alignItems: "center", gap: 6 },
  statValue: { fontSize: 21, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: C.neutral600 },
  buttonWrap: { borderRadius: 8, shadowColor: C.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45 },
  button: { height: 46, borderRadius: 8, borderWidth: 1, borderColor: C.accent, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 15, fontWeight: "500", color: C.accent },
});
