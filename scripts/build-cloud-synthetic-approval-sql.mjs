import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// Derive the managed-test binding from the single tested approval implementation.
// The isolated rehearsal source and its database-name safeguard stay unchanged.
export function buildCloudSyntheticApprovalSql(source){
 const installer="do $$ begin\n if current_database() <> 'sc_approval_test' then\n  raise exception 'new isolated sc_approval_test database required';\n end if;\nend $$;";
 const guard="if current_database()<>'sc_approval_test' or p_tenant<>'sarberki-test' then";
 if(!source.includes(installer)||!source.includes(guard))throw Error('APPROVAL_SOURCE_CHANGED');
 return source.replace('-- Rehearsal only. Not a Supabase migration; NEVER install on the source project.',
  `-- Generated from recovery/sql/isolated-approval.sql; managed sarberki-test synthetic binding only.
-- Live store slice 2 (2026-11-06): with the deployment profile installed, the project binding comes from the
-- profile (a LIVE project must be empty); without it the original TEST literals apply unchanged.
-- sc_approve_case below stays TEST-only (literal tenant): on a LIVE project it always refuses.`)
 .replace(installer,()=>`do $$ declare p record; bad boolean:=false; begin
 if to_regclass('public.sc_deployment_profile') is not null then
  execute 'select environment,tenant_id,project_ref from public.sc_deployment_profile where singleton' into p;
  if p.project_ref is null or current_setting('sarberki.approval_install_project_ref',true) is distinct from p.project_ref
  or coalesce(current_setting('sarberki.approval_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
  or not exists(select 1 from public.sc_tenants where tenant_id=p.tenant_id and test_only=(p.environment='test'))
  or exists(select 1 from public.sc_tenants where tenant_id<>p.tenant_id and not (p.environment='test' and tenant_id='demo-test' and test_only))
  or (p.environment='live' and exists(select 1 from public.sc_cases))
  or (p.environment='test' and to_regclass('public.sc_test_mailbox_cases') is null
      and exists(select 1 from public.sc_cases where coalesce(data->>'sender','')!~'^[^@[:space:]]+@[^@[:space:]]+\\.invalid$')) then
   raise exception 'verified test project and fresh backup required';
  end if;
  -- TEST with the test-mailbox layer: a non-.invalid sender is allowed only for a registered test-mailbox case.
  if p.environment='test' and to_regclass('public.sc_test_mailbox_cases') is not null then
   execute 'select exists(select 1 from public.sc_cases c where coalesce(c.data->>''sender'','''')!~''^[^@[:space:]]+@[^@[:space:]]+\\.invalid$''
    and not exists(select 1 from public.sc_test_mailbox_cases t where t.tenant_id=c.tenant_id and t.case_id=c.case_id))' into bad;
   if bad then raise exception 'verified test project and fresh backup required'; end if;
  end if;
 elsif current_setting('sarberki.approval_install_project_ref',true) is distinct from 'mojnqizbcaczstguikpv'
 or coalesce(current_setting('sarberki.approval_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or not exists(select 1 from public.sc_tenants where tenant_id='sarberki-test' and test_only)
 or exists(select 1 from public.sc_tenants where not test_only or tenant_id not in ('sarberki-test','demo-test'))
 or exists(select 1 from public.sc_cases where coalesce(data->>'sender','')!~'^[^@[:space:]]+@[^@[:space:]]+\\.invalid$') then
  raise exception 'verified test project and fresh backup required';
 end if;
end $$;
create table if not exists public.sc_cloud_approval_binding(
 singleton boolean primary key default true check(singleton),
 project_ref text not null check(project_ref~'^[a-z]{20}$'),
 backup_sha256 text not null check(backup_sha256~'^[a-f0-9]{64}$')
);
alter table public.sc_cloud_approval_binding enable row level security;
revoke all on public.sc_cloud_approval_binding from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on public.sc_cloud_approval_binding from service_role';
 end if;
end $$;
insert into public.sc_cloud_approval_binding(project_ref,backup_sha256)
 values(current_setting('sarberki.approval_install_project_ref'),current_setting('sarberki.approval_backup_sha256'))
 on conflict(singleton) do update set backup_sha256=excluded.backup_sha256
 where public.sc_cloud_approval_binding.project_ref=excluded.project_ref;
do $$ begin
 if not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref=current_setting('sarberki.approval_install_project_ref')) then
  raise exception 'project binding mismatch';
 end if;
end $$;`)
 .replace(guard,`if p_tenant<>'sarberki-test'
 or not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref='mojnqizbcaczstguikpv')
 or not exists(select 1 from public.sc_tenants where tenant_id=p_tenant and test_only)
 or coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'iss','')<>'https://mojnqizbcaczstguikpv.supabase.co/auth/v1' then`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const sql=await readFile(new URL('../recovery/sql/isolated-approval.sql',import.meta.url),'utf8');
 process.stdout.write(buildCloudSyntheticApprovalSql(sql));
}
