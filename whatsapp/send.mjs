#!/usr/bin/env node
// Sends one WhatsApp message through the linked Green API instance.
//
//   node whatsapp/send.mjs 0501234567 "היי, זה מבחן"
//   node whatsapp/send.mjs 972501234567@c.us "hello"

import { GreenApi, GreenApiError, toChatId } from './green-api.mjs';

const [phone, ...rest] = process.argv.slice(2);
const message = rest.join(' ');

if (!phone || !message) {
  console.error('Usage: node whatsapp/send.mjs <phone> <message>');
  process.exit(2);
}

const api = new GreenApi();

const state = await api.getStateInstance();
if (state !== 'authorized') {
  console.error(`❌ Instance is "${state}", not authorized. Run: node whatsapp/connect.mjs`);
  process.exit(1);
}

const chatId = toChatId(phone);

try {
  const res = await api.sendMessage(chatId, message);
  console.log(`✅ Sent to ${chatId} (idMessage: ${res?.idMessage ?? 'unknown'})`);
} catch (err) {
  if (err instanceof GreenApiError) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
  throw err;
}
