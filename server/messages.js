'use strict';

/**
 * Normalises the several shapes Green API uses for an inbound message into a
 * single flat object, so callers do not have to branch on typeMessage.
 *
 * Webhook payloads and polled notifications carry the same `body`, which is
 * why both paths funnel through here.
 */

/** @returns {null | {kind, id, chatId, sender, senderName, timestamp, text, file, raw}} */
function parseIncoming(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.typeWebhook !== 'incomingMessageReceived') return null;

  const senderData = body.senderData || {};
  const messageData = body.messageData || {};
  const type = messageData.typeMessage;

  const base = {
    id: body.idMessage,
    chatId: senderData.chatId,
    sender: senderData.sender,
    senderName: senderData.senderName || senderData.chatName || '',
    timestamp: body.timestamp ? new Date(body.timestamp * 1000).toISOString() : null,
    raw: body,
  };

  switch (type) {
    case 'textMessage':
      return {
        ...base,
        kind: 'text',
        text: messageData.textMessageData?.textMessage ?? '',
        file: null,
      };

    // Text sent with a link preview, or as a reply to another message.
    case 'extendedTextMessage':
      return {
        ...base,
        kind: 'text',
        text: messageData.extendedTextMessageData?.text ?? '',
        file: null,
      };

    case 'imageMessage':
    case 'videoMessage':
    case 'documentMessage':
    case 'audioMessage': {
      const f = messageData.fileMessageData || {};
      return {
        ...base,
        kind: 'file',
        text: f.caption ?? '',
        file: {
          url: f.downloadUrl ?? null,
          name: f.fileName ?? null,
          mimeType: f.mimeType ?? null,
        },
      };
    }

    default:
      // Locations, contacts, polls, reactions — surfaced so the caller can
      // decide, rather than silently dropped.
      return { ...base, kind: type || 'unknown', text: '', file: null };
  }
}

module.exports = { parseIncoming };
