// ============================================================================
// Worker 5 — Integration root.
// Launch intro animation → auth gate (Sign Up / Log In) → onboarding vs
// dashboard, based on whether the signed-in account already completed
// onboarding. The floating buddy is mounted globally once inside the app, and
// the interstitial ad engine runs for the whole session.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import AuthScreen from './src/screens/auth/AuthScreen';
import OnboardingFlow from './src/screens/onboarding/OnboardingFlow';
import DashboardScreen from './src/screens/DashboardScreen';
import { FloatingChatbot } from './src/components/chat/FloatingChatbot';
import IntroAnimation from './src/components/intro/IntroAnimation';
import useInterstitialTimer from './src/ads/useInterstitialTimer';
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
  // When the store gains a premium flag (the 110 ₪ one-time purchase), ads
  // switch themselves off for that account.
  const isPremium = useStore((s: any) => !!s.premium);

  const [introDone, setIntroDone] = useState(false);

  // Restore an existing session on launch (runs while the intro plays).
  useEffect(() => { checkSession(); }, [checkSession]);

  // ---- Interstitial every 6 minutes of foreground time --------------------
  // Suppressed for premium users, and while the intro or the onboarding wizard
  // is on screen so a flow is never interrupted half-way — which is also what
  // AdMob's interstitial placement policy requires.
  const inOnboarding = !!authUser && hydrated && !onboarded;
  useInterstitialTimer({
    enabled: !isPremium,
    blocked: !introDone || !authUser || inOnboarding,
  });

  // The intro owns the screen while the session is restored in the background.
  if (!introDone) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="light" />
        <IntroAnimation onFinish={() => setIntroDone(true)} />
      </View>
    );
  }

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
