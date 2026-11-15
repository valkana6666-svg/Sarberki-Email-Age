-- Rollback of guest-contact.sql (stored names/e-mails stay in the cases; only the function is removed).
begin;
drop function if exists public.sc_tm_set_guest_contact(text,text,bigint,text,text);
commit;
