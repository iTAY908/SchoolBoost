-- =====================================================================
-- CubeFinance — accounts that live on the server (v3, prefix cf3_)
--
-- What this adds:
--   * one copy of each account's data on the server, so uninstalling the
--     app, reinstalling it, or signing in on another phone brings it all back;
--   * at most 2 devices per account;
--   * purchases recorded per account, so they follow the account to the
--     second device — and are burned for good when the account is deleted.
--
-- Who may do what:
--   * The email code is sent and checked ONLY by the Edge Function `cf-auth`
--     (service role). It is the only way to get a session, so typing someone
--     else's email gets nobody in: the code goes to that inbox.
--   * The app (a signed-in user) reaches its own account through the cf3_*
--     functions below, and only from a device registered to that account.
--   * Every table is locked (RLS on, no policies, no grants).
--
-- Self-contained: runs on an empty project and next to shared_savings*.sql.
-- Safe to run more than once.
-- =====================================================================

-- ------------------------------------------------------------- tables ---
create table if not exists public.cf_codes (
  email      text primary key check (email = lower(trim(email))),
  code_hash  text not null,
  salt       text not null,
  expires_at timestamptz not null,
  attempts   int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.cf_code_sends (
  id    bigserial primary key,
  email text not null,
  ip    text,
  at    timestamptz not null default now()
);
create index if not exists cf_code_sends_email on public.cf_code_sends (email, at);
create index if not exists cf_code_sends_ip on public.cf_code_sends (ip, at);

create table if not exists public.cf_accounts (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  email          text not null unique check (email = lower(trim(email))),
  data           jsonb,
  version        bigint not null default 0,
  updated_at     timestamptz,
  updated_device text,
  created_at     timestamptz not null default now()
);

create table if not exists public.cf_account_devices (
  user_id    uuid not null references auth.users (id) on delete cascade,
  device_id  text not null check (length(device_id) between 8 and 128),
  name       text,
  platform   text,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  primary key (user_id, device_id)
);

-- token_hash = SHA-256 of the Google Play purchase token (never the token).
create table if not exists public.cf_purchases (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id    uuid not null references auth.users (id) on delete cascade,
  product    text not null check (product in ('premium', 'book')),
  created_at timestamptz not null default now()
);
create index if not exists cf_purchases_user on public.cf_purchases (user_id);

-- Purchases of deleted accounts. Holds no personal data — only the hash —
-- and makes sure a deleted purchase never unlocks anything again.
create table if not exists public.cf_burned_purchases (
  token_hash text primary key,
  product    text,
  burned_at  timestamptz not null default now()
);

-- Complimentary access (filled by hand in the SQL Editor; empty by default).
create table if not exists public.cf_complimentary (
  email      text primary key check (email = lower(trim(email))),
  note       text,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['cf_codes', 'cf_code_sends', 'cf_accounts', 'cf_account_devices',
                           'cf_purchases', 'cf_burned_purchases', 'cf_complimentary'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on sequence public.cf_code_sends_id_seq from anon, authenticated;

-- ------------------------------------------------------------ helpers ---
-- How many devices one account may use, and when an unused one stops counting.
create or replace function public.cf3_max_devices() returns int language sql immutable as $$ select 2 $$;
create or replace function public.cf3_device_idle() returns interval language sql immutable as $$ select interval '90 days' $$;

-- The verified email of the session (the JWT) — nothing the app sends.
create or replace function public.cf3_email()
returns text language sql stable
set search_path = public
as $$
  select case
    when coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    then nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '')
  end;
$$;

-- The signed-in user, but only on a device registered to the account.
-- Touches last_seen. null = not signed in, or this device was removed.
create or replace function public.cf3_me(p_device text)
returns uuid language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or public.cf3_email() is null or p_device is null then return null; end if;
  update public.cf_account_devices set last_seen = now()
   where user_id = v_uid and device_id = p_device;
  if not found then return null; end if;
  return v_uid;
end;
$$;

create or replace function public.cf3_devices_json(p_uid uuid, p_current text)
returns json language sql stable security definer
set search_path = public
as $$
  select coalesce(json_agg(json_build_object(
           'id', d.device_id, 'name', d.name, 'platform', d.platform,
           'last_seen', d.last_seen, 'current', d.device_id = p_current)
           order by d.last_seen desc), '[]'::json)
    from public.cf_account_devices d
   where d.user_id = p_uid and d.last_seen > now() - public.cf3_device_idle();
$$;

-- =====================================================================
-- Edge Function only (service role): email codes and device slots
-- =====================================================================

-- Store a new code (hash + salt only). Limits: one code per 30 s and 6 per
-- hour for an address, 30 per hour from one IP.
create or replace function public.cf3_code_issue(p_email text, p_ip text, p_code_hash text, p_salt text)
returns json language plpgsql security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_last timestamptz;
  v_hour int;
  v_ip_hour int;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then return json_build_object('ok', false, 'error', 'bad_email'); end if;
  perform pg_advisory_xact_lock(hashtext('cf3_code:' || v_email));
  select max(at), count(*) filter (where at > now() - interval '1 hour')
    into v_last, v_hour
    from public.cf_code_sends where email = v_email and at > now() - interval '1 hour';
  if v_last is not null and v_last > now() - interval '30 seconds' then
    return json_build_object('ok', false, 'error', 'too_soon',
      'retry_after', ceil(extract(epoch from (v_last + interval '30 seconds' - now()))));
  end if;
  if v_hour >= 6 then return json_build_object('ok', false, 'error', 'rate_limited'); end if;
  if p_ip is not null then
    select count(*) into v_ip_hour from public.cf_code_sends where ip = p_ip and at > now() - interval '1 hour';
    if v_ip_hour >= 30 then return json_build_object('ok', false, 'error', 'rate_limited'); end if;
  end if;
  insert into public.cf_code_sends (email, ip) values (v_email, p_ip);
  insert into public.cf_codes (email, code_hash, salt, expires_at, attempts)
  values (v_email, p_code_hash, p_salt, now() + interval '10 minutes', 0)
  on conflict (email) do update
    set code_hash = excluded.code_hash, salt = excluded.salt,
        expires_at = excluded.expires_at, attempts = 0, created_at = now();
  delete from public.cf_code_sends where at < now() - interval '1 day';
  return json_build_object('ok', true);
end;
$$;

-- The email could not be sent: forget the code, and let the user retry at once.
create or replace function public.cf3_code_cancel(p_email text)
returns void language sql security definer
set search_path = public
as $$
  delete from public.cf_codes where email = lower(trim(p_email));
  delete from public.cf_code_sends
   where id = (select max(id) from public.cf_code_sends where email = lower(trim(p_email)));
$$;

-- Check a code. 5 wrong tries end it. A right code is NOT used up here —
-- cf3_code_consume does that once the sign-in is complete — so a user who
-- has to free a device slot first does not need a new code.
create or replace function public.cf3_code_check(p_email text, p_code text)
returns json language plpgsql security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  r public.cf_codes;
begin
  select * into r from public.cf_codes where email = v_email for update;
  if not found then return json_build_object('ok', false, 'error', 'no_code'); end if;
  if r.expires_at < now() then return json_build_object('ok', false, 'error', 'expired'); end if;
  if r.attempts >= 5 then return json_build_object('ok', false, 'error', 'too_many_attempts'); end if;
  if encode(sha256(convert_to(r.salt || coalesce(p_code, ''), 'UTF8')), 'hex') <> r.code_hash then
    update public.cf_codes set attempts = attempts + 1 where email = v_email;
    return json_build_object('ok', false, 'error', 'bad_code', 'attempts_left', greatest(0, 4 - r.attempts));
  end if;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.cf3_code_consume(p_email text)
returns void language sql security definer
set search_path = public
as $$ delete from public.cf_codes where email = lower(trim(p_email)); $$;

-- Give this device one of the account's 2 slots. A device already on the
-- account just signs in again. p_replace frees a slot first (the user chose
-- which device to sign out). Devices unused for 90 days stop counting.
create or replace function public.cf3_claim_device(p_uid uuid, p_email text, p_device text, p_name text,
                                                   p_platform text, p_replace text)
returns json language plpgsql security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_used int;
begin
  if p_uid is null or p_device is null or length(p_device) not between 8 and 128 then
    return json_build_object('ok', false, 'error', 'bad_device');
  end if;
  perform pg_advisory_xact_lock(hashtext('cf3_dev:' || p_uid::text));
  insert into public.cf_accounts (user_id, email) values (p_uid, v_email)
  on conflict (user_id) do update set email = excluded.email;

  delete from public.cf_account_devices
   where user_id = p_uid and last_seen < now() - public.cf3_device_idle();
  if p_replace is not null and p_replace <> p_device then
    delete from public.cf_account_devices where user_id = p_uid and device_id = p_replace;
  end if;

  if not exists (select 1 from public.cf_account_devices where user_id = p_uid and device_id = p_device) then
    select count(*) into v_used from public.cf_account_devices where user_id = p_uid;
    if v_used >= public.cf3_max_devices() then
      return json_build_object('ok', false, 'error', 'device_limit',
        'max', public.cf3_max_devices(), 'devices', public.cf3_devices_json(p_uid, p_device));
    end if;
    insert into public.cf_account_devices (user_id, device_id, name, platform)
    values (p_uid, p_device, left(p_name, 80), left(p_platform, 20));
  else
    update public.cf_account_devices
       set last_seen = now(), name = coalesce(left(p_name, 80), name), platform = coalesce(left(p_platform, 20), platform)
     where user_id = p_uid and device_id = p_device;
  end if;
  return json_build_object('ok', true,
    'existing', exists (select 1 from public.cf_accounts where user_id = p_uid and data is not null));
end;
$$;

-- =====================================================================
-- The app (a signed-in user, from a registered device)
-- =====================================================================

-- Everything this account has: its data, its purchases, its devices.
create or replace function public.cf3_pull(p_device text)
returns json language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := public.cf3_me(p_device);
  a public.cf_accounts;
begin
  if v_uid is null then return json_build_object('ok', false, 'error', 'device_removed'); end if;
  select * into a from public.cf_accounts where user_id = v_uid;
  return json_build_object('ok', true, 'email', public.cf3_email(),
    'data', a.data, 'version', coalesce(a.version, 0), 'updated_at', a.updated_at,
    'purchases', coalesce((select json_agg(distinct product) from public.cf_purchases where user_id = v_uid), '[]'::json),
    'devices', public.cf3_devices_json(v_uid, p_device));
end;
$$;

-- Save the account's data. p_base = the version this device last saw.
-- Someone else saved in between → 'conflict' with the newer copy, unless
-- p_force (the device decided its copy is the newer one).
create or replace function public.cf3_push(p_device text, p_data jsonb, p_base bigint, p_force boolean default false)
returns json language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := public.cf3_me(p_device);
  a public.cf_accounts;
begin
  if v_uid is null then return json_build_object('ok', false, 'error', 'device_removed'); end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then return json_build_object('ok', false, 'error', 'bad_data'); end if;
  if octet_length(p_data::text) > 2000000 then return json_build_object('ok', false, 'error', 'too_large'); end if;
  select * into a from public.cf_accounts where user_id = v_uid for update;
  if not found then
    insert into public.cf_accounts (user_id, email) values (v_uid, public.cf3_email())
    returning * into a;
  end if;
  if not coalesce(p_force, false) and coalesce(p_base, -1) <> a.version then
    return json_build_object('ok', false, 'error', 'conflict',
      'data', a.data, 'version', a.version, 'updated_at', a.updated_at);
  end if;
  update public.cf_accounts
     set data = p_data, version = a.version + 1, updated_at = now(), updated_device = p_device
   where user_id = v_uid
  returning * into a;
  return json_build_object('ok', true, 'version', a.version, 'updated_at', a.updated_at);
end;
$$;

-- Record a Google Play purchase for this account (the app sends the SHA-256
-- of the purchase token). valid=false: it belonged to a deleted account
-- ('burned') or is already recorded for another account ('other_account').
create or replace function public.cf3_claim_purchase(p_device text, p_product text, p_token_hash text)
returns json language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := public.cf3_me(p_device);
  v_owner uuid;
begin
  if v_uid is null then return json_build_object('ok', false, 'error', 'device_removed'); end if;
  if p_product not in ('premium', 'book') or coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' then
    return json_build_object('ok', false, 'error', 'bad_input');
  end if;
  if exists (select 1 from public.cf_burned_purchases where token_hash = p_token_hash) then
    return json_build_object('ok', true, 'valid', false, 'state', 'burned');
  end if;
  insert into public.cf_purchases (token_hash, user_id, product) values (p_token_hash, v_uid, p_product)
  on conflict (token_hash) do nothing;
  select user_id into v_owner from public.cf_purchases where token_hash = p_token_hash;
  if v_owner <> v_uid then return json_build_object('ok', true, 'valid', false, 'state', 'other_account'); end if;
  return json_build_object('ok', true, 'valid', true, 'state', 'claimed');
end;
$$;

-- This account's devices / sign one out (it is asked to sign in again).
create or replace function public.cf3_devices(p_device text)
returns json language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := public.cf3_me(p_device);
begin
  if v_uid is null then return json_build_object('ok', false, 'error', 'device_removed'); end if;
  return json_build_object('ok', true, 'max', public.cf3_max_devices(), 'devices', public.cf3_devices_json(v_uid, p_device));
end;
$$;

create or replace function public.cf3_remove_device(p_device text, p_target text)
returns json language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := public.cf3_me(p_device);
begin
  if v_uid is null then return json_build_object('ok', false, 'error', 'device_removed'); end if;
  delete from public.cf_account_devices where user_id = v_uid and device_id = p_target;
  return json_build_object('ok', true);
end;
$$;

-- "Log out" frees this device's slot. The data stays on the server.
create or replace function public.cf3_sign_out(p_device text)
returns json language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return json_build_object('ok', false, 'error', 'not_signed_in'); end if;
  delete from public.cf_account_devices where user_id = auth.uid() and device_id = p_device;
  return json_build_object('ok', true);
end;
$$;

-- "Delete account": everything goes — data, devices, purchases, the sign-in
-- itself. Purchases are burned first so they can never unlock anything
-- again, even for a new account with the same email.
create or replace function public.cf3_delete_account(p_device text)
returns json language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := public.cf3_me(p_device);
  v_email text := public.cf3_email();
begin
  if v_uid is null then return json_build_object('ok', false, 'error', 'device_removed'); end if;
  insert into public.cf_burned_purchases (token_hash, product)
  select token_hash, product from public.cf_purchases where user_id = v_uid
  on conflict (token_hash) do nothing;
  delete from public.cf_purchases where user_id = v_uid;
  delete from public.cf_account_devices where user_id = v_uid;
  delete from public.cf_accounts where user_id = v_uid;
  delete from public.cf_codes where email = v_email;
  delete from public.cf_code_sends where email = v_email;
  delete from auth.users where id = v_uid;
  return json_build_object('ok', true);
end;
$$;

-- What the signed-in account gets beyond what Google Play reports on THIS
-- phone: complimentary access, or AI Premium bought on another device.
-- Same name and answer shape as v2, so the Android app reads it unchanged.
create or replace function public.cf2_my_entitlements()
returns json language plpgsql stable security definer
set search_path = public
as $$
declare v_email text := public.cf3_email();
begin
  if v_email is null then return json_build_object('ok', false, 'error', 'not_signed_in'); end if;
  return json_build_object('ok', true, 'email', v_email,
    'complimentary',
       exists (select 1 from public.cf_complimentary where email = v_email)
    or exists (select 1 from public.cf_purchases where user_id = auth.uid() and product = 'premium'),
    'purchases', coalesce((select json_agg(distinct product) from public.cf_purchases where user_id = auth.uid()), '[]'::json));
end;
$$;

-- -------------------------------------------------------- permissions ---
do $$
declare f text;
begin
  foreach f in array array[
    'cf3_max_devices()', 'cf3_device_idle()', 'cf3_email()', 'cf3_me(text)', 'cf3_devices_json(uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'cf3_code_issue(text, text, text, text)', 'cf3_code_cancel(text)', 'cf3_code_check(text, text)',
    'cf3_code_consume(text)', 'cf3_claim_device(uuid, text, text, text, text, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  foreach f in array array[
    'cf3_pull(text)', 'cf3_push(text, jsonb, bigint, boolean)', 'cf3_claim_purchase(text, text, text)',
    'cf3_devices(text)', 'cf3_remove_device(text, text)', 'cf3_sign_out(text)', 'cf3_delete_account(text)',
    'cf2_my_entitlements()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
