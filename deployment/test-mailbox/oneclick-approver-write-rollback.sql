-- Rollback of oneclick-approver-write.sql: removes exactly the logged write grants, then the log.
begin;
do $$ begin
 if current_setting('sarberki.tm_install_project_ref',true) is distinct from 'mojnqizbcaczstguikpv'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$' then
  raise exception 'verified TEST project and fresh backup required';
 end if;
end $$;
update public.sc_memberships m set can_write=false from public.sc_oneclick_write_grants g
 where m.tenant_id=g.tenant_id and m.user_id=g.user_id and m.can_approve;
drop table public.sc_oneclick_write_grants;
commit;
