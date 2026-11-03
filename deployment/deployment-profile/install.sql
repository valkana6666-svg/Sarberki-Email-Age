-- Deployment profile (slice 1 of the live case store, owner decision 2026-11-03: separate Supabase
-- project for live data). One immutable row per database says whether this project is the TEST or
-- the LIVE store, which single tenant it serves and which Supabase project (ref, Auth issuer) it is.
-- Later slices replace the hard-coded TEST literals with these helpers; this file changes no
-- existing function.
--
-- Usage (operator, inside ONE transaction, never from a client):
--   begin; select set_config('sarberki.deployment_environment','test',true);       -- or 'live'
--          select set_config('sarberki.deployment_project_ref','<20-char ref>',true); \i install.sql
-- An unset or unknown environment/ref aborts; TEST must be the TEST project ref, LIVE must not be.
-- Re-running with the same values is a no-op; different values abort.
-- Requires the case store (supabase/migrations/202610090001).
do $$
declare env text:=current_setting('sarberki.deployment_environment',true);
declare ref text:=current_setting('sarberki.deployment_project_ref',true);
declare existing text;
begin
 if env is null or env not in ('test','live') then raise exception 'DEPLOYMENT_ENVIRONMENT_REQUIRED' using errcode='22023'; end if;
 if ref is null or ref!~'^[a-z]{20}$' or (env='test')<>(ref='mojnqizbcaczstguikpv') then
  raise exception 'DEPLOYMENT_PROJECT_REF_REQUIRED' using errcode='22023';
 end if;
 if to_regclass('public.sc_tenants') is null then raise exception 'CASE_STORE_REQUIRED' using errcode='55000'; end if;
 if to_regclass('public.sc_deployment_profile') is not null then
  select environment||'/'||project_ref into existing from public.sc_deployment_profile where singleton;
  if existing is distinct from env||'/'||ref then raise exception 'DEPLOYMENT_PROFILE_MISMATCH' using errcode='55000'; end if;
 end if;
 -- A LIVE project must start empty: no test tenants, cases or memberships are carried over.
 if env='live' and (exists(select 1 from public.sc_tenants where tenant_id<>'sarberki-live')
  or exists(select 1 from public.sc_cases where tenant_id<>'sarberki-live')) then
  raise exception 'LIVE_PROJECT_NOT_EMPTY' using errcode='55000';
 end if;
end $$;

create table if not exists public.sc_deployment_profile(
 singleton boolean primary key default true check(singleton),
 environment text not null check(environment in ('test','live')),
 tenant_id text not null,
 project_ref text not null check(project_ref~'^[a-z]{20}$'),
 created_at timestamptz not null default now(),
 check((environment='test' and tenant_id='sarberki-test') or (environment='live' and tenant_id='sarberki-live')),
 check((environment='test')=(project_ref='mojnqizbcaczstguikpv'))
);
alter table public.sc_deployment_profile enable row level security;
revoke all on table public.sc_deployment_profile from public,anon,authenticated;

create or replace function public.sc_deployment_profile_immutable() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'DEPLOYMENT_PROFILE_IMMUTABLE' using errcode='55000'; end $$;
revoke all on function public.sc_deployment_profile_immutable() from public,anon,authenticated;
drop trigger if exists sc_deployment_profile_no_change on public.sc_deployment_profile;
create trigger sc_deployment_profile_no_change before update or delete on public.sc_deployment_profile
 for each row execute function public.sc_deployment_profile_immutable();
drop trigger if exists sc_deployment_profile_no_truncate on public.sc_deployment_profile;
create trigger sc_deployment_profile_no_truncate before truncate on public.sc_deployment_profile
 for each statement execute function public.sc_deployment_profile_immutable();

insert into public.sc_deployment_profile(environment,tenant_id,project_ref)
 select current_setting('sarberki.deployment_environment',true),
  case current_setting('sarberki.deployment_environment',true) when 'live' then 'sarberki-live' else 'sarberki-test' end,
  current_setting('sarberki.deployment_project_ref',true)
 where not exists(select 1 from public.sc_deployment_profile);

-- Read helpers for definer functions only (no client grant).
create or replace function public.sc_deployment_tenant() returns text
language sql stable security definer set search_path='' as
$$ select tenant_id from public.sc_deployment_profile where singleton $$;
create or replace function public.sc_is_live_deployment() returns boolean
language sql stable security definer set search_path='' as
$$ select coalesce((select environment='live' from public.sc_deployment_profile where singleton),false) $$;
create or replace function public.sc_deployment_project_ref() returns text
language sql stable security definer set search_path='' as
$$ select project_ref from public.sc_deployment_profile where singleton $$;
create or replace function public.sc_deployment_issuer() returns text
language sql stable security definer set search_path='' as
$$ select 'https://'||project_ref||'.supabase.co/auth/v1' from public.sc_deployment_profile where singleton $$;
revoke all on function public.sc_deployment_tenant() from public,anon,authenticated;
revoke all on function public.sc_is_live_deployment() from public,anon,authenticated;
revoke all on function public.sc_deployment_project_ref() from public,anon,authenticated;
revoke all on function public.sc_deployment_issuer() from public,anon,authenticated;

-- Tenant fence. TEST keeps the original check(test_only) and gains: only the TEST tenants.
-- LIVE drops check(test_only) and allows exactly one tenant: 'sarberki-live', test_only=false.
create or replace function public.sc_tenant_fence() returns trigger
language plpgsql set search_path='' as $$
declare env text:=(select environment from public.sc_deployment_profile where singleton);
begin
 if env='live' and (new.tenant_id<>'sarberki-live' or new.test_only) then raise exception 'LIVE_TENANT_ONLY' using errcode='42501'; end if;
 if env='test' and (new.tenant_id not in ('sarberki-test','demo-test') or not new.test_only) then raise exception 'TEST_TENANT_ONLY' using errcode='42501'; end if;
 if env is null then raise exception 'DEPLOYMENT_PROFILE_REQUIRED' using errcode='55000'; end if;
 return new;
end $$;
revoke all on function public.sc_tenant_fence() from public,anon,authenticated;
drop trigger if exists sc_tenants_deployment_fence on public.sc_tenants;
create trigger sc_tenants_deployment_fence before insert or update on public.sc_tenants
 for each row execute function public.sc_tenant_fence();

do $$
begin
 if public.sc_is_live_deployment() then
  alter table public.sc_tenants drop constraint if exists sc_tenants_test_only_check;
  alter table public.sc_tenants alter column test_only set default false;
 end if;
end $$;

-- Supabase default privileges also grant new objects to service_role; this path never uses it.
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on table public.sc_deployment_profile from service_role';
  execute 'revoke all on function public.sc_deployment_tenant(),public.sc_is_live_deployment(),public.sc_deployment_project_ref(),public.sc_deployment_issuer(),public.sc_tenant_fence(),public.sc_deployment_profile_immutable() from service_role';
 end if;
end $$;
