// ============================================================================
// Worker 5 — Integration root.
// Auth gate first (Sign Up / Log In), then onboarding vs dashboard based on
// whether the signed-in account already completed onboarding. The floating
// buddy is mounted globally once inside the app.
// ============================================================================

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import AuthScreen from './src/screens/auth/AuthScreen';
import OnboardingFlow from './src/screens/onboarding/OnboardingFlow';
import DashboardScreen from './src/screens/DashboardScreen';
import { FloatingChatbot } from './src/components/chat/FloatingChatbot';
import { useStore } from './src/state/store';
import { colors } from './src/theme/theme';

function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <StatusBar style="light" />
      <Text style={{ fontSize: 40, marginBottom: 16 }}>🧊</Text>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export default function App() {
  const authChecked = useStore((s) => s.authChecked);
  const authUser = useStore((s) => s.authUser);
  const hydrated = useStore((s) => s.hydrated);
  const onboarded = useStore((s) => s.onboarded);
  const checkSession = useStore((s) => s.checkSession);

  // Restore an existing session on launch.
  useEffect(() => { checkSession(); }, [checkSession]);

  if (!authChecked) return <Splash />;
  if (!authUser) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="light" />
        <AuthScreen />
      </View>
    );
  }
  if (!hydrated) return <Splash />; // loading this account's saved state

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      {onboarded ? (
        <>
          <DashboardScreen />
          <FloatingChatbot />
        </>
      ) : (
        <OnboardingFlow />
      )}
    </View>
  );
}
