// ============================================================================
// Worker 5 — State Management & Integration Coordinator
// store.ts — the single source of truth. Zustand keeps this tiny and reactive:
// every screen subscribes with a selector, so when the CHATBOT mutates a cube,
// the DASHBOARD re-renders automatically. No prop drilling, no event bus.
// ============================================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setUserId, getUserId } from '../api/client';
import { Cube, Profile, Alert, ChatMessage, OnboardingDraft, EMPTY_DRAFT } from './types';
import { buildCustomCube } from '../logic/customCube';
import * as auth from '../services/authService';
import { AuthUser } from '../services/authService';

// Data fields wiped on logout / account switch (identity + flags preserved).
const BLANK_DATA = {
  profile: null,
  cubes: [] as Cube[],
  mainAccount: 0,
  summary: null,
  alerts: [] as Alert[],
  chat: [] as ChatMessage[],
  onboardingDraft: EMPTY_DRAFT,
  onboardingStep: 0,
  lastSavedAt: null as number | null,
  onboarded: false,
  error: null as string | null,
  lastTransfer: null as any,
};

// Persisted state is namespaced per account: the storage key becomes
// `cubefinance:v1:<userId>`, so multiple users on one device stay separate.
const perUserStorage = {
  getItem: (name: string) => AsyncStorage.getItem(`${name}:${getUserId()}`),
  setItem: (name: string, value: string) => AsyncStorage.setItem(`${name}:${getUserId()}`, value),
  removeItem: (name: string) => AsyncStorage.removeItem(`${name}:${getUserId()}`),
};

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

  // --- identity + cross-device sync ---
  userId: string | null;
  cloud: 'local' | 'syncing' | 'synced' | 'offline';

  // --- auth ---
  authUser: AuthUser | null;
  authChecked: boolean; // true once we've checked for an existing session

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
  syncFromCloud: () => Promise<void>;
  submitOnboarding: (profile: Profile) => Promise<void>;
  transfer: (amount: number) => Promise<void>;
  spend: (cubeKey: string, amount: number) => Promise<void>;
  sendChat: (text: string) => Promise<void>;
  addCustomCube: (name: string, amount: number, meta?: { priority?: number; explanation?: string }) => void;
  clearTransferEvent: () => void;
  // auth actions
  checkSession: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<string | null>; // returns error msg or null
  logIn: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  reset: () => void;
}

// Load a signed-in account's namespaced state and enter the app.
async function enterAccount(user: AuthUser) {
  setUserId(user.id);
  useStore.setState({ ...BLANK_DATA });
  await (useStore.persist as any).rehydrate(); // reload this account's saved state
  useStore.setState({ authUser: user, authChecked: true });
  useStore.getState().syncFromCloud();
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

  userId: null,
  cloud: 'local',

  authUser: null,
  authChecked: false,

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

  // --- Auth ---------------------------------------------------------------
  checkSession: async () => {
    try {
      const user = await auth.getSessionUser();
      if (user) { await enterAccount(user); return; }
    } catch (_) {}
    set({ authChecked: true });
  },
  signUp: async (email, password) => {
    const res = await auth.signUp(email, password);
    if (res.error || !res.user) return res.error || 'שגיאה בהרשמה';
    await enterAccount(res.user); // auto-login -> onboarding
    return null;
  },
  logIn: async (email, password) => {
    const res = await auth.logIn(email, password);
    if (res.error || !res.user) return res.error || 'שגיאה בהתחברות';
    await enterAccount(res.user); // -> dashboard if onboarded, else questionnaire
    return null;
  },
  logout: async () => {
    await auth.clearSession();
    setUserId('anon');
    set({ ...BLANK_DATA, authUser: null });
  },

  // --- Custom cube: add a persisted personal-goal cube --------------------
  addCustomCube: (name, amount, meta = {}) => {
    const { cubes, profile } = get();
    const income = profile?.monthlyIncome || 0;
    const { cubes: next } = buildCustomCube(name, amount, income, cubes, meta);
    set({ cubes: next, lastSavedAt: Date.now() });
  },

  // --- Worker 5: reconcile local state with the backend (last write wins) --
  syncFromCloud: async () => {
    set({ cloud: 'syncing' });
    try {
      const { state: remote, savedAt } = await api.getState();
      const localAt = get().lastSavedAt || 0;
      if (remote && (savedAt || 0) > localAt) {
        set({
          profile: remote.profile ?? null,
          cubes: remote.cubes ?? [],
          mainAccount: remote.mainAccount ?? 0,
          summary: remote.summary ?? null,
          alerts: remote.alerts ?? [],
          chat: remote.chat ?? [],
          onboarded: !!remote.onboarded,
          onboardingDraft: remote.onboardingDraft ?? EMPTY_DRAFT,
          onboardingStep: remote.onboardingStep ?? 0,
          lastSavedAt: savedAt,
          cloud: 'synced',
        });
      } else {
        set({ cloud: 'synced' });
        if (localAt > (savedAt || 0)) schedulePush(); // local is newer — upload
      }
    } catch (_) {
      set({ cloud: 'local' });
    }
  },

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
        lastSavedAt: Date.now(),
      });
      // Remember, per account, that onboarding is done (drives login routing).
      const u = get().authUser;
      if (u) auth.markOnboarded(u.email).catch(() => {});
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
      storage: createJSONStorage(() => perUserStorage),
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
        userId: s.userId,
      }),
      // Fires after the persisted state is read back from AsyncStorage.
      // userId + backend sync are driven by the auth layer (enterAccount), so we
      // only flip the hydration flag here.
      onRehydrateStorage: () => (_restored, error) => {
        if (error) console.warn('[store] rehydrate failed', error);
        useStore.setState({ hydrated: true, chatStreaming: false });
      },
    }
  )
);

// --- Cross-device push: debounced upload whenever durable data changes -------
let pushTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const s = useStore.getState();
    if (!s.hydrated) return;
    const at = Date.now();
    useStore.setState({ lastSavedAt: at, cloud: 'syncing' });
    const snap = {
      profile: s.profile,
      cubes: s.cubes,
      mainAccount: s.mainAccount,
      summary: s.summary,
      alerts: s.alerts,
      chat: s.chat,
      onboarded: s.onboarded,
      onboardingDraft: s.onboardingDraft,
      onboardingStep: s.onboardingStep,
    };
    try {
      await api.saveState(snap, at);
      useStore.setState({ cloud: 'synced' });
    } catch (_) {
      useStore.setState({ cloud: 'local' });
    }
  }, 700);
}

// Watch only durable content refs (never the sync/status fields) to avoid loops.
useStore.subscribe((s, prev) => {
  if (!s.hydrated) return;
  if (
    s.cubes !== prev.cubes ||
    s.chat !== prev.chat ||
    s.onboarded !== prev.onboarded ||
    s.mainAccount !== prev.mainAccount ||
    s.profile !== prev.profile ||
    s.summary !== prev.summary ||
    s.onboardingStep !== prev.onboardingStep ||
    s.onboardingDraft !== prev.onboardingDraft
  ) {
    schedulePush();
  }
});

// --- Derived selectors (shared by dashboard, chatbot header, alerts) -------
export const selectTotalBalance = (s: AppState) =>
  s.cubes.reduce((sum, c) => sum + (c.balance || 0), 0);

export const selectHasAlerts = (s: AppState) => s.alerts.length > 0;
