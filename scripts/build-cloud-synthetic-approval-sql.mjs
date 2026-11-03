import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// Derive the managed-test binding from the single tested approval implementation.
// The isolated rehearsal source and its database-name safeguard stay unchanged.
export function buildCloudSyntheticApprovalSql(source){
 const installer="do $$ begin\n if current_database() <> 'sc_approval_test' then\n  raise exception 'new isolated sc_approval_test database required';\n end if;\nend $$;";
 const guard="if current_database()<>'sc_approval_test' or p_tenant<>'sarberki-test' then";
 if(!source.includes(installer)||!source.includes(guard))throw Error('APPROVAL_SOURCE_CHANGED');
 return source.replace('-- Rehearsal only. Not a Supabase migration; NEVER install on the source project.',
  '-- Generated from recovery/sql/isolated-approval.sql; project binding from the deployment profile.')
 .replace(installer,()=>`-- Project binding comes from the immutable deployment profile (deployment/deployment-profile).
-- TEST keeps every original fixture precondition; LIVE requires exactly its own empty-of-others tenant.
-- sc_approve_case below stays synthetic and TEST-only: in a LIVE project it always fails closed.
do $$
declare env text; ref text; tenant text;
begin
 if to_regclass('public.sc_deployment_profile') is null then
  raise exception 'deployment profile required';
 end if;
 select environment,project_ref,tenant_id into env,ref,tenant from public.sc_deployment_profile where singleton;
 if current_setting('sarberki.approval_install_project_ref',true) is distinct from ref
 or coalesce(current_setting('sarberki.approval_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or (env='test' and (not exists(select 1 from public.sc_tenants where tenant_id='sarberki-test' and test_only)
  or exists(select 1 from public.sc_tenants where not test_only or tenant_id not in ('sarberki-test','demo-test'))
  or exists(select 1 from public.sc_cases where coalesce(data->>'sender','')!~'^[^@[:space:]]+@[^@[:space:]]+\\.invalid$')))
 or (env='live' and (not exists(select 1 from public.sc_tenants where tenant_id=tenant and not test_only)
  or exists(select 1 from public.sc_tenants where test_only or tenant_id<>tenant))) then
  raise exception 'verified % project and fresh backup required',env;
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
 values(public.sc_deployment_project_ref(),current_setting('sarberki.approval_backup_sha256'))
 on conflict(singleton) do update set backup_sha256=excluded.backup_sha256;
do $$ begin
 if not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref=public.sc_deployment_project_ref()) then
  raise exception 'approval binding does not match deployment profile';
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
