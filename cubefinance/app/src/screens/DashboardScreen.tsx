// ============================================================================
// Worker 2 — Dashboard & Cubes UI Developer
// DashboardScreen.tsx — the home screen. Total balance header, main-account
// pool, alert banner, the grid of cubes, and the distribute trigger.
// ============================================================================

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Pressable } from 'react-native';
import { colors, radius, spacing, font } from '../theme/theme';
import { CubeCard } from '../components/cubes/CubeCard';
import { TransferSheet, TransferAnimation } from '../components/cubes/TransferSheet';
import { useStore, selectTotalBalance } from '../state/store';

export default function DashboardScreen() {
  const cubes = useStore((s) => s.cubes);
  const mainAccount = useStore((s) => s.mainAccount);
  const summary = useStore((s) => s.summary);
  const alerts = useStore((s) => s.alerts);
  const lastTransfer = useStore((s) => s.lastTransfer);
  const total = useStore(selectTotalBalance);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Keys that just received money — used to highlight/animate those cards.
  const justFunded = useMemo(
    () => new Set((lastTransfer?.allocations || []).map((a) => a.key)),
    [lastTransfer]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.brand}>🧊 CubeFinance</Text>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Total across cubes</Text>
          <Text style={styles.heroValue}>₪{Math.round(total).toLocaleString()}</Text>
          <View style={styles.poolRow}>
            <Text style={styles.poolText}>
              Main account: <Text style={styles.poolStrong}>₪{mainAccount.toLocaleString()}</Text>
            </Text>
            <Pressable style={styles.distributeBtn} onPress={() => setSheetOpen(true)} disabled={mainAccount <= 0}>
              <Text style={styles.distributeText}>Distribute →</Text>
            </Pressable>
          </View>
        </View>

        {summary ? <Text style={styles.summary}>{summary.headline}</Text> : null}

        {alerts.length > 0 ? (
          <View style={styles.alertBox}>
            {alerts.map((a, i) => (
              <Text key={i} style={[styles.alert, a.level === 'critical' && { color: colors.danger }]}>
                {a.level === 'critical' ? '🔴' : '🟡'} {a.message}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Your Cubes</Text>
        {cubes.map((c) => (
          <CubeCard key={c.key} cube={c} highlight={justFunded.has(c.key)} />
        ))}

        {cubes.length === 0 ? (
          <Text style={styles.empty}>No cubes yet — complete onboarding to build them.</Text>
        ) : null}

        <View style={{ height: spacing(12) }} />
      </ScrollView>

      <TransferAnimation />
      <TransferSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing(3), paddingBottom: spacing(6) },
  brand: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing(2) },
  hero: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing(3),
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
  },
  heroLabel: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  heroValue: { color: colors.text, fontSize: 40, fontWeight: '900', marginTop: spacing(0.5) },
  poolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing(2),
  },
  poolText: { color: colors.textDim, fontSize: 14 },
  poolStrong: { color: colors.text, fontWeight: '700' },
  distributeBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    borderRadius: radius.pill,
  },
  distributeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  summary: { color: colors.textDim, fontSize: 14, marginVertical: spacing(2), lineHeight: 20 },
  alertBox: {
    backgroundColor: '#2A1F1F',
    borderRadius: radius.md,
    padding: spacing(2),
    gap: spacing(0.5),
    marginBottom: spacing(2),
  },
  alert: { color: colors.warning, fontSize: 13, fontWeight: '600' },
  sectionTitle: { ...font.h3, color: colors.text, marginBottom: spacing(1.5), marginTop: spacing(1) },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: spacing(4) },
});
