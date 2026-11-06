-- Removes the follow-up function. Stored follow-up messages, drafts and audit rows are kept.
begin;
drop function if exists public.sc_tm_followup(text,text,bigint,jsonb,jsonb,jsonb,jsonb);
commit;
