-- Read-only verification after deployment/intake/deposit-alerts-2.sql (74-hour window).
do $$ declare f text:='public.sc_deposit_alerts(text)'; d text; begin
 if to_regprocedure(f) is null then raise exception 'VERIFY FAIL: function missing %',f; end if;
 d:=pg_get_functiondef(to_regprocedure(f));
 if position('sc_intake_actor(p_tenant)' in d)=0 or position('interval ''74 hours''' in d)=0 then raise exception 'VERIFY FAIL: guard or window missing'; end if;
 if position('email' in d)>0 or position('phone' in d)>0 or position('''name''' in d)>0 then raise exception 'VERIFY FAIL: personal field exposed'; end if;
 if not has_function_privilege('authenticated',f,'execute') then raise exception 'VERIFY FAIL: authenticated execute missing'; end if;
 if has_function_privilege('anon',f,'execute') then raise exception 'VERIFY FAIL: anon can execute'; end if;
end $$;
select 'VERIFY PASS' as result,(select count(*) from public.sc_cases) as cases,(select count(*) from public.sc_audit) as audit_rows;
