import React, { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import WorkoutCompleteOverlay from "@/components/WorkoutCompleteOverlay";
import { useTheme } from "@/hooks/useTheme";

type Summary = any;
type Analysis = any;
type SetRow = any;

interface WorkoutRecapProps {
  visible: boolean;
  summary: Summary | null;
  routineName: string;
  sessionNumber: number;
  durationSecs: number;
  unit: string;
  onDone: () => void;
  onApplyPlan: () => void;
}

const MINUS = "−";
const BAR_H = 72;
const LABEL_H = 34;

const MUSCLE_COLORS: Record<string, string> = {
  Chest: "#0A84FF",
  Back: "#BF5AF2",
  Shoulders: "#FF9F0A",
  Legs: "#FFD60A",
  Arms: "#30D158",
  Core: "#FF3B30",
};

const STATUS_LABEL: Record<string, string> = {
  improved: "Improved",
  held: "Held",
  dipped: "Dipped",
  declined: "Declined",
  new: "New",
};

const ACTIONS: Record<string, { title: string; icon: string; tone: "green" | "blue" | "orange" | "neutral" }> = {
  drop_weight: { title: "Drop weight, build reps back up", icon: "M7 3v8M3.5 7.5L7 11l3.5-3.5", tone: "orange" },
  increase_weight: { title: "Increase weight, expect fewer reps", icon: "M7 11V3M3.5 6.5L7 3l3.5 3.5", tone: "green" },
  add_set: { title: "Stay put, add a set", icon: "M7 3v8M3 7h8", tone: "blue" },
  add_reps: { title: "Keep weight, add reps", icon: "M7 3v8M3 7h8", tone: "blue" },
  hold: { title: "Hold weight, match last time", icon: "M3 5h8M3 9h8", tone: "neutral" },
  progress_variation: { title: "Add load or a harder variation", icon: "M7 11V3M3.5 6.5L7 3l3.5 3.5", tone: "green" },
};

function usePalette() {
  const { colors, isLight } = useTheme();
  return {
    ...colors,
    isLight,
    green: isLight ? "#1F8A3B" : "#30D158",
    red: isLight ? "#D70036" : "#FF2D55",
    orange: isLight ? "#B35300" : "#FF9F0A",
    blue: isLight ? "#0060DF" : "#0A84FF",
    volume: isLight ? colors.textPrimary : "#FFD60A",
    neutralBar: isLight ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.28)",
    subtle: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)",
    textMuted: isLight ? "rgba(0,0,0,0.62)" : "rgba(255,255,255,0.6)",
  };
}
type Palette = ReturnType<typeof usePalette>;

const num = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 });
const whole = (n: number) => Math.round(n).toLocaleString("en-US");
const sign = (d: number) => (d > 0 ? "+" : MINUS);
const signed = (d: number, suffix = "") => (d === 0 ? `0${suffix}` : `${sign(d)}${num(Math.abs(d))}${suffix}`);
const pctText = (p: number) => (p === 0 ? "0%" : `${sign(p)}${Math.abs(p).toFixed(1)}%`);
const arrow = (d: number) => (d > 0 ? "▲ " : d < 0 ? "▼ " : "");
const plural = (n: number, one: string, many: string) => (Math.abs(n) === 1 ? one : many);
const setText = (s: { weight: number; reps: number }) => (s.weight > 0 ? `${num(s.weight)} × ${s.reps}` : `${s.reps} reps`);

function seriesText(sets: { weight: number; reps: number }[], unit: string) {
  if (!sets.length) return "—";
  const w = sets[0].weight;
  if (sets.every((s) => s.weight === w)) {
    return w > 0 ? `${num(w)} ${unit} × ${sets.map((s) => s.reps).join(" · ")}` : `${sets.map((s) => s.reps).join(" · ")} reps`;
  }
  return sets.map(setText).join(" · ");
}

function targetText(rec: { weight: number; reps: number[] }, unit: string) {
  return rec.weight > 0 ? `${num(rec.weight)} ${unit} × ${rec.reps.join(" · ")}` : `${rec.reps.join(" · ")} reps`;
}

function setDelta(row: SetRow) {
  if (row.kind === "added") return 1;
  if (row.kind === "skipped") return -1;
  return row.cur.weight > 0 || row.prev.weight > 0 ? row.strengthDelta : row.repsDelta;
}

function deltaColor(d: number, p: Palette) {
  return d > 0.05 ? p.green : d < -0.05 ? p.red : p.textMuted;
}

function setBarColor(row: SetRow, p: Palette) {
  const d = setDelta(row);
  return d > 0.05 ? p.green : d < -0.05 ? p.red : p.neutralBar;
}

function Chip({ text, delta, small, color }: { text: string; delta: number; small?: boolean; color?: string }) {
  const p = usePalette();
  const fg = color || (delta > 0 ? p.green : delta < 0 ? p.red : p.textMuted);
  const bg = color ? p.border : delta > 0 ? "rgba(48,209,88,0.15)" : delta < 0 ? "rgba(255,45,85,0.14)" : p.border;
  return (
    <View style={[styles.chip, small && styles.chipSmall, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, small && styles.chipTextSmall, { color: fg }]}>{text}</Text>
    </View>
  );
}

