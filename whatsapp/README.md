# WhatsApp via Green API

Dependency-free Node client for driving a WhatsApp account through a
[Green API](https://green-api.com) instance — linking the account, sending
messages and files, reading history, and streaming incoming messages live.

## Setup

```bash
cp .env.example .env   # then fill it in from the Green API console
```

`.env` lives at the repo root and is gitignored. Its field names match the
Green API console exactly, so values can be pasted straight across:

```
idInstance
apiTokenInstance
apiUrl
mediaUrl
```

Credentials are read from the environment only — nothing is hardcoded, and the
token never appears in log or error output even though Green API carries it in
the request path. The older `GREEN_API_*` names still work as a fallback.

All commands below assume Node 20.6+ for `--env-file`; on older versions export
the four fields yourself.

## Commands

```bash
node --env-file=.env whatsapp/cli.mjs <command> [args]
```

| Command | What it does |
|---|---|
| `state` | Instance state, plus the linked number when authorized |
| `connect` | Link an account — writes the login QR to `whatsapp/qr.png` |
| `send <phone> <message...>` | Send a text message |
| `send-file <phone> <url> [fileName] [caption]` | Send a file by URL |
| `upload <phone> <path> [caption]` | Send a local file (goes via `mediaUrl`) |
| `download <phone> <idMessage> [outPath]` | Save a file from a received message |
| `history <phone> [count]` | Last messages of one chat (default 50) |
| `incoming [minutes]` | Incoming messages across all chats (default 1440) |
| `outgoing [minutes]` | Outgoing messages across all chats |
| `chats` | All chats known to the instance |
| `contacts` | Contact list |
| `info <phone>` | Contact details |
| `check <phone>` | Whether a number has a WhatsApp account |
| `read <phone>` | Mark a chat as read |
| `listen` | Stream incoming messages and events until Ctrl-C |
| `settings` | Instance settings |
| `logout` | Unlink the account |

### Linking

```bash
node --env-file=.env whatsapp/cli.mjs connect
```

If the instance is already linked it says so. Otherwise it polls for the login
QR and rewrites `whatsapp/qr.png` every few seconds as the code rotates — open
that file and scan it from **WhatsApp → Settings → Linked devices → Link a
device**. It exits once the instance reports `authorized`.

### Phone numbers

Numbers are normalized to Green API's `<number>@c.us` chat id. A leading `0` is
treated as an Israeli local number and rewritten to the `972` country code; pass
a full international number or an explicit `...@c.us` to bypass that.

```
0501234567  →  972501234567@c.us
+972-50-123-4567  →  972501234567@c.us
120363xxxxx@g.us  →  unchanged (group)
```

### Listening

`listen` long-polls the instance's notification queue, prints each event, and
deletes it so it isn't redelivered. A notification whose handler throws is left
queued for the next pass. Ctrl-C aborts the in-flight poll and exits
immediately.

Incoming webhooks must be enabled on the instance for anything to arrive —
check with `settings`, and enable them in the Green API console if
`incomingWebhook` is not `yes`.

## Programmatic use

```js
import { GreenApi, toChatId } from './whatsapp/green-api.mjs';
import { listen } from './whatsapp/listener.mjs';

const api = new GreenApi();                       // reads the .env fields from env

await api.sendMessage(toChatId('0501234567'), 'שלום');
const history = await api.getChatHistory(toChatId('0501234567'), 20);

// React to incoming messages
await listen(api, async (event) => {
  if (event.direction === 'in' && event.text) {
    await api.sendMessage(event.chatId, `קיבלתי: ${event.text}`);
  }
});
```

`listen` hands the handler a flat event — `{ type, direction, chatId,
senderName, messageType, text, url, fileName, timestamp, raw }` for messages,
with the untouched webhook body always on `raw`.

`messageText(messageData)` normalizes any message body to
`{ type, text, caption, url, fileName }`, accepting both the nested shape
webhooks use and the flattened shape the REST history endpoints return.

## Downloading received files

`history` and `incoming` print an `id=` for any message carrying media. Pass it
to `download`:

```bash
node --env-file=.env whatsapp/cli.mjs history 0501234567
node --env-file=.env whatsapp/cli.mjs download 0501234567 BAE5xxxxxxxx report.pdf
```

## Notes

- Green API hosts (`*.greenapi.com`) must be reachable. Sandboxed or
  policy-restricted environments may block them at the egress proxy, in which
  case every command fails on connect — run from a machine with direct access.
- Instance states: `authorized` (ready), `notAuthorized` (needs a QR scan),
  `starting` (booting), `sleepMode` (phone offline), `blocked`.
- These scripts are a local operator tool. Driving WhatsApp from the browser
  app in `index.html` would need a server in between — the token cannot be
  shipped to a browser.
