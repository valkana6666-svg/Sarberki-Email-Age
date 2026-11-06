-- Read-only verification after deployment/test-mailbox/booking-status.sql.
do $$ declare f text; begin
 foreach f in array array['public.sc_tm_confirm_booking(text,text,bigint,jsonb,jsonb,jsonb)','public.sc_tm_deposit_received(text,text,bigint,date)'] loop
  if to_regprocedure(f) is null then raise exception 'VERIFY FAIL: function missing %',f; end if;
  if not has_function_privilege('authenticated',f,'execute') then raise exception 'VERIFY FAIL: authenticated execute missing %',f; end if;
  if has_function_privilege('anon',f,'execute') then raise exception 'VERIFY FAIL: anon can execute %',f; end if;
 end loop;
end $$;
select 'VERIFY PASS' as result,(select count(*) from public.sc_cases) as cases,(select count(*) from public.sc_audit) as audit_rows;
