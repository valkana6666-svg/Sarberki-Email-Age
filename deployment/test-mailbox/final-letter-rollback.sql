-- Rollback of final-letter.sql: the function is removed; prepared drafts stay in the cases.
begin;
drop function if exists public.sc_tm_final_letter(text,text,bigint,jsonb,jsonb);
commit;
