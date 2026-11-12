-- TEST only – owner permission PERM-20261112-ONECLICK (2026-11-12, V1-ALLAPOT): the one-click V2 action (Previo
-- option + confirmation + approval in one operator step) needs ONE account with write AND approve. The sarberki-test
-- Approver membership(s) (read + approve, no write) get write; nothing else changes. Every changed row is logged in
-- sc_oneclick_write_grants so the rollback (oneclick-approver-write-rollback.sql) removes exactly that write again.
-- Unchanged: Writer accounts (still no approve), RLS, all functions, the DB rule that a human-edited draft needs an
-- approver other than its author (sc_tm_decide). No user ids appear in this file or its output.
begin;
do $$ begin
 if current_setting('sarberki.tm_install_project_ref',true) is distinct from 'mojnqizbcaczstguikpv'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or not exists(select 1 from public.sc_tenants where tenant_id='sarberki-test' and test_only)
 or to_regclass('public.sc_deployment_profile') is not null then
  raise exception 'verified TEST project and fresh backup required';
 end if;
end $$;
create table if not exists public.sc_oneclick_write_grants(
 tenant_id text not null, user_id uuid not null, granted_at timestamptz not null default now(), primary key(tenant_id,user_id));
alter table public.sc_oneclick_write_grants enable row level security;
revoke all on public.sc_oneclick_write_grants from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then execute 'revoke all on public.sc_oneclick_write_grants from service_role'; end if; end $$;
with changed as (
 update public.sc_memberships set can_write=true
 where tenant_id='sarberki-test' and can_read and can_approve and not can_write
 returning tenant_id,user_id)
insert into public.sc_oneclick_write_grants(tenant_id,user_id) select tenant_id,user_id from changed on conflict do nothing;
do $$ begin
 if not exists(select 1 from public.sc_memberships where tenant_id='sarberki-test' and can_read and can_write and can_approve) then
  raise exception 'no sarberki-test membership with read, write and approve after the change';
 end if;
end $$;
commit;
