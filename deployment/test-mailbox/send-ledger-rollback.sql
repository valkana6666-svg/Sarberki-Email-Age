-- TEST ONLY. Removes the send-ledger functions. The ledger table (the record of what was sent) is kept.
-- Before running this, remove the Netlify switch CASE_TEST_MAILBOX_SEND_LEDGER and redeploy, otherwise
-- the send button fails closed (STORAGE_FAILURE) instead of sending.
begin;
do $$ begin
 if current_setting('sarberki.tm_install_project_ref',true) is distinct from 'mojnqizbcaczstguikpv' then
  raise exception 'unexpected project';
 end if;
end $$;
drop function if exists public.sc_tm_send_finish(text,uuid,text,text);
drop function if exists public.sc_tm_send_claim(text,text,bigint,text);
commit;
