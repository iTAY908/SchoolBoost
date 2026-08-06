# WhatsApp connection (Green API)

Small, dependency-free Node client for linking a WhatsApp account to a
[Green API](https://green-api.com) instance and sending messages from it.

## Setup

```bash
cp whatsapp/.env.example whatsapp/.env
# edit whatsapp/.env with the instance id, token and API URL from the Green API console
```

`whatsapp/.env` is gitignored. Credentials are read from the environment only —
nothing is hardcoded.

## Connect

```bash
node --env-file=whatsapp/.env whatsapp/connect.mjs
```

- If the instance is already linked, it prints the connected phone number.
- If not, it polls for the login QR code and writes it to `whatsapp/qr.png`,
  rewriting it every few seconds as the code rotates. Open that file and scan it
  from **WhatsApp → Settings → Linked devices → Link a device**. The script exits
  once the instance reports `authorized`.

`--env-file` needs Node 20.6+. On older versions, export the variables yourself.

## Send a message

```bash
node --env-file=whatsapp/.env whatsapp/send.mjs 0501234567 "היי, זה מבחן"
```

Numbers are normalized to Green API's `<number>@c.us` chat id. A leading `0` is
treated as an Israeli local number and rewritten to the `972` country code; pass
a full international number or an explicit `...@c.us` to bypass that.

## Instance states

| State | Meaning |
|---|---|
| `authorized` | Linked and ready |
| `notAuthorized` | Needs a QR scan |
| `starting` | Still booting — retry shortly |
| `sleepMode` | Phone is offline |
| `blocked` | Instance blocked; check the Green API console |

## Note on network access

Green API hosts (`*.greenapi.com`, `green-api.com`) must be reachable. Sandboxed
or policy-restricted environments may block them at the egress proxy, in which
case these scripts fail on connect — run them somewhere with direct access.
