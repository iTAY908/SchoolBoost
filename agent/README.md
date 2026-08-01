# SchoolBoost WhatsApp Agent

A WhatsApp agent: people message the business number, Claude answers, the reply
goes back over WhatsApp. Infobip fronts the WhatsApp Business API; Claude Opus 5
produces the answers.

```
person on WhatsApp  ──▶  Meta  ──▶  Infobip  ──▶  POST /webhook/whatsapp
                                                        │
                                                        ▼
                                                  Claude Opus 5
                                                        │
person on WhatsApp  ◀──  Meta  ◀──  Infobip  ◀──  POST /whatsapp/1/message/text
```

## The chat link

```
https://wa.me/447860088970
```

That opens a WhatsApp chat with the Infobip sender number. **It only answers
while this server is running and reachable at the URL configured as Infobip's
inbound webhook.** Without that, messages arrive at Infobip and nothing replies.

## Setup

```bash
cd agent
npm install
cp .env.example .env      # fill it in
npm run build
npm start
```

### Environment

| Variable | What it is |
| --- | --- |
| `INFOBIP_BASE_URL` | Base URL from the Infobip portal, no scheme (`8vn9v1.api.infobip.com`) |
| `INFOBIP_API_KEY` | Infobip API key, sent as `Authorization: App <key>` |
| `INFOBIP_SENDER` | WhatsApp Business sender number, digits only, no `+` |
| `INFOBIP_TEMPLATE_NAME` | Approved template for messages outside the 24h window |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `ANTHROPIC_MODEL` | Defaults to `claude-opus-5` |
| `WEBHOOK_TOKEN` | Random secret; Infobip must call `?token=<this>` |
| `PORT` | Defaults to `3000` |
| `HISTORY_TURNS` | Conversation turns kept per contact, default 20 |

### Point Infobip at the webhook

The server must be reachable over public HTTPS. In the Infobip portal, set the
inbound WhatsApp webhook to:

```
https://<your-host>/webhook/whatsapp?token=<WEBHOOK_TOKEN>
```

For local development, tunnel it (`ngrok http 3000`) and use the tunnel URL.
Requests without the right `token` get a 401, so the endpoint isn't open to
anyone who finds the path.

Verify the server is up:

```bash
curl https://<your-host>/health
# {"status":"ok","sender":"447860088970","model":"claude-opus-5"}
```

## Sending a message yourself

```bash
node dist/send.js 972584080951 --template Itay     # template, works anytime
node dist/send.js 972584080951 "היי, הסוכן באוויר"  # free text, 24h window only
```

## The 24-hour window

Meta only delivers free-form text within 24 hours of the contact's last message
to the business. Outside that window only pre-approved **templates** go through.
The agent replies to inbound messages, so it is always inside the window — but
anything the agent initiates (a reminder, a proactive alert) needs an approved
template. `sendTemplate()` in `src/infobip.ts` covers that case.

## Behavior

- Answers in Hebrew by default, switching to whatever language it's addressed in.
- Formatting is tuned for WhatsApp: no markdown headings, tables, or code
  blocks, since WhatsApp doesn't render them.
- Replies longer than WhatsApp's 4096-character limit are split on paragraph
  boundaries rather than truncated.
- Per-contact conversation history, capped at `HISTORY_TURNS`.
- `/reset` or `איפוס` clears a contact's history.

## Files

| File | Role |
| --- | --- |
| `src/server.ts` | Express webhook, dedupe, error handling |
| `src/agent.ts` | Claude call, system prompt, refusal handling |
| `src/infobip.ts` | Outbound text and template sends, message splitting |
| `src/store.ts` | In-memory conversation history |
| `src/config.ts` | Environment loading, fails fast on anything missing |
| `src/send.ts` | One-off CLI sender |

## Known limits

- **History is in memory.** Restarting the process clears every conversation,
  and two instances behind a load balancer will disagree. Move `src/store.ts`
  to Redis or Postgres before running more than one.
- **No inbound signature verification.** The `token` query parameter is the only
  check. Infobip supports IP allowlisting — worth adding in front of this.
- **Text only.** Images, audio, and documents get a "text only" reply.
