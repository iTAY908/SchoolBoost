// ============================================================================
// Worker 5 — State Management & Integration Coordinator
// store.ts — the single source of truth. Zustand keeps this tiny and reactive:
// every screen subscribes with a selector, so when the CHATBOT mutates a cube,
// the DASHBOARD re-renders automatically. No prop drilling, no event bus.
// ============================================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { Cube, Profile, Alert, ChatMessage, OnboardingDraft, EMPTY_DRAFT } from './types';

interface TransferEvent {
  allocations: { key: string; name: string; amount: number }[];
  at: number;
}

interface AppState {
  // --- data ---
  profile: Profile | null;
  cubes: Cube[];
  mainAccount: number;
  summary: any | null;
  alerts: Alert[];
  chat: ChatMessage[];

  // --- onboarding progress (persisted, so registration resumes) ---
  onboardingDraft: OnboardingDraft;
  onboardingStep: number;
  lastSavedAt: number | null;

  // --- status flags ---
  onboarded: boolean;
  hydrated: boolean; // true once persisted state has been read back from disk
  calculating: boolean;
  transferring: boolean;
  chatStreaming: boolean;
  error: string | null;

  // signals the dashboard's transfer animation to play
  lastTransfer: TransferEvent | null;

  // --- actions ---
  setDraft: (patch: Partial<OnboardingDraft>) => void;
  setStep: (n: number) => void;
  submitOnboarding: (profile: Profile) => Promise<void>;
  transfer: (amount: number) => Promise<void>;
  spend: (cubeKey: string, amount: number) => Promise<void>;
  sendChat: (text: string) => Promise<void>;
  clearTransferEvent: () => void;
  reset: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
  profile: null,
  cubes: [],
  mainAccount: 0,
  summary: null,
  alerts: [],
  chat: [],

  onboardingDraft: EMPTY_DRAFT,
  onboardingStep: 0,
  lastSavedAt: null,

  onboarded: false,
  hydrated: false,
  calculating: false,
  transferring: false,
  chatStreaming: false,
  error: null,
  lastTransfer: null,

  // --- Worker 1: persist each answer so registration can be resumed -------
  setDraft: (patch) =>
    set({ onboardingDraft: { ...get().onboardingDraft, ...patch }, lastSavedAt: Date.now() }),
  setStep: (n) => set({ onboardingStep: n, lastSavedAt: Date.now() }),

  // --- Worker 1 -> Worker 3: submit questionnaire, receive cubes ----------
  submitOnboarding: async (profile) => {
    set({ calculating: true, error: null, profile });
    try {
      const { budget, mainAccount } = await api.calculateBudget(profile);
      set({
        cubes: budget.cubes,
        summary: budget.summary,
        mainAccount,
        onboarded: true,
        calculating: false,
      });
    } catch (e: any) {
      set({ calculating: false, error: e?.message || 'Could not build your budget' });
    }
  },

  // --- Worker 2 -> Worker 3: run the simulated transfer -------------------
  transfer: async (amount) => {
    const { cubes } = get();
    set({ transferring: true, error: null });
    try {
      const res = await api.transfer(cubes, amount);
      set({
        cubes: res.cubes,
        mainAccount: res.mainAccount,
        alerts: res.alerts,
        transferring: false,
        lastTransfer: { allocations: res.allocations, at: Date.now() },
      });
    } catch (e: any) {
      set({ transferring: false, error: e?.message || 'Transfer failed' });
    }
  },

  // --- Worker 4 -> Worker 3: spend from a cube (after buddy confirms) -----
  spend: async (cubeKey, amount) => {
    const { cubes } = get();
    try {
      const res = await api.spend(cubes, cubeKey, amount);
      set({ cubes: res.cubes, alerts: res.alerts });
    } catch (e: any) {
      set({ error: e?.message || 'Spend failed' });
    }
  },

  // --- Worker 4: stream a buddy reply, updating chat live -----------------
  sendChat: async (text) => {
    const { chat, profile, cubes, mainAccount } = get();
    const userMsg: ChatMessage = { role: 'user', content: text };
    const withUser = [...chat, userMsg];
    // Optimistically add the user message + an empty assistant bubble to fill.
    set({ chat: [...withUser, { role: 'assistant', content: '' }], chatStreaming: true });

    await api.streamChat(
      withUser,
      { profile, cubes, mainAccount },
      {
        onDelta: (textChunk) => {
          const cur = get().chat;
          const last = cur[cur.length - 1];
          const updated = [...cur];
          updated[updated.length - 1] = { ...last, content: last.content + textChunk };
          set({ chat: updated });
        },
        onDone: (_full, alerts) => set({ chatStreaming: false, alerts }),
        onError: (msg) => {
          const cur = get().chat;
          const updated = [...cur];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: `⚠️ ${msg}`,
          };
          set({ chat: updated, chatStreaming: false, error: msg });
        },
      }
    );
  },

  clearTransferEvent: () => set({ lastTransfer: null }),

  reset: () =>
    set({
      profile: null,
      cubes: [],
      mainAccount: 0,
      summary: null,
      alerts: [],
      chat: [],
      onboardingDraft: EMPTY_DRAFT,
      onboardingStep: 0,
      lastSavedAt: null,
      onboarded: false,
      error: null,
      lastTransfer: null,
    }),
    }),
    {
      name: 'cubefinance:v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Persist only durable data — never the transient flags, functions or
      // the one-shot transfer animation signal.
      partialize: (s) => ({
        profile: s.profile,
        cubes: s.cubes,
        mainAccount: s.mainAccount,
        summary: s.summary,
        alerts: s.alerts,
        chat: s.chat,
        onboarded: s.onboarded,
        onboardingDraft: s.onboardingDraft,
        onboardingStep: s.onboardingStep,
        lastSavedAt: s.lastSavedAt,
      }),
      // Fires after the persisted state is read back from AsyncStorage.
      onRehydrateStorage: () => (restored, error) => {
        if (error) console.warn('[store] rehydrate failed', error);
        useStore.setState({ hydrated: true, chatStreaming: false });
      },
    }
  )
);

// --- Derived selectors (shared by dashboard, chatbot header, alerts) -------
export const selectTotalBalance = (s: AppState) =>
  s.cubes.reduce((sum, c) => sum + (c.balance || 0), 0);

export const selectHasAlerts = (s: AppState) => s.alerts.length > 0;
