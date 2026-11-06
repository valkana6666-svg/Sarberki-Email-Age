-- Removes the booking-status functions. Stored booking status, drafts and audit rows are kept.
begin;
drop function if exists public.sc_tm_confirm_booking(text,text,bigint,jsonb,jsonb,jsonb);
drop function if exists public.sc_tm_deposit_received(text,text,bigint,date);
commit;
