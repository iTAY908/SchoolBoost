import { type Env, graphApiVersion } from "./env.js";

/** WhatsApp caps a single text message at 4096 characters. */
const TEXT_LIMIT = 4096;

/**
 * Split on paragraph, then line, then word boundaries so a long answer arrives
 * as several readable messages instead of being truncated.
 */
export function splitForWhatsApp(text: string, limit = TEXT_LIMIT): string[] {
  if (text.length <= limit) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);
    let cut = window.lastIndexOf("\n\n");
    if (cut < limit / 2) cut = window.lastIndexOf("\n");
    if (cut < limit / 2) cut = window.lastIndexOf(" ");
    if (cut < limit / 2) cut = limit;

    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

/**
 * Free-form text. Meta only delivers this inside the 24-hour window that opens
 * when the contact messages the business; outside it, only approved templates
 * go through.
 */
export async function sendText(env: Env, to: string, text: string): Promise<void> {
  const url = `https://graph.facebook.com/${graphApiVersion(env)}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  for (const chunk of splitForWhatsApp(text)) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: chunk },
      }),
    });

    if (!response.ok) {
      throw new Error(`WhatsApp send failed (${response.status}): ${await response.text()}`);
    }
  }
}

/**
 * Meta signs every inbound webhook with the app secret. Without this check the
 * endpoint would answer anyone who finds the URL.
 */
export async function verifySignature(
  appSecret: string,
  header: string | null,
  rawBody: string,
): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(signed)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const received = header.slice("sha256=".length);
  if (received.length !== expected.length) return false;

  // Constant-time compare — a length-only check plus early return would leak
  // the signature one byte at a time.
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  }
  return mismatch === 0;
}

export interface InboundMessage {
  from: string;
  id: string;
  type: string;
  text?: { body?: string };
  image?: { caption?: string };
  document?: { caption?: string };
}

interface WebhookPayload {
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        messages?: InboundMessage[];
        statuses?: unknown[];
      };
    }>;
  }>;
}

/**
 * Pull user messages out of the webhook envelope. Delivery-status callbacks
 * arrive on the same endpoint under `statuses` and are ignored.
 */
export function extractMessages(payload: unknown): InboundMessage[] {
  const typed = payload as WebhookPayload;
  const messages: InboundMessage[] = [];

  for (const entry of typed.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        messages.push(message);
      }
    }
  }

  return messages;
}

export function messageText(message: InboundMessage): string | null {
  const text = message.text?.body ?? message.image?.caption ?? message.document?.caption;
  return text?.trim() || null;
}
