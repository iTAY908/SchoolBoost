import Anthropic from '@anthropic-ai/sdk';
import { log } from '../config.js';
import { now, todayKey, DAY_NAMES, weekdayOf } from '../time.js';
import { TOOL_DEFS, makeExecutors } from './tools.js';

const MAX_ITERATIONS = 12;
const HISTORY_TURNS = 24;

// כלים מובנים של Anthropic ליצירת קבצים. נטענים רק אם הם באמת זמינים לחשבון.
const DOC_SKILL_HINTS = ['pptx', 'xlsx', 'docx', 'pdf'];

export class Agent {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey
   * @param {string} opts.model
   * @param {'low'|'medium'|'high'|'xhigh'|'max'} opts.effort
   * @param {string} opts.tz
   * @param {{url:string,name:string,token?:string}|null} opts.mcp - שרת MCP לחיבור לג'ימייל/יומן/זום וכו'
   * @param {boolean} opts.files - לאפשר יצירת מצגות/אקסל/וורד/PDF
   * @param {object} [opts.client] - הזרקת לקוח לצורך בדיקות
   */
  constructor(opts) {
    this.model = opts.model;
    this.effort = opts.effort;
    this.tz = opts.tz;
    this.mcp = opts.mcp || null;
    this.wantFiles = opts.files !== false;
    this.client = opts.client || new Anthropic({ apiKey: opts.apiKey });
    this.skills = [];
    this.histories = new Map();
  }

  /** מגלה אילו סקילים ליצירת מסמכים זמינים לחשבון. נכשל בשקט. */
  async discoverSkills() {
    if (!this.wantFiles) return [];
    try {
      const found = [];
      for await (const skill of this.client.beta.skills.list({ betas: ['skills-2025-10-02'] })) {
        const id = String(skill.id || skill.skill_id || '').toLowerCase();
        if (DOC_SKILL_HINTS.some((hint) => id === hint || id.endsWith(`/${hint}`))) {
          found.push({ skill_id: skill.id || skill.skill_id, type: skill.type || 'anthropic', version: 'latest' });
        }
      }
      this.skills = found;
      log.info(found.length
        ? `סקילים ליצירת קבצים: ${found.map((s) => s.skill_id).join(', ')}`
        : 'לא נמצאו סקילים ליצירת קבצים בחשבון');
    } catch (err) {
      log.warn('טעינת רשימת הסקילים נכשלה, ממשיכים בלי יצירת קבצים:', err.message);
      this.skills = [];
    }
    return this.skills;
  }

  history(chatId) {
    const key = String(chatId);
    if (!this.histories.has(key)) this.histories.set(key, []);
    return this.histories.get(key);
  }

  resetHistory(chatId) {
    this.histories.delete(String(chatId));
  }

