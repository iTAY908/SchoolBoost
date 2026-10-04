-- ============================================================================
-- CubeFinance — shared savings v2 (run AFTER shared_savings.sql). Safe to re-run.
--
-- What v2 changes, and why
--   * Identity: a Supabase Auth user (email code sent by Supabase itself),
--     not a random device token, so the same account works from any device,
--     after a reinstall or after logout. A profile belongs to an Auth user id
--     (cf_profiles.auth_user_id) and is created by a trigger the moment a
--     sign-up is confirmed; cf2_backfill_profiles covers accounts that existed
--     before. A v1 profile (unverified email + device token) joins an account
--     only with BOTH its device token and the same verified email — accounts
--     are never merged on an email match alone.
--   * People search (cf2_search_users): name / @handle / exact email, public
--     fields only, never an email, opt-out per person, rate-limited and paged.
--   * One ledger per goal (cf_ledger), in agorot (bigint minor units). The
--     balance everyone sees is the sum of its confirmed rows. Every write
--     carries an idempotency key, so retries and double taps never count twice.
--   * Nothing in this app moves real money: every contribution is a RECORD
--     the member made (status 'confirmed' = recorded). The status column and
--     the pending/failed values are there for a future payment provider; no
--     function here ever creates a pending or failed row.
--   * Joining is one atomic step and idempotent: a retry after a lost
--     response returns the same membership instead of "invalid code".
--   * A persistent notification inbox (cf_notifications) plus a push outbox
--     (cf_push_outbox) drained by the cf-push Edge Function over FCM.
--   * No goal can be deleted by one person. Deletion = a request that every
--     current member approves; any change to members or money voids it.
--     Deleted goals are hidden, not erased: their ledger stays for the record.
--   * No expiry: nothing here deletes goals, members or ledger rows on a
--     timer. Only invite codes expire (10 minutes) — and that never touches
--     a goal or a membership.
-- ============================================================================

-- ---------------------------------------------------------------- schema ----
-- Profiles belong to a Supabase Auth user (auth_user_id), never to an email
-- string. v1 created profiles from an UNVERIFIED email and a device token;
-- such a profile is linked to an Auth user only when that user also presents
-- the v1 device token (cf2_register p_legacy_token) — two accounts are never
-- merged just because they show the same address.
alter table public.cf_profiles add column if not exists auth_user_id uuid;
create unique index if not exists cf_profiles_auth_user on public.cf_profiles (auth_user_id) where auth_user_id is not null;
alter table public.cf_profiles drop constraint if exists cf_profiles_email_key;
create index if not exists cf_profiles_email_lower on public.cf_profiles (lower(email));
alter table public.cf_profiles add column if not exists username text;
create unique index if not exists cf_profiles_username on public.cf_profiles (lower(username)) where username is not null;
alter table public.cf_profiles add column if not exists name_set boolean not null default false;   -- a name the person chose
alter table public.cf_profiles add column if not exists discoverable boolean not null default true; -- shows up in search
alter table public.cf_profiles add column if not exists deactivated_at timestamptz;                  -- account deleted in the app
-- v1 filled an empty name with the part of the email before "@". That is not
-- a name anyone chose, and showing it would leak the address: treat as unset.
update public.cf_profiles set name_set = true
 where not name_set and display_name <> '' and lower(display_name) <> lower(split_part(email, '@', 1));

alter table public.cf_goals   add column if not exists target_minor bigint;
alter table public.cf_goals   add column if not exists currency text not null default 'ILS';
alter table public.cf_goals   add column if not exists status text not null default 'active';
alter table public.cf_goals   add column if not exists deleted_at timestamptz;
alter table public.cf_goals   add column if not exists version bigint not null default 0;
alter table public.cf_goals   add column if not exists create_key text;
update public.cf_goals set target_minor = round(target * 100) where target_minor is null;
do $$ begin
  alter table public.cf_goals add constraint cf_goals_status_chk check (status in ('active', 'deleted'));
exception when duplicate_object then null; end $$;
create unique index if not exists cf_goals_create_key on public.cf_goals (owner_id, create_key) where create_key is not null;

-- v1 deleted a goal (and, by cascade, every membership) when its owner's
-- profile was deleted. A goal belongs to all its members: refuse instead.
alter table public.cf_goals drop constraint if exists cf_goals_owner_id_fkey;
alter table public.cf_goals add constraint cf_goals_owner_id_fkey
  foreign key (owner_id) references public.cf_profiles(id) on delete restrict;

alter table public.cf_invites add column if not exists used_by uuid references public.cf_profiles(id);
-- An invitation sent to a user found in search: only that account can use it.
alter table public.cf_invites add column if not exists invitee_profile uuid references public.cf_profiles(id);

create table if not exists public.cf_ledger (
  id           uuid primary key default gen_random_uuid(),
  seq          bigserial unique,
  goal_id      uuid not null references public.cf_goals(id) on delete restrict,
  profile_id   uuid not null references public.cf_profiles(id) on delete restrict,
  kind         text not null check (kind in ('opening', 'deposit', 'recurring', 'reversal')),
  amount_minor bigint not null check (amount_minor <> 0 and abs(amount_minor) <= 100000000000),
  currency     text not null default 'ILS',
  status       text not null default 'confirmed' check (status in ('confirmed', 'pending', 'failed')),
  idem_key     text not null check (char_length(idem_key) between 8 and 120),
  period       text,                              -- 'YYYY-MM' for recurring rows
  reverses     uuid references public.cf_ledger(id) on delete restrict,
  created_at   timestamptz not null default now(),
  unique (profile_id, idem_key)
);
create index if not exists cf_ledger_goal on public.cf_ledger (goal_id, seq);
create unique index if not exists cf_ledger_one_reversal on public.cf_ledger (reverses) where reverses is not null;

create table if not exists public.cf_recurring (
  goal_id    uuid not null references public.cf_goals(id) on delete restrict,
  profile_id uuid not null references public.cf_profiles(id) on delete restrict,
  mode       text not null check (mode in ('fixed', 'percent')),
  value      bigint not null check (value > 0),   -- fixed: agorot · percent: basis points (1% = 100)
  consent_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (goal_id, profile_id)
);

create table if not exists public.cf_deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  goal_id      uuid not null references public.cf_goals(id) on delete restrict,
  requested_by uuid not null references public.cf_profiles(id) on delete restrict,
  status       text not null default 'open'
               check (status in ('open', 'rejected', 'cancelled', 'invalidated', 'completed')),
  goal_version bigint not null,                   -- members/money as they were when asked
  created_at   timestamptz not null default now(),
  closed_at    timestamptz
);
create unique index if not exists cf_deletion_one_open on public.cf_deletion_requests (goal_id) where status = 'open';

create table if not exists public.cf_deletion_votes (
  request_id uuid not null references public.cf_deletion_requests(id) on delete restrict,
  profile_id uuid not null references public.cf_profiles(id) on delete restrict,
  vote       text not null check (vote in ('approve', 'reject')),
  at         timestamptz not null default now(),
  primary key (request_id, profile_id)
);

