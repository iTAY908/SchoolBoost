// ============================================================================
// IntroAnimation — the launch sequence.
//
//   0.0s  a glass jar full of green banknotes shakes, the money rattles
//   1.1s  the shaking intensifies
//   1.8s  the camera pans down toward the base of the jar
//   2.9s  the jar tips over and falls
//   3.4s  it shatters: glass shards and banknotes burst out, flash + shockwave
//   3.9s  a "poof" smoke cloud with sparks swallows the scene
//   4.6s  it dissolves into the dashboard (onFinish)
//
// Built on the stock Animated API (useNativeDriver wherever possible) so it
// needs no animation library. expo-linear-gradient supplies the glass/money
// shading. Honours the OS "reduce motion" setting by skipping straight to the end.
// ============================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const BILL_COUNT = 20;
const SHARD_COUNT = 18;
const FLYING_BILLS = 9;
const SPARK_COUNT = 22;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Props = {
  /** Called once the sequence is done (or skipped). */
  onFinish: () => void;
};

export default function IntroAnimation({ onFinish }: Props) {
  const [done, setDone] = useState(false);
  const finished = useRef(false);

  // ---- animated values -----------------------------------------------------
  const shake = useRef(new Animated.Value(0)).current;      // -1..1 jar wobble
  const camera = useRef(new Animated.Value(0)).current;     // 0..1 pan down
  const fall = useRef(new Animated.Value(0)).current;       // 0..1 tip + drop
  const jarOpacity = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;      // 0..1 debris flight
  const flash = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const poof = useRef(new Animated.Value(0)).current;
  const sceneFade = useRef(new Animated.Value(1)).current;
  const wipe = useRef(new Animated.Value(0)).current;

  // ---- randomised particle definitions (stable across renders) -------------
  const bills = useMemo(
    () =>
      Array.from({ length: BILL_COUNT }, (_, i) => ({
        key: `b${i}`,
        left: rand(4, 108),
        bottom: 6 + Math.floor(i / 4) * 26 + rand(-5, 5),
        rot: rand(-28, 28),
        phase: rand(0, 1),
      })),
    [],
  );

  const shards = useMemo(
    () =>
      Array.from({ length: SHARD_COUNT }, (_, i) => {
        const angle = rand(0, Math.PI * 2);
        const dist = rand(90, 240);
        return {
          key: `s${i}`,
          w: rand(14, 34),
          h: rand(16, 38),
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist * 0.85 - rand(20, 110),
          rot: rand(-540, 540),
          scale: rand(0.5, 1.15),
        };
      }),
    [],
  );

  const flyBills = useMemo(
    () =>
      Array.from({ length: FLYING_BILLS }, (_, i) => {
        const angle = rand(-Math.PI, 0);
        const dist = rand(110, 250);
        return {
          key: `f${i}`,
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist,
          rot: rand(-420, 420),
        };
      }),
    [],
  );

  const sparks = useMemo(
    () =>
      Array.from({ length: SPARK_COUNT }, (_, i) => {
        const angle = rand(0, Math.PI * 2);
        const dist = rand(90, 230);
        const colors = ['#ffffff', '#cdd4ff', '#f2b134', '#8f9aff', '#a8f0d0'];
        return {
          key: `k${i}`,
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist,
          color: colors[i % colors.length],
        };
      }),
    [],
  );

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setDone(true);
    onFinish();
  }, [onFinish]);

  // ---- the timeline --------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) { finish(); return; }   // accessibility: no motion, go straight in

      // gentle wobble, then a violent one
      const wobble = (dur: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(shake, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true }),
            Animated.timing(shake, { toValue: -1, duration: dur, easing: Easing.linear, useNativeDriver: true }),
          ]),
        );

      const soft = wobble(170);
      soft.start();
      at(1100, () => { soft.stop(); wobble(70).start(); });

      // camera pans down to the jar's base
      at(1800, () =>
        Animated.timing(camera, {
          toValue: 1, duration: 1100, easing: Easing.bezier(0.45, 0.05, 0.25, 1), useNativeDriver: true,
        }).start(),
      );

      // the jar tips and drops
      at(2900, () =>
        Animated.timing(fall, {
          toValue: 1, duration: 500, easing: Easing.bezier(0.55, 0.06, 0.9, 0.6), useNativeDriver: true,
        }).start(),
      );

      // IMPACT — shatter, flash, shockwave
      at(3400, () => {
        jarOpacity.setValue(0);
        Animated.timing(burst, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        Animated.sequence([
          Animated.timing(flash, { toValue: 0.6, duration: 40, useNativeDriver: true }),
          Animated.timing(flash, { toValue: 0, duration: 260, useNativeDriver: true }),
        ]).start();
        Animated.timing(ring, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      });

      // the magical poof
      at(3900, () => {
        Animated.timing(poof, { toValue: 1, duration: 950, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        Animated.timing(sceneFade, { toValue: 0, duration: 450, useNativeDriver: true }).start();
      });

      // white wipe hands over to the dashboard
      at(4250, () =>
        Animated.sequence([
          Animated.timing(wipe, { toValue: 0.9, duration: 260, useNativeDriver: true }),
          Animated.timing(wipe, { toValue: 0, duration: 420, useNativeDriver: true }),
        ]).start(),
      );

      at(4600, finish);
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish]);

  if (done) return null;

  // ---- derived transforms --------------------------------------------------
  const jarTranslateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-5, 5] });
  const jarRotate = Animated.multiply(shake, 1).interpolate({
    inputRange: [-1, 1], outputRange: ['-2deg', '2deg'],
  });
  const camTranslateY = camera.interpolate({ inputRange: [0, 1], outputRange: [0, SCREEN_H * 0.09] });
  const camScale = camera.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const fallRotate = fall.interpolate({ inputRange: [0, 0.45, 1], outputRange: ['0deg', '-26deg', '-74deg'] });
  const fallTranslateY = fall.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 6, 66] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.3, 9] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.95, 0] });

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* ---------- studio backdrop ---------- */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: sceneFade }]}>
        <LinearGradient colors={['#0a0e1b', '#070a12']} style={StyleSheet.absoluteFill} />
        <View style={styles.floorGlow} />
      </Animated.View>

      {/* ---------- camera rig ---------- */}
      <Animated.View
        style={[
          styles.cameraRig,
          { opacity: sceneFade, transform: [{ translateY: camTranslateY }, { scale: camScale }] },
        ]}
        pointerEvents="none"
      >
        <View style={styles.jarShadow} />
        <Animated.View
          style={{
            transform: [
              { translateX: jarTranslateX },
              { translateY: fallTranslateY },
              { rotate: fallRotate },
              { rotate: jarRotate },
            ],
            opacity: jarOpacity,
          }}
        >
          <Jar bills={bills} shake={shake} />
        </Animated.View>
      </Animated.View>

      {/* ---------- debris ---------- */}
      <View style={styles.center} pointerEvents="none">
        {shards.map((s) => (
          <Animated.View
            key={s.key}
            style={[
              styles.shard,
              {
                width: s.w,
                height: s.h,
                opacity: burst.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, s.tx] }) },
                  { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, s.ty] }) },
                  { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${s.rot}deg`] }) },
                  { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.4, s.scale] }) },
                ],
              },
            ]}
          />
        ))}
        {flyBills.map((f) => (
          <Animated.View
            key={f.key}
            style={{
              position: 'absolute',
              opacity: burst.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] }),
              transform: [
                { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, f.tx] }) },
                { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, f.ty] }) },
                { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${f.rot}deg`] }) },
              ],
            }}
          >
            <Banknote />
          </Animated.View>
        ))}

        {/* shockwave ring */}
        <Animated.View
          style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
        />

        {/* poof cloud + sparks */}
        <Animated.View
          style={[
            styles.puff,
            {
              opacity: poof.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 0.95, 0] }),
              transform: [{ scale: poof.interpolate({ inputRange: [0, 1], outputRange: [0.2, 3.4] }) }],
            },
          ]}
        />
        {sparks.map((k) => (
          <Animated.View
            key={k.key}
            style={[
              styles.spark,
              {
                backgroundColor: k.color,
                shadowColor: k.color,
                opacity: poof.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateX: poof.interpolate({ inputRange: [0, 1], outputRange: [0, k.tx] }) },
                  { translateY: poof.interpolate({ inputRange: [0, 1], outputRange: [0, k.ty] }) },
                ],
              },
            ]}
          />
        ))}
      </View>

      {/* impact flash + final white wipe */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.white, { opacity: flash }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.white, { opacity: wipe }]} />

      {/* let people out of the animation */}
      <Pressable style={styles.skip} onPress={finish} hitSlop={10}>
        <Text style={styles.skipText}>דלג ←</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Banknote() {
  return (
    <LinearGradient colors={['#4caf76', '#2f8f57']} style={styles.bill}>
      <Text style={styles.billText}>$</Text>
    </LinearGradient>
  );
}

