-- ============================================================================
-- Runs the cf-push Edge Function every minute (the retry net behind the
-- immediate kick in shared_savings_v2.sql). Run once AFTER:
--   1. deploying the function:   supabase functions deploy cf-push --no-verify-jwt
--   2. setting its secrets:      supabase secrets set CF_PUSH_SECRET=<random> FCM_SERVICE_ACCOUNT="$(cat sa.json)"
--   3. storing the same values in Vault (Dashboard → Project Settings → Vault, or SQL):
--        select vault.create_secret('https://sfrkenhauekqdijtunpg.supabase.co/functions/v1/cf-push', 'cf_push_url');
--        select vault.create_secret('<the same random CF_PUSH_SECRET>', 'cf_push_secret');
-- No secret is written in this file.
-- ============================================================================
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule('cf-push-retry', '* * * * *', $job$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'cf_push_url'),
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cf-push-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cf_push_secret')),
    body    := '{}'::jsonb)
  where exists (select 1 from public.cf_push_outbox where sent_at is null and attempts < 6 and next_at <= now());
$job$);
