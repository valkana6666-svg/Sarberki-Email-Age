-- Follow-up test-only migration: approval requires read permission, independently
-- of draft-writing permission. No users, memberships, grants or RPCs are changed.
begin;
do $$
declare old_constraint text;
begin
 if current_setting('sarberki.approval_install_project_ref',true) is distinct from 'mojnqizbcaczstguikpv'
 or coalesce(current_setting('sarberki.approval_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref='mojnqizbcaczstguikpv')
 or not exists(select 1 from public.sc_tenants where tenant_id='sarberki-test' and test_only)
 or exists(select 1 from public.sc_tenants where not test_only or tenant_id not in ('sarberki-test','demo-test')) then
  raise exception 'verified test project and fresh backup required';
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
