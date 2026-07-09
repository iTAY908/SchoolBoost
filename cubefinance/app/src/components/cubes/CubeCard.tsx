// ============================================================================
// Worker 2 — Dashboard & Cubes UI Developer
// CubeCard.tsx — one budget cube. Shows balance, monthly target, a color-coded
// fill bar (balance / target) and an animated count-up when the balance changes
// (driven by the transfer simulation).
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors, radius, spacing } from '../../theme/theme';
import { Cube } from '../../state/types';

const ICONS: Record<string, string> = {
  home: '🏠',
  cart: '🛒',
  'piggy-bank': '🐷',
  'trending-up': '📈',
  shield: '🛡️',
  sparkles: '✨',
};

export function CubeCard({ cube, highlight }: { cube: Cube; highlight?: boolean }) {
  const target = cube.monthlyContribution || 1;
  const fillPct = Math.max(0, Math.min(1, cube.balance / target));

  const fill = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const [displayBalance, setDisplayBalance] = useState(cube.balance);
  const prevBalance = useRef(cube.balance);

  useEffect(() => {
    Animated.timing(fill, {
      toValue: fillPct,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fillPct]);

  // Count-up animation + a little pop when money lands in this cube.
  useEffect(() => {
    const from = prevBalance.current;
    const to = cube.balance;
    prevBalance.current = to;
    if (from === to) {
      setDisplayBalance(to);
      return;
    }
    if (highlight) {
      Animated.sequence([
        Animated.spring(pop, { toValue: 1.06, useNativeDriver: true, speed: 30, bounciness: 12 }),
        Animated.spring(pop, { toValue: 1, useNativeDriver: true }),
      ]).start();
    }
    const start = Date.now();
    const dur = 650;
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayBalance(from + (to - from) * eased);
      if (t >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [cube.balance, highlight]);

  const low = cube.balance < target * 0.2;

  return (
    <Animated.View
      style={[
        styles.card,
        { borderColor: highlight ? cube.color : colors.cardBorder, transform: [{ scale: pop }] },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.iconChip, { backgroundColor: cube.color + '22' }]}>
          <Text style={styles.icon}>{ICONS[cube.icon] || '🧊'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{cube.name}</Text>
          <Text style={styles.note}>{cube.note}</Text>
        </View>
        <View style={[styles.pctChip, { backgroundColor: cube.color + '22' }]}>
          <Text style={[styles.pct, { color: cube.color }]}>{cube.percentage}%</Text>
        </View>
      </View>

      <View style={styles.balanceRow}>
        <Text style={styles.balance}>
          ₪{Math.round(displayBalance).toLocaleString()}
        </Text>
        <Text style={styles.target}>/ ₪{target.toLocaleString()}·mo</Text>
        {cube.fixed ? <Text style={styles.fixedTag}>FIXED</Text> : null}
      </View>

      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fillBar,
            {
              backgroundColor: low ? colors.danger : cube.color,
              width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      {low ? <Text style={styles.lowText}>⚠️ Running low</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing(2),
    marginBottom: spacing(1.5),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  iconChip: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  note: { color: colors.textDim, fontSize: 12, marginTop: 1 },
  pctChip: { paddingHorizontal: spacing(1.25), paddingVertical: spacing(0.5), borderRadius: radius.pill },
  pct: { fontSize: 13, fontWeight: '800' },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing(1), marginTop: spacing(1.5) },
  balance: { color: colors.text, fontSize: 24, fontWeight: '800' },
  target: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  fixedTag: {
    marginLeft: 'auto',
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  track: {
    height: 8,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginTop: spacing(1.5),
  },
  fillBar: { height: '100%', borderRadius: radius.pill },
  lowText: { color: colors.danger, fontSize: 12, fontWeight: '700', marginTop: spacing(1) },
});
