-- Complimentary (creator) access: every paid feature — AI chat, guide books,
-- Premium tools — and no ads, without a Google Play purchase.
-- Run in the Supabase SQL Editor after shared_savings_v2.sql. Safe to re-run.
-- The app learns about this only for the signed-in, email-verified account
-- (cf2_my_entitlements); the list itself is never readable from the app.
insert into public.cf_complimentary (email, note)
values ('itayleiss2010@gmail.com', 'creator')
on conflict (email) do nothing;

-- To remove someone later:
--   delete from public.cf_complimentary where email = '...';
