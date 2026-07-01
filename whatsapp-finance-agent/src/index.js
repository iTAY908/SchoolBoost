import "dotenv/config";
import express from "express";
import { handleMessage } from "./agent.js";
import { sendWhatsAppMessage, markAsRead } from "./whatsapp.js";
import { ensureSheetsExist } from "./sheets.js";

const app = express();
app.use(express.json());

// מניעת עיבוד כפול של אותה הודעה (Meta שולחת לפעמים webhook פעמיים)
const processedMessages = new Set();

// בדיקת חיים
app.get("/", (req, res) => {
  res.send("🤖 סוכן הכספים בוואטסאפ פועל!");
});

// אימות ה-Webhook מול Meta (קורה פעם אחת בהגדרה)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// קבלת הודעות נכנסות מוואטסאפ
app.post("/webhook", (req, res) => {
  // עונים ל-Meta מיד כדי לא לקבל retries; העיבוד ממשיך ברקע
  res.sendStatus(200);

  const value = req.body?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message || message.type !== "text") return;

  if (processedMessages.has(message.id)) return;
  processedMessages.add(message.id);
  if (processedMessages.size > 1000) {
    // ניקוי כדי שהסט לא יגדל בלי סוף
    const first = processedMessages.values().next().value;
    processedMessages.delete(first);
  }

  const from = message.from;
  const text = message.text.body;
  console.log(`📩 ${from}: ${text}`);

  markAsRead(message.id);

  handleMessage(from, text)
    .then((reply) => {
      console.log(`🤖 ${from}: ${reply}`);
      return sendWhatsAppMessage(from, reply);
    })
    .catch(async (err) => {
      console.error("Error handling message:", err);
      try {
        await sendWhatsAppMessage(
          from,
          "😅 משהו השתבש אצלי, נסה לשלוח שוב בעוד רגע."
        );
      } catch (sendErr) {
        console.error("Failed to send error message:", sendErr);
      }
    });
});

const PORT = process.env.PORT || 3000;

ensureSheetsExist()
  .then(() => {
    console.log("✅ Google Sheets מוכן");
    app.listen(PORT, () => {
      console.log(`🚀 הסוכן מאזין על פורט ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ שגיאה בהתחברות ל-Google Sheets:", err.message);
    process.exit(1);
  });
