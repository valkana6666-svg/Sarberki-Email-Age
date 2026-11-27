-- Rollback of phone-transcript.sql: the function is removed; stored transcripts stay in the cases (display only).
begin;
drop function if exists public.sc_intake_phone_transcript(text,text,text,jsonb);
commit;
