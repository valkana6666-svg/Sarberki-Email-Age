-- TEST – V3-3/V3-4 switch-on (owner 2026-11-14, "ma meg kell csinálni"): the shared intake (install.sql) plus the
-- dedicated intake account in the registry. The account (Supabase Auth user intake-test@sarberki.invalid) is created
-- beforehand in the Supabase dashboard; it gets NO read/write/approve membership, only the intake registry, so it can
-- call nothing but sc_intake_create (least privilege, no service role). Rollback: rollback.sql.
\ir install.sql
begin;
do $$ declare n int; begin
 if coalesce(current_setting('sarberki.tm_install_project_ref',true),'')!~'^[a-z]{20}$'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$' then
  raise exception 'verified TEST project and fresh backup required';
 end if;
 select count(*) into n from auth.users where lower(email)='intake-test@sarberki.invalid';
 if n<>1 then raise exception 'intake account intake-test@sarberki.invalid missing: create it in Supabase Auth first'; end if;
 if exists(select 1 from public.sc_memberships m join auth.users u on u.id=m.user_id where lower(u.email)='intake-test@sarberki.invalid') then
  raise exception 'the intake account must not have an operator membership';
 end if;
end $$;
insert into public.sc_intake_actors(tenant_id,user_id)
 select 'sarberki-test',id from auth.users where lower(email)='intake-test@sarberki.invalid' on conflict do nothing;
commit;
