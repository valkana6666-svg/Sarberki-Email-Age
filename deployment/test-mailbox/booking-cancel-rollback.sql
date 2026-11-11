-- Removes the cancellation function. Stored booking states, drafts and audit rows are kept.
begin;
drop function if exists public.sc_tm_cancel_booking(text,text,bigint,text);
commit;
