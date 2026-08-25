import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Telegram } from '../src/telegram.js';
import { Store } from '../src/storage.js';
import { Router } from '../src/router.js';

/** טלגרם מזויף: קולט קריאות API ומחזיר תשובות סבירות, בלי רשת. */
export function fakeTelegram() {
  const calls = [];
  let messageId = 100;

  const fetchImpl = async (url, init) => {
    const method = url.split('/').pop();
    // sendDocument שולח multipart, כל השאר JSON
    const payload = init.body instanceof FormData
      ? Object.fromEntries([...init.body.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '<binary>']))
      : JSON.parse(init.body);
    calls.push({ method, payload });

    let result = true;
    if (method === 'sendMessage') {
      result = { message_id: ++messageId, chat: { id: payload.chat_id }, text: payload.text };
    } else if (method === 'editMessageText') {
      result = { message_id: payload.message_id, chat: { id: payload.chat_id }, text: payload.text };
    } else if (method === 'getMe') {
      result = { id: 1, is_bot: true, username: 'SchoolBoostTestBot', first_name: 'SchoolBoost' };
    } else if (method === 'sendDocument') {
      result = { message_id: ++messageId, document: { file_name: payload.document } };
    }
    // מחקה Response אמיתי: הלקוח קורא text() ומפרש בעצמו
    return { status: 200, text: async () => JSON.stringify({ ok: true, result }) };
  };

  const tg = new Telegram('TEST:TOKEN', { fetchImpl });
  tg.calls = calls;
  tg.sent = () => calls.filter((c) => c.method === 'sendMessage').map((c) => c.payload.text);
  tg.edited = () => calls.filter((c) => c.method === 'editMessageText').map((c) => c.payload.text);
  tg.outgoing = () => calls
    .filter((c) => c.method === 'sendMessage' || c.method === 'editMessageText')
    .map((c) => c.payload.text);
  tg.last = () => tg.outgoing().at(-1) || '';
  tg.reset = () => { calls.length = 0; };
  return tg;
}

/**
 * לקוח Anthropic מזויף. `script` הוא מערך תשובות שיוחזרו לפי הסדר,
 * והקריאות שנשלחו נאספות ל-`requests` לבדיקה.
 */
export function fakeAnthropic(script, { skills = [], fileBody = 'FAKE-FILE' } = {}) {
  const requests = [];
  let i = 0;

  return {
    requests,
    beta: {
      messages: {
        create: async (req) => {
          // צילום מצב: מערך ההודעות ממשיך להשתנות אחרי הקריאה
          requests.push({ ...req, messages: structuredClone(req.messages) });
          const res = script[Math.min(i, script.length - 1)];
          i += 1;
          if (typeof res === 'function') return res(req);
          return res;
        },
      },
      skills: {
        list: () => ({
          async *[Symbol.asyncIterator]() {
            for (const s of skills) yield s;
          },
        }),
      },
      files: {
        retrieveMetadata: async (id) => ({ filename: `${id}.pptx` }),
        download: async () => ({ arrayBuffer: async () => new TextEncoder().encode(fileBody).buffer }),
      },
    },
  };
}

export function textResponse(text, stop = 'end_turn') {
  return { stop_reason: stop, content: [{ type: 'text', text }] };
}

export function toolCallResponse(name, input, id = 'tu_1') {
  return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] };
}

export function makeHarness({ tz = 'Asia/Jerusalem', agent = null } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'schoolboost-'));
  const file = path.join(dir, 'data.json');
  const tg = fakeTelegram();
  const store = new Store(file, tz);
  const router = new Router({ tg, store, tz, agent });

  const chatId = 555;
  const userId = 777;
  let msgId = 1;

  return {
    tg, store, router, tz, chatId, userId, file, dir, agent,
    chat: () => store.chat(chatId),

    send(text) {
      return router.handleUpdate({
        update_id: msgId++,
        message: {
          message_id: msgId,
          chat: { id: chatId, type: 'private' },
          from: { id: userId, first_name: 'איתי' },
          text,
        },
      });
    },

    click(data) {
      return router.handleUpdate({
        update_id: msgId++,
        callback_query: {
          id: `cb${msgId}`,
          from: { id: userId, first_name: 'איתי' },
          data,
          message: {
            message_id: 50,
            chat: { id: chatId, type: 'private' },
          },
        },
      });
    },

    cleanup() {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
