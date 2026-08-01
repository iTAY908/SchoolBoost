import { randomUUID } from "node:crypto";
import { config } from "./config.js";

/** WhatsApp caps a single text message at 4096 characters. */
const WHATSAPP_TEXT_LIMIT = 4096;

async function post(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(`https://${config.infobip.baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `App ${config.infobip.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Infobip ${path} returned ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

/**
 * Split on paragraph, then line, then hard character boundaries so a long
 * answer arrives as several readable messages instead of being truncated.
 */
export function splitForWhatsApp(text: string, limit = WHATSAPP_TEXT_LIMIT): string[] {
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
 * Free-form text. Only deliverable inside the 24-hour window that opens when
 * the contact messages the business; outside it, Meta requires a template.
 */
export async function sendText(to: string, text: string): Promise<void> {
  for (const chunk of splitForWhatsApp(text)) {
    await post("/whatsapp/1/message/text", {
      messages: [
        {
          from: config.infobip.sender,
          to,
          messageId: randomUUID(),
          content: { text: chunk },
        },
      ],
    });
  }
}

/**
 * Pre-approved template — the only way to initiate a conversation outside the
 * 24-hour window. `placeholders` fill the template body in order.
 */
export async function sendTemplate(
  to: string,
  placeholders: string[] = [],
  templateName = config.infobip.templateName,
): Promise<void> {
  await post("/whatsapp/1/message/template", {
    messages: [
      {
        from: config.infobip.sender,
        to,
        messageId: randomUUID(),
        content: {
          templateName,
          templateData: { body: { placeholders } },
          language: config.infobip.templateLanguage,
        },
      },
    ],
  });
}

/** Shape of the inbound payload Infobip POSTs to the webhook URL. */
export interface InboundResult {
  from: string;
  to: string;
  messageId: string;
  receivedAt?: string;
  contact?: { name?: string };
  message?: {
    type?: string;
    text?: string;
    caption?: string;
    url?: string;
  };
}

export interface InboundPayload {
  results?: InboundResult[];
  messageCount?: number;
}
