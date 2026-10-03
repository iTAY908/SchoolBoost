// ============================================================================
// Worker 1 — Onboarding Frontend Developer
// OnboardingFlow.tsx — the full multi-step questionnaire.
//
// A small step machine drives conditional rendering: the "Independent living"
// cost step only appears when the user is NOT living with parents, and the
// income step only appears when employed. Each step animates in/out and the
// footer button label reflects the final step.
// ============================================================================

import React, { useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  SafeAreaView,
} from 'react-native';
import { colors, spacing, font } from '../../theme/theme';
import {
  PrimaryButton,
  GhostButton,
  OptionCard,
  MoneyInput,
  ProgressBar,
  StepHeader,
} from '../../components/common/UI';
import { useStore } from '../../state/store';
import { Profile } from '../../state/types';

type Draft = {
  age: string;
  employed: boolean | null;
  monthlyIncome: string;
  livesWithParents: boolean | null;
  rent: string;
  arnona: string;
  utilities: string;
  houseCommittee: string;
  initialBalance: string;
};

type StepId = 'age' | 'employment' | 'income' | 'housing' | 'housingCosts' | 'balance';

export default function OnboardingFlow() {
  // Draft + step live in the persisted store, so a user who leaves mid-signup
  // and returns (even hours later) lands on the exact step with their answers.
  const draft = useStore((s) => s.onboardingDraft);
  const index = useStore((s) => s.onboardingStep);
  const setDraft = useStore((s) => s.setDraft);
  const setStep = useStore((s) => s.setStep);
  const fade = useRef(new Animated.Value(1)).current;
  const submitOnboarding = useStore((s) => s.submitOnboarding);
  const calculating = useStore((s) => s.calculating);
  const error = useStore((s) => s.error);

  const set = (patch: Partial<Draft>) => setDraft(patch);

  // The active step list is derived from answers — this IS the conditional
  // rendering. Steps appear/disappear as the user makes choices.
  const steps: StepId[] = useMemo(() => {
    const list: StepId[] = ['age', 'employment'];
    if (draft.employed) list.push('income');
    list.push('housing');
    if (draft.livesWithParents === false) list.push('housingCosts');
    list.push('balance');
    return list;
  }, [draft.employed, draft.livesWithParents]);

  const clampedIndex = Math.min(index, steps.length - 1);
  const current = steps[clampedIndex];
  const isLast = clampedIndex === steps.length - 1;

  const animateTo = (next: number) => {
    Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    });
  };

  const canAdvance = (): boolean => {
    switch (current) {
      case 'age':
        return Number(draft.age) >= 16 && Number(draft.age) <= 100;
      case 'employment':
        return draft.employed !== null;
      case 'income':
        return Number(draft.monthlyIncome) > 0;
      case 'housing':
        return draft.livesWithParents !== null;
      case 'housingCosts':
        return Number(draft.rent) > 0; // at least rent
      case 'balance':
        return draft.initialBalance !== '' && Number(draft.initialBalance) >= 0;
      default:
        return false;
    }
  };

  const onNext = () => {
    if (!canAdvance()) return;
    if (isLast) return finish();
    animateTo(clampedIndex + 1);
  };

  const onBack = () => {
    if (clampedIndex === 0) return;
    animateTo(clampedIndex - 1);
  };

  const finish = () => {
    const profile: Profile = {
      age: Number(draft.age),
      employed: !!draft.employed,
      monthlyIncome: Number(draft.monthlyIncome) || 0,
      livesWithParents: !!draft.livesWithParents,
      initialBalance: Number(draft.initialBalance) || 0,
      housing: draft.livesWithParents
        ? undefined
        : {
            rent: Number(draft.rent) || 0,
            arnona: Number(draft.arnona) || 0,
            utilities: Number(draft.utilities) || 0,
            houseCommittee: Number(draft.houseCommittee) || 0,
          },
    };
    submitOnboarding(profile);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>🧊 CubeFinance</Text>
          <ProgressBar step={clampedIndex + 1} total={steps.length} />
          <Text style={styles.stepCount}>
            Step {clampedIndex + 1} of {steps.length}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fade }}>
            {renderStep(current, draft, set)}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            label={isLast ? (calculating ? 'Building your cubes…' : 'Build my Cubes 🧊') : 'Continue'}
            onPress={onNext}
            disabled={!canAdvance() || calculating}
          />
          {clampedIndex > 0 ? <GhostButton label="Back" onPress={onBack} /> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function renderStep(step: StepId, d: Draft, set: (p: Partial<Draft>) => void) {
  switch (step) {
    case 'age':
      return (
        <>
          <StepHeader title="How old are you?" subtitle="Your age helps us tune investment suggestions." />
          <MoneyInput
            label="Age"
            value={d.age}
            onChangeText={(t) => set({ age: t })}
            placeholder="28"
            autoFocus
          />
        </>
      );
    case 'employment':
      return (
        <>
          <StepHeader title="Do you work?" subtitle="Tells us whether to plan around an income." />
          <OptionCard label="Yes, I'm employed" selected={d.employed === true} onPress={() => set({ employed: true })} />
          <OptionCard
            label="Not right now"
            sub="We'll plan around your balance instead"
            selected={d.employed === false}
            onPress={() => set({ employed: false, monthlyIncome: '' })}
          />
        </>
      );
    case 'income':
      return (
        <>
          <StepHeader title="Monthly income" subtitle="Your estimated take-home each month." />
          <MoneyInput
            label="Estimated monthly income"
            value={d.monthlyIncome}
            onChangeText={(t) => set({ monthlyIncome: t })}
            placeholder="10000"
            autoFocus
          />
        </>
      );
    case 'housing':
      return (
        <>
          <StepHeader title="Where do you live?" subtitle="This decides whether we build a Housing cube." />
          <OptionCard
            label="With my parents"
            sub="No rent — we redirect that into savings & investing"
            selected={d.livesWithParents === true}
            onPress={() => set({ livesWithParents: true })}
          />
          <OptionCard
            label="Independently"
            sub="We'll create a Housing & Bills cube"
            selected={d.livesWithParents === false}
            onPress={() => set({ livesWithParents: false })}
          />
        </>
      );
    case 'housingCosts':
      return (
        <>
          <StepHeader
            title="Your monthly home costs"
            subtitle="Only rent is required — add the rest for a sharper plan."
          />
          <MoneyInput label="Rent" value={d.rent} onChangeText={(t) => set({ rent: t })} placeholder="3500" autoFocus />
          <MoneyInput label="Arnona (city tax)" value={d.arnona} onChangeText={(t) => set({ arnona: t })} placeholder="300" />
          <MoneyInput label="Utilities (water/electric/gas)" value={d.utilities} onChangeText={(t) => set({ utilities: t })} placeholder="400" />
          <MoneyInput label="House committee (va'ad bayit)" value={d.houseCommittee} onChangeText={(t) => set({ houseCommittee: t })} placeholder="100" />
        </>
      );
    case 'balance':
      return (
        <>
          <StepHeader
            title="Starting balance"
            subtitle="Enter the balance you want to track and manage in the app. (Simulated — no bank connection.)"
          />
          <MoneyInput
            label="Balance to track"
            value={d.initialBalance}
            onChangeText={(t) => set({ initialBalance: t })}
            placeholder="15000"
            autoFocus
          />
          <Text style={styles.hint}>
            We'll split this across your cubes when you tap “Distribute” on the dashboard.
          </Text>
        </>
      );
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing(3), paddingTop: spacing(2), gap: spacing(1.5) },
  brand: { color: colors.text, fontSize: 18, fontWeight: '800' },
  stepCount: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  body: { paddingHorizontal: spacing(3), paddingTop: spacing(4), paddingBottom: spacing(4) },
  footer: { paddingHorizontal: spacing(3), paddingBottom: spacing(3), gap: spacing(1) },
  error: { color: colors.danger, marginTop: spacing(2), fontWeight: '600' },
  hint: { color: colors.textDim, fontSize: 13, marginTop: spacing(1) },
});
