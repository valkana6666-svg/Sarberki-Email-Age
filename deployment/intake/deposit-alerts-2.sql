-- TEST – owner 2026-11-25 („állítsd át reggel 8-ra”): the first deposit alert moves to 08:00 Budapest two days
-- before the deadline day, up to ~64 h ahead – so the read window grows from 50 to 74 hours. Same function, same
-- intake-only access, same fields (type, dates, deadline; no guest name, e-mail, phone or message). Nothing written.
-- Rollback: deposit-alerts-2-rollback.sql (back to the 50-hour window).
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
   and (c.data->'booking'->'deposit'->>'deadlineUtc')::timestamptz between now()-interval '2 hours' and now()+interval '74 hours'),'[]'::jsonb);
end $$;

revoke all on function public.sc_deposit_alerts(text) from public,anon;
grant execute on function public.sc_deposit_alerts(text) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.sc_deposit_alerts(text) from service_role';
 end if;
end $$;
commit;
