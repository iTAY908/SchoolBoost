// ============================================================================
// Worker 5 — State Management & Integration Coordinator  (API layer)
// client.ts — the single place the app talks to the backend. Every module goes
// through here so wiring stays consistent and mockable.
// ============================================================================

import { Cube, Profile, Alert, ChatMessage } from '../state/types';

const BASE_URL =
  (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_API_URL) ||
  'http://localhost:4000';

// Stable per-install id, set by the store after hydration so all API calls
// (and cross-device state sync) are scoped to this user.
let currentUserId = 'default';
export const setUserId = (id: string) => { currentUserId = id || 'default'; };
export const getUserId = () => currentUserId;

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUserId, ...(body as object) }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`${path} failed: ${msg}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  baseUrl: BASE_URL,

  /** Worker 5: pull the full saved snapshot for this user (cross-device sync). */
  async getState(): Promise<{ state: any | null; savedAt: number }> {
    const res = await fetch(
      `${BASE_URL}/api/state?userId=${encodeURIComponent(currentUserId)}`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (!res.ok) throw new Error('getState failed');
    return res.json();
  },

  /** Worker 5: push the full snapshot to the backend. */
  saveState(snapshot: unknown, savedAt: number) {
    return post<{ ok: boolean; savedAt: number }>('/api/state', { state: snapshot, savedAt });
  },

  /** Worker 3: turn the questionnaire into a budget. */
  calculateBudget(profile: Profile) {
    return post<{ budget: { cubes: Cube[]; summary: any }; mainAccount: number }>(
      '/api/budget/calculate',
      { profile }
    );
  },

  /** Worker 3: distribute main-account pool into cubes. */
  transfer(cubes: Cube[], amount: number, fundFixedFirst = true) {
    return post<{
      cubes: Cube[];
      allocations: { key: string; name: string; amount: number }[];
      moved: number;
      mainAccount: number;
      alerts: Alert[];
    }>('/api/budget/transfer', { cubes, amount, fundFixedFirst });
  },

  /** Worker 3: spend from one cube (used after the buddy confirms a purchase). */
  spend(cubes: Cube[], key: string, amount: number) {
    return post<{ cubes: Cube[]; overdrawn: boolean; alerts: Alert[] }>(
      '/api/budget/spend',
      { cubes, key, amount }
    );
  },

  /**
   * Worker 4: stream a chat reply via SSE. Calls handlers as chunks arrive.
   * Uses fetch streaming (works in Expo/Hermes with the fetch polyfill) and
   * degrades to the /sync endpoint if streaming isn't available.
   */
  async streamChat(
    messages: ChatMessage[],
    context: { profile: Profile | null; cubes: Cube[]; mainAccount: number },
    handlers: {
      onDelta: (text: string) => void;
      onDone: (full: string, alerts: Alert[]) => void;
      onError: (msg: string) => void;
    }
  ) {
    try {
      const res = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, messages, context }),
      });

      const reader = (res.body as any)?.getReader?.();
      if (!reader) {
        // Fallback: no streaming support -> single-shot sync call.
        const sync = await post<{ reply: string; alerts: Alert[] }>('/api/chat/sync', {
          messages,
          context,
        });
        handlers.onDelta(sync.reply);
        handlers.onDone(sync.reply, sync.alerts);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const evt of events) {
          const line = evt.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6));
          if (payload.type === 'delta') {
            full += payload.text;
            handlers.onDelta(payload.text);
          } else if (payload.type === 'done') {
            handlers.onDone(payload.full ?? full, payload.alerts ?? []);
          } else if (payload.type === 'error') {
            handlers.onError(payload.message);
          }
        }
      }
    } catch (e: any) {
      handlers.onError(e?.message || 'network error');
    }
  },
};
