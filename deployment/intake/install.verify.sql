-- Read-only verification after deployment/intake/install.sql.
do $$ declare f text:='public.sc_intake_create(text,text,jsonb,jsonb)'; begin
 if to_regprocedure(f) is null or to_regprocedure('public.sc_intake_actor(text)') is null then raise exception 'VERIFY FAIL: function missing'; end if;
 if to_regclass('public.sc_intake_actors') is null then raise exception 'VERIFY FAIL: registry missing'; end if;
 if not (select relrowsecurity from pg_class where oid='public.sc_intake_actors'::regclass) then raise exception 'VERIFY FAIL: RLS off on sc_intake_actors'; end if;
 if not has_function_privilege('authenticated',f,'execute') then raise exception 'VERIFY FAIL: authenticated execute missing'; end if;
 if has_function_privilege('anon',f,'execute') then raise exception 'VERIFY FAIL: anon can execute'; end if;
 if has_function_privilege('authenticated','public.sc_intake_actor(text)','execute') then raise exception 'VERIFY FAIL: actor guard callable'; end if;
 if has_table_privilege('authenticated','public.sc_intake_actors','select') then raise exception 'VERIFY FAIL: registry readable'; end if;
end $$;
select 'VERIFY PASS' as result,(select count(*) from public.sc_cases) as cases,(select count(*) from public.sc_intake_actors) as intake_actors;