create table if not exists public.cf_notifications (
  id           uuid primary key default gen_random_uuid(),
  seq          bigserial unique,
  profile_id   uuid not null references public.cf_profiles(id) on delete restrict,
  goal_id      uuid not null references public.cf_goals(id) on delete restrict,
  kind         text not null,
  actor_id     uuid references public.cf_profiles(id) on delete restrict,
  actor_name   text not null default '',
  goal_name    text not null default '',
  amount_minor bigint,
  request_id   uuid,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
alter table public.cf_notifications add column if not exists invite_code text;   -- kind 'invited'
create index if not exists cf_notifications_me on public.cf_notifications (profile_id, seq);

create table if not exists public.cf_devices (
  install_id text primary key check (char_length(install_id) between 8 and 64),
  profile_id uuid not null references public.cf_profiles(id) on delete cascade,
  fcm_token  text not null unique check (char_length(fcm_token) between 20 and 4096),
  updated_at timestamptz not null default now()
);

create table if not exists public.cf_push_outbox (
  notification_id uuid primary key references public.cf_notifications(id) on delete cascade,
  profile_id      uuid not null references public.cf_profiles(id) on delete cascade,
  attempts        int not null default 0,
  next_at         timestamptz not null default now(),
  sent_at         timestamptz,
  last_error      text
);
create index if not exists cf_push_due on public.cf_push_outbox (next_at) where sent_at is null;

alter table public.cf_ledger            enable row level security;
alter table public.cf_recurring         enable row level security;
alter table public.cf_deletion_requests enable row level security;
alter table public.cf_deletion_votes    enable row level security;
alter table public.cf_notifications     enable row level security;
alter table public.cf_devices           enable row level security;
alter table public.cf_push_outbox       enable row level security;
revoke all on public.cf_ledger, public.cf_recurring, public.cf_deletion_requests, public.cf_deletion_votes,
              public.cf_notifications, public.cf_devices, public.cf_push_outbox from anon, authenticated;

-- Balances that were kept in cf_members.amount (v1) become opening ledger rows, once.
insert into public.cf_ledger (goal_id, profile_id, kind, amount_minor, idem_key)
select m.goal_id, m.profile_id, 'opening', round(m.amount * 100), 'opening:v2:' || m.goal_id
  from public.cf_members m
 where m.amount > 0
on conflict (profile_id, idem_key) do nothing;

-- --------------------------------------------------------------- helpers ----
-- The caller, from the Supabase Auth JWT: a signed-in, email-verified user.
create or replace function public.cf2_email()
returns text language sql stable
set search_path = public, extensions
as $$
  select case
    when coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    then nullif(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), '')
  end;
$$;

-- The signed-in Auth user's id (only for a verified, non-anonymous session).
create or replace function public.cf2_uid()
returns uuid language sql stable
set search_path = public, extensions
as $$
  select case when public.cf2_email() is not null then nullif(auth.jwt() ->> 'sub', '')::uuid end;
$$;

-- The caller's profile: the one linked to their Auth user — never "a profile
-- with the same email".
create or replace function public.cf2_me()
returns uuid language sql stable security definer
set search_path = public, extensions
as $$
  select id from public.cf_profiles
   where auth_user_id = public.cf2_uid() and auth_user_id is not null and deactivated_at is null;
$$;

-- A fresh handle like "user3f9a1c": unique, and never derived from the email.
create or replace function public.cf2_new_username()
returns text language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare v text;
begin
  loop
    v := 'user' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6);
    exit when not exists (select 1 from public.cf_profiles where lower(username) = v);
  end loop;
  return v;
end;
$$;
update public.cf_profiles set username = public.cf2_new_username() where username is null;

-- Can this profile be found and invited? Linked to a live Auth user, not
-- deleted in the app, not hidden by its owner, and not banned/deleted in Auth.
create or replace function public.cf2_eligible(p public.cf_profiles)
returns boolean language sql stable security definer
set search_path = public, extensions
as $$
  select p.auth_user_id is not null and p.deactivated_at is null and p.discoverable
     and exists (select 1 from auth.users u
                  where u.id = p.auth_user_id and u.deleted_at is null
                    and (u.banned_until is null or u.banned_until < now())
                    and coalesce(u.is_anonymous, false) = false);
$$;

-- Profile for an Auth user — used by sign-up (trigger), sign-in (cf2_register)
-- and the backfill alike. Idempotent: an existing profile is returned as is.
create or replace function public.cf2_ensure_profile(p_uid uuid, p_email text, p_name text)
returns uuid language plpgsql security definer
set search_path = public, extensions
as $$
declare v_id uuid; v_name text := left(trim(coalesce(p_name, '')), 40);
begin
  select id into v_id from public.cf_profiles where auth_user_id = p_uid;
  if v_id is not null then return v_id; end if;
  insert into public.cf_profiles (auth_user_id, email, display_name, name_set, username, token_hash)
  values (p_uid, lower(trim(p_email)), v_name, v_name <> '', public.cf2_new_username(),
          'auth:' || encode(extensions.gen_random_bytes(32), 'hex'))   -- v1's device-token column: unusable placeholder
  on conflict (auth_user_id) where auth_user_id is not null do nothing
  returning id into v_id;
  if v_id is null then select id into v_id from public.cf_profiles where auth_user_id = p_uid; end if;
  return v_id;
end;
$$;

