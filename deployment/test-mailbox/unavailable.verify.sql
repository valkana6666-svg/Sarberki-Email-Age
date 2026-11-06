-- Read-only verification after deployment/test-mailbox/unavailable.sql.
do $$ begin
 if to_regprocedure('public.sc_tm_unavailable_redraft(text,text,bigint,jsonb,jsonb)') is null then raise exception 'VERIFY FAIL: function missing'; end if;
 if not has_function_privilege('authenticated','public.sc_tm_unavailable_redraft(text,text,bigint,jsonb,jsonb)','execute') then raise exception 'VERIFY FAIL: authenticated execute missing'; end if;
 if has_function_privilege('anon','public.sc_tm_unavailable_redraft(text,text,bigint,jsonb,jsonb)','execute') then raise exception 'VERIFY FAIL: anon can execute'; end if;
end $$;
select 'VERIFY PASS' as result,(select count(*) from public.sc_cases) as cases,(select count(*) from public.sc_audit) as audit_rows;
