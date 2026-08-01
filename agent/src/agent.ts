import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { getHistory, appendTurn } from "./store.js";

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

const SYSTEM_PROMPT = `אתה הסוכן של SchoolBoost, עונה לאנשים בוואטסאפ. השפה הראשית היא עברית — ענה בעברית אלא אם פנו אליך בשפה אחרת, ואז ענה באותה שפה.

הערוץ הוא וואטסאפ, לא צ'אט בדפדפן. זה מכתיב את הסגנון:
- תשובות קצרות. שתיים-שלוש פסקאות לכל היותר, ולרוב הרבה פחות.
- בלי כותרות markdown, בלי טבלאות ובלי בלוקים של קוד. וואטסאפ לא מרנדר אותם.
- הדגשה עם *כוכביות* בלבד, ובמשורה.
- רשימות רק כשהן באמת עוזרות, ואז שורות קצרות עם מקף.
- הובל עם התשובה עצמה. בלי הקדמות כמו "שאלה מצוינת" או "בוא נראה".

אם שאלה לא ברורה מספיק כדי לענות עליה, שאל שאלת הבהרה אחת קצרה במקום לנחש.
אם אינך יודע משהו, אמור זאת ישירות. אל תמציא עובדות, מספרים או מקורות.
אין לך גישה לקבצים, למיילים או לאינטרנט — אתה עונה מתוך ידע וההקשר של השיחה בלבד.`;

/**
 * WhatsApp caps a message at 4096 characters, and the system prompt asks for
 * short replies — a large output budget here would only fund verbosity the
 * channel can't display well. Longer answers are still split by sendText().
 */
const MAX_TOKENS = 4096;

export interface AgentReply {
  text: string;
  refused: boolean;
}

export async function respondTo(contact: string, userMessage: string): Promise<AgentReply> {
  const history = getHistory(contact);

  const params = {
    model: config.anthropic.model,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    thinking: { type: "adaptive" },
    messages: [...history, { role: "user", content: userMessage }],
    // Opus 5's safety classifiers can decline a request outright. "default"
    // lets the API re-serve it on Anthropic's recommended fallback model
    // instead of handing us an empty response.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  };

  const response = await client.beta.messages.create(
    params as unknown as Parameters<typeof client.beta.messages.create>[0],
  );

  if ("stop_reason" in response && response.stop_reason === "refusal") {
    return {
      text: "אני לא יכול לענות על ההודעה הזאת. נסה לנסח אותה אחרת או לשאול משהו אחר.",
      refused: true,
    };
  }

  const text = ("content" in response ? response.content : [])
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    return { text: "לא הצלחתי לנסח תשובה. אפשר לנסות שוב?", refused: false };
  }

  appendTurn(contact, { role: "user", content: userMessage });
  appendTurn(contact, { role: "assistant", content: text });

  return { text, refused: false };
}
