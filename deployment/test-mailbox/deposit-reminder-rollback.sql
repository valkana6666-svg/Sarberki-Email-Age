-- Rollback of deposit-reminder.sql: removes the reminder function. Cases keep their data (a prepared reminder draft
-- stays in the history; the normal flows are unchanged).
begin;
drop function if exists public.sc_tm_deposit_reminder(text,text,bigint,jsonb,jsonb);
commit;
