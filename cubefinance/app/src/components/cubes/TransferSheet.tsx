// ============================================================================
// Worker 2 — Dashboard & Cubes UI Developer
// TransferSheet.tsx — the "distribute" control. Lets the user move money out of
// the main-account pool into the cubes and TRIGGERS the transfer animation
// (coins flying + per-cube count-up on the dashboard).
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Easing, Pressable } from 'react-native';
import { colors, radius, spacing, font } from '../../theme/theme';
import { MoneyInput, PrimaryButton, GhostButton } from '../common/UI';
import { useStore } from '../../state/store';

export function TransferSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const mainAccount = useStore((s) => s.mainAccount);
  const transfer = useStore((s) => s.transfer);
  const transferring = useStore((s) => s.transferring);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (visible) setAmount(String(mainAccount));
  }, [visible, mainAccount]);

  const value = Number(amount) || 0;
  const invalid = value <= 0 || value > mainAccount;

  const run = async () => {
    await transfer(value);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={[font.h2, { color: colors.text }]}>Distribute funds</Text>
        <Text style={styles.sub}>
          Move money from your main account pool into your cubes, split by each
          cube's percentage (fixed cubes are funded first).
        </Text>

        <View style={styles.poolChip}>
          <Text style={styles.poolLabel}>Main account pool</Text>
          <Text style={styles.poolValue}>₪{mainAccount.toLocaleString()}</Text>
        </View>

        <MoneyInput label="Amount to distribute" value={amount} onChangeText={setAmount} />
        <View style={styles.quickRow}>
          {[0.25, 0.5, 1].map((f) => (
            <Pressable
              key={f}
              style={styles.quick}
              onPress={() => setAmount(String(Math.round(mainAccount * f)))}
            >
              <Text style={styles.quickText}>{f === 1 ? 'All' : `${f * 100}%`}</Text>
            </Pressable>
          ))}
        </View>

        {invalid && value > mainAccount ? (
          <Text style={styles.warn}>That's more than your pool holds.</Text>
        ) : null}

        <PrimaryButton
          label={transferring ? 'Distributing…' : `Distribute ₪${value.toLocaleString()}`}
          onPress={run}
          disabled={invalid || transferring}
          style={{ marginTop: spacing(2) }}
        />
        <GhostButton label="Cancel" onPress={onClose} />
      </View>
    </Modal>
  );
}

/**
 * Full-screen coin-burst overlay played when a transfer completes. Purely
 * decorative; reads `lastTransfer` and self-dismisses.
 */
export function TransferAnimation() {
  const lastTransfer = useStore((s) => s.lastTransfer);
  const clear = useStore((s) => s.clearTransferEvent);
  const coins = useRef(
    Array.from({ length: 14 }, () => ({
      y: new Animated.Value(0),
      x: Math.random() * 300 - 150,
      delay: Math.random() * 250,
    }))
  ).current;

  useEffect(() => {
    if (!lastTransfer) return;
    const anims = coins.map((c) =>
      Animated.timing(c.y, {
        toValue: 1,
        duration: 900,
        delay: c.delay,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      })
    );
    coins.forEach((c) => c.y.setValue(0));
    Animated.stagger(20, anims).start(() => {
      const t = setTimeout(clear, 200);
      return () => clearTimeout(t);
    });
  }, [lastTransfer]);

  if (!lastTransfer) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {coins.map((c, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.coin,
            {
              transform: [
                { translateX: c.x },
                {
                  translateY: c.y.interpolate({ inputRange: [0, 1], outputRange: [-80, 500] }),
                },
                { rotate: c.y.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
              ],
              opacity: c.y.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            },
          ]}
        >
          🪙
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing(3),
    paddingBottom: spacing(5),
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.cardBorder,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing(2),
  },
  sub: { color: colors.textDim, fontSize: 14, marginVertical: spacing(1.5) },
  poolChip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing(2),
    marginBottom: spacing(2),
  },
  poolLabel: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  poolValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  quickRow: { flexDirection: 'row', gap: spacing(1), marginBottom: spacing(1) },
  quick: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing(1.25),
    alignItems: 'center',
  },
  quickText: { color: colors.text, fontWeight: '700' },
  warn: { color: colors.warning, fontWeight: '600', marginTop: spacing(0.5) },
  coin: { position: 'absolute', top: 0, alignSelf: 'center', fontSize: 30 },
});
