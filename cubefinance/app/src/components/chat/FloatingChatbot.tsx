// ============================================================================
// Worker 4 — Floating AI Financial Buddy Developer
// FloatingChatbot.tsx — a FAB at the bottom-right that expands into a chat
// panel. Streams replies from the backend and is fully aware of the live cube
// state + profile (pulled straight from the Worker 5 store on each send).
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  SafeAreaView,
} from 'react-native';
import { colors, radius, spacing, font } from '../../theme/theme';
import { useStore, selectHasAlerts } from '../../state/store';

const SUGGESTIONS = ['Can I afford 500 ILS?', 'How am I doing?', 'My rent is going up'];

export function FloatingChatbot() {
  const [open, setOpen] = useState(false);
  const hasAlerts = useStore(selectHasAlerts);
  const pulse = useRef(new Animated.Value(1)).current;

  // Gentle pulse on the FAB when there are active alerts (real-time nudge).
  useEffect(() => {
    if (!hasAlerts) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [hasAlerts]);

  return (
    <>
      <Animated.View style={[styles.fabWrap, { transform: [{ scale: pulse }] }]}>
        <Pressable style={styles.fab} onPress={() => setOpen(true)}>
          <Text style={styles.fabIcon}>🧊</Text>
          {hasAlerts ? <View style={styles.fabBadge} /> : null}
        </Pressable>
      </Animated.View>
      <ChatPanel visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ChatPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const chat = useStore((s) => s.chat);
  const sendChat = useStore((s) => s.sendChat);
  const streaming = useStore((s) => s.chatStreaming);
  const alerts = useStore((s) => s.alerts);
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [chat]);

  const send = (t: string) => {
    const msg = t.trim();
    if (!msg || streaming) return;
    setText('');
    sendChat(msg);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <SafeAreaView style={styles.panelSafe}>
        <KeyboardAvoidingView
          style={styles.panel}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[font.h3, { color: colors.text }]}>Cubey 🧊</Text>
              <Text style={styles.headerSub}>
                {streaming ? 'typing…' : 'Your financial buddy · knows your cubes'}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.close}>
              <Text style={{ color: colors.textDim, fontSize: 20 }}>✕</Text>
            </Pressable>
          </View>

          {alerts.length > 0 ? (
            <View style={styles.alertStrip}>
              <Text style={styles.alertStripText}>🔔 {alerts[0].message}</Text>
            </View>
          ) : null}

          <ScrollView ref={scrollRef} contentContainerStyle={styles.messages}>
            {chat.length === 0 ? (
              <View style={styles.intro}>
                <Text style={styles.introEmoji}>👋</Text>
                <Text style={styles.introText}>
                  Hi! I'm Cubey. I can see your cubes and balances. Ask me anything about
                  your money.
                </Text>
              </View>
            ) : null}

            {chat.map((m, i) => (
              <View
                key={i}
                style={[styles.bubbleRow, m.role === 'user' ? styles.rowUser : styles.rowBot]}
              >
                <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
                  <Text style={[styles.bubbleText, m.role === 'user' && { color: '#fff' }]}>
                    {m.content || '…'}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {chat.length === 0 ? (
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} style={styles.chip} onPress={() => send(s)}>
                  <Text style={styles.chipText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.inputBar}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Ask Cubey…"
              placeholderTextColor={colors.textDim}
              style={styles.textInput}
              onSubmitEditing={() => send(text)}
              editable={!streaming}
            />
            <Pressable
              style={[styles.sendBtn, (!text.trim() || streaming) && { opacity: 0.4 }]}
              onPress={() => send(text)}
              disabled={!text.trim() || streaming}
            >
              <Text style={styles.sendIcon}>➤</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fabWrap: { position: 'absolute', right: spacing(3), bottom: spacing(4) },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabIcon: { fontSize: 28 },
  fabBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  panelSafe: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  panel: {
    height: '82%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing(2),
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  headerSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  close: { padding: spacing(1) },
  alertStrip: { backgroundColor: '#2A1F1F', padding: spacing(1.5) },
  alertStripText: { color: colors.warning, fontSize: 13, fontWeight: '600' },
  messages: { padding: spacing(2), gap: spacing(1) },
  intro: { alignItems: 'center', paddingVertical: spacing(4), gap: spacing(1) },
  introEmoji: { fontSize: 40 },
  introText: { color: colors.textDim, textAlign: 'center', fontSize: 14, lineHeight: 20, paddingHorizontal: spacing(3) },
  bubbleRow: { flexDirection: 'row', marginBottom: spacing(1) },
  rowUser: { justifyContent: 'flex-end' },
  rowBot: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: radius.md, padding: spacing(1.5) },
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  bubbleText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1), padding: spacing(2) },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    padding: spacing(2),
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
    color: colors.text,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { color: '#fff', fontSize: 18 },
});
