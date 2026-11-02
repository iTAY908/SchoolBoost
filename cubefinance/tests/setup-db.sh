#!/bin/sh
# Fresh local database with Supabase-like stubs (roles, auth.uid/jwt, auth.users) + account_sync.sql.
set -e
P="psql -h ${PGHOST:-/tmp/cfpg} -p ${PGPORT:-54329} -U postgres -v ON_ERROR_STOP=1 -q"
DB=${PGDB:-cf4db}
$P -c "drop database if exists $DB" -c "create database $DB"
$P -d $DB <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text unique, created_at timestamptz default now());
create or replace function auth.jwt() returns jsonb language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $f$;
create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(auth.jwt() ->> 'sub', '')::uuid $f$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.jwt(), auth.uid() to anon, authenticated, service_role;
SQL
$P -d $DB -f "$(dirname "$0")/../supabase/live/account_sync.sql" 2>&1 | grep -v NOTICE || true
echo "database $DB ready"
