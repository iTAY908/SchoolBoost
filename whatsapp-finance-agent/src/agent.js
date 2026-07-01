import Anthropic from "@anthropic-ai/sdk";
import {
  addTransaction,
  getTransactions,
  deleteTransaction,
  setBudget,
  getBudgets,
} from "./sheets.js";

const client = new Anthropic();

const MODEL = "claude-opus-4-8";
const MAX_TOOL_ITERATIONS = 10;
const MAX_HISTORY_MESSAGES = 40;

const SYSTEM_PROMPT = `אתה "כספי" - סוכן AI פיננסי אישי שפועל בוואטסאפ ומחובר ל-Google Sheets של המשתמש.

התפקיד שלך:
- לרשום הוצאות והכנסות שהמשתמש מדווח לך (למשל "קניתי קפה ב-18 שקל" או "קיבלתי משכורת 12000")
- לענות על שאלות על המצב הפיננסי: כמה הוצאתי החודש, על מה, מה המאזן, השוואות בין תקופות
- לנהל תקציבים לפי קטגוריות ולהתריע כשמתקרבים לחריגה
- לתת תובנות וטיפים פיננסיים מבוססים על הנתונים האמיתיים

כללים:
- ענה תמיד בעברית (אלא אם המשתמש כותב בשפה אחרת)
- תשובות קצרות וברורות - זה וואטסאפ, לא מייל. השתמש באימוג'ים במידה
- כשהמשתמש מדווח על הוצאה/הכנסה, שייך אותה לקטגוריה הגיונית (אוכל, תחבורה, קניות, בילויים, חשבונות, בריאות, משכורת, וכו')
- אם חסר מידע קריטי (למשל סכום), שאל. אם חסר מידע משני (תיאור מדויק), הנח הנחה סבירה ורשום
- המטבע ברירת המחדל הוא שקל (₪)
- לפני מחיקת תנועה, ודא עם המשתמש שזו התנועה הנכונה
- כשנותנים סיכום, הצג מספרים מעוגלים וברורים
- התאריך של היום: ${new Date().toISOString().slice(0, 10)}`;

const TOOLS = [
  {
    name: "add_transaction",
    description:
      "רושם הוצאה או הכנסה חדשה בגיליון Google Sheets של המשתמש. השתמש בזה בכל פעם שהמשתמש מדווח על הוצאה או הכנסה.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["expense", "income"],
          description: "expense = הוצאה, income = הכנסה",
        },
        amount: { type: "number", description: "הסכום בשקלים (מספר חיובי)" },
        category: {
          type: "string",
          description:
            "קטגוריה בעברית, למשל: אוכל, תחבורה, קניות, בילויים, חשבונות, בריאות, דיור, משכורת, אחר",
        },
        description: { type: "string", description: "תיאור קצר של התנועה" },
        date: {
          type: "string",
          description: "תאריך בפורמט YYYY-MM-DD. השאר ריק עבור היום",
        },
      },
      required: ["type", "amount", "category"],
    },
  },
  {
    name: "list_transactions",
    description:
      "מחזיר את רשימת התנועות (הוצאות והכנסות) של המשתמש מהגיליון. השתמש בזה כדי לענות על שאלות על הוצאות, הכנסות, סיכומים ומאזנים. הרשימה חוזרת מלאה - סנן וחשב בעצמך לפי מה שהמשתמש שאל.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "delete_transaction",
    description:
      "מוחק תנועה מהגיליון לפי המזהה שלה (ID). מצא קודם את המזהה עם list_transactions וודא עם המשתמש לפני מחיקה.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "המזהה של התנועה למחיקה" },
      },
      required: ["id"],
    },
  },
  {
    name: "set_budget",
    description: "קובע או מעדכן תקציב חודשי לקטגוריה מסוימת.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "שם הקטגוריה בעברית" },
        monthly_limit: {
          type: "number",
          description: "התקציב החודשי בשקלים",
        },
      },
      required: ["category", "monthly_limit"],
    },
  },
  {
    name: "get_budgets",
    description:
      "מחזיר את כל התקציבים החודשיים שהוגדרו. השתמש יחד עם list_transactions כדי לבדוק כמה נשאר מהתקציב.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
];

async function executeTool(name, input, user) {
  switch (name) {
    case "add_transaction":
      return await addTransaction({ ...input, user });
    case "list_transactions":
      return await getTransactions(user);
    case "delete_transaction": {
      const deleted = await deleteTransaction(input.id, user);
      return deleted
        ? { success: true }
        : { success: false, error: "לא נמצאה תנועה עם המזהה הזה" };
    }
    case "set_budget":
      return await setBudget(input.category, input.monthly_limit);
    case "get_budgets":
      return await getBudgets();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// היסטוריית שיחה לכל משתמש (בזיכרון - מתאפסת בהפעלה מחדש של השרת)
const conversations = new Map();

/**
 * מקבל הודעת וואטסאפ ממשתמש ומחזיר את תשובת הסוכן.
 * @param {string} user - מספר הוואטסאפ של השולח
 * @param {string} text - תוכן ההודעה
 */
export async function handleMessage(user, text) {
  const history = conversations.get(user) || [];
  const messages = [...history, { role: "user", content: text }];

  let response;
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason !== "tool_use") break;

    messages.push({ role: "assistant", content: response.content });

    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      try {
        const result = await executeTool(block.name, block.input, user);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `שגיאה: ${err.message}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  const reply = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  // בהיסטוריה ארוכת-טווח שומרים רק טקסט נקי (בלי בלוקים של כלים),
  // כדי שחיתוך ההיסטוריה לא ישבור זוגות tool_use/tool_result
  const newHistory = [
    ...history,
    { role: "user", content: text },
    { role: "assistant", content: reply || "(בוצע)" },
  ];
  conversations.set(user, newHistory.slice(-MAX_HISTORY_MESSAGES));

  return reply || "🤔 לא הצלחתי לנסח תשובה, נסה שוב.";
}
