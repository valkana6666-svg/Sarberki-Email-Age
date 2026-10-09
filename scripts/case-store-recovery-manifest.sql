-- Read-only owner manifest. Contains no password hashes, tokens or secret keys.
-- Run identically on source and isolated restore; compare the JSON output.
begin transaction isolation level repeatable read read only;
select jsonb_build_object(
 'tables',(select jsonb_agg(to_jsonb(x) order by relname) from (
  select c.relname,c.relrowsecurity,c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('sc_tenants','sc_memberships','sc_cases','sc_message_keys','sc_audit')) x),
 'counts',jsonb_build_object('tenants',(select count(*) from sc_tenants),'memberships',(select count(*) from sc_memberships),'cases',(select count(*) from sc_cases),'message_keys',(select count(*) from sc_message_keys),'audit',(select count(*) from sc_audit)),
 'policies',(select jsonb_agg(to_jsonb(x) order by tablename,policyname) from (select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename like 'sc_%') x),
 'constraints',(select jsonb_agg(to_jsonb(x) order by table_name,name) from (
  select c.conrelid::regclass::text as table_name,c.conname as name,pg_get_constraintdef(c.oid) as definition
  from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname like 'sc_%') x),
 'grants',(select jsonb_agg(to_jsonb(x) order by table_name,grantee,privilege_type) from (select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name like 'sc_%') x),
 'functions',(select jsonb_agg(to_jsonb(x) order by name) from (
  select p.proname as name,p.prosecdef as security_definer,p.proconfig as configuration,p.proacl::text as grants,md5(pg_get_functiondef(p.oid)) as definition_checksum
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('sc_write_case','sc_has_permission')) x),
 'audit_gaps',(select count(*) from (select c.tenant_id,c.case_id from sc_cases c left join sc_audit a using(tenant_id,case_id) group by c.tenant_id,c.case_id,c.revision having count(a.event_id)<>c.revision or min(a.revision)<>1 or max(a.revision)<>c.revision) x),
 'latest_hash_mismatches',(select count(*) from sc_cases c left join sc_audit a on a.tenant_id=c.tenant_id and a.case_id=c.case_id and a.revision=c.revision where a.data_hash is distinct from encode(sha256(convert_to(c.data::text,'UTF8')),'hex')),
 'audit_checksum',(select md5(coalesce(string_agg(row_to_json(a)::text,E'\n' order by event_id),'')) from sc_audit a),
 'case_checksum',(select md5(coalesce(string_agg(row_to_json(c)::text,E'\n' order by tenant_id,case_id),'')) from sc_cases c)
) as recovery_manifest;
commit;
