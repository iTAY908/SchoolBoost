// ============================================================================
// Worker 5 — Integration root.
// Chooses the screen based on onboarding state and mounts the floating buddy
// globally so it's available on every post-onboarding screen. All wiring flows
// through the single Zustand store — no props passed between modules.
// ============================================================================

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import OnboardingFlow from './src/screens/onboarding/OnboardingFlow';
import DashboardScreen from './src/screens/DashboardScreen';
import { FloatingChatbot } from './src/components/chat/FloatingChatbot';
import { useStore } from './src/state/store';
import { colors } from './src/theme/theme';

export default function App() {
  const onboarded = useStore((s) => s.onboarded);
  const hydrated = useStore((s) => s.hydrated);

  // Wait for the persisted state to load from disk before deciding which screen
  // to show — avoids a flash of onboarding for a returning, already-set-up user.
  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="light" />
        <Text style={{ fontSize: 40, marginBottom: 16 }}>🧊</Text>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      {onboarded ? (
        <>
          <DashboardScreen />
          {/* Worker 4 buddy — global FAB, mounted only after onboarding */}
          <FloatingChatbot />
        </>
      ) : (
        <OnboardingFlow />
      )}
    </View>
  );
}
