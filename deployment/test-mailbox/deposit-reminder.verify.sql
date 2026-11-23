-- Read-only verification after deployment/test-mailbox/deposit-reminder.sql.
do $$ declare f text:='public.sc_tm_deposit_reminder(text,text,bigint,jsonb,jsonb)'; d text; begin
 if to_regprocedure(f) is null then raise exception 'VERIFY FAIL: function missing %',f; end if;
 d:=pg_get_functiondef(to_regprocedure(f));
 if position('test-mailbox-deposit-reminder-v1' in d)=0 or position('interval ''2 days''' in d)=0 or position('reminder already prepared' in d)=0 then
  raise exception 'VERIFY FAIL: attestation, 2-day window or once-only check missing'; end if;
 if not has_function_privilege('authenticated',f,'execute') then raise exception 'VERIFY FAIL: authenticated execute missing'; end if;
 if has_function_privilege('anon',f,'execute') then raise exception 'VERIFY FAIL: anon can execute'; end if;
end $$;
select 'VERIFY PASS' as result,(select count(*) from public.sc_cases) as cases,(select count(*) from public.sc_audit) as audit_rows;
