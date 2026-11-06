-- Read-only verification after deployment/test-mailbox/send-ledger.sql (run by the TEST install workflow).
do $$ begin
 if to_regclass('public.sc_tm_send_ledger') is null then raise exception 'VERIFY FAIL: ledger table missing'; end if;
 if not has_function_privilege('authenticated','public.sc_tm_send_claim(text,text,bigint,text)','execute')
 or not has_function_privilege('authenticated','public.sc_tm_send_finish(text,uuid,text,text)','execute') then raise exception 'VERIFY FAIL: authenticated execute missing'; end if;
 if has_function_privilege('anon','public.sc_tm_send_claim(text,text,bigint,text)','execute') then raise exception 'VERIFY FAIL: anon can execute'; end if;
 if exists(select 1 from pg_roles where rolname='service_role') and has_function_privilege('service_role','public.sc_tm_send_claim(text,text,bigint,text)','execute') then raise exception 'VERIFY FAIL: service_role can execute'; end if;
 if has_table_privilege('authenticated','public.sc_tm_send_ledger','insert') or has_table_privilege('authenticated','public.sc_tm_send_ledger','update') then raise exception 'VERIFY FAIL: clients can write the ledger'; end if;
 if not (select relrowsecurity from pg_class where oid='public.sc_tm_send_ledger'::regclass) then raise exception 'VERIFY FAIL: RLS off'; end if;
end $$;
select 'VERIFY PASS' as result,(select count(*) from public.sc_cases) as cases,(select count(*) from public.sc_audit) as audit_rows,
 (select count(*) from public.sc_tm_send_ledger) as ledger_rows,
 md5(coalesce((select string_agg(tenant_id||user_id::text||can_read||can_write||can_approve,',' order by tenant_id,user_id) from public.sc_memberships),'')) as membership_hash;