-- Every confirmed sign-up gets a searchable profile on the server, even if
-- the app is closed before it gets to call cf2_register.
create or replace function public.cf2_on_auth_user()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if new.email is not null and new.email_confirmed_at is not null and new.deleted_at is null
     and coalesce(new.is_anonymous, false) = false then
    perform public.cf2_ensure_profile(new.id, new.email,
      coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', ''));
  end if;
  return new;
end;
$$;
drop trigger if exists cf2_auth_user_profile on auth.users;
create trigger cf2_auth_user_profile after insert or update of email_confirmed_at on auth.users
  for each row execute function public.cf2_on_auth_user();

-- Backfill for accounts that existed in Auth before profiles were created
-- automatically. Run in the SQL Editor (or with the service role):
--   select public.cf2_backfill_profiles(true);    -- dry run: counts only
--   select public.cf2_backfill_profiles(false);   -- create the missing profiles
-- Idempotent; never touches an existing profile; never links by email.
create or replace function public.cf2_backfill_profiles(p_dry_run boolean default true)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare r record; v_created int := 0;
  v json;
begin
  select json_build_object(
    'auth_users',            count(*),
    'eligible',              count(*) filter (where ok),
    'already_have_profile',  count(*) filter (where ok and has_profile),
    'missing_profile',       count(*) filter (where ok and not has_profile),
    'excluded_unconfirmed',  count(*) filter (where u_email is not null and confirmed is null),
    'excluded_deleted',      count(*) filter (where deleted is not null),
    'excluded_banned',       count(*) filter (where banned),
    'excluded_anonymous',    count(*) filter (where anon),
    'excluded_no_email',     count(*) filter (where u_email is null))
  into v
  from (select u.email as u_email, u.email_confirmed_at as confirmed, u.deleted_at as deleted,
               (u.banned_until is not null and u.banned_until >= now()) as banned,
               coalesce(u.is_anonymous, false) as anon,
               exists (select 1 from public.cf_profiles p where p.auth_user_id = u.id) as has_profile,
               (u.email is not null and u.email_confirmed_at is not null and u.deleted_at is null
                and (u.banned_until is null or u.banned_until < now()) and not coalesce(u.is_anonymous, false)) as ok
          from auth.users u) s;
  if not p_dry_run then
    for r in select u.* from auth.users u
              where u.email is not null and u.email_confirmed_at is not null and u.deleted_at is null
                and (u.banned_until is null or u.banned_until < now()) and not coalesce(u.is_anonymous, false)
                and not exists (select 1 from public.cf_profiles p where p.auth_user_id = u.id) loop
      perform public.cf2_ensure_profile(r.id, r.email,
        coalesce(r.raw_user_meta_data ->> 'display_name', r.raw_user_meta_data ->> 'full_name', ''));
      v_created := v_created + 1;
    end loop;
  end if;
  return (v::jsonb || jsonb_build_object('dry_run', p_dry_run, 'created', v_created))::json;
end;
$$;

create or replace function public.cf2_is_member(p_goal uuid, p_me uuid)
returns boolean language sql stable security definer
set search_path = public, extensions
as $$
  select exists (select 1 from public.cf_members m join public.cf_goals g on g.id = m.goal_id
                  where m.goal_id = p_goal and m.profile_id = p_me and g.status = 'active');
$$;

-- What other people see: the chosen name, else the @handle — never the email.
create or replace function public.cf2_name(p_id uuid)
returns text language sql stable security definer
set search_path = public, extensions
as $$
  select case when name_set and display_name <> '' then display_name else '@' || coalesce(username, 'user') end
    from public.cf_profiles where id = p_id;
$$;

-- The identity a push message is addressed to on the phone: the same
-- SHA-256 the app computes (EntitlementManager.accountKey). The device
-- drops a push whose key is not the account signed in on it.
create or replace function public.cf2_account_key(p_id uuid)
returns text language sql stable security definer
set search_path = public, extensions
as $$
  select encode(extensions.digest('cubefinance:' || email, 'sha256'), 'hex')
    from public.cf_profiles where id = p_id;
$$;

-- In-app notification (durable) + its push (best effort, retried).
create or replace function public.cf2_notify(p_to uuid, p_goal uuid, p_kind text, p_actor uuid,
                                             p_amount bigint default null, p_request uuid default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare v_id uuid;
begin
  insert into public.cf_notifications (profile_id, goal_id, kind, actor_id, actor_name, goal_name, amount_minor, request_id)
  values (p_to, p_goal, p_kind, p_actor, coalesce(public.cf2_name(p_actor), ''),
          (select name from public.cf_goals where id = p_goal), p_amount, p_request)
  returning id into v_id;
  insert into public.cf_push_outbox (notification_id, profile_id) values (v_id, p_to);
end;
$$;

create or replace function public.cf2_notify_others(p_goal uuid, p_kind text, p_actor uuid,
                                                    p_amount bigint default null, p_request uuid default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare r record;
begin
  for r in select profile_id from public.cf_members where goal_id = p_goal and profile_id <> p_actor loop
    perform public.cf2_notify(r.profile_id, p_goal, p_kind, p_actor, p_amount, p_request);
  end loop;
end;
$$;

-- Any change to the members or the money of a goal bumps its version; an
-- open deletion request was approved against an older version is void.
create or replace function public.cf2_touch(p_goal uuid)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare v_req public.cf_deletion_requests;
begin
  update public.cf_goals set version = version + 1 where id = p_goal;
  select * into v_req from public.cf_deletion_requests where goal_id = p_goal and status = 'open';
  if found then
    update public.cf_deletion_requests set status = 'invalidated', closed_at = now() where id = v_req.id;
    perform public.cf2_notify(m.profile_id, p_goal, 'deletion_invalidated', null, null, v_req.id)
       from public.cf_members m where m.goal_id = p_goal;
  end if;
end;
$$;

-- ------------------------------------------------------------ register -----
-- Untouched = nothing anywhere refers to it (a profile the sign-up trigger
-- made a moment ago). Only such a profile may be replaced by a proven v1 one.
create or replace function public.cf2_profile_unused(p_id uuid)
returns boolean language sql stable security definer
set search_path = public, extensions
as $$
  select not exists (select 1 from public.cf_members where profile_id = p_id)
     and not exists (select 1 from public.cf_goals where owner_id = p_id)
     and not exists (select 1 from public.cf_ledger where profile_id = p_id)
     and not exists (select 1 from public.cf_notifications where profile_id = p_id or actor_id = p_id)
     and not exists (select 1 from public.cf_invites where inviter_id = p_id or used_by = p_id or invitee_profile = p_id)
     and not exists (select 1 from public.cf_deletion_requests where requested_by = p_id)
     and not exists (select 1 from public.cf_deletion_votes where profile_id = p_id)
     and not exists (select 1 from public.cf_recurring where profile_id = p_id);
$$;

drop function if exists public.cf2_register(text);   -- the earlier one-argument version
create or replace function public.cf2_register(p_name text, p_legacy_token text default null)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_uid   uuid := public.cf2_uid();
  v_email text := public.cf2_email();
  v_id    uuid;
  v_legacy uuid;
  v_created boolean := false;
  v_linked boolean := false;
  v_conflict boolean := false;
  v_p public.cf_profiles;
begin
  if v_uid is null then return json_build_object('ok', false, 'error', 'not_signed_in'); end if;
  select id into v_id from public.cf_profiles where auth_user_id = v_uid;
  if p_legacy_token is not null and char_length(p_legacy_token) >= 32 then
    -- A v1 profile is taken over only with BOTH proofs: its device token
    -- (held by the app account that created it) and the same, now verified, email.
    select id into v_legacy from public.cf_profiles
     where token_hash = encode(extensions.digest(p_legacy_token, 'sha256'), 'hex')
       and auth_user_id is null and lower(email) = v_email
     for update;
    if v_legacy is not null and v_id is not null then
      if public.cf2_profile_unused(v_id) then
        -- the empty profile made at sign-up gives way to the proven v1 one
        delete from public.cf_attempts where profile_id = v_id;
        delete from public.cf_devices where profile_id = v_id;
        delete from public.cf_profiles where id = v_id;
        v_id := null;
      else
        v_conflict := true;   -- both in use: kept apart, never merged
        v_legacy := null;
      end if;
    end if;
    if v_legacy is not null then
      update public.cf_profiles set auth_user_id = v_uid, email = v_email where id = v_legacy;
      v_id := v_legacy; v_linked := true;
    end if;
  end if;
  if v_id is null then
    v_id := public.cf2_ensure_profile(v_uid, v_email, '');
    v_created := true;
  end if;
  select * into v_p from public.cf_profiles where id = v_id;
  if v_p.deactivated_at is not null then return json_build_object('ok', false, 'error', 'deactivated'); end if;
  -- A name sent by the app is the person's own (the app never sends the email).
  update public.cf_profiles
     set last_seen = now(), email = v_email,
         display_name = case when not name_set and left(trim(coalesce(p_name, '')), 40) <> ''
                             then left(trim(p_name), 40) else display_name end,
         name_set = name_set or left(trim(coalesce(p_name, '')), 40) <> ''
   where id = v_id
  returning * into v_p;
  return json_build_object('ok', true, 'created', v_created, 'linked_legacy', v_linked, 'legacy_conflict', v_conflict,
    'account_key', public.cf2_account_key(v_id),
    'profile', json_build_object('display_name', case when v_p.name_set then v_p.display_name end,
                                 'username', v_p.username, 'discoverable', v_p.discoverable));
end;
$$;

-- The person's own public profile: name, @handle, and whether they can be found.
create or replace function public.cf2_update_profile(p_display_name text, p_username text, p_discoverable boolean)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare v_me uuid := public.cf2_me(); v_name text; v_user text; v_p public.cf_profiles;
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  if p_display_name is not null then
    v_name := left(regexp_replace(trim(p_display_name), '\s+', ' ', 'g'), 40);
    if v_name = '' or position('@' in v_name) > 0 then return json_build_object('ok', false, 'error', 'bad_name'); end if;
    update public.cf_profiles set display_name = v_name, name_set = true where id = v_me;
  end if;
  if p_username is not null then
    v_user := lower(trim(p_username));
    if v_user !~ '^[a-z0-9_.]{3,20}$' then return json_build_object('ok', false, 'error', 'bad_username'); end if;
    if exists (select 1 from public.cf_profiles where lower(username) = v_user and id <> v_me) then
      return json_build_object('ok', false, 'error', 'username_taken');
    end if;
    update public.cf_profiles set username = v_user where id = v_me;
  end if;
  if p_discoverable is not null then update public.cf_profiles set discoverable = p_discoverable where id = v_me; end if;
  select * into v_p from public.cf_profiles where id = v_me;
  return json_build_object('ok', true, 'profile', json_build_object(
    'display_name', case when v_p.name_set then v_p.display_name end, 'username', v_p.username, 'discoverable', v_p.discoverable));
end;
$$;

-- Account deleted in the app: no longer findable or invitable, no pushes.
-- Shared records stay — they belong to every member of those goals.
create or replace function public.cf2_deactivate_profile()
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare v_me uuid := public.cf2_me();
begin
  if v_me is null then return json_build_object('ok', true, 'none', true); end if;
  update public.cf_profiles set deactivated_at = now(), discoverable = false where id = v_me;
  delete from public.cf_devices where profile_id = v_me;
  delete from public.cf_recurring where profile_id = v_me;
  return json_build_object('ok', true);
end;
$$;

-- --------------------------------------------------------------- search ----
-- Find people to invite: by name or @handle (2+ characters), or by an exact
-- email address. Public fields only — never an email — at most 20 a page and
-- 100 in total, rate-limited, eligible profiles only (cf2_eligible). There is
-- no presence data, so nothing here claims anyone is "online".
create or replace function public.cf2_search_match(p public.cf_profiles, p_q text, p_like text)
returns boolean language sql stable security definer
set search_path = public, extensions
as $$
  select case when position('@' in p_q) > 1 and position(' ' in p_q) = 0
              then lower(p.email) = p_q                                   -- an email: exact match only
              else lower(p.username) like ltrim(p_like, '@') || '%' escape '\'
                or (p.name_set and lower(p.display_name) like '%' || p_like || '%' escape '\') end;
$$;

create or replace function public.cf2_search_users(p_query text, p_goal uuid default null,
                                                   p_limit int default 20, p_offset int default 0)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := public.cf2_me();
  v_q text := lower(trim(coalesce(p_query, '')));
  v_like text;
  v_lim int := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_off int := least(greatest(coalesce(p_offset, 0), 0), 80);
  v_rows json;
  v_total int;
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  if p_goal is not null and not public.cf2_is_member(p_goal, v_me) then
    return json_build_object('ok', false, 'error', 'not_member');
  end if;
  if char_length(ltrim(v_q, '@')) < 2 then
    return json_build_object('ok', true, 'items', '[]'::json, 'has_more', false, 'too_short', true);
  end if;
  if (select count(*) from public.cf_attempts where profile_id = v_me and kind = 'search' and at > now() - interval '10 minutes') >= 120 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  insert into public.cf_attempts (profile_id, kind) values (v_me, 'search');
  v_like := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');

  select count(*) into v_total from (
    select 1 from public.cf_profiles p
     where p.id <> v_me and public.cf2_eligible(p) and public.cf2_search_match(p, v_q, v_like)
     limit 101) t;

  select json_agg(json_build_object(
           'profile_id', h.id,
           'display_name', case when h.name_set and h.display_name <> '' then h.display_name end,
           'username', h.username,
           'avatar_hue', abs(hashtext(h.id::text)) % 360,
           'member', p_goal is not null and exists (select 1 from public.cf_members m where m.goal_id = p_goal and m.profile_id = h.id),
           'invited', p_goal is not null and exists (select 1 from public.cf_invites i where i.goal_id = p_goal and i.invitee_profile = h.id
                                                       and i.used_at is null and i.expires_at > now()))
           order by h.rank, h.sortkey, h.id)
    into v_rows
    from (select p.*,
                 case when lower(p.username) = ltrim(v_q, '@') then 0
                      when lower(p.username) like ltrim(v_like, '@') || '%' escape '\' then 1 else 2 end as rank,
                 lower(coalesce(case when p.name_set then nullif(p.display_name, '') end, p.username)) as sortkey
            from public.cf_profiles p
           where p.id <> v_me and public.cf2_eligible(p) and public.cf2_search_match(p, v_q, v_like)
           order by rank, sortkey, p.id
           limit v_lim offset v_off) h;
  return json_build_object('ok', true, 'items', coalesce(v_rows, '[]'::json),
                           'has_more', v_total > v_off + v_lim and v_off + v_lim < 100);
end;
$$;

-- Exact-email lookup kept for older callers, now under the same privacy rules.
create or replace function public.cf2_search(p_email text)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare v json;
begin
  v := public.cf2_search_users(p_email, null, 1, 0);
  if (v ->> 'ok')::boolean is not true then return v; end if;
  if json_array_length(v -> 'items') = 0 then return json_build_object('ok', true, 'found', false); end if;
  return json_build_object('ok', true, 'found', true, 'self', false,
    'name', coalesce(v -> 'items' -> 0 ->> 'display_name', '@' || (v -> 'items' -> 0 ->> 'username')),
    'profile_id', v -> 'items' -> 0 ->> 'profile_id');
end;
$$;

-- Invite a user found in search. The code is bound to that account, the
-- invitee gets it in their inbox (+ push), and the same code is what the
-- inviter can also share by email or WhatsApp. Re-inviting while a code is
-- still valid returns that same code: one invitation, no spam.
create or replace function public.cf2_invite_user(p_goal uuid, p_profile uuid)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := public.cf2_me();
  v_target public.cf_profiles;
  v_inv public.cf_invites;
  v_code text;
  v_tries int := 0;
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  if not public.cf2_is_member(p_goal, v_me) then return json_build_object('ok', false, 'error', 'not_member'); end if;
  select * into v_target from public.cf_profiles where id = p_profile;
  if not found or not public.cf2_eligible(v_target) then return json_build_object('ok', false, 'error', 'no_such_user'); end if;
  if v_target.id = v_me then return json_build_object('ok', false, 'error', 'self'); end if;
  if exists (select 1 from public.cf_members where goal_id = p_goal and profile_id = p_profile) then
    return json_build_object('ok', false, 'error', 'already_member');
  end if;
  select * into v_inv from public.cf_invites
   where goal_id = p_goal and invitee_profile = p_profile and used_at is null and expires_at > now()
   order by created_at desc limit 1;
  if found then
    return json_build_object('ok', true, 'code', v_inv.code, 'existing', true, 'target_name', public.cf2_name(p_profile),
                             'expires_in', greatest(0, extract(epoch from v_inv.expires_at - now())::int));
  end if;
  if (select count(*) from public.cf_attempts where profile_id = v_me and kind = 'invite' and at > now() - interval '1 hour') >= 20 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  loop
    v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
    exit when not exists (select 1 from public.cf_invites where code = v_code);
    v_tries := v_tries + 1;
    if v_tries > 30 then return json_build_object('ok', false, 'error', 'busy'); end if;
  end loop;
  insert into public.cf_invites (code, goal_id, inviter_id, invitee_profile, expires_at)
  values (v_code, p_goal, v_me, p_profile, now() + interval '10 minutes');
  insert into public.cf_attempts (profile_id, kind) values (v_me, 'invite');
  perform public.cf2_notify(p_profile, p_goal, 'invited', v_me);
  update public.cf_notifications set invite_code = v_code
   where id = (select id from public.cf_notifications where profile_id = p_profile and kind = 'invited' order by seq desc limit 1);
  return json_build_object('ok', true, 'code', v_code, 'expires_in', 600, 'existing', false,
                           'target_name', public.cf2_name(p_profile));
end;
$$;

-- ----------------------------------------------------------- create goal ---
create or replace function public.cf2_create_goal(p_name text, p_target_minor bigint, p_key text)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := public.cf2_me();
  v_name text := left(trim(coalesce(p_name, '')), 60);
  v_goal uuid;
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  if v_name = '' or p_target_minor is null or p_target_minor <= 0 or p_target_minor > 1000000000 then
    return json_build_object('ok', false, 'error', 'bad_input');
  end if;
  if p_key is null or char_length(p_key) not between 8 and 100 then
    return json_build_object('ok', false, 'error', 'bad_input');
  end if;
  select id into v_goal from public.cf_goals where owner_id = v_me and create_key = p_key;
  if v_goal is not null then return json_build_object('ok', true, 'goal_id', v_goal, 'duplicate', true); end if;
  if (select count(*) from public.cf_goals where owner_id = v_me and status = 'active') >= 20 then
    return json_build_object('ok', false, 'error', 'too_many_goals');
  end if;
  begin
    insert into public.cf_goals (name, target, target_minor, owner_id, create_key)
    values (v_name, p_target_minor / 100.0, p_target_minor, v_me, p_key)
    returning id into v_goal;
  exception when unique_violation then
    -- a double tap / retry landed in the same instant: the other call made the goal
    select id into v_goal from public.cf_goals where owner_id = v_me and create_key = p_key;
    return json_build_object('ok', true, 'goal_id', v_goal, 'duplicate', true);
  end;
  insert into public.cf_members (goal_id, profile_id) values (v_goal, v_me);
  return json_build_object('ok', true, 'goal_id', v_goal, 'duplicate', false);
end;
$$;

-- --------------------------------------------------------- create invite ---
create or replace function public.cf2_create_invite(p_goal uuid, p_email text)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := public.cf2_me();
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_code text;
  v_tries int := 0;
  v_goal public.cf_goals;
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  if not public.cf2_is_member(p_goal, v_me) then return json_build_object('ok', false, 'error', 'not_member'); end if;
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    return json_build_object('ok', false, 'error', 'bad_email');
  end if;
  if (select count(*) from public.cf_attempts
       where profile_id = v_me and kind = 'invite' and at > now() - interval '1 hour') >= 20 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  -- Only dead INVITE codes are ever cleaned up; goals and memberships never are.
  delete from public.cf_invites where expires_at < now() - interval '1 day' and used_at is null;
  loop
    v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
    exit when not exists (select 1 from public.cf_invites where code = v_code);
    v_tries := v_tries + 1;
    if v_tries > 30 then return json_build_object('ok', false, 'error', 'busy'); end if;
  end loop;
  insert into public.cf_invites (code, goal_id, inviter_id, invitee_email, expires_at)
  values (v_code, p_goal, v_me, v_email, now() + interval '10 minutes');
  insert into public.cf_attempts (profile_id, kind) values (v_me, 'invite');
  select * into v_goal from public.cf_goals where id = p_goal;
  return json_build_object('ok', true, 'code', v_code, 'expires_in', 600,
    'goal_name', v_goal.name, 'target_minor', v_goal.target_minor, 'inviter_name', public.cf2_name(v_me));
end;
$$;

-- --------------------------------------------------------- accept invite ---
-- One transaction: validate the code, add the membership, mark the code used,
-- notify the inviter. Idempotent: the same caller retrying the same code (a
-- lost response, a second tap) gets the same success back — even after the
-- 10 minutes are up, because the code is already theirs.
create or replace function public.cf2_accept_invite(p_code text)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := public.cf2_me();
  v_inv public.cf_invites;
  v_goal public.cf_goals;
  v_clean text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  v_email text;
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  select * into v_inv from public.cf_invites where code = v_clean for update;
  if found and v_inv.used_by = v_me then
    select * into v_goal from public.cf_goals where id = v_inv.goal_id;
    return json_build_object('ok', true, 'goal_id', v_goal.id, 'goal_name', v_goal.name, 'already', true,
                             'member', public.cf2_is_member(v_goal.id, v_me));
  end if;
  if (select count(*) from public.cf_attempts
       where profile_id = v_me and kind = 'join_fail' and at > now() - interval '10 minutes') >= 8 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  if not found or v_inv.used_at is not null or v_inv.expires_at < now() then
    insert into public.cf_attempts (profile_id, kind) values (v_me, 'join_fail');
    return json_build_object('ok', false,
      'error', case when found and v_inv.used_at is null and v_inv.expires_at < now() then 'expired' else 'invalid' end);
  end if;
  select email into v_email from public.cf_profiles where id = v_me;
  if (v_inv.invitee_email is not null and v_inv.invitee_email <> v_email)
     or (v_inv.invitee_profile is not null and v_inv.invitee_profile <> v_me) then
    insert into public.cf_attempts (profile_id, kind) values (v_me, 'join_fail');
    return json_build_object('ok', false, 'error', 'wrong_account');
  end if;
  select * into v_goal from public.cf_goals where id = v_inv.goal_id for update;
  if v_goal.status <> 'active' then return json_build_object('ok', false, 'error', 'goal_deleted'); end if;
  if exists (select 1 from public.cf_members where goal_id = v_goal.id and profile_id = v_me) then
    update public.cf_invites set used_at = now(), used_by = v_me where code = v_inv.code;
    return json_build_object('ok', true, 'goal_id', v_goal.id, 'goal_name', v_goal.name, 'already', true, 'member', true);
  end if;
  if (select count(*) from public.cf_members where goal_id = v_goal.id) >= 12 then
    return json_build_object('ok', false, 'error', 'goal_full');
  end if;
  insert into public.cf_members (goal_id, profile_id) values (v_goal.id, v_me);
  update public.cf_invites set used_at = now(), used_by = v_me where code = v_inv.code;
  perform public.cf2_touch(v_goal.id);
  if v_inv.inviter_id <> v_me and public.cf2_is_member(v_goal.id, v_inv.inviter_id) then
    perform public.cf2_notify(v_inv.inviter_id, v_goal.id, 'member_joined', v_me);
  end if;
  return json_build_object('ok', true, 'goal_id', v_goal.id, 'goal_name', v_goal.name, 'already', false, 'member', true);
end;
$$;

-- ------------------------------------------------------------ contribute ---
-- A recorded contribution (the member says they put money aside; nothing is
-- transferred). p_key makes it idempotent per member. Recurring rows use a
-- key the server builds from the month, so two devices or a rerun can never
-- book the same month twice.
create or replace function public.cf2_contribute(p_goal uuid, p_amount_minor bigint, p_key text,
                                                 p_source text default 'manual', p_period text default null)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := public.cf2_me();
  v_key text;
  v_kind text;
  v_row public.cf_ledger;
  v_goal public.cf_goals;
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > 100000000 then
    return json_build_object('ok', false, 'error', 'bad_amount');
  end if;
  if p_source = 'recurring' then
    if p_period is null or p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then
      return json_build_object('ok', false, 'error', 'bad_period');
    end if;
    if not exists (select 1 from public.cf_recurring where goal_id = p_goal and profile_id = v_me) then
      return json_build_object('ok', false, 'error', 'no_recurring');
    end if;
    v_key := 'rec:' || p_goal || ':' || p_period;
    v_kind := 'recurring';
  elsif p_source = 'manual' then
    if p_key is null or char_length(p_key) not between 8 and 100 then
      return json_build_object('ok', false, 'error', 'bad_key');
    end if;
    v_key := 'dep:' || p_key;
    v_kind := 'deposit';
  else
    return json_build_object('ok', false, 'error', 'bad_source');
  end if;

  -- Retry of something already recorded: hand back the original row.
  select * into v_row from public.cf_ledger where profile_id = v_me and idem_key = v_key;
  if found then
    if v_row.goal_id <> p_goal or (v_kind = 'deposit' and v_row.amount_minor <> p_amount_minor) then
      return json_build_object('ok', false, 'error', 'key_reused');
    end if;
    return json_build_object('ok', true, 'duplicate', true, 'entry', row_to_json(v_row));
  end if;

  -- Lock the goal: concurrent contributions queue here, none is lost.
  select * into v_goal from public.cf_goals where id = p_goal for update;
  if not found or v_goal.status <> 'active' then return json_build_object('ok', false, 'error', 'goal_deleted'); end if;
  if not exists (select 1 from public.cf_members where goal_id = p_goal and profile_id = v_me) then
    return json_build_object('ok', false, 'error', 'not_member');
  end if;

  insert into public.cf_ledger (goal_id, profile_id, kind, amount_minor, idem_key, period)
  values (p_goal, v_me, v_kind, p_amount_minor, v_key, case when v_kind = 'recurring' then p_period end)
  on conflict (profile_id, idem_key) do nothing
  returning * into v_row;
  if v_row.id is null then   -- lost a race with our own retry
    select * into v_row from public.cf_ledger where profile_id = v_me and idem_key = v_key;
    return json_build_object('ok', true, 'duplicate', true, 'entry', row_to_json(v_row));
  end if;
  update public.cf_members set amount = amount + p_amount_minor / 100.0 where goal_id = p_goal and profile_id = v_me;
  perform public.cf2_touch(p_goal);
  perform public.cf2_notify_others(p_goal, case when v_kind = 'recurring' then 'recurring' else 'contribution' end,
                                   v_me, p_amount_minor);
  return json_build_object('ok', true, 'duplicate', false, 'entry', row_to_json(v_row));
end;
$$;

-- --------------------------------------------------------------- reverse ---
-- A correction is a new, linked, negative row — never an edit or a delete.
create or replace function public.cf2_reverse(p_entry uuid)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := public.cf2_me();
  v_orig public.cf_ledger;
  v_row public.cf_ledger;
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  select * into v_orig from public.cf_ledger where id = p_entry;
  if not found or v_orig.profile_id <> v_me then return json_build_object('ok', false, 'error', 'not_yours'); end if;
  if v_orig.kind = 'reversal' or v_orig.status <> 'confirmed' then return json_build_object('ok', false, 'error', 'not_reversible'); end if;
  select * into v_row from public.cf_ledger where reverses = p_entry;
  if found then return json_build_object('ok', true, 'duplicate', true, 'entry', row_to_json(v_row)); end if;
  perform 1 from public.cf_goals where id = v_orig.goal_id and status = 'active' for update;
  if not found then return json_build_object('ok', false, 'error', 'goal_deleted'); end if;
  if not exists (select 1 from public.cf_members where goal_id = v_orig.goal_id and profile_id = v_me) then
    return json_build_object('ok', false, 'error', 'not_member');
  end if;
  insert into public.cf_ledger (goal_id, profile_id, kind, amount_minor, idem_key, reverses)
  values (v_orig.goal_id, v_me, 'reversal', -v_orig.amount_minor, 'rev:' || p_entry, p_entry)
  on conflict do nothing
  returning * into v_row;
  if v_row.id is null then
    select * into v_row from public.cf_ledger where reverses = p_entry;
    return json_build_object('ok', true, 'duplicate', true, 'entry', row_to_json(v_row));
  end if;
  update public.cf_members set amount = greatest(0, amount - v_orig.amount_minor / 100.0)
   where goal_id = v_orig.goal_id and profile_id = v_me;
  perform public.cf2_touch(v_orig.goal_id);
  perform public.cf2_notify_others(v_orig.goal_id, 'reversal', v_me, v_orig.amount_minor);
  return json_build_object('ok', true, 'duplicate', false, 'entry', row_to_json(v_row));
end;
$$;

-- ------------------------------------------------------ recurring config ---
-- Opt-in, per member, per goal. Only the member's own setting is ever
-- returned; the income it is computed from never reaches the server.
create or replace function public.cf2_set_recurring(p_goal uuid, p_mode text, p_value bigint, p_consent boolean)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare v_me uuid := public.cf2_me();
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  if not public.cf2_is_member(p_goal, v_me) then return json_build_object('ok', false, 'error', 'not_member'); end if;
  if p_mode = 'off' then
    delete from public.cf_recurring where goal_id = p_goal and profile_id = v_me;
    return json_build_object('ok', true, 'recurring', null);
  end if;
  if p_consent is not true then return json_build_object('ok', false, 'error', 'consent_required'); end if;
  if p_mode not in ('fixed', 'percent') or p_value is null or p_value <= 0
     or (p_mode = 'percent' and p_value > 10000) or (p_mode = 'fixed' and p_value > 100000000) then
    return json_build_object('ok', false, 'error', 'bad_input');
  end if;
  insert into public.cf_recurring (goal_id, profile_id, mode, value, consent_at)
  values (p_goal, v_me, p_mode, p_value, now())
  on conflict (goal_id, profile_id) do update set mode = excluded.mode, value = excluded.value,
                                                  consent_at = now(), updated_at = now();
  return json_build_object('ok', true, 'recurring', json_build_object('mode', p_mode, 'value', p_value));
end;
$$;

-- -------------------------------------------------------------- my goals ---
create or replace function public.cf2_goal_json(p_goal uuid, p_me uuid)
returns json language sql stable security definer
set search_path = public, extensions
as $$
  select json_build_object(
    'id', g.id, 'name', g.name, 'target_minor', g.target_minor, 'currency', g.currency,
    'owner', g.owner_id = p_me, 'version', g.version,
    'balance_minor', coalesce((select sum(amount_minor) from public.cf_ledger
                                where goal_id = g.id and status = 'confirmed'), 0),
    'last_seq', coalesce((select max(seq) from public.cf_ledger where goal_id = g.id), 0),
    'members', (select json_agg(json_build_object(
                  'profile_id', p.id, 'name', public.cf2_name(p.id), 'username', p.username, 'me', p.id = p_me,
                  'contributed_minor', coalesce((select sum(l.amount_minor) from public.cf_ledger l
                                                  where l.goal_id = g.id and l.profile_id = p.id
                                                    and l.status = 'confirmed'), 0))
                  order by (p.id = p_me) desc, m.joined_at)
                from public.cf_members m join public.cf_profiles p on p.id = m.profile_id
                where m.goal_id = g.id),
    'my_recurring', (select json_build_object('mode', r.mode, 'value', r.value, 'consent_at', r.consent_at)
                       from public.cf_recurring r where r.goal_id = g.id and r.profile_id = p_me),
    'deletion', (select json_build_object(
                   'id', d.id, 'requested_by', public.cf2_name(d.requested_by), 'mine', d.requested_by = p_me,
                   'created_at', d.created_at,
                   'votes', (select json_agg(json_build_object(
                               'name', public.cf2_name(p.id), 'me', p.id = p_me,
                               'vote', (select v.vote from public.cf_deletion_votes v
                                         where v.request_id = d.id and v.profile_id = p.id))
                               order by (p.id = p_me) desc, m.joined_at)
                             from public.cf_members m join public.cf_profiles p on p.id = m.profile_id
                             where m.goal_id = g.id))
                 from public.cf_deletion_requests d where d.goal_id = g.id and d.status = 'open'))
  from public.cf_goals g where g.id = p_goal;
$$;

create or replace function public.cf2_my_goals()
returns json language plpgsql stable security definer
set search_path = public, extensions
as $$
declare v_me uuid := public.cf2_me();
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  return json_build_object('ok', true, 'goals', coalesce((
    select json_agg(public.cf2_goal_json(g.id, v_me) order by g.created_at)
      from public.cf_goals g
     where g.status = 'active'
       and exists (select 1 from public.cf_members m where m.goal_id = g.id and m.profile_id = v_me)), '[]'::json),
    'unread', (select count(*) from public.cf_notifications where profile_id = v_me and read_at is null));
end;
$$;

-- --------------------------------------------------------------- history ---
create or replace function public.cf2_history(p_goal uuid, p_before_seq bigint default null, p_limit int default 50)
returns json language plpgsql stable security definer
set search_path = public, extensions
as $$
declare v_me uuid := public.cf2_me();
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  if not public.cf2_is_member(p_goal, v_me) then return json_build_object('ok', false, 'error', 'not_member'); end if;
  return json_build_object('ok', true, 'entries', coalesce((
    select json_agg(e order by e.seq desc) from (
      select l.id, l.seq, l.kind, l.amount_minor, l.currency, l.status, l.period, l.reverses, l.created_at,
             public.cf2_name(p.id) as name, l.profile_id = v_me as me,
             exists (select 1 from public.cf_ledger r where r.reverses = l.id) as reversed
        from public.cf_ledger l join public.cf_profiles p on p.id = l.profile_id
       where l.goal_id = p_goal and (p_before_seq is null or l.seq < p_before_seq)
       order by l.seq desc
       limit least(greatest(coalesce(p_limit, 50), 1), 200)) e), '[]'::json));
end;
$$;

-- ----------------------------------------------------------------- leave ---
-- Leaving never deletes the goal or anyone's records. The last member cannot
-- leave (that would orphan the goal): they ask for deletion instead.
create or replace function public.cf2_leave(p_goal uuid)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare v_me uuid := public.cf2_me();
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  perform 1 from public.cf_goals where id = p_goal and status = 'active' for update;
  if not found then return json_build_object('ok', false, 'error', 'goal_deleted'); end if;
  if not exists (select 1 from public.cf_members where goal_id = p_goal and profile_id = v_me) then
    return json_build_object('ok', true, 'already', true);
  end if;
  if (select count(*) from public.cf_members where goal_id = p_goal) <= 1 then
    return json_build_object('ok', false, 'error', 'last_member');
  end if;
  delete from public.cf_recurring where goal_id = p_goal and profile_id = v_me;
  delete from public.cf_members where goal_id = p_goal and profile_id = v_me;
  perform public.cf2_touch(p_goal);
  perform public.cf2_notify_others(p_goal, 'member_left', v_me);
  return json_build_object('ok', true);
end;
$$;

-- -------------------------------------------------------------- deletion ---
create or replace function public.cf2_finish_deletion_if_agreed(p_req uuid)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare v_req public.cf_deletion_requests; r record;
begin
  select * into v_req from public.cf_deletion_requests where id = p_req;
  if exists (select 1 from public.cf_members m where m.goal_id = v_req.goal_id
              and not exists (select 1 from public.cf_deletion_votes v
                               where v.request_id = p_req and v.profile_id = m.profile_id and v.vote = 'approve')) then
    return false;   -- someone has not approved (no answer is never a yes)
  end if;
  -- Settlement check: nothing may be waiting on a payment. (This app only
  -- records contributions, so this never blocks today — it is here for a
  -- future payment provider.)
  if exists (select 1 from public.cf_ledger where goal_id = v_req.goal_id and status = 'pending') then
    raise exception 'pending_payments';
  end if;
  update public.cf_goals set status = 'deleted', deleted_at = now() where id = v_req.goal_id;
  update public.cf_deletion_requests set status = 'completed', closed_at = now() where id = p_req;
  delete from public.cf_recurring where goal_id = v_req.goal_id;
  for r in select profile_id from public.cf_members where goal_id = v_req.goal_id loop
    perform public.cf2_notify(r.profile_id, v_req.goal_id, 'goal_deleted', null, null, p_req);
  end loop;
  return true;
end;
$$;

create or replace function public.cf2_request_deletion(p_goal uuid)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := public.cf2_me();
  v_goal public.cf_goals;
  v_req public.cf_deletion_requests;
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  select * into v_goal from public.cf_goals where id = p_goal for update;
  if not found or v_goal.status <> 'active' then return json_build_object('ok', false, 'error', 'goal_deleted'); end if;
  if not exists (select 1 from public.cf_members where goal_id = p_goal and profile_id = v_me) then
    return json_build_object('ok', false, 'error', 'not_member');
  end if;
  select * into v_req from public.cf_deletion_requests where goal_id = p_goal and status = 'open';
  if found then return json_build_object('ok', true, 'request_id', v_req.id, 'existing', true); end if;
  insert into public.cf_deletion_requests (goal_id, requested_by, goal_version)
  values (p_goal, v_me, v_goal.version) returning * into v_req;
  -- Asking is the requester's own explicit approval; everyone else must still say yes.
  insert into public.cf_deletion_votes (request_id, profile_id, vote) values (v_req.id, v_me, 'approve');
  begin
    if public.cf2_finish_deletion_if_agreed(v_req.id) then   -- a goal with one member
      return json_build_object('ok', true, 'request_id', v_req.id, 'deleted', true);
    end if;
  exception when raise_exception then
    return json_build_object('ok', false, 'error', 'pending_payments');
  end;
  perform public.cf2_notify_others(p_goal, 'deletion_requested', v_me, null, v_req.id);
  return json_build_object('ok', true, 'request_id', v_req.id, 'deleted', false);
end;
$$;

create or replace function public.cf2_vote_deletion(p_request uuid, p_vote text)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := public.cf2_me();
  v_req public.cf_deletion_requests;
  v_goal public.cf_goals;
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  if p_vote not in ('approve', 'reject') then return json_build_object('ok', false, 'error', 'bad_input'); end if;
  select * into v_req from public.cf_deletion_requests where id = p_request;
  if not found then return json_build_object('ok', false, 'error', 'no_request'); end if;
  -- Lock the goal first: votes, contributions and joins on it are serialized.
  select * into v_goal from public.cf_goals where id = v_req.goal_id for update;
  select * into v_req from public.cf_deletion_requests where id = p_request;
  if v_req.status <> 'open' then return json_build_object('ok', false, 'error', 'request_' || v_req.status); end if;
  if not exists (select 1 from public.cf_members where goal_id = v_req.goal_id and profile_id = v_me) then
    return json_build_object('ok', false, 'error', 'not_member');
  end if;
  if v_goal.version <> v_req.goal_version then
    update public.cf_deletion_requests set status = 'invalidated', closed_at = now() where id = p_request;
    return json_build_object('ok', false, 'error', 'request_invalidated');
  end if;
  insert into public.cf_deletion_votes (request_id, profile_id, vote) values (p_request, v_me, p_vote)
  on conflict (request_id, profile_id) do update set vote = excluded.vote, at = now();
  if p_vote = 'reject' then
    update public.cf_deletion_requests set status = 'rejected', closed_at = now() where id = p_request;
    perform public.cf2_notify_others(v_req.goal_id, 'deletion_rejected', v_me, null, p_request);
    return json_build_object('ok', true, 'status', 'rejected');
  end if;
  begin
    if public.cf2_finish_deletion_if_agreed(p_request) then
      return json_build_object('ok', true, 'status', 'completed');
    end if;
  exception when raise_exception then
    return json_build_object('ok', false, 'error', 'pending_payments');
  end;
  return json_build_object('ok', true, 'status', 'open');
end;
$$;

create or replace function public.cf2_cancel_deletion(p_request uuid)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare v_me uuid := public.cf2_me(); v_req public.cf_deletion_requests;
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  select * into v_req from public.cf_deletion_requests where id = p_request for update;
  if not found or v_req.requested_by <> v_me then return json_build_object('ok', false, 'error', 'not_yours'); end if;
  if v_req.status <> 'open' then return json_build_object('ok', true, 'status', v_req.status); end if;
  update public.cf_deletion_requests set status = 'cancelled', closed_at = now() where id = p_request;
  perform public.cf2_notify_others(v_req.goal_id, 'deletion_cancelled', v_me, null, p_request);
  return json_build_object('ok', true, 'status', 'cancelled');
end;
$$;

-- --------------------------------------------------------- notifications ---
create or replace function public.cf2_notifications(p_after_seq bigint default 0)
returns json language plpgsql stable security definer
set search_path = public, extensions
as $$
declare v_me uuid := public.cf2_me();
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  return json_build_object('ok', true,
    'unread', (select count(*) from public.cf_notifications where profile_id = v_me and read_at is null),
    'items', coalesce((select json_agg(n order by n.seq desc) from (
       select id, seq, goal_id, kind, actor_name, goal_name, amount_minor, request_id, created_at, read_at,
              invite_code,
              (kind = 'invited' and exists (select 1 from public.cf_invites i where i.code = cf_notifications.invite_code
                                              and i.invitee_profile = v_me and i.used_at is null and i.expires_at > now())) as invite_valid
         from public.cf_notifications
        where profile_id = v_me and seq > coalesce(p_after_seq, 0)
        order by seq desc limit 100) n), '[]'::json));
end;
$$;

create or replace function public.cf2_mark_read(p_upto_seq bigint)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare v_me uuid := public.cf2_me();
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  update public.cf_notifications set read_at = now()
   where profile_id = v_me and read_at is null and seq <= p_upto_seq;
  return json_build_object('ok', true);
end;
$$;

-- --------------------------------------------------------------- devices ---
create or replace function public.cf2_register_device(p_install text, p_token text)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare v_me uuid := public.cf2_me();
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  if p_install is null or char_length(p_install) not between 8 and 64
     or p_token is null or char_length(p_token) not between 20 and 4096 then
    return json_build_object('ok', false, 'error', 'bad_input');
  end if;
  -- One token = one install = one account at a time (account switching).
  delete from public.cf_devices where (fcm_token = p_token or install_id = p_install) and profile_id <> v_me;
  delete from public.cf_devices where fcm_token = p_token and install_id <> p_install;
  insert into public.cf_devices (install_id, profile_id, fcm_token) values (p_install, v_me, p_token)
  on conflict (install_id) do update set profile_id = v_me, fcm_token = excluded.fcm_token, updated_at = now();
  return json_build_object('ok', true);
end;
$$;

create or replace function public.cf2_unregister_device(p_install text)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare v_me uuid := public.cf2_me();
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  delete from public.cf_devices where install_id = p_install and profile_id = v_me;
  return json_build_object('ok', true);
end;
$$;

-- ------------------------------------------- push outbox (service role only) ---
-- Claimed by the cf-push Edge Function. A claim is a lease: the row is
-- pushed back by the backoff before sending, so a crashed run is retried.
create or replace function public.cf2_push_claim(p_limit int default 50)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare v_ids uuid[];
begin
  select array_agg(notification_id) into v_ids from (
    select o.notification_id from public.cf_push_outbox o
     where o.sent_at is null and o.attempts < 6 and o.next_at <= now()
     order by o.next_at
     limit least(greatest(coalesce(p_limit, 50), 1), 200)
     for update skip locked) due;
  if v_ids is null then return '[]'::json; end if;
  update public.cf_push_outbox o
     set attempts = o.attempts + 1,
         next_at = now() + make_interval(secs => 30 * power(4, o.attempts))   -- 30s, 2m, 8m, 32m, 2h, 8.5h
   where o.notification_id = any(v_ids);
  return coalesce((
    select json_agg(json_build_object(
             'id', n.id, 'kind', n.kind, 'goal_id', n.goal_id, 'goal_name', n.goal_name,
             'actor_name', n.actor_name, 'amount_minor', n.amount_minor, 'attempt', o.attempts,
             'account_key', public.cf2_account_key(o.profile_id),
             'tokens', coalesce((select json_agg(d.fcm_token) from public.cf_devices d where d.profile_id = o.profile_id), '[]'::json)))
      from public.cf_push_outbox o join public.cf_notifications n on n.id = o.notification_id
     where o.notification_id = any(v_ids)), '[]'::json);
end;
$$;

create or replace function public.cf2_push_result(p_id uuid, p_ok boolean, p_error text, p_dead_tokens text[])
returns json language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if p_dead_tokens is not null and array_length(p_dead_tokens, 1) > 0 then
    delete from public.cf_devices where fcm_token = any(p_dead_tokens);
  end if;
  if p_ok then
    update public.cf_push_outbox set sent_at = now(), last_error = null where notification_id = p_id;
  else
    update public.cf_push_outbox set last_error = left(coalesce(p_error, ''), 500) where notification_id = p_id;
  end if;
  return json_build_object('ok', true);
end;
$$;

-- Kick the dispatcher right away when something is queued (needs pg_net and
-- the Vault secrets from supabase/README.md; without them the every-minute
-- cron in schedule_push.sql still delivers, just later). Never blocks or
-- fails the transaction that queued the notification.
create or replace function public.cf2_kick_push()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare v_url text; v_secret text;
begin
  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'cf_push_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cf_push_secret';
    if v_url is not null and v_secret is not null then
      perform net.http_post(url := v_url, body := '{}'::jsonb,
                            headers := jsonb_build_object('Content-Type', 'application/json', 'x-cf-push-secret', v_secret));
    end if;
  exception when others then null;
  end;
  return null;
end;
$$;
drop trigger if exists cf_push_kick on public.cf_push_outbox;
create trigger cf_push_kick after insert on public.cf_push_outbox
  for each statement execute function public.cf2_kick_push();

-- ------------------------------------------ v1 functions, made safe for v2 ---
-- Older app versions still call these with their device token.
--  * cf_deposit now also writes the ledger (otherwise v2 balances would miss it).
--  * cf_leave no longer lets the owner delete the goal for everyone.
create or replace function public.cf_deposit(p_token text, p_goal uuid, p_amount numeric)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare v_me uuid := public.cf_me(p_token); v_minor bigint := round(coalesce(p_amount, 0) * 100);
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  if v_minor <= 0 or v_minor > 100000000 then return json_build_object('ok', false, 'error', 'bad_amount'); end if;
  perform 1 from public.cf_goals where id = p_goal and status = 'active' for update;
  if not found then return json_build_object('ok', false, 'error', 'not_member'); end if;
  if not exists (select 1 from public.cf_members where goal_id = p_goal and profile_id = v_me) then
    return json_build_object('ok', false, 'error', 'not_member');
  end if;
  insert into public.cf_ledger (goal_id, profile_id, kind, amount_minor, idem_key)
  values (p_goal, v_me, 'deposit', v_minor, 'v1:' || gen_random_uuid());
  update public.cf_members set amount = amount + v_minor / 100.0 where goal_id = p_goal and profile_id = v_me;
  perform public.cf2_touch(p_goal);
  perform public.cf2_notify_others(p_goal, 'contribution', v_me, v_minor);
  return json_build_object('ok', true);
end;
$$;

create or replace function public.cf_leave(p_token text, p_goal uuid)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare v_me uuid := public.cf_me(p_token);
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  perform 1 from public.cf_goals where id = p_goal and status = 'active' for update;
  if not found then return json_build_object('ok', true); end if;
  if (select count(*) from public.cf_members where goal_id = p_goal) <= 1 then
    return json_build_object('ok', false, 'error', 'last_member');
  end if;
  delete from public.cf_members where goal_id = p_goal and profile_id = v_me;
  if found then
    perform public.cf2_touch(p_goal);
    perform public.cf2_notify_others(p_goal, 'member_left', v_me);
  end if;
  return json_build_object('ok', true);
end;
$$;

-- v1's list must hide deleted goals.
create or replace function public.cf_my_goals(p_token text)
returns json language plpgsql stable security definer
set search_path = public, extensions
as $$
declare v_me uuid := public.cf_me(p_token);
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  return json_build_object('ok', true, 'goals', coalesce((
    select json_agg(json_build_object(
             'id', g.id, 'name', g.name, 'target', g.target, 'owner', g.owner_id = v_me,
             'members', (select json_agg(json_build_object(
                            'name', p.display_name, 'amount', m.amount, 'me', p.id = v_me)
                          order by (p.id = v_me) desc, m.joined_at)
                         from public.cf_members m join public.cf_profiles p on p.id = m.profile_id
                         where m.goal_id = g.id))
           order by g.created_at)
    from public.cf_goals g
    where g.status = 'active'
      and exists (select 1 from public.cf_members m where m.goal_id = g.id and m.profile_id = v_me)
  ), '[]'::json));
end;
$$;

-- ------------------------------------------------- complimentary access ---
-- Accounts that get every paid feature (AI chat, guide books, no ads) without
-- a purchase. The list lives ONLY here: locked like every other table, filled
-- from the SQL Editor (complimentary_seed.sql), never shipped in the app.
create table if not exists public.cf_complimentary (
  email      text primary key check (email = lower(trim(email))),
  note       text,
  created_at timestamptz not null default now()
);
alter table public.cf_complimentary enable row level security;
revoke all on public.cf_complimentary from anon, authenticated;

-- What the signed-in account is entitled to beyond its purchases. Decided
-- from the verified email in the session (the JWT) — nothing the app sends —
-- and it only ever tells callers about themselves. Grants nothing on other
-- people's data: every other function keeps its usual member checks.
create or replace function public.cf2_my_entitlements()
returns json language plpgsql stable security definer
set search_path = public, extensions
as $$
declare v_email text := public.cf2_email();
begin
  if v_email is null then return json_build_object('ok', false, 'error', 'not_signed_in'); end if;
  return json_build_object('ok', true, 'email', v_email,
    'complimentary', exists (select 1 from public.cf_complimentary where email = v_email));
end;
$$;

-- ---------------------------------------------------------- permissions ----
do $$
declare f text;
begin
  -- internal helpers: nobody calls these directly
  foreach f in array array[
    'cf2_email()', 'cf2_uid()', 'cf2_me()', 'cf2_is_member(uuid, uuid)', 'cf2_name(uuid)', 'cf2_account_key(uuid)',
    'cf2_new_username()', 'cf2_profile_unused(uuid)', 'cf2_eligible(public.cf_profiles)', 'cf2_ensure_profile(uuid, text, text)',
    'cf2_on_auth_user()', 'cf2_search_match(public.cf_profiles, text, text)', 'cf2_backfill_profiles(boolean)',
    'cf2_notify(uuid, uuid, text, uuid, bigint, uuid)', 'cf2_notify_others(uuid, text, uuid, bigint, uuid)',
    'cf2_touch(uuid)', 'cf2_goal_json(uuid, uuid)', 'cf2_finish_deletion_if_agreed(uuid)', 'cf2_kick_push()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- the app (a signed-in Supabase user) — never anon
  foreach f in array array[
    'cf2_register(text, text)', 'cf2_update_profile(text, text, boolean)', 'cf2_deactivate_profile()',
    'cf2_search(text)', 'cf2_search_users(text, uuid, int, int)', 'cf2_invite_user(uuid, uuid)',
    'cf2_create_goal(text, bigint, text)',
    'cf2_create_invite(uuid, text)', 'cf2_accept_invite(text)',
    'cf2_contribute(uuid, bigint, text, text, text)', 'cf2_reverse(uuid)',
    'cf2_set_recurring(uuid, text, bigint, boolean)', 'cf2_my_goals()', 'cf2_history(uuid, bigint, int)',
    'cf2_leave(uuid)', 'cf2_request_deletion(uuid)', 'cf2_vote_deletion(uuid, text)', 'cf2_cancel_deletion(uuid)',
    'cf2_notifications(bigint)', 'cf2_mark_read(bigint)', 'cf2_my_entitlements()',
    'cf2_register_device(text, text)', 'cf2_unregister_device(text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- the push dispatcher (Edge Function with the service-role key) only
  foreach f in array array['cf2_push_claim(int)', 'cf2_push_result(uuid, boolean, text, text[])', 'cf2_backfill_profiles(boolean)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
