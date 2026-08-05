import Anthropic from "@anthropic-ai/sdk";
import { type Env, model } from "./env.js";
import { getHistory, saveHistory } from "./store.js";

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
 * WhatsApp caps a message at 4096 characters and the system prompt asks for
 * short replies, so a larger budget would only fund output the channel drops.
 * Longer answers are still split by sendText().
 */
const MAX_TOKENS = 2048;

export async function respondTo(env: Env, contact: string, userMessage: string): Promise<string> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const history = await getHistory(env, contact);

  const response = await client.messages.create({
    model: model(env),
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // The prompt is identical on every request, so caching it turns the
        // largest fixed part of each call into a cache read.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [...history, { role: "user", content: userMessage }],
  });

  if (response.stop_reason === "refusal") {
    return "אני לא יכול לענות על ההודעה הזאת. נסה לנסח אותה אחרת או לשאול משהו אחר.";
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    return "לא הצלחתי לנסח תשובה. אפשר לנסות שוב?";
  }

  await saveHistory(env, contact, [
    ...history,
    { role: "user", content: userMessage },
    { role: "assistant", content: text },
  ]);

  return text;
}
