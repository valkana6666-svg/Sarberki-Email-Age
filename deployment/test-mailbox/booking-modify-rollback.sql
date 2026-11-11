-- Removes the modification function. Stored bookings, their modification history, drafts and audit rows are kept.
begin;
drop function if exists public.sc_tm_modify_booking(text,text,bigint,jsonb,jsonb,jsonb);
commit;