function GrowBar({ fraction, color, delay = 250 }: { fraction: number; color: string; delay?: number }) {
  const reduce = useReducedMotion();
  const progress = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) progress.set(withDelay(delay, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })));
  }, [reduce, delay, progress]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  const width = `${Math.max(0, Math.min(1, fraction)) * 100}%` as const;
  return <Animated.View style={[styles.growFill, { width, backgroundColor: color }, style]} />;
}

function useCountUp(target: number, duration = 900) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduce]);
  return reduce ? target : value;
}

function Chevron({ open, color }: { open: boolean; color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
      <Path d="M3 5l4 4 4-4" />
    </Svg>
  );
}

function Section({ index, children, style }: { index: number; children: React.ReactNode; style?: any }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 70).duration(420)} style={style}>
      {children}
    </Animated.View>
  );
}

function durationText(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = String(Math.floor((secs % 3600) / 60)).padStart(h ? 2 : 1, "0");
  const s = String(secs % 60).padStart(2, "0");
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

/* ─── Recap page ────────────────────────────────────────────── */

function ExerciseRow({ a, unit, open, onToggle }: { a: Analysis; unit: string; open: boolean; onToggle: () => void }) {
  const p = usePalette();
  const hasHistory = a.status !== "new";
  const dV = a.volume - a.prevVolume;
  const doneSets = a.sets.filter((s: SetRow) => s.cur).length;

  return (
    <View style={[styles.card, { backgroundColor: p.bgCard, borderColor: open ? p.borderStrong : p.bgCardBorder, padding: 0, overflow: "hidden" }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${a.name}, ${STATUS_LABEL[a.status]}. ${open ? "Hide" : "Show"} set details`}
        style={styles.exRowHeader}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <View style={styles.rowCenter}>
            <View style={[styles.dot, { backgroundColor: MUSCLE_COLORS[a.muscleGroup] || p.textTertiary }]} />
            <Text numberOfLines={1} style={[styles.exName, { color: p.textPrimary }]}>{a.name}</Text>
          </View>
          <Text style={[styles.meta, { color: p.textMuted }]}>
            {a.muscleGroup} · {doneSets} {plural(doneSets, "set", "sets")}{a.topSet ? ` · top ${setText(a.topSet)}` : ""}
          </Text>
          <View style={styles.rowCenter}>
            <View style={{ flexDirection: "row", gap: 3 }}>
              {a.sets.map((s: SetRow) => (
                <View key={s.index} style={[styles.stripBar, { backgroundColor: hasHistory ? setBarColor(s, p) : p.neutralBar }]} />
              ))}
            </View>
            <Text style={[styles.metaStrong, { color: hasHistory ? deltaColor(a.changePct, p) : p.blue }]}>
              {hasHistory ? (a.changePct === 0 ? "Strength same" : `Strength ${pctText(a.changePct)}`) : "First time logged"}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Text style={[styles.exVolume, { color: p.textPrimary }]}>{whole(a.volume)} {unit}</Text>
          {hasHistory && <Chip small delta={dV} text={dV === 0 ? "Same" : `${arrow(dV)}${Math.abs(Math.round((dV / (a.prevVolume || 1)) * 1000) / 10).toFixed(1)}%`} />}
        </View>
        <Chevron open={open} color={p.textMuted} />
      </Pressable>

      {open && (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.exDetail, { borderTopColor: p.border }]}>
          {hasHistory && a.weighted && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { label: "Volume", from: `was ${whole(a.prevVolume)}`, to: `${whole(a.volume)} ${unit}`, chip: dV === 0 ? "Same" : signed(dV, ` ${unit}`), d: dV },
                { label: "Top set", from: `was ${setText(a.prevTopSet)}`, to: setText(a.topSet), chip: a.topSet.weight === a.prevTopSet.weight ? "Same wt" : signed(a.topSet.weight - a.prevTopSet.weight, ` ${unit}`), d: a.topSet.weight - a.prevTopSet.weight },
                { label: "Est. 1RM", from: `was ${whole(a.prevBestOneRepMax)}`, to: `${whole(a.bestOneRepMax)} ${unit}`, chip: pctText(Math.round(((a.bestOneRepMax - a.prevBestOneRepMax) / a.prevBestOneRepMax) * 1000) / 10), d: a.bestOneRepMax - a.prevBestOneRepMax },
              ].map((st) => (
                <View key={st.label} style={[styles.miniStat, { backgroundColor: p.subtle }]}>
                  <Text style={[styles.miniLabel, { color: p.textMuted }]}>{st.label}</Text>
                  <Text style={[styles.miniFrom, { color: p.textMuted }]}>{st.from}</Text>
                  <Text style={[styles.miniTo, { color: p.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{st.to}</Text>
                  <Chip small delta={Math.abs(st.d) < 0.05 ? 0 : st.d} text={st.chip} />
                </View>
              ))}
            </View>
          )}

          <View style={{ gap: 6 }}>
            <View style={styles.setHeaderRow}>
              <Text style={[styles.th, { width: 34, color: p.textMuted }]}>Set</Text>
              <Text style={[styles.th, { width: 66, color: p.textMuted }]}>Last</Text>
              <Text style={[styles.th, { width: 70, color: p.textMuted }]}>Today</Text>
              <Text style={[styles.th, { flex: 1, color: p.textMuted }]}>Change</Text>
            </View>
            {a.sets.map((s: SetRow) => {
              return (
                <View key={s.index} style={[styles.setRow, { backgroundColor: p.subtle, borderLeftColor: hasHistory ? setBarColor(s, p) : p.neutralBar }]}>
                  <Text style={[styles.td, { width: 31, fontWeight: "700", color: p.textMuted }]}>{s.index + 1}</Text>
                  <Text style={[styles.td, { width: 66, color: p.textMuted }]}>{s.prev ? setText(s.prev) : "—"}</Text>
                  <Text style={[styles.td, { width: 70, fontWeight: "700", color: s.cur ? p.textPrimary : p.red }]}>{s.cur ? setText(s.cur) : "Skipped"}</Text>
                  <View style={styles.chipRow}>
                    {s.kind === "compare" && (
                      <>
                        {(s.cur.weight > 0 || s.prev.weight > 0) && (
                          <Chip small delta={s.weightDelta} text={s.weightDelta === 0 ? "Same wt" : signed(s.weightDelta, ` ${unit}`)} />
                        )}
                        <Chip small delta={s.repsDelta} text={s.repsDelta === 0 ? "Same reps" : signed(s.repsDelta, plural(s.repsDelta, " rep", " reps"))} />
                      </>
                    )}
                    {s.kind === "added" && hasHistory && <Chip small delta={1} text="New set" />}
                    {s.kind === "skipped" && <Chip small delta={-1} text="Missed" />}
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={[styles.nextLine, { color: p.blue }]}>Next time: {targetText(a.recommendation, unit)}</Text>
        </Animated.View>
      )}
    </View>
  );
}

function RecapPage({ summary, routineName, durationSecs, unit, onDone, onOpenPlan }: {
  summary: Summary; routineName: string; durationSecs: number; unit: string; onDone: () => void; onOpenPlan: () => void;
}) {
  const p = usePalette();
  const [openId, setOpenId] = useState<string | null>(null);
  const total = useCountUp(summary.totalVolume);
  const compared = summary.comparedCount > 0;
  const dTotal = summary.comparableVolume - summary.prevVolume;
  const maxBar = Math.max(summary.comparableVolume, summary.prevVolume, 1);
  const c = summary.counts;
  const dSets = summary.sets - summary.prevSets;

  const verdict = !compared
    ? "First session logged."
    : summary.volumeChangePct >= 1
      ? "You out-lifted last time."
      : summary.volumeChangePct <= -1
        ? "Lighter than last time."
        : "You matched last time.";

  const maxMuscle = Math.max(1, ...summary.muscles.map((m: any) => Math.max(m.volume, m.prevVolume)));

  return (
    <>
      <Section index={0} style={styles.headerRow}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[styles.eyebrow, { color: p.green }]}>{routineName} complete</Text>
          <Text style={[styles.h1, { color: p.textPrimary }]} accessibilityRole="header">{verdict}</Text>
          <Text style={[styles.sub, { color: p.textMuted }]}>Compared with your last session of each exercise</Text>
        </View>
        <Pressable onPress={onDone} accessibilityRole="button" accessibilityLabel="Close recap" style={[styles.roundBtn, { borderColor: p.bgCardBorder, backgroundColor: p.bgCard }]}>
          <Svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke={p.textPrimary} strokeWidth={2} strokeLinecap="round">
            <Path d="M3 3l10 10M13 3L3 13" />
          </Svg>
        </Pressable>
      </Section>

      <Section index={1} style={[styles.card, styles.heroCard, { backgroundColor: p.bgCard, borderColor: p.bgCardBorder }]}>
        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: p.textMuted }]}>Total weight moved</Text>
          <View style={styles.rowBaseline}>
            <Text style={[styles.heroNumber, { color: p.volume }]}>{whole(total)}</Text>
            <Text style={[styles.heroUnit, { color: p.textMuted }]}>{unit}</Text>
          </View>
          {compared && (
            <View style={[styles.rowCenter, { flexWrap: "wrap" }]}>
              <Chip delta={dTotal} text={dTotal === 0 ? "Same as last time" : `${arrow(dTotal)}${whole(Math.abs(dTotal))} ${unit} · ${pctText(summary.volumeChangePct)}`} />
              <Text style={[styles.sub, { color: p.textMuted }]}>
                {c.new ? `on the ${summary.comparedCount} ${plural(summary.comparedCount, "lift", "lifts")} you've logged before` : "vs. last time"}
              </Text>
            </View>
          )}
        </View>

        {compared && (
          <View style={{ gap: 8 }}>
            {[
              { label: "Today", value: summary.comparableVolume, color: p.volume === p.textPrimary ? p.blue : p.volume, strong: true },
              { label: "Last", value: summary.prevVolume, color: p.neutralBar, strong: false },
            ].map((b) => (
              <View key={b.label} style={styles.rowCenter}>
                <Text style={[styles.barLabel, { color: p.textMuted }]}>{b.label}</Text>
                <View style={[styles.track, { height: 10, backgroundColor: p.border }]}>
                  <GrowBar fraction={b.value / maxBar} color={b.color} />
                </View>
                <Text style={[styles.barValue, { color: b.strong ? p.textPrimary : p.textMuted }]}>{whole(b.value)}</Text>
              </View>
            ))}
          </View>
        )}

        {compared && (
          <View style={[styles.divider, { borderTopColor: p.border }]}>
            <View style={{ flexDirection: "row" }}>
              {[
                { n: c.improved, label: "Improved", color: p.green },
                { n: c.held, label: "Held", color: p.textPrimary },
                { n: c.dipped + c.declined, label: "Down", color: p.red },
              ].map((s) => (
                <View key={s.label} style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.scoreNumber, { color: s.color }]}>{s.n}</Text>
                  <Text style={[styles.scoreLabel, { color: p.textSecondary }]}>{s.label}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.caption, { color: p.textMuted }]}>
              Each lift is judged on estimated 1-rep max across its sets, assuming you stopped 1 rep short of failure. A heavier set with fewer reps still counts as progress.
            </Text>
          </View>
        )}
      </Section>

      <Section index={2} style={{ flexDirection: "row", gap: 10 }}>
        {[
          { label: "Duration", value: durationText(durationSecs), sub: " ", subColor: p.textMuted },
          { label: "Sets", value: String(summary.sets), sub: compared ? (dSets === 0 ? "same as last" : `${signed(dSets)} vs last`) : " ", subColor: dSets > 0 ? p.green : dSets < 0 ? p.red : p.textMuted },
          { label: "Heavier", value: compared ? `${summary.heavierCount}/${summary.comparedCount}` : "—", sub: "lifts, top weight", subColor: p.textMuted },
        ].map((t) => (
          <View key={t.label} style={[styles.card, styles.tile, { backgroundColor: p.bgCard, borderColor: p.bgCardBorder }]}>
            <Text style={[styles.label, { color: p.textMuted }]}>{t.label}</Text>
            <Text style={[styles.tileValue, { color: p.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{t.value}</Text>
            <Text style={[styles.tileSub, { color: t.subColor }]} numberOfLines={1}>{t.sub}</Text>
          </View>
        ))}
      </Section>

      <Section index={3} style={{ gap: 12 }}>
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: p.textMuted }]} accessibilityRole="header">Weight moved by muscle</Text>
          <View style={styles.rowCenter}>
            <View style={[styles.legendBar, { backgroundColor: p.textSecondary }]} />
            <Text style={[styles.legend, { color: p.textMuted }]}>Today</Text>
            <View style={[styles.legendTick, { backgroundColor: p.textPrimary }]} />
            <Text style={[styles.legend, { color: p.textMuted }]}>Last</Text>
          </View>
        </View>
        <View style={[styles.card, { backgroundColor: p.bgCard, borderColor: p.bgCardBorder, padding: 16, gap: 18 }]}>
          {summary.muscles.map((m: any) => {
            const d = m.volume - m.prevVolume;
            const color = MUSCLE_COLORS[m.name] || p.textTertiary;
            return (
              <View key={m.name} style={{ gap: 8 }}>
                <View style={styles.rowCenter}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Text style={[styles.exName, { flex: 1, color: p.textPrimary }]}>{m.name}</Text>
                  <Text style={[styles.exVolume, { color: p.textPrimary }]}>{whole(m.volume)} {unit}</Text>
                  {m.hasHistory && <Chip small delta={d} text={d === 0 ? "Same" : `${arrow(d)}${Math.abs(Math.round((d / (m.prevVolume || 1)) * 1000) / 10).toFixed(1)}%`} />}
                </View>
                <View style={[styles.track, { height: 8, backgroundColor: p.border, overflow: "visible" }]}>
                  <GrowBar fraction={m.volume / maxMuscle} color={color} />
                  {m.hasHistory && <View style={[styles.tick, { left: `${(m.prevVolume / maxMuscle) * 100}%`, backgroundColor: p.textPrimary }]} />}
                </View>
                <Text style={[styles.meta, { color: p.textMuted }]}>
                  {m.hasHistory ? `Last time ${whole(m.prevVolume)} ${unit} · ${d === 0 ? "no change" : signed(Math.round(d), ` ${unit}`)}` : "No previous session to compare"}
                </Text>
              </View>
            );
          })}
        </View>
      </Section>

      <Section index={4} style={{ gap: 12 }}>
        <View style={{ gap: 6 }}>
          <Text style={[styles.sectionTitle, { color: p.textMuted }]} accessibilityRole="header">Exercises</Text>
          <View style={[styles.rowCenter, { flexWrap: "wrap", gap: 10 }]}>
            <Text style={[styles.legend, { color: p.textMuted }]}>Each bar is one set vs. the same set last time:</Text>
            {[{ c: p.green, l: "Better" }, { c: p.neutralBar, l: "Same" }, { c: p.red, l: "Worse" }].map((x) => (
              <View key={x.l} style={styles.rowCenter}>
                <View style={[styles.legendBar, { backgroundColor: x.c }]} />
                <Text style={[styles.legend, { color: p.textMuted }]}>{x.l}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ gap: 10 }}>
          {summary.exercises.map((a: Analysis, i: number) => {
            const key = `${a.id}-${i}`;
            return <ExerciseRow key={key} a={a} unit={unit} open={openId === key} onToggle={() => setOpenId(openId === key ? null : key)} />;
          })}
        </View>
      </Section>

      <Section index={5} style={{ gap: 10, paddingTop: 4 }}>
        <Pressable onPress={onDone} accessibilityRole="button" style={[styles.primaryBtn, { backgroundColor: "#30D158" }]}>
          <Text style={[styles.primaryBtnText, { color: "#000" }]}>Done</Text>
        </Pressable>
        <Pressable onPress={onOpenPlan} accessibilityRole="button" style={[styles.secondaryBtn, { borderColor: "rgba(10,132,255,0.5)", backgroundColor: "rgba(10,132,255,0.12)" }]}>
          <Text style={[styles.secondaryBtnText, { color: p.textPrimary }]}>See next-session plan</Text>
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={p.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M5 3l4 4-4 4" />
          </Svg>
        </Pressable>
      </Section>
    </>
  );
}

/* ─── Next-session plan page ────────────────────────────────── */

function PlanCard({ a, unit, open, onToggle }: { a: Analysis; unit: string; open: boolean; onToggle: () => void }) {
  const p = usePalette();
  const rec = a.recommendation;
  const action = ACTIONS[rec.action] || ACTIONS.add_reps;
  const actionColor = { green: p.green, blue: p.blue, orange: p.orange, neutral: p.textPrimary }[action.tone];
  const hasHistory = a.status !== "new";
  const { min, max, heavyCompound } = a.range;
  const allReps = a.sets.flatMap((s: SetRow) => [s.prev?.reps || 0, s.cur?.reps || 0]);
  const maxR = Math.max(max + 2, ...allReps);
  const h = (r: number) => (r / maxR) * BAR_H;
  const prevSets = a.sets.filter((s: SetRow) => s.prev).map((s: SetRow) => s.prev);
  const curSets = a.sets.filter((s: SetRow) => s.cur).map((s: SetRow) => s.cur);
  const dReps = a.totalReps - a.prevTotalReps;
  const vPct = a.prevVolume ? Math.round(((a.volume - a.prevVolume) / a.prevVolume) * 1000) / 10 : 0;
  const compares = a.sets.filter((s: SetRow) => s.kind === "compare");

  return (
    <View style={[styles.card, { backgroundColor: p.bgCard, borderColor: p.bgCardBorder, padding: 16, gap: 14 }]}>
      <View style={styles.rowCenter}>
        <View style={[styles.dot, { backgroundColor: MUSCLE_COLORS[a.muscleGroup] || p.textTertiary }]} />
        <Text numberOfLines={1} style={[styles.exName, { flex: 1, fontSize: 16, color: p.textPrimary }]} accessibilityRole="header">{a.name}</Text>
        {hasHistory
          ? <Chip delta={a.status === "improved" ? 1 : a.status === "held" ? 0 : -1} color={a.status === "dipped" ? p.orange : undefined} text={`${STATUS_LABEL[a.status]} ${pctText(a.changePct)}`} />
          : <Chip delta={0} color={p.blue} text="New" />}
      </View>
      <Text style={[styles.meta, { color: p.textMuted, marginTop: -8 }]}>
        Target {min}–{max} reps{heavyCompound ? " · heavy compound" : ""}
      </Text>

      <View style={styles.seriesGrid}>
        <Text style={[styles.seriesLabel, { color: p.textMuted }]}>Last</Text>
        <Text style={[styles.seriesValue, { color: p.textSecondary }]}>{hasHistory ? seriesText(prevSets, unit) : "—"}</Text>
        <Text style={[styles.seriesLabel, { color: p.textMuted }]}>Today</Text>
        <Text style={[styles.seriesValue, { color: p.textPrimary, fontWeight: "700" }]}>{seriesText(curSets, unit)}</Text>
      </View>

      <View style={{ gap: 8 }}>
        <View style={[styles.rowCenter, { justifyContent: "space-between" }]}>
          <Text style={[styles.legend, { color: p.textMuted }]}>Reps per set</Text>
          <View style={styles.rowCenter}>
            <View style={[styles.legendSquare, { backgroundColor: p.neutralBar }]} />
            <Text style={[styles.legend, { color: p.textMuted }]}>Last</Text>
            <View style={[styles.legendSquare, { backgroundColor: p.green }]} />
            <Text style={[styles.legend, { color: p.textMuted }]}>Today</Text>
          </View>
        </View>
        <View
          accessible
          accessibilityLabel={`Reps per set, last versus today: ${a.sets.map((s: SetRow) => `set ${s.index + 1}, ${s.prev ? s.prev.reps : "none"} then ${s.cur ? s.cur.reps : "none"}`).join("; ")}`}
          style={{ height: BAR_H + LABEL_H, flexDirection: "row", gap: 8 }}
        >
          <View style={[styles.band, { bottom: LABEL_H + h(min), height: h(max) - h(min), backgroundColor: p.subtle, borderColor: p.borderStrong }]} />
          <Text style={[styles.bandLabel, { bottom: LABEL_H + h(max) + 2, color: p.textMuted }]}>{min}–{max} reps</Text>
          {a.sets.map((s: SetRow) => (
            <View key={s.index} style={{ flex: 1, maxWidth: 48, alignItems: "center" }}>
              <View style={{ height: BAR_H, flexDirection: "row", alignItems: "flex-end", gap: 3 }}>
                <View style={[styles.repBar, { height: s.prev ? h(s.prev.reps) : 0, backgroundColor: p.neutralBar }]} />
                <View style={[styles.repBar, { height: s.cur ? h(s.cur.reps) : 0, backgroundColor: hasHistory ? setBarColor(s, p) : p.blue }]} />
              </View>
              <View style={[styles.repLabel, { borderTopColor: p.borderStrong }]}>
                <Text style={[styles.repLabelTop, { color: p.textMuted }]}>S{s.index + 1}</Text>
                <Text style={[styles.repLabelBottom, { color: p.textSecondary }]}>{s.prev ? s.prev.reps : "–"}{"→"}{s.cur ? s.cur.reps : "–"}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {hasHistory && (
        <View style={[styles.chipRow, { gap: 6 }]}>
          <Chip delta={a.changePct} text={`Strength ${pctText(a.changePct)}`} />
          <Chip delta={dReps} text={`Reps ${a.prevTotalReps} → ${a.totalReps}`} />
          {a.weighted && <Chip delta={vPct} text={`Volume ${pctText(vPct)}`} />}
        </View>
      )}

      <View style={[styles.actionBox, { borderColor: action.tone === "neutral" ? p.borderStrong : actionColor, backgroundColor: p.subtle }]}>
        <View style={styles.rowCenter}>
          <View style={[styles.actionIcon, { backgroundColor: actionColor }]}>
            <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={p.isLight ? "#fff" : "#000"} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <Path d={action.icon} />
            </Svg>
          </View>
          <Text style={[styles.actionTitle, { color: actionColor }]}>{hasHistory ? action.title : "Baseline set"}</Text>
        </View>
        <View style={[styles.rowBaseline, { flexWrap: "wrap" }]}>
          <Text style={[styles.meta, { fontWeight: "600", color: p.textMuted }]}>Next time</Text>
          <Text style={[styles.targetText, { color: p.textPrimary }]}>{targetText(rec, unit)}</Text>
        </View>
        <Text style={[styles.reason, { color: p.textSecondary }]}>
          {hasHistory ? rec.reason : `First time logging this lift. ${rec.reason}`}
        </Text>
      </View>

      {hasHistory && (
        <>
          <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.howBtn}>
            <Text style={[styles.howText, { color: p.textSecondary }]}>How we worked this out</Text>
            <Chevron open={open} color={p.textSecondary} />
          </Pressable>
          {open && (
            <Animated.View entering={FadeIn.duration(200)} style={{ gap: 10 }}>
              {a.weighted ? (
                <View>
                  <View style={styles.mathRow}>
                    {["Set", "Last 1RM", "Today 1RM", "Change"].map((hd, i) => (
                      <Text key={hd} style={[styles.th, { flex: i === 0 ? 0.6 : 1, textAlign: i === 0 ? "left" : "right", color: p.textMuted }]}>{hd}</Text>
                    ))}
                  </View>
                  {compares.map((s: SetRow) => {
                    const ch = Math.round((s.strengthDelta / s.prevOneRepMax) * 1000) / 10;
                    return (
                      <View key={s.index} style={[styles.mathRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }]}>
                        <Text style={[styles.td, { flex: 0.6, fontWeight: "700", color: p.textMuted }]}>S{s.index + 1}</Text>
                        <Text style={[styles.td, styles.tdNum, { color: p.textSecondary }]}>{num(s.prevOneRepMax)}</Text>
                        <Text style={[styles.td, styles.tdNum, { fontWeight: "700", color: p.textPrimary }]}>{num(s.curOneRepMax)}</Text>
                        <Text style={[styles.td, styles.tdNum, { fontWeight: "700", color: deltaColor(ch, p) }]}>{pctText(ch)}</Text>
                      </View>
                    );
                  })}
                  <View style={[styles.mathRow, { borderTopWidth: 1, borderTopColor: p.borderStrong }]}>
                    <Text style={[styles.td, { flex: 0.6, fontWeight: "800", color: p.textPrimary }]}>Avg</Text>
                    <Text style={[styles.td, styles.tdNum, { fontWeight: "700", color: p.textSecondary }]}>{num(a.strengthBefore)}</Text>
                    <Text style={[styles.td, styles.tdNum, { fontWeight: "800", color: p.textPrimary }]}>{num(a.strengthNow)}</Text>
                    <Text style={[styles.td, styles.tdNum, { fontWeight: "800", color: deltaColor(a.changePct, p) }]}>{pctText(a.changePct)}</Text>
                  </View>
                </View>
              ) : null}
              <Text style={[styles.caption, { color: p.textMuted }]}>
                {a.weighted
                  ? "Est. 1RM = weight × (1 + (reps + 1) ÷ 30), counting the rep left in reserve. Sets are matched in order."
                  : "Bodyweight lift: judged on total reps across matched sets."}
                {` Improved at +1% or more, held within ±1%, dipped down to ${MINUS}5%, declined beyond ${MINUS}5% or on a second dip in a row.`}
              </Text>
            </Animated.View>
          )}
        </>
      )}
    </View>
  );
}

function PlanPage({ summary, routineName, unit, onBack, onApply, onKeep }: {
  summary: Summary; routineName: string; unit: string; onBack: () => void; onApply: () => void; onKeep: () => void;
}) {
  const p = usePalette();
  const [openId, setOpenId] = useState<string | null>(null);
  const c = summary.counts;
  const counts = [
    { n: c.improved, label: "Improved", color: p.green },
    { n: c.held, label: "Held", color: p.textPrimary },
    { n: c.dipped, label: "Dipped", color: p.orange },
    { n: c.declined, label: "Declined", color: p.red },
    ...(c.new ? [{ n: c.new, label: "New", color: p.blue }] : []),
  ];

  return (
    <>
      <Section index={0} style={{ gap: 14 }}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to workout recap" style={[styles.roundBtn, { borderColor: p.bgCardBorder, backgroundColor: p.bgCard }]}>
          <Svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke={p.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M10 3L5 8l5 5" />
          </Svg>
        </Pressable>
        <View style={{ gap: 6 }}>
          <Text style={[styles.eyebrow, { color: p.blue }]}>Next session plan</Text>
          <Text style={[styles.h1, { color: p.textPrimary }]} accessibilityRole="header">{routineName}, adjusted</Text>
          <Text style={[styles.sub, { color: p.textMuted }]}>Every set is treated as 1 rep short of failure.</Text>
        </View>
      </Section>

      <Section index={1} style={[styles.card, { backgroundColor: p.bgCard, borderColor: p.bgCardBorder, padding: 16, gap: 12 }]}>
        <Text style={[styles.label, { color: p.textMuted }]}>How each lift went</Text>
        <View style={{ flexDirection: "row" }}>
          {counts.map((s) => (
            <View key={s.label} style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.scoreNumber, { fontSize: 24, color: s.color }]}>{s.n}</Text>
              <Text style={[styles.scoreLabel, { fontSize: 12, color: p.textSecondary }]}>{s.label}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.caption, { color: p.textMuted }]}>
          Strength is the average estimated 1-rep max across matched sets. Within ±1% (about one rep over three sets) counts as held.
        </Text>
      </Section>

      <Section index={2} style={{ gap: 12 }}>
        <Text style={[styles.sectionTitle, { color: p.textMuted }]} accessibilityRole="header">Per exercise</Text>
        {summary.exercises.map((a: Analysis, i: number) => {
          const key = `${a.id}-${i}`;
          return <PlanCard key={key} a={a} unit={unit} open={openId === key} onToggle={() => setOpenId(openId === key ? null : key)} />;
        })}
      </Section>

      <Section index={3} style={{ gap: 10, paddingTop: 4 }}>
        <Pressable onPress={onApply} accessibilityRole="button" style={[styles.primaryBtn, { backgroundColor: "#0A84FF" }]}>
          <Text style={[styles.primaryBtnText, { color: "#fff" }]}>Apply to next session</Text>
        </Pressable>
        <Pressable onPress={onKeep} accessibilityRole="button" style={[styles.secondaryBtn, { borderColor: p.borderStrong }]}>
          <Text style={[styles.secondaryBtnText, { color: p.textPrimary }]}>Keep current targets</Text>
        </Pressable>
      </Section>
    </>
  );
}

/* ─── Modal shell ───────────────────────────────────────────── */

export default function WorkoutRecap({ visible, summary, routineName, sessionNumber, durationSecs, unit, onDone, onApplyPlan }: WorkoutRecapProps) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  // Mounted fresh for each finished workout, so stage always starts at the intro
  const [stage, setStage] = useState<"intro" | "recap" | "plan">("intro");
  const [celebrating, setCelebrating] = useState(false);

  if (!summary) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onShow={() => setCelebrating(true)}
      onRequestClose={() => (stage === "plan" ? setStage("recap") : onDone())}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: p.bgBase }]}>
        {stage !== "intro" && (
          <ScrollView
            key={stage}
            contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32, paddingHorizontal: 16, gap: 22 }}
          >
            {stage === "recap" ? (
              <RecapPage summary={summary} routineName={routineName} durationSecs={durationSecs} unit={unit} onDone={onDone} onOpenPlan={() => setStage("plan")} />
            ) : (
              <PlanPage summary={summary} routineName={routineName} unit={unit} onBack={() => setStage("recap")} onApply={onApplyPlan} onKeep={onDone} />
            )}
          </ScrollView>
        )}
        <WorkoutCompleteOverlay
          visible={celebrating}
          kicker={`${routineName} · Session ${sessionNumber}`}
          durationSecs={durationSecs}
          volume={summary.totalVolume}
          sets={summary.sets}
          unit={unit}
          actionLabel="View recap"
          onDismiss={() => { setCelebrating(false); setStage("recap"); }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1 },
  heroCard: { padding: 20, gap: 18, borderRadius: 22 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowBaseline: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase" },
  h1: { fontSize: 28, fontWeight: "800", letterSpacing: -1, lineHeight: 32 },
  sub: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase" },
  heroNumber: { fontSize: 56, fontWeight: "800", letterSpacing: -2.5, lineHeight: 60, fontVariant: ["tabular-nums"] },
  heroUnit: { fontSize: 18, fontWeight: "700" },
  roundBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, alignSelf: "flex-start" },
  chipSmall: { paddingHorizontal: 7, paddingVertical: 3 },
  chipText: { fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },
  chipTextSmall: { fontSize: 11 },
  chipRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  track: { flex: 1, borderRadius: 5, overflow: "hidden", position: "relative" },
  growFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 5, transformOrigin: "left" },
  tick: { position: "absolute", top: -4, bottom: -4, width: 2, marginLeft: -1, borderRadius: 1 },
  barLabel: { width: 40, fontSize: 12, fontWeight: "600" },
  barValue: { width: 56, textAlign: "right", fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16, gap: 10 },
  scoreNumber: { fontSize: 26, fontWeight: "800", letterSpacing: -1, fontVariant: ["tabular-nums"] },
  scoreLabel: { fontSize: 13, fontWeight: "600" },
  caption: { fontSize: 12, lineHeight: 17 },
  tile: { flex: 1, padding: 12, gap: 4, borderRadius: 16 },
  tileValue: { fontSize: 22, fontWeight: "800", letterSpacing: -0.8, fontVariant: ["tabular-nums"] },
  tileSub: { fontSize: 12, fontWeight: "600" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  legend: { fontSize: 11 },
  legendBar: { width: 12, height: 6, borderRadius: 3 },
  legendTick: { width: 2, height: 12, borderRadius: 1, marginLeft: 6 },
  legendSquare: { width: 8, height: 8, borderRadius: 2, marginLeft: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  exName: { fontSize: 15, fontWeight: "700", flexShrink: 1 },
  exVolume: { fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
  meta: { fontSize: 12 },
  metaStrong: { fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  stripBar: { width: 16, height: 6, borderRadius: 3 },
  exRowHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingLeft: 16, paddingRight: 14, minHeight: 44 },
  exDetail: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14, gap: 14 },
  miniStat: { flex: 1, padding: 10, borderRadius: 12, gap: 3 },
  miniLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  miniFrom: { fontSize: 11, fontVariant: ["tabular-nums"] },
  miniTo: { fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
  setHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 9 },
  th: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  setRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingLeft: 6, paddingRight: 6, borderRadius: 8, borderLeftWidth: 3 },
  td: { fontSize: 13, fontVariant: ["tabular-nums"] },
  tdNum: { flex: 1, textAlign: "right" },
  nextLine: { fontSize: 13, fontWeight: "700" },
  primaryBtn: { height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 16, fontWeight: "800" },
  secondaryBtn: { height: 50, borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { fontSize: 15, fontWeight: "700" },
  seriesGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 4 },
  seriesLabel: { width: 52, fontSize: 14 },
  seriesValue: { width: "80%", flexGrow: 1, flexShrink: 1, fontSize: 14, fontVariant: ["tabular-nums"] },
  band: { position: "absolute", left: 0, right: 0, borderTopWidth: 1, borderBottomWidth: 1 },
  bandLabel: { position: "absolute", right: 0, fontSize: 10, fontWeight: "600" },
  repBar: { width: 13, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  repLabel: { height: LABEL_H, alignSelf: "stretch", alignItems: "center", justifyContent: "center", borderTopWidth: 1 },
  repLabelTop: { fontSize: 10, fontWeight: "700" },
  repLabelBottom: { fontSize: 11, fontWeight: "600", fontVariant: ["tabular-nums"] },
  actionBox: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  actionIcon: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  actionTitle: { fontSize: 14, fontWeight: "800", flexShrink: 1 },
  targetText: { fontSize: 22, fontWeight: "800", letterSpacing: -0.6, fontVariant: ["tabular-nums"] },
  reason: { fontSize: 13, lineHeight: 19 },
  howBtn: { minHeight: 44, marginVertical: -6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  howText: { fontSize: 13, fontWeight: "600" },
  mathRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, gap: 4 },
});
