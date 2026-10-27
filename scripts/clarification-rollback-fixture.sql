\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
\i supabase/migrations/202610090001_case_store.sql
insert into public.sc_tenants values('sarberki-test','Fictional only',true);
set sarberki.approval_install_project_ref='mojnqizbcaczstguikpv';
set sarberki.receipt_install_project_ref='mojnqizbcaczstguikpv';
set sarberki.approval_backup_sha256='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
set sarberki.receipt_backup_sha256='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
\i deployment/cloud-approval/install.sql
\i deployment/exact-receipt/install.sql
insert into public.sc_private_exact_receipt(enabled,tenant_id,case_id,expected_source,expected_message,body_sha256)
select true,'sarberki-test','13c8ecb7-f836-4e2c-9833-d58ee96f2dda',
 '{"provider":"gmail","mailbox_id":"fake","message_id":"fake","thread_id":"fake","received_at":"fake","rfc_message_id":"fake","in_reply_to":null,"references":[],"subject":"fake","to":"fake","from":"fake","from_email":"fake@example.test"}'::jsonb,
 '{"sender":"fake@example.test","text":"synthetic","mailbox_id":"fake","message_id":"fake","thread_id":"fake","received_at":"fake","rfc_message_id":"fake","references":[]}'::jsonb,
 encode(sha256(convert_to('synthetic','UTF8')),'hex');
insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash)
values ('sarberki-test','synthetic-audit',1,'11111111-1111-4111-8111-111111111111','synthetic_before','synthetic');
create temporary table expected_writer as
select pg_get_functiondef(p.oid) definition, p.proacl acl, p.proowner owner_oid
from pg_proc p where p.oid='public.sc_write_case(text,text,bigint,jsonb)'::regprocedure;
\i deployment/cloud-approval/clarification-snapshot.sql
\i deployment/cloud-approval/clarification-only.sql
insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash)
values ('sarberki-test','synthetic-audit',2,'11111111-1111-4111-8111-111111111111','synthetic_after','synthetic');
create temporary table expected_audit as select * from public.sc_audit;
do $$ begin
 if to_regprocedure('public.sc_approve_clarification(text,text,bigint,text,jsonb)') is null
 or position('clarification approval RPC only' in pg_get_functiondef('public.sc_write_case(text,text,bigint,jsonb)'::regprocedure))=0
 then raise exception 'installation not verified'; end if;
 if has_schema_privilege('authenticated','sc_clarification_rollback_private','usage')
 or has_table_privilege('authenticated','sc_clarification_rollback_private.writer_snapshot','select')
 then raise exception 'snapshot exposed'; end if;
end $$;
\i deployment/cloud-approval/clarification-rollback.sql
do $$ begin
 if to_regprocedure('public.sc_approve_clarification(text,text,bigint,text,jsonb)') is not null
 or exists(select 1 from expected_writer e, pg_proc p where p.oid='public.sc_write_case(text,text,bigint,jsonb)'::regprocedure
 and (pg_get_functiondef(p.oid) is distinct from e.definition or p.proacl is distinct from e.acl or p.proowner is distinct from e.owner_oid))
 or exists ((select * from expected_audit except select * from public.sc_audit)
            union all (select * from public.sc_audit except select * from expected_audit))
 then raise exception 'rollback verification failed'; end if;
end $$;
\echo 'PASS: captured Writer definition, owner, ACL; removed RPC; preserved both synthetic audit rows'
