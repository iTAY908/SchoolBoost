# Store review access

Google Play and the App Store both require an account that reaches every
feature without a real purchase. This is that account, and how it gets onto
the device.

## The account

| | |
|---|---|
| Email | `ytylyys707@gmail.com` |
| Password | **not in this repository** — see below |
| Entitlement | `premium: true`, granted at seed time |
| Starting state | onboarded, employed, renting alone, ₪12,000/month income, ₪8,400 on hand, 7 cubes |

The password belongs in the Play Console's **App access** form (and App Store
Connect's **Sign-in information**), nowhere else. It is deliberately absent
from the code, the git history and this file: what ships in
`cubefinance-web.html` is `REVIEWER.salt` and `REVIEWER.hash`, the salted,
key-stretched digest the login path already compares against. Anyone reading
the repository cannot recover the password from it.

To rotate the password, recompute the digest with the app's own `mockHash`:

```js
function mockHash(s){let h=5381;for(let i=0;i<s.length;i++)h=((h*33)^s.charCodeAt(i))>>>0;
  for(let r=0;r<800;r++)h=((h*33)^(h>>>7))>>>0;return h.toString(16);}
const salt = crypto.randomBytes(8).toString('hex');
console.log(salt, mockHash(salt + '::' + NEW_PASSWORD));
```

then replace `REVIEWER.salt` / `REVIEWER.hash` and update the console form.

### One honest caveat

`mockHash` folds down to 32 bits, so the stored digest is brute-forceable and a
collision would open this demo account. It holds nothing but sample data, and
this is not a new weakness — every account in the app hashes the same way, and
`premium` is a client-side flag in `localStorage` that a determined user can
flip regardless. It is called out here so nobody mistakes the seeded account
for server-grade auth. Real authentication belongs on a server with bcrypt or
argon2; the app has no server-side user table today.

## The reset

There is no central user database. Accounts live only in each device's
`localStorage`; the backend keeps sessions in an in-memory `Map` that empties on
restart. "Delete every existing user" therefore has to happen on the device.

`applyReleaseReset()` runs once per stamp, before any account is read:

```js
const RESET_STAMP = "2026-08-26-store-review";
```

On the first load of a build carrying a new stamp it drops the local user
table, the saved session, every per-account state blob and every onboarding
draft, then seeds the reviewer account. The language preference is deliberately
kept — wiping users should not throw the reader back into Hebrew.

**Bumping this stamp is destructive and irreversible for anyone holding the
device.** It is safe right now only because the app has never shipped, so the
only accounts it can destroy are our own test ones. Do not bump it again once
real users exist.

## What a reviewer should be able to do

Sign in, switch to English from the login card (or Settings → 🌐 Language), and
reach every screen: the dashboard and cube split, income, the expense journal,
the what-if simulator, the books page and its free worksheet, the calm flow,
the guide, challenges, shared cubes, the debt optimiser, and the Cubey chat —
all without a purchase, because the entitlement is already granted.

The in-app book purchase (₪19) is the one paid item. Its payment sheet is a
client-side simulation, not Google Play Billing; see `PLAY_STORE.md`.
