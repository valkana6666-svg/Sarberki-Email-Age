-- Read-only verification after deployment/intake/phone-transcript.sql.
do $$ declare f text:='public.sc_intake_phone_transcript(text,text,text,jsonb)'; d text; begin
 if to_regprocedure(f) is null then raise exception 'VERIFY FAIL: function missing %',f; end if;
 d:=pg_get_functiondef(to_regprocedure(f));
 if position('sc_intake_actor(p_tenant)' in d)=0 or position('intake-transcript-v1' in d)=0 or position('interval ''3 hours''' in d)=0
 or position('''callTranscript'',t' in d)=0 then raise exception 'VERIFY FAIL: guard missing'; end if;
 if not has_function_privilege('authenticated',f,'execute') then raise exception 'VERIFY FAIL: authenticated execute missing'; end if;
 if has_function_privilege('anon',f,'execute') then raise exception 'VERIFY FAIL: anon can execute'; end if;
end $$;
select 'VERIFY PASS' as result,(select count(*) from public.sc_cases) as cases,(select count(*) from public.sc_audit) as audit_rows;
