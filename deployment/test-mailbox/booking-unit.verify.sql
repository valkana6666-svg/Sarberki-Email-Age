-- Read-only verification after deployment/test-mailbox/booking-unit.sql.
do $$ declare f text:='public.sc_tm_confirm_booking(text,text,bigint,jsonb,jsonb,jsonb)'; begin
 if to_regprocedure(f) is null then raise exception 'VERIFY FAIL: function missing'; end if;
 if position('sc_tm_unit:' in pg_get_functiondef(to_regprocedure(f)))=0 then raise exception 'VERIFY FAIL: collision check missing'; end if;
 if not has_function_privilege('authenticated',f,'execute') then raise exception 'VERIFY FAIL: authenticated execute missing'; end if;
 if has_function_privilege('anon',f,'execute') then raise exception 'VERIFY FAIL: anon can execute'; end if;
end $$;
select 'VERIFY PASS' as result,(select count(*) from public.sc_cases) as cases,(select count(*) from public.sc_audit) as audit_rows;
