-- Read-only verification after deployment/test-mailbox/followup.sql.
do $$ begin
 if to_regprocedure('public.sc_tm_followup(text,text,bigint,jsonb,jsonb,jsonb,jsonb)') is null then raise exception 'VERIFY FAIL: function missing'; end if;
 if not has_function_privilege('authenticated','public.sc_tm_followup(text,text,bigint,jsonb,jsonb,jsonb,jsonb)','execute') then raise exception 'VERIFY FAIL: authenticated execute missing'; end if;
 if has_function_privilege('anon','public.sc_tm_followup(text,text,bigint,jsonb,jsonb,jsonb,jsonb)','execute') then raise exception 'VERIFY FAIL: anon can execute'; end if;
 if exists(select 1 from pg_roles where rolname='service_role') and has_function_privilege('service_role','public.sc_tm_followup(text,text,bigint,jsonb,jsonb,jsonb,jsonb)','execute') then raise exception 'VERIFY FAIL: service_role can execute'; end if;
end $$;
select 'VERIFY PASS' as result,(select count(*) from public.sc_cases) as cases,(select count(*) from public.sc_audit) as audit_rows;
