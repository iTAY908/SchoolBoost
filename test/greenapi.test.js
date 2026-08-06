'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { GreenApiClient, redactUrl } = require('../server/greenapi');
const { parseIncoming } = require('../server/messages');
const { isAuthorized } = require('../server/webhook');

const client = new GreenApiClient({
  idInstance: '1234567890',
  apiTokenInstance: 'a'.repeat(50),
  baseUrl: 'https://example.api.greenapi.com',
  defaultCountryCode: '972',
});

test('toChatId expands a local Israeli number', () => {
  assert.equal(client.toChatId('0501234567'), '972501234567@c.us');
});

test('toChatId strips punctuation and a leading plus', () => {
  assert.equal(client.toChatId('+972-50-123-4567'), '972501234567@c.us');
  assert.equal(client.toChatId('050 123 4567'), '972501234567@c.us');
});

test('toChatId leaves an existing chat id untouched', () => {
  assert.equal(client.toChatId('972501234567@c.us'), '972501234567@c.us');
  assert.equal(client.toChatId('120363000000000000@g.us'), '120363000000000000@g.us');
});

test('toChatId rejects input with no digits', () => {
  assert.throws(() => client.toChatId(''), /Empty phone number/);
  assert.throws(() => client.toChatId('not-a-number'), /Cannot derive a chat id/);
});

test('redactUrl removes the api token', () => {
  const url = `https://example.api.greenapi.com/waInstance1234567890/sendMessage/${'a'.repeat(50)}`;
  const redacted = redactUrl(url);
  assert.ok(!redacted.includes('a'.repeat(50)), 'token must not survive redaction');
  assert.ok(redacted.endsWith('/<token>'));
});

test('parseIncoming reads a plain text message', () => {
  const message = parseIncoming({
    typeWebhook: 'incomingMessageReceived',
    idMessage: 'ABC123',
    timestamp: 1_700_000_000,
    senderData: { chatId: '972501234567@c.us', sender: '972501234567@c.us', senderName: 'Itay' },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'שלום' } },
  });

  assert.equal(message.kind, 'text');
  assert.equal(message.text, 'שלום');
  assert.equal(message.senderName, 'Itay');
  assert.equal(message.id, 'ABC123');
  assert.equal(message.timestamp, '2023-11-14T22:13:20.000Z');
});

test('parseIncoming reads an extended text message', () => {
  const message = parseIncoming({
    typeWebhook: 'incomingMessageReceived',
    senderData: { chatId: 'x@c.us' },
    messageData: {
      typeMessage: 'extendedTextMessage',
      extendedTextMessageData: { text: 'see https://example.com' },
    },
  });
  assert.equal(message.kind, 'text');
  assert.equal(message.text, 'see https://example.com');
});

test('parseIncoming reads a file message with its caption', () => {
  const message = parseIncoming({
    typeWebhook: 'incomingMessageReceived',
    senderData: { chatId: 'x@c.us' },
    messageData: {
      typeMessage: 'imageMessage',
      fileMessageData: {
        downloadUrl: 'https://example.com/a.jpg',
        fileName: 'a.jpg',
        mimeType: 'image/jpeg',
        caption: 'grades',
      },
    },
  });

  assert.equal(message.kind, 'file');
  assert.equal(message.text, 'grades');
  assert.equal(message.file.url, 'https://example.com/a.jpg');
  assert.equal(message.file.mimeType, 'image/jpeg');
});

test('parseIncoming ignores non-message webhooks', () => {
  assert.equal(parseIncoming({ typeWebhook: 'outgoingMessageStatus' }), null);
  assert.equal(parseIncoming({ typeWebhook: 'stateInstanceChanged' }), null);
  assert.equal(parseIncoming(null), null);
  assert.equal(parseIncoming('nonsense'), null);
});

test('isAuthorized accepts the bearer token and rejects everything else', () => {
  const token = 's3cret-token';
  assert.ok(isAuthorized({ headers: { authorization: `Bearer ${token}` } }, token));
  assert.ok(isAuthorized({ headers: { authorization: token } }, token));

  assert.ok(!isAuthorized({ headers: {} }, token));
  assert.ok(!isAuthorized({ headers: { authorization: 'Bearer wrong' } }, token));
  assert.ok(!isAuthorized({ headers: { authorization: 'Bearer ' } }, token));
});

test('isAuthorized is open when no token is configured', () => {
  assert.ok(isAuthorized({ headers: {} }, ''));
});
