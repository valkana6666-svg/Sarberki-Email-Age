-- Rollback of deployment/intake/install.sql: removes the intake functions and registry. Cases already created by
-- intake stay (they are ordinary test-mailbox cases with their audit rows).
begin;
drop function if exists public.sc_intake_create(text,text,jsonb,jsonb);
drop function if exists public.sc_intake_actor(text);
drop table if exists public.sc_intake_actors;
commit;
