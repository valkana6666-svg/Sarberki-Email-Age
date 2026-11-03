-- Removes the mailbox-case RPCs and disables the switch (TEST or LIVE, project from the deployment profile). Cases, audit, message keys and the
-- provenance registry are kept unchanged; existing functions were never modified, so nothing is restored.
begin;
do $$ begin
 if to_regclass('public.sc_deployment_profile') is null
 or current_setting('sarberki.tm_install_project_ref',true) is distinct from
  (select project_ref from public.sc_deployment_profile where singleton) then
  raise exception 'unexpected project';
 end if;
end $$;
update public.sc_test_mailbox_config set enabled=false where singleton;
drop function if exists public.sc_tm_decide(text,text,bigint,text,text,text);
drop function if exists public.sc_tm_redraft(text,text,bigint,jsonb);
drop function if exists public.sc_tm_create(text,text,jsonb,jsonb);
drop function if exists public.sc_tm_actor(text,text);
drop function if exists public.sc_tm_profile();
commit;
