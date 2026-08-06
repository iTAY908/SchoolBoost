#!/usr/bin/env node
// WhatsApp CLI over Green API.
//
//   node --env-file=.env whatsapp/cli.mjs <command> [args]
//
// Run with no arguments for the command list.

import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { GreenApi, GreenApiError, toChatId, messageText } from './green-api.mjs';
import { waitForScan } from './qr.mjs';
import { listen } from './listener.mjs';

const COMMANDS = {
  state: 'Print the instance state and, if linked, the connected number',
  connect: 'Link a WhatsApp account (writes a QR to whatsapp/qr.png to scan)',
  'send <phone> <message...>': 'Send a text message',
  'send-file <phone> <url> [fileName] [caption]': 'Send a file by URL',
  'upload <phone> <path> [caption]': 'Send a local file',
  'download <phone> <idMessage> [outPath]': 'Download a file from a received message',
  'history <phone> [count]': 'Print the last messages of one chat (default 50)',
  'incoming [minutes]': 'Print incoming messages across all chats (default 1440)',
  'outgoing [minutes]': 'Print outgoing messages across all chats (default 1440)',
  chats: 'List all chats known to the instance',
  contacts: 'List contacts',
  'info <phone>': 'Contact details for one number',
  'check <phone>': 'Whether a number has a WhatsApp account',
  'read <phone>': 'Mark a chat as read',
  listen: 'Stream incoming messages and events until interrupted',
  settings: 'Print instance settings',
  logout: 'Unlink the WhatsApp account from this instance',
};

function usage() {
  console.log('Usage: node --env-file=.env whatsapp/cli.mjs <command> [args]\n');
  console.log('Commands:');
  const width = Math.max(...Object.keys(COMMANDS).map((k) => k.length));
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`  ${cmd.padEnd(width)}  ${desc}`);
  }
}

const fmtTime = (ts) =>
  ts ? new Date(ts * 1000).toLocaleString('he-IL', { hour12: false }) : '—';

function printMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    console.log('(no messages)');
    return;
  }
  for (const m of messages) {
    const { text, type, fileName } = messageText(m);
    const who = m.type === 'incoming' ? '←' : '→';
    const name = m.senderName || m.chatId || '';
    // Media has no text of its own — show what it is, and the id `download` needs.
    const shown = text ?? `[${type}${fileName ? ` ${fileName}` : ''}  id=${m.idMessage}]`;
    console.log(`${who} ${fmtTime(m.timestamp)}  ${name}\n   ${shown}`);
  }
}

async function requireAuthorized(api) {
  const state = await api.getStateInstance();
  if (state !== 'authorized') {
    throw new GreenApiError(`Instance is "${state}", not authorized. Run: cli.mjs connect`);
  }
}

