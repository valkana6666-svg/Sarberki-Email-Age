-- TEST ONLY. Run immediately before clarification-only.sql, after all gates.
-- Retain this restricted snapshot until rollback and audit verification finish.
begin;
do $$ begin
 if current_setting('sarberki.approval_install_project_ref',true) is distinct from 'mojnqizbcaczstguikpv'
 or not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref='mojnqizbcaczstguikpv')
 or not exists(select 1 from public.sc_tenants where tenant_id='sarberki-test' and test_only)
 or exists(select 1 from public.sc_tenants where not test_only or tenant_id not in ('sarberki-test','demo-test'))
 or to_regprocedure('public.sc_approve_clarification(text,text,bigint,text,jsonb)') is not null
 or position('sc_private_exact_receipt' in pg_get_functiondef('public.sc_write_case(text,text,bigint,jsonb)'::regprocedure)) = 0
 or position(' if coalesce(p_data->''state''->>''approval'',''pending'') <> ''pending'' then' in pg_get_functiondef('public.sc_write_case(text,text,bigint,jsonb)'::regprocedure)) = 0
 or position('clarification approval RPC only' in pg_get_functiondef('public.sc_write_case(text,text,bigint,jsonb)'::regprocedure)) > 0
 then raise exception 'unexpected project or pre-install state'; end if;
end $$;
create schema sc_clarification_rollback_private;
revoke all on schema sc_clarification_rollback_private from public, anon, authenticated;
create table sc_clarification_rollback_private.writer_snapshot as
select pg_get_functiondef(p.oid) as definition, p.proowner as owner_oid, p.proacl as acl,
       encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition_sha256
from pg_proc p where p.oid='public.sc_write_case(text,text,bigint,jsonb)'::regprocedure;
revoke all on sc_clarification_rollback_private.writer_snapshot from public, anon, authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on schema sc_clarification_rollback_private from service_role';
  execute 'revoke all on sc_clarification_rollback_private.writer_snapshot from service_role';
 end if;
end $$;
do $$ begin
 if (select count(*) from sc_clarification_rollback_private.writer_snapshot) <> 1 then
  raise exception 'Writer snapshot required'; end if;
end $$;
commit;
