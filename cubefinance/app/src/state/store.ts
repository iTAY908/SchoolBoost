// ============================================================================
// Worker 5 — State Management & Integration Coordinator
// store.ts — the single source of truth. Zustand keeps this tiny and reactive:
// every screen subscribes with a selector, so when the CHATBOT mutates a cube,
// the DASHBOARD re-renders automatically. No prop drilling, no event bus.
// ============================================================================

import { create } from 'zustand';
import { api } from '../api/client';
import { Cube, Profile, Alert, ChatMessage } from './types';

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

  // --- status flags ---
  onboarded: boolean;
  calculating: boolean;
  transferring: boolean;
  chatStreaming: boolean;
  error: string | null;

  // signals the dashboard's transfer animation to play
  lastTransfer: TransferEvent | null;

  // --- actions ---
  submitOnboarding: (profile: Profile) => Promise<void>;
  transfer: (amount: number) => Promise<void>;
  spend: (cubeKey: string, amount: number) => Promise<void>;
  sendChat: (text: string) => Promise<void>;
  clearTransferEvent: () => void;
  reset: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  profile: null,
  cubes: [],
  mainAccount: 0,
  summary: null,
  alerts: [],
  chat: [],

  onboarded: false,
  calculating: false,
  transferring: false,
  chatStreaming: false,
  error: null,
  lastTransfer: null,

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
      onboarded: false,
      error: null,
      lastTransfer: null,
    }),
}));

// --- Derived selectors (shared by dashboard, chatbot header, alerts) -------
export const selectTotalBalance = (s: AppState) =>
  s.cubes.reduce((sum, c) => sum + (c.balance || 0), 0);

export const selectHasAlerts = (s: AppState) => s.alerts.length > 0;