function Jar({
  bills,
  shake,
}: {
  bills: Array<{ key: string; left: number; bottom: number; rot: number; phase: number }>;
  shake: Animated.Value;
}) {
  return (
    <View style={styles.jar}>
      {/* glass body */}
      <LinearGradient
        colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.34)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.glass}
      >
        {bills.map((b) => (
          <Animated.View
            key={b.key}
            style={{
              position: 'absolute',
              left: b.left,
              bottom: b.bottom,
              transform: [
                { rotate: `${b.rot}deg` },
                { translateY: shake.interpolate({ inputRange: [-1, 1], outputRange: [-3 - b.phase * 3, 3 + b.phase * 3] }) },
              ],
            }}
          >
            <Banknote />
          </Animated.View>
        ))}
      </LinearGradient>
      {/* neck + rim + base */}
      <View style={styles.neck} />
      <View style={styles.rim} />
      <View style={styles.base} />
    </View>
  );
}

// ---------------------------------------------------------------------------
const JAR_W = 190;
const JAR_H = 254;

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#070a12', zIndex: 100 },
  center: {
    position: 'absolute',
    left: SCREEN_W / 2,
    top: SCREEN_H * 0.47,
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraRig: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  floorGlow: {
    position: 'absolute',
    left: '-30%',
    right: '-30%',
    top: '66%',
    height: '30%',
    backgroundColor: '#131a2e',
    opacity: 0.55,
    borderRadius: 999,
    transform: [{ scaleY: 0.35 }],
  },
  jarShadow: {
    position: 'absolute',
    top: SCREEN_H * 0.47 + 110,
    width: 200,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#000',
    opacity: 0.5,
    transform: [{ scaleY: 0.5 }],
  },
  jar: { width: JAR_W, height: JAR_H },
  glass: {
    position: 'absolute',
    left: 13,
    right: 13,
    top: 31,
    bottom: 14,
    borderRadius: 16,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    overflow: 'hidden',
    backgroundColor: 'rgba(140,180,225,0.06)',
  },
  neck: {
    position: 'absolute', left: 13, right: 13, top: 27, height: 18,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  rim: {
    position: 'absolute', left: 5, right: 5, top: 14, height: 31, borderRadius: 999,
    backgroundColor: 'rgba(200,225,250,0.30)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)',
  },
  base: {
    position: 'absolute', left: 16, right: 16, bottom: 5, height: 23, borderRadius: 999,
    backgroundColor: 'rgba(140,185,230,0.22)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  bill: {
    width: 46, height: 23, borderRadius: 3, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  billText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '900' },
  shard: {
    position: 'absolute',
    backgroundColor: 'rgba(214,236,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 2,
  },
  ring: {
    position: 'absolute', width: 56, height: 56, borderRadius: 999,
    borderWidth: 2, borderColor: 'rgba(200,230,255,0.85)',
  },
  puff: {
    position: 'absolute', width: 170, height: 170, borderRadius: 999,
    backgroundColor: '#e6e9ff',
    ...Platform.select({ ios: { shadowColor: '#fff', shadowOpacity: 0.9, shadowRadius: 40 }, android: {} }),
  },
  spark: {
    position: 'absolute', width: 6, height: 6, borderRadius: 999,
    shadowOpacity: 0.9, shadowRadius: 8, elevation: 4,
  },
  white: { backgroundColor: '#fff' },
  skip: {
    position: 'absolute', top: 48, right: 18,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
  skipText: { color: '#dfe3f5', fontSize: 12.5, fontWeight: '700' },
});
