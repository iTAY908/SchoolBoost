# What is in this folder

These are the migration files and the Edge Function written for this project,
copied from the local Android Studio project on 4.10.2026. They are **not** a
dump of the live database:

- The machine that made this commit has no admin access (no service key, no
  SQL access), so live function definitions could not be exported.
- Read-only checks of the production project (`sfrkenhauekqdijtunpg`) on
  4.10.2026 found none of these objects deployed: no `cf_profiles` table, no
  `cf_*` / `cf2_*` functions, and no `cf-push` Edge Function (HTTP 404).

Run order when deploying: `shared_savings.sql` → `shared_savings_v2.sql` →
`complimentary_seed.sql` → (after the Edge Function and its secrets/Vault
entries) `schedule_push.sql`.

To export the live definitions yourself (Supabase SQL Editor):

    select pg_get_functiondef(p.oid) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' order by p.proname;
