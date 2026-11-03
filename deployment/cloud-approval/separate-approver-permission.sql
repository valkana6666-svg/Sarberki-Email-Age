-- Follow-up migration: approval requires read permission, independently of draft-writing
-- permission. No users, memberships, grants or RPCs are changed. Project and tenant come from
-- the immutable deployment profile (TEST: unchanged preconditions; LIVE: only its own tenant).
begin;
do $$
declare old_constraint text; env text; ref text; tenant text;
begin
 if to_regclass('public.sc_deployment_profile') is null then
  raise exception 'deployment profile required';
 end if;
 select environment,project_ref,tenant_id into env,ref,tenant from public.sc_deployment_profile where singleton;
 if current_setting('sarberki.approval_install_project_ref',true) is distinct from ref
 or coalesce(current_setting('sarberki.approval_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref=ref)
 or (env='test' and (not exists(select 1 from public.sc_tenants where tenant_id='sarberki-test' and test_only)
  or exists(select 1 from public.sc_tenants where not test_only or tenant_id not in ('sarberki-test','demo-test'))))
 or (env='live' and (not exists(select 1 from public.sc_tenants where tenant_id=tenant and not test_only)
  or exists(select 1 from public.sc_tenants where test_only or tenant_id<>tenant))) then
  raise exception 'verified % project and fresh backup required',env;
 end if;
 -- Identify the actual prior definition, not only an auto-generated name.
 select conname into old_constraint from pg_constraint
 where conrelid='public.sc_memberships'::regclass and contype='c'
 and lower(regexp_replace(pg_get_constraintdef(oid),'[[:space:]()]','','g'))='checknotcan_approveorcan_write';
 if old_constraint is null then
  raise exception 'expected original approve/write constraint missing';
 end if;
 execute format('alter table public.sc_memberships drop constraint %I',old_constraint);
 alter table public.sc_memberships add constraint sc_memberships_approve_requires_read
  check (not can_approve or can_read);
 -- Validate all existing rows inside the transaction. Writer/read constraint,
 -- RLS, definer authority checks, CAS and audit functions remain untouched.
end $$;
commit;
