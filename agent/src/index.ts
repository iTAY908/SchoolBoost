import { respondTo } from "./agent.js";
import type { Env } from "./env.js";
import { alreadyHandled, resetConversation } from "./store.js";
import {
  extractMessages,
  messageText,
  sendText,
  verifySignature,
  type InboundMessage,
} from "./whatsapp.js";

async function handleMessage(env: Env, message: InboundMessage): Promise<void> {
  const contact = message.from;
  const text = messageText(message);

  if (!text) {
    await sendText(env, contact, "אני קורא רק הודעות טקסט כרגע. אפשר לכתוב לי מה צריך?");
    return;
  }

  if (text === "/reset" || text === "איפוס") {
    await resetConversation(env, contact);
    await sendText(env, contact, "השיחה אופסה. מתחילים מחדש.");
    return;
  }

  const reply = await respondTo(env, contact, text);
  await sendText(env, contact, reply);
}

async function processWebhook(env: Env, payload: unknown): Promise<void> {
  for (const message of extractMessages(payload)) {
    if (await alreadyHandled(env, message.id)) continue;

    try {
      await handleMessage(env, message);
    } catch (error) {
      console.error(`[message ${message.id}]`, error);
      try {
        await sendText(env, message.from, "משהו השתבש אצלי בצד. אפשר לנסות שוב עוד רגע?");
      } catch (sendError) {
        console.error(`[notify-failure ${message.id}]`, sendError);
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        status: "ok",
        model: env.ANTHROPIC_MODEL || "claude-haiku-4-5",
        phone_number_id: env.WHATSAPP_PHONE_NUMBER_ID,
      });
    }

    if (url.pathname !== "/webhook") {
      return new Response("Not found", { status: 404 });
    }

    // Meta's one-time webhook verification handshake.
    if (request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN && challenge) {
        return new Response(challenge, { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const rawBody = await request.text();
    const valid = await verifySignature(
      env.WHATSAPP_APP_SECRET,
      request.headers.get("x-hub-signature-256"),
      rawBody,
    );
    if (!valid) {
      return new Response("Invalid signature", { status: 401 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    // Ack first: Meta retries anything it considers slow, and a model call plus
    // an outbound send takes far longer than its timeout allows. waitUntil
    // keeps the Worker alive to finish the work after the response goes out.
    ctx.waitUntil(processWebhook(env, payload));
    return new Response("OK", { status: 200 });
  },
} satisfies ExportedHandler<Env>;
