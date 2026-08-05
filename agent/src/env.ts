/// <reference types="@cloudflare/workers-types" />

/**
 * Bindings Cloudflare passes into the Worker. Secrets are set with
 * `wrangler secret put <NAME>`; plain values live in wrangler.toml [vars].
 */
export interface Env {
  /** Permanent access token from the Meta app. Secret. */
  WHATSAPP_TOKEN: string;
  /** Phone number ID from WhatsApp > API Setup. Not the phone number itself. */
  WHATSAPP_PHONE_NUMBER_ID: string;
  /** String you invent; Meta echoes it back when verifying the webhook. Secret. */
  WHATSAPP_VERIFY_TOKEN: string;
  /** App Secret from Meta > App Settings > Basic. Signs inbound requests. Secret. */
  WHATSAPP_APP_SECRET: string;
  /** Graph API version, e.g. v21.0. Meta retires versions ~2 years after release. */
  GRAPH_API_VERSION?: string;

  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL?: string;

  /** Conversation history and message-ID dedupe. */
  HISTORY: KVNamespace;
  /** Turns kept per contact. */
  HISTORY_TURNS?: string;
}

export function graphApiVersion(env: Env): string {
  return env.GRAPH_API_VERSION || "v21.0";
}

export function model(env: Env): string {
  return env.ANTHROPIC_MODEL || "claude-haiku-4-5";
}

export function historyTurns(env: Env): number {
  const parsed = Number(env.HISTORY_TURNS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}
