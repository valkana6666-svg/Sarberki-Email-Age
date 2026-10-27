-- TEST ONLY. Restore the exact captured Writer; do not alter case or audit rows.
begin;
do $rollback$
declare s record; p record; expected text; grantee record;
 marker text := ' if coalesce(p_data->''state''->>''approval'',''pending'') <> ''pending'' then';
 addition text := E' if p_data ? ''clarificationApproval'' then\n  raise exception ''clarification approval RPC only'' using errcode=''42501'';\n end if;\n';
begin
 if current_setting('sarberki.approval_install_project_ref',true) is distinct from 'mojnqizbcaczstguikpv'
 or not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref='mojnqizbcaczstguikpv')
 or not exists(select 1 from public.sc_tenants where tenant_id='sarberki-test' and test_only)
 or exists(select 1 from public.sc_tenants where not test_only or tenant_id not in ('sarberki-test','demo-test'))
 or (select count(*) from sc_clarification_rollback_private.writer_snapshot) <> 1 then
  raise exception 'rollback test binding or snapshot missing'; end if;
 select * into strict s from sc_clarification_rollback_private.writer_snapshot;
 select p0.proowner, p0.proacl, pg_get_functiondef(p0.oid) as definition into strict p
 from pg_proc p0 where p0.oid='public.sc_write_case(text,text,bigint,jsonb)'::regprocedure;
 if encode(sha256(convert_to(s.definition,'UTF8')),'hex') is distinct from s.definition_sha256
 or position(marker in s.definition)=0 or position(addition in s.definition)>0 then
  raise exception 'snapshot integrity or expected guard invalid'; end if;
 expected := replace(s.definition,marker,addition||marker);
 if p.definition is distinct from expected or p.proowner is distinct from s.owner_oid
 or p.proacl is distinct from s.acl
 or to_regprocedure('public.sc_approve_clarification(text,text,bigint,text,jsonb)') is null then
  raise exception 'installed Writer, owner, ACL or RPC changed; rollback stopped'; end if;
 -- Revoke all explicit non-owner grants, including PUBLIC, before dropping RPC.
 for grantee in
  select distinct a.grantee from pg_proc f,
   lateral aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a
  where f.oid='public.sc_approve_clarification(text,text,bigint,text,jsonb)'::regprocedure
   and a.grantee<>f.proowner
 loop
  if grantee.grantee=0 then
   execute 'revoke all on function public.sc_approve_clarification(text,text,bigint,text,jsonb) from public';
  else
   execute format('revoke all on function public.sc_approve_clarification(text,text,bigint,text,jsonb) from %I',pg_get_userbyid(grantee.grantee));
  end if;
 end loop;
 drop function public.sc_approve_clarification(text,text,bigint,text,jsonb);
 execute s.definition;
 if (select pg_get_functiondef(oid) from pg_proc where oid='public.sc_write_case(text,text,bigint,jsonb)'::regprocedure) is distinct from s.definition
 or (select proowner from pg_proc where oid='public.sc_write_case(text,text,bigint,jsonb)'::regprocedure) is distinct from s.owner_oid
 or (select proacl from pg_proc where oid='public.sc_write_case(text,text,bigint,jsonb)'::regprocedure) is distinct from s.acl then
  raise exception 'Writer restoration mismatch'; end if;
end $rollback$;
commit;
