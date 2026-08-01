import { config } from "./config.js";

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Conversation history per WhatsApp number, in memory. Good enough for a
 * single process; swap for Redis or Postgres before running more than one
 * instance, or history will differ between them.
 */
const conversations = new Map<string, Turn[]>();

export function getHistory(contact: string): Turn[] {
  return conversations.get(contact) ?? [];
}

export function appendTurn(contact: string, turn: Turn): void {
  const history = conversations.get(contact) ?? [];
  history.push(turn);

  // Drop whole turn pairs from the front so the first message stays a user one.
  const maxEntries = config.historyTurns * 2;
  if (history.length > maxEntries) {
    history.splice(0, history.length - maxEntries);
    while (history.length > 0 && history[0].role !== "user") {
      history.shift();
    }
  }

  conversations.set(contact, history);
}

export function resetConversation(contact: string): void {
  conversations.delete(contact);
}
