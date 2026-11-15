-- Read-only verification after guest-contact.sql.
do $$ declare f text:='public.sc_tm_set_guest_contact(text,text,bigint,text,text)'; begin
 if to_regprocedure(f) is null then raise exception 'VERIFY FAIL: function missing'; end if;
 if not has_function_privilege('authenticated',f,'execute') then raise exception 'VERIFY FAIL: authenticated execute missing'; end if;
 if has_function_privilege('anon',f,'execute') then raise exception 'VERIFY FAIL: anon can execute'; end if;
end $$;
select 'VERIFY PASS' as result,(select count(*) from public.sc_cases) as cases;
