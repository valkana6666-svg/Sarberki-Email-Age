-- Read-only verification after enable-chat.sql (counts only, no ids).
\ir install.verify.sql
do $$ begin
 if (select count(*) from public.sc_intake_actors a join auth.users u on u.id=a.user_id
     where a.tenant_id='sarberki-test' and lower(u.email)='intake-test@sarberki.invalid')<>1 then raise exception 'VERIFY FAIL: intake account not registered'; end if;
 if exists(select 1 from public.sc_memberships m join public.sc_intake_actors a on a.user_id=m.user_id) then raise exception 'VERIFY FAIL: intake account has a membership'; end if;
end $$;
select 'VERIFY PASS' as result,(select count(*) from public.sc_intake_actors) as intake_actors;
