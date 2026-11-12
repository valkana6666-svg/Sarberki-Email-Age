-- Read-only verification after deployment/test-mailbox/booking-deposit-tz.sql.
do $$ declare f text:='public.sc_tm_deposit_received(text,text,bigint,date)'; begin
 if to_regprocedure(f) is null then raise exception 'VERIFY FAIL: function missing %',f; end if;
 if position('p_received_on>(now() at time zone' in pg_get_functiondef(to_regprocedure(f)))=0 then raise exception 'VERIFY FAIL: Budapest date check missing'; end if;
 if not has_function_privilege('authenticated',f,'execute') then raise exception 'VERIFY FAIL: authenticated execute missing'; end if;
 if has_function_privilege('anon',f,'execute') then raise exception 'VERIFY FAIL: anon can execute'; end if;
end $$;
select 'VERIFY PASS' as result,(select count(*) from public.sc_cases) as cases,(select count(*) from public.sc_audit) as audit_rows;
