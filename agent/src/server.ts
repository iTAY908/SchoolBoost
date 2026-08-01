import express from "express";
import { config } from "./config.js";
import { respondTo } from "./agent.js";
import { resetConversation } from "./store.js";
import { sendText, type InboundPayload, type InboundResult } from "./infobip.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

/**
 * Infobip retries a webhook it considers failed, and a retry replays the same
 * messageId. Without this the agent answers the same question twice.
 */
const handledMessageIds = new Set<string>();
const HANDLED_ID_LIMIT = 5000;

function alreadyHandled(messageId: string): boolean {
  if (handledMessageIds.has(messageId)) return true;
  handledMessageIds.add(messageId);
  if (handledMessageIds.size > HANDLED_ID_LIMIT) {
    const oldest = handledMessageIds.values().next().value;
    if (oldest) handledMessageIds.delete(oldest);
  }
  return false;
}

function extractText(result: InboundResult): string | null {
  const message = result.message;
  if (!message) return null;
  const text = message.text ?? message.caption;
  return text?.trim() || null;
}

async function handleInbound(result: InboundResult): Promise<void> {
  const contact = result.from;
  const text = extractText(result);

  if (!text) {
    await sendText(
      contact,
      "אני קורא רק הודעות טקסט כרגע. אפשר לכתוב לי מה צריך?",
    );
    return;
  }

  if (text === "/reset" || text === "איפוס") {
    resetConversation(contact);
    await sendText(contact, "השיחה אופסה. מתחילים מחדש.");
    return;
  }

  const reply = await respondTo(contact, text);
  await sendText(contact, reply.text);
}

app.post("/webhook/whatsapp", (req, res) => {
  if (req.query.token !== config.server.webhookToken) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const payload = req.body as InboundPayload;
  const results = payload.results ?? [];

  // Ack first: Infobip treats a slow response as a failure and retries, and a
  // model call takes far longer than its timeout allows.
  res.status(200).json({ received: results.length });

  for (const result of results) {
    if (alreadyHandled(result.messageId)) continue;

    handleInbound(result).catch(async (error: unknown) => {
      console.error(`[inbound ${result.messageId}]`, error);
      try {
        await sendText(
          result.from,
          "משהו השתבש אצלי בצד. אפשר לנסות שוב עוד רגע?",
        );
      } catch (sendError) {
        console.error(`[notify-failure ${result.messageId}]`, sendError);
      }
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", sender: config.infobip.sender, model: config.anthropic.model });
});

app.listen(config.server.port, () => {
  console.log(`Listening on :${config.server.port}`);
  console.log(`Webhook path: /webhook/whatsapp?token=<WEBHOOK_TOKEN>`);
  console.log(`Chat link:    https://wa.me/${config.infobip.sender}`);
});
