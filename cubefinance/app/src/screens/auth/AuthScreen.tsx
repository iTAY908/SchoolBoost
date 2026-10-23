// ============================================================================
// Auth UI — Sign Up / Log In screen. Clean, modern, Hebrew error messages.
// Talks only to the store's auth actions (which use the Mock Auth Service).
// ============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { colors, spacing, radius, font } from '../../theme/theme';
import { PrimaryButton } from '../../components/common/UI';
import { useStore } from '../../state/store';

export default function AuthScreen() {
  const signUp = useStore((s) => s.signUp);
  const logIn = useStore((s) => s.logIn);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';

  const submit = async () => {
    setError('');
    setBusy(true);
    const err = isSignup ? await signUp(email, password) : await logIn(email, password);
    setBusy(false);
    if (err) setError(err); // e.g. "שגיאה: סיסמה שגויה" / "האימייל כבר רשום במערכת"
    // On success the store flips authUser and App.tsx swaps the screen.
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.center}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.brand}>🧊 CubeFinance</Text>
          <Text style={styles.title}>{isSignup ? 'יצירת חשבון' : 'התחברות'}</Text>
          <Text style={styles.sub}>
            {isSignup ? 'הירשם כדי להתחיל לחלק את הכסף לקוביות.' : 'התחבר כדי להמשיך לקוביות שלך.'}
          </Text>

          <Text style={styles.label}>אימייל</Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#55556a"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <Text style={styles.label}>סיסמה</Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••"
              placeholderTextColor="#55556a"
              secureTextEntry
              autoCapitalize="none"
              style={styles.input}
              onSubmitEditing={submit}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : <View style={{ height: spacing(2) }} />}

          {busy ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing(1.5) }} />
          ) : (
            <PrimaryButton label={isSignup ? 'הרשמה' : 'התחברות'} onPress={submit} />
          )}

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {isSignup ? 'כבר יש לך חשבון?' : 'עדיין אין לך חשבון?'}
            </Text>
            <Pressable onPress={() => { setMode(isSignup ? 'login' : 'signup'); setError(''); }}>
              <Text style={styles.switchLink}>{isSignup ? ' התחבר' : ' הירשם'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    padding: spacing(3),
  },
  brand: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  title: { ...font.h1, color: colors.text, marginTop: spacing(1.5) },
  sub: { color: colors.textDim, fontSize: 14, marginTop: spacing(0.5), marginBottom: spacing(2.5) },
  label: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginBottom: spacing(1), textAlign: 'right' },
  inputWrap: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2),
    marginBottom: spacing(2),
  },
  input: { color: colors.text, fontSize: 16, fontWeight: '600', paddingVertical: spacing(1.75), textAlign: 'left' },
  error: { color: colors.danger, fontSize: 13.5, fontWeight: '700', marginBottom: spacing(1.5), textAlign: 'right' },
  switchRow: { flexDirection: 'row-reverse', justifyContent: 'center', marginTop: spacing(2) },
  switchText: { color: colors.textDim, fontSize: 13.5 },
  switchLink: { color: colors.primary, fontSize: 13.5, fontWeight: '800' },
});
