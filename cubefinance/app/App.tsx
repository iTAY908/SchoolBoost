// ============================================================================
// Worker 5 — Integration root.
// Chooses the screen based on onboarding state and mounts the floating buddy
// globally so it's available on every post-onboarding screen. All wiring flows
// through the single Zustand store — no props passed between modules.
// ============================================================================

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import OnboardingFlow from './src/screens/onboarding/OnboardingFlow';
import DashboardScreen from './src/screens/DashboardScreen';
import { FloatingChatbot } from './src/components/chat/FloatingChatbot';
import { useStore } from './src/state/store';
import { colors } from './src/theme/theme';

export default function App() {
  const onboarded = useStore((s) => s.onboarded);

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
