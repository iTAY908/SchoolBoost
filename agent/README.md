# SchoolBoost WhatsApp Agent

People message the WhatsApp business number, Claude answers, the reply goes back
over WhatsApp. Runs as a Cloudflare Worker against Meta's WhatsApp Cloud API.

```
person on WhatsApp  ──▶  Meta  ──▶  POST /webhook  (Cloudflare Worker)
                                          │
                                          ▼
                                   Claude Haiku 4.5
                                          │
person on WhatsApp  ◀──  Meta  ◀──  POST /{phone-number-id}/messages
```

No middleman BSP, so there is nothing to pay for the WhatsApp side beyond
Meta's own conversation pricing — and conversations the user starts are free.
Cloudflare's free tier covers the hosting. Claude API usage is the running cost.

## Setup

### 1. Meta — get four values

In [developers.facebook.com](https://developers.facebook.com), create a Business
app and add the **WhatsApp** product. From **WhatsApp > API Setup** you need:

| Value | Where |
| --- | --- |
| Phone number ID | API Setup. A numeric ID, **not** the phone number |
| Access token | API Setup. The temporary one expires in 24h — generate a permanent System User token for real use |
| App Secret | App Settings > Basic |
| Graph API version | Shown in the API Setup URL, e.g. `v21.0` |

Also add your own number under **API Setup > To > Manage phone number list**,
or Meta won't deliver test messages to you.

### 2. Cloudflare — deploy

```bash
cd agent
npm install
npx wrangler login

# Create the KV namespace and paste the printed id into wrangler.toml
npx wrangler kv namespace create HISTORY
```

Fill in `wrangler.toml`: the KV `id`, `WHATSAPP_PHONE_NUMBER_ID`, and
`GRAPH_API_VERSION`. Then set the secrets:

```bash
npx wrangler secret put WHATSAPP_TOKEN
npx wrangler secret put WHATSAPP_VERIFY_TOKEN   # any string you invent — remember it
npx wrangler secret put WHATSAPP_APP_SECRET
npx wrangler secret put ANTHROPIC_API_KEY

npx wrangler deploy
```

Deploy prints your URL, something like
`https://schoolboost-whatsapp-agent.<subdomain>.workers.dev`. Check it:

```bash
curl https://<your-worker>.workers.dev/health
# {"status":"ok","model":"claude-haiku-4-5","phone_number_id":"..."}
```

### 3. Meta — point the webhook at the Worker

**WhatsApp > Configuration > Webhook > Edit**:

| Field | Value |
| --- | --- |
| Callback URL | `https://<your-worker>.workers.dev/webhook` |
| Verify token | Whatever you set as `WHATSAPP_VERIFY_TOKEN` |

Click **Verify and save** — Meta calls the Worker with a challenge and the
Worker echoes it back. Then **Manage** the webhook fields and subscribe to
**messages**. Without that subscription nothing is ever delivered.

### 4. Test

Message the business number from WhatsApp. A reply should arrive in seconds.
`npx wrangler tail` streams live logs if it doesn't.

## Local development

```bash
cp .dev.vars.example .dev.vars   # fill in
npx wrangler dev
```

Meta can't reach `localhost`, so to test inbound end to end you need a tunnel
(`cloudflared tunnel --url http://localhost:8787`) and the tunnel URL in the
webhook config.

## Behavior

- Answers in Hebrew by default, switching to whatever language it's addressed in.
- Formatting is tuned for WhatsApp: no markdown headings, tables, or code
  blocks, since WhatsApp doesn't render them.
- Replies past WhatsApp's 4096-character limit are split on paragraph
  boundaries rather than truncated.
- Per-contact history in KV, capped at `HISTORY_TURNS` and expiring after 30
  days of silence.
- `/reset` or `איפוס` clears a contact's history.

## Files

| File | Role |
| --- | --- |
| `src/index.ts` | Worker entry: routing, Meta verification, signature check |
| `src/agent.ts` | Claude call, system prompt, refusal handling |
| `src/whatsapp.ts` | Cloud API sends, signature verification, payload parsing |
| `src/store.ts` | KV-backed history and message-ID dedupe |
| `src/env.ts` | Binding types and defaults |

## Cost

Claude is the only per-use cost. At roughly 1,300 input and 200 output tokens
per exchange, Haiku 4.5 works out near $0.002 per message — about $7/month at
100 messages a day. The system prompt is cached, which takes a bite out of the
input side. Switch models with the `ANTHROPIC_MODEL` var in `wrangler.toml`.

Cloudflare's free tier allows 100,000 requests/day and doesn't sleep. Meta
charges nothing for conversations the user initiates.

## Known limits

- **The 24-hour window.** Meta only delivers free-form text within 24 hours of
  the contact's last message. The agent only ever replies, so it stays inside
  the window — but anything it initiates (a reminder, an alert) needs an
  approved template, which isn't implemented.
- **Dedupe is best-effort.** KV is eventually consistent, so a Meta retry
  arriving a second after the original can slip past the check. The cost is a
  duplicate answer.
- **Text only.** Images, audio, and documents get a "text only" reply; image
  and document captions are read.
- **Graph API versions expire.** Meta retires them roughly two years after
  release. When sends start failing, bump `GRAPH_API_VERSION`.