async function run(argv) {
  const [command, ...args] = argv;
  if (!command || command === 'help' || command === '--help') {
    usage();
    return 0;
  }

  const api = new GreenApi();

  switch (command) {
    case 'state': {
      const state = await api.getStateInstance();
      console.log(`Instance state: ${state}`);
      if (state === 'authorized') {
        const wa = await api.getWaSettings();
        if (wa?.phone) console.log(`Linked number:  +${wa.phone}`);
      }
      return state === 'authorized' ? 0 : 1;
    }

    case 'connect': {
      const state = await api.getStateInstance();
      console.log(`Instance state: ${state}`);
      if (state === 'authorized') {
        const wa = await api.getWaSettings();
        console.log(`✅ Already connected${wa?.phone ? ` as +${wa.phone}` : ''}.`);
        return 0;
      }
      if (state !== 'notAuthorized') {
        console.log(`Cannot link while the instance is "${state}".`);
        return 1;
      }
      console.log('📱 Fetching a login QR code…');
      if (await waitForScan(api)) {
        console.log('\n✅ Linked.');
        return 0;
      }
      console.error('\n⏱  Timed out waiting for the QR code to be scanned.');
      return 1;
    }

    case 'send': {
      const [phone, ...rest] = args;
      const message = rest.join(' ');
      if (!phone || !message) return usageError('send <phone> <message...>');
      await requireAuthorized(api);
      const chatId = toChatId(phone);
      const res = await api.sendMessage(chatId, message);
      console.log(`✅ Sent to ${chatId} (idMessage: ${res?.idMessage ?? 'unknown'})`);
      return 0;
    }

    case 'send-file': {
      const [phone, url, fileName, ...captionParts] = args;
      if (!phone || !url) return usageError('send-file <phone> <url> [fileName] [caption]');
      await requireAuthorized(api);
      const chatId = toChatId(phone);
      const name = fileName || url.split('/').pop() || 'file';
      const caption = captionParts.join(' ');
      const res = await api.sendFileByUrl(chatId, url, name, caption ? { caption } : {});
      console.log(`✅ Sent ${name} to ${chatId} (idMessage: ${res?.idMessage ?? 'unknown'})`);
      return 0;
    }

    case 'upload': {
      const [phone, path, ...captionParts] = args;
      if (!phone || !path) return usageError('upload <phone> <path> [caption]');
      await requireAuthorized(api);
      const chatId = toChatId(phone);
      const bytes = await readFile(path);
      const caption = captionParts.join(' ');
      const res = await api.sendFileByUpload(chatId, bytes, basename(path),
        caption ? { caption } : {});
      console.log(`✅ Uploaded ${basename(path)} to ${chatId} (idMessage: ${res?.idMessage ?? 'unknown'})`);
      return 0;
    }

    case 'download': {
      const [phone, idMessage, outPath] = args;
      if (!phone || !idMessage) return usageError('download <phone> <idMessage> [outPath]');
      await requireAuthorized(api);
      const chatId = toChatId(phone);
      const res = await api.downloadFile(chatId, idMessage);
      if (!res?.downloadUrl) {
        console.error(`❌ No downloadUrl for ${idMessage}: ${JSON.stringify(res)}`);
        return 1;
      }
      const target = outPath || res.fileName || new URL(res.downloadUrl).pathname.split('/').pop();
      const bytes = await api.fetchMedia(res.downloadUrl);
      await writeFile(target, bytes);
      console.log(`✅ Saved ${bytes.length} bytes to ${target}`);
      return 0;
    }

    case 'history': {
      const [phone, count] = args;
      if (!phone) return usageError('history <phone> [count]');
      await requireAuthorized(api);
      const chatId = toChatId(phone);
      const messages = await api.getChatHistory(chatId, Number(count) || 50);
      printMessages(Array.isArray(messages) ? messages.slice().reverse() : messages);
      return 0;
    }

    case 'incoming':
    case 'outgoing': {
      await requireAuthorized(api);
      const minutes = Number(args[0]) || 1440;
      const messages = command === 'incoming'
        ? await api.lastIncomingMessages(minutes)
        : await api.lastOutgoingMessages(minutes);
      printMessages(messages);
      return 0;
    }

    case 'chats': {
      await requireAuthorized(api);
      const chats = await api.getChats();
      if (!Array.isArray(chats) || !chats.length) {
        console.log('(no chats)');
        return 0;
      }
      for (const c of chats) console.log(`${c.id}${c.name ? `  ${c.name}` : ''}`);
      console.log(`\n${chats.length} chats`);
      return 0;
    }

    case 'contacts': {
      await requireAuthorized(api);
      const contacts = await api.getContacts();
      if (!Array.isArray(contacts) || !contacts.length) {
        console.log('(no contacts)');
        return 0;
      }
      for (const c of contacts) {
        console.log(`${c.id}  ${c.name || c.contactName || ''}`.trimEnd());
      }
      console.log(`\n${contacts.length} contacts`);
      return 0;
    }

    case 'info': {
      const [phone] = args;
      if (!phone) return usageError('info <phone>');
      await requireAuthorized(api);
      console.log(JSON.stringify(await api.getContactInfo(toChatId(phone)), null, 2));
      return 0;
    }

    case 'check': {
      const [phone] = args;
      if (!phone) return usageError('check <phone>');
      const res = await api.checkWhatsapp(phone);
      console.log(res?.existsWhatsapp ? '✅ has WhatsApp' : '❌ no WhatsApp account');
      return res?.existsWhatsapp ? 0 : 1;
    }

    case 'read': {
      const [phone] = args;
      if (!phone) return usageError('read <phone>');
      await requireAuthorized(api);
      const res = await api.readChat(toChatId(phone));
      console.log(res?.setRead ? '✅ marked as read' : JSON.stringify(res));
      return 0;
    }

    case 'listen': {
      await requireAuthorized(api);
      console.log('👂 Listening for events — Ctrl-C to stop.\n');
      const controller = new AbortController();
      process.on('SIGINT', () => {
        console.log('\nStopping…');
        controller.abort();
      });
      await listen(api, (event) => {
        if (event.text !== undefined && event.text !== null) {
          const arrow = event.direction === 'in' ? '←' : '→';
          console.log(`${arrow} ${fmtTime(event.timestamp)}  ${event.senderName || event.chatId}`);
          console.log(`   ${event.text}`);
        } else if (event.type === 'outgoingMessageStatus') {
          console.log(`·  ${event.idMessage} → ${event.status}`);
        } else {
          console.log(`·  ${event.type}`);
        }
      }, { signal: controller.signal });
      return 0;
    }

    case 'settings': {
      console.log(JSON.stringify(await api.getSettings(), null, 2));
      return 0;
    }

    case 'logout': {
      const res = await api.logout();
      console.log(res?.isLogout ? '✅ logged out' : JSON.stringify(res));
      return 0;
    }

    default:
      console.error(`Unknown command: ${command}\n`);
      usage();
      return 2;
  }
}

function usageError(form) {
  console.error(`Usage: cli.mjs ${form}`);
  return 2;
}

run(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    if (err instanceof GreenApiError) {
      console.error(`❌ ${err.message}`);
      if (err.status === 401 || err.status === 403) {
        console.error('   The token or instance id looks wrong — re-check GREEN_API_* values.');
      }
      if (err.body) console.error(`   ${JSON.stringify(err.body)}`);
    } else {
      console.error(`❌ ${err.stack || err.message}`);
    }
    process.exit(1);
  });
