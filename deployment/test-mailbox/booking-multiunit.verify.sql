-- Read-only verification after deployment/test-mailbox/booking-multiunit.sql.
do $$ declare f text:='public.sc_tm_confirm_booking(text,text,bigint,jsonb,jsonb,jsonb)'; src text; begin
 if to_regprocedure(f) is null then raise exception 'VERIFY FAIL: function missing %',f; end if;
 if not has_function_privilege('authenticated',f,'execute') then raise exception 'VERIFY FAIL: authenticated execute missing'; end if;
 if has_function_privilege('anon',f,'execute') then raise exception 'VERIFY FAIL: anon can execute'; end if;
 select prosrc into src from pg_proc where oid=to_regprocedure(f);
 if position('att_unit' in src)=0 then raise exception 'VERIFY FAIL: multi-unit definition not active'; end if;
end $$;
select 'VERIFY PASS' as result,(select count(*) from public.sc_cases) as cases,(select count(*) from public.sc_audit) as audit_rows;
