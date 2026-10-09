// Worker 1 & 2 — small reusable UI primitives (buttons, inputs, chips, progress)
import React from 'react';
import {
  Text,
  TextInput,
  Pressable,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, radius, spacing, font } from '../../theme/theme';

export function PrimaryButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        disabled && styles.btnDisabled,
        pressed && !disabled && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.6 }]}>
      <Text style={styles.ghostText}>{label}</Text>
    </Pressable>
  );
}

export function OptionCard({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.optionLabel, selected && { color: colors.text }]}>{label}</Text>
        {sub ? <Text style={styles.optionSub}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

export function MoneyInput({
  value,
  onChangeText,
  placeholder,
  label,
  autoFocus,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
}) {
  return (
    <View style={{ marginBottom: spacing(2) }}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <View style={styles.inputWrap}>
        <Text style={styles.currency}>₪</Text>
        <TextInput
          value={value}
          onChangeText={(t) => onChangeText(t.replace(/[^0-9.]/g, ''))}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          keyboardType="numeric"
          autoFocus={autoFocus}
          style={styles.input}
        />
      </View>
    </View>
  );
}

export function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round((step / total) * 100);
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
    </View>
  );
}

export function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: spacing(3) }}>
      <Text style={[font.h1, { color: colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[font.body, { color: colors.textDim, marginTop: spacing(1) }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { backgroundColor: colors.cardBorder },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' } as TextStyle,
  ghost: { paddingVertical: spacing(1.5), alignItems: 'center' },
  ghostText: { color: colors.textDim, fontSize: 15, fontWeight: '600' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    padding: spacing(2),
    marginBottom: spacing(1.5),
    gap: spacing(1.5),
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: '#221F3A' },
  optionLabel: { color: colors.textDim, fontSize: 16, fontWeight: '700' },
  optionSub: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  inputLabel: { color: colors.textDim, fontSize: 14, fontWeight: '600', marginBottom: spacing(1) },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2),
  },
  currency: { color: colors.textDim, fontSize: 20, fontWeight: '700', marginRight: spacing(1) },
  input: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '700', paddingVertical: spacing(2) },
  progressTrack: {
    height: 6,
    backgroundColor: colors.cardBorder,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
});
