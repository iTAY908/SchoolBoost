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
    const payload = JSON.parse(init.body);
    calls.push({ method, payload });

    let result = true;
    if (method === 'sendMessage') {
      result = { message_id: ++messageId, chat: { id: payload.chat_id }, text: payload.text };
    } else if (method === 'editMessageText') {
      result = { message_id: payload.message_id, chat: { id: payload.chat_id }, text: payload.text };
    } else if (method === 'getMe') {
      result = { id: 1, is_bot: true, username: 'SchoolBoostTestBot', first_name: 'SchoolBoost' };
    }
    return { json: async () => ({ ok: true, result }) };
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

export function makeHarness({ tz = 'Asia/Jerusalem' } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'schoolboost-'));
  const file = path.join(dir, 'data.json');
  const tg = fakeTelegram();
  const store = new Store(file, tz);
  const router = new Router({ tg, store, tz });

  const chatId = 555;
  const userId = 777;
  let msgId = 1;

  return {
    tg, store, router, tz, chatId, userId, file, dir,
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
