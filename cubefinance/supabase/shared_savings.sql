-- ============================================================================
-- CubeFinance — shared savings ("חיסכון משותף") on Supabase.
--
-- Paste this whole file into Supabase → SQL Editor → Run. Safe to run again.
--
-- How access works
--   * The app talks to Supabase with the PUBLIC publishable key only.
--   * Every table has Row Level Security ON and NO policies, so that key
--     cannot read or write any table directly.
--   * The only way in is through the cf_* functions below. Each one takes the
--     caller's device token (a long random secret kept on the phone; only its
--     SHA-256 is stored here) and checks membership before doing anything.
--   * Search is by exact email only — nobody can list or browse users.
--   * Invite codes: 6 digits, valid 10 minutes, single use, and a code sent
--     to an email can only be redeemed by the account with that email.
--     Wrong guesses are rate-limited per account.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables ----
create table if not exists public.cf_profiles (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  display_name text not null default '',
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);

create table if not exists public.cf_goals (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  target     numeric(12,2) not null check (target > 0 and target <= 10000000),
  owner_id   uuid not null references public.cf_profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.cf_members (
  goal_id    uuid not null references public.cf_goals(id) on delete cascade,
  profile_id uuid not null references public.cf_profiles(id) on delete cascade,
  amount     numeric(12,2) not null default 0 check (amount >= 0),
  joined_at  timestamptz not null default now(),
  primary key (goal_id, profile_id)
);

create table if not exists public.cf_invites (
  code          text primary key,
  goal_id       uuid not null references public.cf_goals(id) on delete cascade,
  inviter_id    uuid not null references public.cf_profiles(id) on delete cascade,
  invitee_email text,                       -- null = open code (WhatsApp)
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  used_at       timestamptz
);

create table if not exists public.cf_attempts (
  profile_id uuid not null references public.cf_profiles(id) on delete cascade,
  kind       text not null,                 -- 'join_fail' | 'invite'
  at         timestamptz not null default now()
);
create index if not exists cf_attempts_lookup on public.cf_attempts (profile_id, kind, at);

alter table public.cf_profiles enable row level security;
alter table public.cf_goals    enable row level security;
alter table public.cf_members  enable row level security;
alter table public.cf_invites  enable row level security;
alter table public.cf_attempts enable row level security;

revoke all on public.cf_profiles, public.cf_goals, public.cf_members,
              public.cf_invites, public.cf_attempts from anon, authenticated;

-- --------------------------------------------------------------- helpers ----
create or replace function public.cf_me(p_token text)
returns uuid
language sql stable security definer
set search_path = public, extensions
as $$
  select id from public.cf_profiles
  where p_token is not null and char_length(p_token) >= 32
    and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;
revoke all on function public.cf_me(text) from public, anon, authenticated;

-- ------------------------------------------------------------ register -----
-- Called when the app opens. Creates the profile the first time, refreshes
-- the name afterwards. One device per email for now.
create or replace function public.cf_register(p_token text, p_email text, p_name text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_id uuid := public.cf_me(p_token);
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := left(trim(coalesce(p_name, '')), 40);
begin
  if p_token is null or char_length(p_token) < 32 then
    return json_build_object('ok', false, 'error', 'bad_token');
  end if;
  if v_id is not null then
    update public.cf_profiles
       set last_seen = now(), display_name = case when v_name <> '' then v_name else display_name end
     where id = v_id;
    return json_build_object('ok', true);
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' or char_length(v_email) > 254 then
    return json_build_object('ok', false, 'error', 'bad_email');
  end if;
  if exists (select 1 from public.cf_profiles where email = v_email) then
    return json_build_object('ok', false, 'error', 'email_taken');
  end if;
  begin
    insert into public.cf_profiles (email, display_name, token_hash)
    values (v_email, case when v_name <> '' then v_name else split_part(v_email, '@', 1) end,
            encode(extensions.digest(p_token, 'sha256'), 'hex'));
  exception when unique_violation then
    -- someone registered this email (or this device) a split second before us
    if public.cf_me(p_token) is not null then
      return json_build_object('ok', true);
    end if;
    return json_build_object('ok', false, 'error', 'email_taken');
  end;
  return json_build_object('ok', true, 'created', true);
end;
$$;

-- -------------------------------------------------------------- search -----
-- Exact email only. Returns a display name, never a list.
create or replace function public.cf_search(p_token text, p_email text)
returns json
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := public.cf_me(p_token);
  v_row public.cf_profiles;
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  select * into v_row from public.cf_profiles where email = lower(trim(coalesce(p_email, '')));
  if not found then return json_build_object('ok', true, 'found', false); end if;
  return json_build_object('ok', true, 'found', true, 'name', v_row.display_name, 'self', v_row.id = v_me);
end;
$$;

-- ----------------------------------------------------------- create goal ---
create or replace function public.cf_create_goal(p_token text, p_name text, p_target numeric)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := public.cf_me(p_token);
  v_goal uuid;
  v_name text := left(trim(coalesce(p_name, '')), 60);
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  if v_name = '' or p_target is null or p_target <= 0 or p_target > 10000000 then
    return json_build_object('ok', false, 'error', 'bad_input');
  end if;
  if (select count(*) from public.cf_goals where owner_id = v_me) >= 20 then
    return json_build_object('ok', false, 'error', 'too_many_goals');
  end if;
  insert into public.cf_goals (name, target, owner_id) values (v_name, round(p_target, 2), v_me)
  returning id into v_goal;
  insert into public.cf_members (goal_id, profile_id) values (v_goal, v_me);
  return json_build_object('ok', true, 'goal_id', v_goal);
end;
$$;

-- --------------------------------------------------------- create invite ---
-- p_email given  -> the code is emailed and only that account can use it.
-- p_email null   -> an open code for sharing on WhatsApp.
create or replace function public.cf_create_invite(p_token text, p_goal uuid, p_email text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := public.cf_me(p_token);
  v_code text;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_goal public.cf_goals;
  v_tries int := 0;
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  if not exists (select 1 from public.cf_members where goal_id = p_goal and profile_id = v_me) then
    return json_build_object('ok', false, 'error', 'not_member');
  end if;
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    return json_build_object('ok', false, 'error', 'bad_email');
  end if;
  if (select count(*) from public.cf_attempts
       where profile_id = v_me and kind = 'invite' and at > now() - interval '1 hour') >= 20 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  delete from public.cf_invites where expires_at < now() - interval '1 day';
  loop
    v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
    v_tries := v_tries + 1;
    if v_tries > 30 then return json_build_object('ok', false, 'error', 'busy'); end if;
    begin
      delete from public.cf_invites                              -- an old, dead row with the same digits
       where code = v_code and (used_at is not null or expires_at <= now());
      insert into public.cf_invites (code, goal_id, inviter_id, invitee_email, expires_at)
      values (v_code, p_goal, v_me, v_email, now() + interval '10 minutes');
      exit;
    exception when unique_violation then
      null;                                                      -- live code with the same digits: draw again
    end;
  end loop;
  insert into public.cf_attempts (profile_id, kind) values (v_me, 'invite');
  select * into v_goal from public.cf_goals where id = p_goal;
  return json_build_object('ok', true, 'code', v_code, 'expires_in', 600,
    'goal_name', v_goal.name, 'target', v_goal.target,
    'inviter_name', (select display_name from public.cf_profiles where id = v_me));
end;
$$;

-- --------------------------------------------------------- accept invite ---
create or replace function public.cf_accept_invite(p_token text, p_code text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := public.cf_me(p_token);
  v_inv public.cf_invites;
  v_email text;
  v_clean text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  if (select count(*) from public.cf_attempts
       where profile_id = v_me and kind = 'join_fail' and at > now() - interval '10 minutes') >= 8 then
    return json_build_object('ok', false, 'error', 'rate_limited');
  end if;
  select * into v_inv from public.cf_invites where code = v_clean for update;
  if not found or v_inv.used_at is not null or v_inv.expires_at < now() then
    insert into public.cf_attempts (profile_id, kind) values (v_me, 'join_fail');
    return json_build_object('ok', false,
      'error', case when found and v_inv.expires_at < now() then 'expired' else 'invalid' end);
  end if;
  select email into v_email from public.cf_profiles where id = v_me;
  if v_inv.invitee_email is not null and v_inv.invitee_email <> v_email then
    insert into public.cf_attempts (profile_id, kind) values (v_me, 'join_fail');
    return json_build_object('ok', false, 'error', 'wrong_account');
  end if;
  perform 1 from public.cf_goals where id = v_inv.goal_id for update;   -- one joiner at a time per goal
  if exists (select 1 from public.cf_members where goal_id = v_inv.goal_id and profile_id = v_me) then
    return json_build_object('ok', false, 'error', 'already_member');
  end if;
  if (select count(*) from public.cf_members where goal_id = v_inv.goal_id) >= 12 then
    return json_build_object('ok', false, 'error', 'goal_full');
  end if;
  insert into public.cf_members (goal_id, profile_id) values (v_inv.goal_id, v_me)
  on conflict do nothing;
  update public.cf_invites set used_at = now() where code = v_inv.code;
  return json_build_object('ok', true, 'goal_id', v_inv.goal_id,
    'goal_name', (select name from public.cf_goals where id = v_inv.goal_id));
end;
$$;

-- --------------------------------------------------------------- deposit ---
create or replace function public.cf_deposit(p_token text, p_goal uuid, p_amount numeric)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := public.cf_me(p_token);
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then
    return json_build_object('ok', false, 'error', 'bad_amount');
  end if;
  update public.cf_members set amount = amount + round(p_amount, 2)
   where goal_id = p_goal and profile_id = v_me;
  if not found then return json_build_object('ok', false, 'error', 'not_member'); end if;
  return json_build_object('ok', true);
end;
$$;

-- -------------------------------------------------------------- my goals ---
create or replace function public.cf_my_goals(p_token text)
returns json
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := public.cf_me(p_token);
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
    where exists (select 1 from public.cf_members m where m.goal_id = g.id and m.profile_id = v_me)
  ), '[]'::json));
end;
$$;

-- ----------------------------------------------------------------- leave ---
-- A member leaves; the owner leaving closes the goal for everyone.
create or replace function public.cf_leave(p_token text, p_goal uuid)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := public.cf_me(p_token);
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'no_profile'); end if;
  if exists (select 1 from public.cf_goals where id = p_goal and owner_id = v_me) then
    delete from public.cf_goals where id = p_goal;
  else
    delete from public.cf_members where goal_id = p_goal and profile_id = v_me;
  end if;
  return json_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------- permissions ----
revoke all on function public.cf_register(text, text, text)       from public;
revoke all on function public.cf_search(text, text)                from public;
revoke all on function public.cf_create_goal(text, text, numeric)  from public;
revoke all on function public.cf_create_invite(text, uuid, text)   from public;
revoke all on function public.cf_accept_invite(text, text)         from public;
revoke all on function public.cf_deposit(text, uuid, numeric)      from public;
revoke all on function public.cf_my_goals(text)                    from public;
revoke all on function public.cf_leave(text, uuid)                 from public;

grant execute on function public.cf_register(text, text, text)       to anon, authenticated;
grant execute on function public.cf_search(text, text)                to anon, authenticated;
grant execute on function public.cf_create_goal(text, text, numeric)  to anon, authenticated;
grant execute on function public.cf_create_invite(text, uuid, text)   to anon, authenticated;
grant execute on function public.cf_accept_invite(text, text)         to anon, authenticated;
grant execute on function public.cf_deposit(text, uuid, numeric)      to anon, authenticated;
grant execute on function public.cf_my_goals(text)                    to anon, authenticated;
grant execute on function public.cf_leave(text, uuid)                 to anon, authenticated;

-- Number of registered users (run on its own in the SQL Editor any time):
--   select count(*) from public.cf_profiles;
