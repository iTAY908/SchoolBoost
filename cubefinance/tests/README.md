# Email-code tests

Automated tests for the verification flow: the real Edge Function (`supabase/live/functions/cf-auth`),
the real SQL (`supabase/live/account_sync.sql`) in a local Postgres, and the real app screen
(`web/cubefinance-web.html`) in Chromium. Only EmailJS is simulated (`fake-backend.mjs`).

```sh
./setup-db.sh                                                    # needs a local Postgres (PGHOST/PGPORT)
node --experimental-strip-types auth-server.test.mjs             # 17 server tests
PW=playwright node --experimental-strip-types verify-ui.test.mjs # 12 UI tests
```
