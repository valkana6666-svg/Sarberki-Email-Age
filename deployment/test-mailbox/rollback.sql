-- TEST ONLY. Removes the test-mailbox RPCs and disables the switch. Cases, audit, message keys and the
-- provenance registry are kept unchanged; existing functions were never modified, so nothing is restored.
begin;
do $$ begin
 if current_setting('sarberki.tm_install_project_ref',true) is distinct from 'mojnqizbcaczstguikpv' then
  raise exception 'unexpected project';
 end if;
end $$;
update public.sc_test_mailbox_config set enabled=false where singleton;
drop function if exists public.sc_tm_decide(text,text,bigint,text,text,text);
drop function if exists public.sc_tm_redraft(text,text,bigint,jsonb);
drop function if exists public.sc_tm_create(text,text,jsonb,jsonb);
drop function if exists public.sc_tm_actor(text,text);
commit;
