-- TEST – owner 2026-11-24: Pushover to the owner's phone 48 hours before a deposit deadline and when it has passed
-- without the deposit marked. The scheduled server job signs in with the EXISTING intake account (sc_intake_actors,
-- no membership) and may call only this one read function: finalized test-mailbox bookings whose deposit deadline is
-- between 2 hours ago and 50 hours from now, reduced to type, dates and deadline – no guest name, e-mail, phone or
-- message. Nothing is written. Requires deployment/intake/install.sql and test-mailbox booking-status.sql.
-- Rollback: deposit-alerts-rollback.sql.
begin;
do $$ begin
 if coalesce(current_setting('sarberki.tm_install_project_ref',true),'')!~'^[a-z]{20}$'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or to_regprocedure('public.sc_intake_actor(text)') is null
 or to_regprocedure('public.sc_tm_deposit_received(text,text,bigint,date)') is null then
  raise exception 'verified project, fresh backup, intake and booking-status install required';
 end if;
end $$;

create or replace function public.sc_deposit_alerts(p_tenant text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=public.sc_intake_actor(p_tenant);
 return coalesce((select jsonb_agg(jsonb_build_object('caseId',c.case_id,'unit',left(c.data->'state'->'values'->>'unit',30),
   'arrival',c.data->'state'->'values'->>'arrival','departure',c.data->'state'->'values'->>'departure',
   'deadlineUtc',c.data->'booking'->'deposit'->>'deadlineUtc') order by c.case_id)
  from public.sc_cases c join public.sc_test_mailbox_cases t on t.tenant_id=c.tenant_id and t.case_id=c.case_id
  where c.tenant_id=p_tenant and c.data->'booking'->>'status'='finalized'
   and (c.data->'booking'->'deposit'->>'deadlineUtc') is not null
   and (c.data->'booking'->'deposit'->>'deadlineUtc')::timestamptz between now()-interval '2 hours' and now()+interval '50 hours'),'[]'::jsonb);
end $$;

revoke all on function public.sc_deposit_alerts(text) from public,anon;
grant execute on function public.sc_deposit_alerts(text) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.sc_deposit_alerts(text) from service_role';
 end if;
end $$;
commit;
