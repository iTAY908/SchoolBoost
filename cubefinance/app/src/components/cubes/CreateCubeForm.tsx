// ============================================================================
// Create Custom Cube — modal form. Fund a personal-goal cube either manually
// (fixed monthly amount) or by the AI's 1–10 priority logic. The created cube
// is added to the store and persisted (AsyncStorage) so it survives reloads.
// ============================================================================

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Modal, Pressable, Platform } from 'react-native';
// Slider is optional; we use a simple 1–10 stepper to avoid extra native deps.
import { colors, spacing, radius, font } from '../../theme/theme';
import { PrimaryButton, GhostButton, OptionCard, MoneyInput } from '../common/UI';
import { useStore } from '../../state/store';
import { allocateCustomCube } from '../../logic/customCube';

export function CreateCubeForm({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const profile = useStore((s) => s.profile);
  const cubes = useStore((s) => s.cubes);
  const addCustomCube = useStore((s) => s.addCustomCube);

  const [name, setName] = useState('');
  const [mode, setMode] = useState<'manual' | 'ai' | null>(null);
  const [amount, setAmount] = useState('');
  const [priority, setPriority] = useState(5);
  const [ai, setAi] = useState<{ amount: number; explanation: string } | null>(null);

  const income = profile?.monthlyIncome || 0;
  const housing = cubes.find((c) => c.key === 'housing');
  const housingCost = housing ? housing.monthlyContribution : 0;

  const reset = () => { setName(''); setMode(null); setAmount(''); setPriority(5); setAi(null); };
  const close = () => { reset(); onClose(); };

  const calcAI = () => setAi(allocateCustomCube(priority, income, housingCost));

  const finalAmount = mode === 'manual' ? Number(amount) || 0 : ai?.amount || 0;
  const canCreate = name.trim().length > 0 && finalAmount > 0 && (mode === 'manual' || (mode === 'ai' && !!ai));

  const create = () => {
    addCustomCube(
      name,
      finalAmount,
      mode === 'ai' && ai ? { priority, explanation: ai.explanation } : {}
    );
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={[font.h2, { color: colors.text }]}>צור קובייה אישית 🎯</Text>
        <Text style={styles.sub}>קובייה למטרה אישית — טיול, גאדג׳ט, כל יעד. הנתונים נשמרים לתמיד.</Text>

        <Text style={styles.label}>שם הקובייה</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="טיול ליפן"
            placeholderTextColor="#55556a"
            style={styles.input}
          />
        </View>

        <Text style={styles.label}>איך לממן?</Text>
        <OptionCard label="סכום חודשי קבוע" sub="אני קובע כמה להפריש" selected={mode === 'manual'} onPress={() => setMode('manual')} />
        <OptionCard label="תן ל-AI להחליט 🤖" sub="לפי חשיבות הקובייה עבורך" selected={mode === 'ai'} onPress={() => setMode('ai')} />

        {mode === 'manual' ? (
          <MoneyInput label="סכום חודשי" value={amount} onChangeText={setAmount} placeholder="500" />
        ) : null}

        {mode === 'ai' ? (
          <View style={{ marginTop: spacing(1) }}>
            <Text style={styles.label}>כמה חשובה לך הקובייה? (1 = נמוך, 10 = קריטי)</Text>
            <View style={styles.stepper}>
              <Pressable style={styles.stepBtn} onPress={() => { setPriority((p) => Math.max(1, p - 1)); setAi(null); }}>
                <Text style={styles.stepTxt}>−</Text>
              </Pressable>
              <Text style={styles.priorityVal}>{priority}</Text>
              <Pressable style={styles.stepBtn} onPress={() => { setPriority((p) => Math.min(10, p + 1)); setAi(null); }}>
                <Text style={styles.stepTxt}>＋</Text>
              </Pressable>
            </View>
            <PrimaryButton label="חשב עם AI 🤖" onPress={calcAI} style={{ marginTop: spacing(1.5) }} />
            {ai ? (
              <View style={styles.aiBox}>
                <Text style={styles.aiAmt}>₪{ai.amount.toLocaleString()} <Text style={styles.aiUnit}>לחודש</Text></Text>
                <Text style={styles.aiExp}>{ai.explanation}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <PrimaryButton label="צור קובייה" onPress={create} disabled={!canCreate} style={{ marginTop: spacing(2) }} />
        <GhostButton label="ביטול" onPress={close} />
      </View>
    </Modal>
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
  handle: { width: 40, height: 4, backgroundColor: colors.cardBorder, borderRadius: 2, alignSelf: 'center', marginBottom: spacing(2) },
  sub: { color: colors.textDim, fontSize: 14, marginTop: spacing(1), marginBottom: spacing(2), textAlign: 'right' },
  label: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginBottom: spacing(1), marginTop: spacing(1), textAlign: 'right' },
  inputWrap: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.cardBorder, borderRadius: radius.md, paddingHorizontal: spacing(2), marginBottom: spacing(1) },
  input: { color: colors.text, fontSize: 16, fontWeight: '600', paddingVertical: spacing(1.75), textAlign: 'right' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), justifyContent: 'center' },
  stepBtn: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { color: colors.text, fontSize: 24, fontWeight: '800' },
  priorityVal: { color: colors.primary, fontSize: 30, fontWeight: '900', minWidth: 54, textAlign: 'center' },
  aiBox: { marginTop: spacing(1.5), backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primaryDim, borderRadius: radius.md, padding: spacing(2) },
  aiAmt: { color: colors.text, fontSize: 26, fontWeight: '900' },
  aiUnit: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  aiExp: { color: colors.textDim, fontSize: 13.5, lineHeight: 20, marginTop: spacing(0.5), textAlign: 'right' },
});
