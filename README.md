# SchoolBoost — WhatsApp bridge

Sends and receives WhatsApp messages through [Green API](https://green-api.com).
No dependencies — Node 18+ and the standard library.

## Why a server

Green API authenticates by putting the instance token **in the request URL**.
Anything holding that token can send and read messages on the linked WhatsApp
account, so it cannot live in `index.html` or any other browser-delivered file
— every visitor would be able to read it out of devtools. The token stays here,
server-side, and the browser talks to this server instead.

## Setup

```bash
cp .env.example .env      # then fill it in
npm run check             # is the instance actually linked?
npm start                 # run the bridge
```

`GREEN_API_BASE_URL` must be the regional host shown next to the instance id in
the console — an instance numbered `7107…` lives at `https://7107.api.greenapi.com`,
not the default shared host.

## Endpoints

| Method | Path         | Purpose                                        |
| ------ | ------------ | ---------------------------------------------- |
| `GET`  | `/health`    | Liveness.                                      |
| `GET`  | `/api/state` | `{ connected, state }` straight from Green API. |
| `POST` | `/api/send`  | `{ "to": "0501234567", "message": "…" }`       |
| `POST` | `/webhook`   | Incoming messages from Green API.              |

`to` accepts `0501234567`, `+972-50-123-4567`, or a raw `…@c.us` / `…@g.us`
chat id. Local numbers are expanded using `DEFAULT_COUNTRY_CODE`.

## Receiving messages

Two options — use one, not both, or they will race for the same queue.

**Webhooks** (production). Point the console's webhook url at
`https://your-host/webhook` and set an outgoing webhook token there. Put the
same value in `GREEN_API_WEBHOOK_TOKEN`; requests arriving without it are
rejected with 401. Requires a publicly reachable HTTPS url.

**Polling** (local development). Set `GREEN_API_POLL=1` and the bridge
long-polls `receiveNotification` instead. No public url needed, which is what
makes it work behind NAT or a firewall.

Both paths hand the same normalised object to the handler:

```js
{ kind: 'text' | 'file' | …, id, chatId, sender, senderName, timestamp, text, file, raw }
```

Replace `logMessage` in `server/index.js` to route messages into SchoolBoost.

## Layout

```
server/config.js     env loading and validation
server/greenapi.js   HTTP client — send, state, poll
server/messages.js   normalises Green API's message shapes
server/webhook.js    inbound endpoint + constant-time token check
server/poller.js     long-poll receive loop with backoff
server/index.js      http server, routes, startup
scripts/check-connection.js
test/                run with `npm test`
```

## Credentials

`.env` is gitignored. Keep tokens out of commits, logs, screenshots, and chat
windows. A token that has been pasted anywhere shared should be rotated in the
console before use — the instance id alone is not a secret, but the token is
full access to the linked WhatsApp account.
