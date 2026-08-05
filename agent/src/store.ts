import { type Env, historyTurns } from "./env.js";

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

/** Conversations older than this are dropped rather than kept forever. */
const HISTORY_TTL_SECONDS = 60 * 60 * 24 * 30;
/** Long enough to cover Meta's webhook retry window. */
const SEEN_TTL_SECONDS = 60 * 60;

const historyKey = (contact: string) => `hist:${contact}`;
const seenKey = (messageId: string) => `seen:${messageId}`;

export async function getHistory(env: Env, contact: string): Promise<Turn[]> {
  const stored = await env.HISTORY.get(historyKey(contact), "json");
  return Array.isArray(stored) ? (stored as Turn[]) : [];
}

export async function saveHistory(env: Env, contact: string, history: Turn[]): Promise<void> {
  // Trim whole turn pairs from the front so the first entry stays a user one.
  const maxEntries = historyTurns(env) * 2;
  let trimmed = history.slice(-maxEntries);
  while (trimmed.length > 0 && trimmed[0].role !== "user") {
    trimmed = trimmed.slice(1);
  }

  await env.HISTORY.put(historyKey(contact), JSON.stringify(trimmed), {
    expirationTtl: HISTORY_TTL_SECONDS,
  });
}

export async function resetConversation(env: Env, contact: string): Promise<void> {
  await env.HISTORY.delete(historyKey(contact));
}

/**
 * Meta retries a webhook it considers failed, replaying the same message ID.
 * KV is eventually consistent, so a retry arriving within a second or two of
 * the original can still slip through — rare enough to accept, and the cost is
 * a duplicate answer rather than anything destructive.
 */
export async function alreadyHandled(env: Env, messageId: string): Promise<boolean> {
  const key = seenKey(messageId);
  if (await env.HISTORY.get(key)) return true;
  await env.HISTORY.put(key, "1", { expirationTtl: SEEN_TTL_SECONDS });
  return false;
}