  systemPrompt({ chat, userName }) {
    const t = now(this.tz);
    const today = todayKey(this.tz);
    const clock = `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

    return [
      'אתה SchoolBoost — עוזר לימודים אישי שרץ בתוך בוט טלגרם, ומדבר עברית.',
      '',
      `היום ${DAY_NAMES[weekdayOf(today)]}, ${today}, השעה ${clock} (${this.tz}).`,
      userName ? `שם המשתמש: ${userName}.` : '',
      '',
      'כללי עבודה:',
      '- ענה קצר וישיר. זו שיחת טלגרם בטלפון, לא מסמך.',
      '- טקסט רגיל בלבד. בלי Markdown ובלי תגיות HTML. אימוג׳י בודד פה ושם זה בסדר.',
      '- כשמבקשים ממך לזכור משהו (מטלה, מבחן, ציון, תזכורת) — השתמש בכלי המתאים, אל תסתפק באישור בדברים.',
      '- לפני שאתה עונה על "מה יש לי", קרא את הנתונים בכלים במקום לנחש.',
      '- תאריכים לכלים תמיד בפורמט YYYY-MM-DD. חשב "מחר" ו"יום שלישי" בעצמך לפי התאריך שלמעלה.',
      '- אם חסר לך פרט קריטי, שאל שאלה אחת קצרה במקום להמציא.',
      this.mcp ? '- לחשבונות המחוברים (מייל, יומן וכו׳) יש כלים נפרדים. לפני פעולה ששולחת או משנה משהו החוצה — אשר עם המשתמש קודם.' : '',
      this.skills.length ? '- ליצירת מצגת, גיליון או מסמך: כתוב קוד פייתון בכלי הרצת הקוד ששומר את הקובץ. הקובץ יישלח למשתמש אוטומטית.' : '',
      '',
      `במעקב כרגע: ${chat.homework.filter((h) => !h.done).length} מטלות פתוחות, ${chat.exams.length} מבחנים.`,
    ].filter(Boolean).join('\n');
  }

  buildTools() {
    const tools = [...TOOL_DEFS];
    if (this.skills.length) {
      tools.push({ type: 'code_execution_20260521', name: 'code_execution' });
    }
    if (this.mcp) {
      tools.push({ type: 'mcp_toolset', mcp_server_name: this.mcp.name });
    }
    return tools;
  }

  buildBetas() {
    const betas = [];
    if (this.skills.length) betas.push('code-execution-2025-08-25', 'skills-2025-10-02');
    if (this.mcp) betas.push('mcp-client-2025-11-20');
    return betas;
  }

  /**
   * מריץ תור שיחה שלם: קורא למודל, מבצע כלים, ומחזיר טקסט + קבצים שנוצרו.
   * @returns {Promise<{text: string, files: Array<{fileId: string}>, toolsUsed: string[]}>}
   */
  async reply({ store, chatId, text, userName, onProgress }) {
    const chat = store.chat(chatId);
    const executors = makeExecutors({ store, chatId, tz: this.tz });
    const messages = this.history(chatId);

    messages.push({ role: 'user', content: text });
    trim(messages);

    const betas = this.buildBetas();
    const collectedText = [];
    const fileIds = [];
    const toolsUsed = [];

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const request = {
        model: this.model,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: this.effort },
        system: this.systemPrompt({ chat, userName }),
        messages,
        tools: this.buildTools(),
      };
      if (betas.length) request.betas = betas;
      if (this.skills.length) request.container = { skills: this.skills };
      if (this.mcp) {
        request.mcp_servers = [{
          type: 'url',
          name: this.mcp.name,
          url: this.mcp.url,
          ...(this.mcp.token ? { authorization_token: this.mcp.token } : {}),
        }];
      }

      const response = await this.client.beta.messages.create(request);
      messages.push({ role: 'assistant', content: response.content });

      for (const block of response.content) {
        if (block.type === 'text' && block.text.trim()) collectedText.push(block.text.trim());
        if (block.type === 'bash_code_execution_tool_result') {
          const inner = block.content;
          if (inner && Array.isArray(inner.content)) {
            for (const out of inner.content) {
              if (out.type === 'bash_code_execution_output' && out.file_id) fileIds.push(out.file_id);
            }
          }
        }
      }

      if (response.stop_reason === 'refusal') {
        collectedText.push('לא אוכל לעזור עם הבקשה הזו.');
        break;
      }

      if (response.stop_reason === 'pause_turn') {
        continue; // המודל עצר באמצע עבודה של כלי שרת — ממשיכים
      }

      if (response.stop_reason !== 'tool_use') break;

      const calls = response.content.filter((b) => b.type === 'tool_use');
      if (!calls.length) break;

      const results = [];
      for (const call of calls) {
        toolsUsed.push(call.name);
        if (onProgress) onProgress(call.name);
        const fn = executors[call.name];
        let payload;
        try {
          payload = fn ? await fn(call.input || {}) : { error: `כלי לא מוכר: ${call.name}` };
        } catch (err) {
          log.warn(`הכלי ${call.name} נכשל:`, err.message);
          payload = { error: err.message };
        }
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: JSON.stringify(payload),
          ...(payload && payload.error ? { is_error: true } : {}),
        });
      }

      // כל תוצאות הכלים חוזרות בהודעת user אחת, אחרת המודל מפסיק לקרוא לכלים במקביל
      messages.push({ role: 'user', content: results });
      trim(messages);
    }

    trim(messages);
    return {
      text: collectedText.join('\n\n').trim(),
      files: fileIds.map((fileId) => ({ fileId })),
      toolsUsed,
    };
  }

  /** מוריד קובץ שנוצר בהרצת הקוד. */
  async downloadFile(fileId) {
    const meta = await this.client.beta.files.retrieveMetadata(fileId, { betas: ['files-api-2025-04-14'] })
      .catch(() => ({}));
    const res = await this.client.beta.files.download(fileId, { betas: ['files-api-2025-04-14'] });
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, filename: meta.filename || `schoolboost-${fileId}` };
  }
}

/** שומר את ההיסטוריה קצרה, בלי לחתוך באמצע צמד כלי/תוצאה. */
function trim(messages) {
  while (messages.length > HISTORY_TURNS) {
    messages.shift();
    // הודעה ראשונה חייבת להיות user, ותוצאת כלי בלי הקריאה שלה שוברת את הבקשה
    while (messages.length && !isCleanStart(messages[0])) messages.shift();
  }
}

function isCleanStart(message) {
  if (message.role !== 'user') return false;
  const content = message.content;
  if (typeof content === 'string') return true;
  return !content.some((b) => b.type === 'tool_result');
}
