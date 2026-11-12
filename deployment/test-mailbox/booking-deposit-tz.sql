-- TEST (later the live profile) – fix 2026-11-12: "Foglaló beérkezett" with today's date was refused between
-- 23:00 and 24:00 UTC (00:00–01:00 Budapest; 22–24 UTC in summer): the booking day is the Budapest date, but the
-- "not in the future" check used current_date (UTC). Replaces ONLY sc_tm_deposit_received (same signature): the
-- future check now uses the Budapest date as well. Requires booking-status.sql. Rollback: booking-deposit-tz-rollback.sql.
begin;
do $$ begin
 if coalesce(current_setting('sarberki.tm_install_project_ref',true),'')!~'^[a-z]{20}$'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or to_regprocedure('public.sc_tm_deposit_received(text,text,bigint,date)') is null then
  raise exception 'verified project, fresh backup and booking-status install required';
 end if;
end $$;

create or replace function public.sc_tm_deposit_received(p_tenant text,p_case text,p_expected bigint,p_received_on date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; c public.sc_cases%rowtype; result public.sc_cases%rowtype; changed jsonb;
begin
 actor:=public.sc_tm_actor(p_tenant,'write');
 if p_expected is null or p_expected<1 or p_received_on is null or p_received_on>(now() at time zone 'Europe/Budapest')::date then
  raise exception 'invalid deposit receipt' using errcode='22023';
 end if;
 select * into c from public.sc_cases where tenant_id=p_tenant and case_id=p_case and revision=p_expected for update;
 if not found then return null; end if;
 if not exists(select 1 from public.sc_test_mailbox_cases where tenant_id=p_tenant and case_id=p_case) then
  raise exception 'test-mailbox case required' using errcode='42501';
 end if;
 if c.data->'booking'->>'status' is distinct from 'finalized' then
  raise exception 'finalized booking required' using errcode='22023';
 end if;
 if p_received_on<((c.data->'booking'->'previo'->>'recordedAt')::timestamptz at time zone 'Europe/Budapest')::date then
  raise exception 'receipt before booking' using errcode='22023';
 end if;
 changed:=jsonb_set(c.data,'{booking,status}','"deposit_received"');
 changed:=jsonb_set(changed,'{booking,depositReceived}',jsonb_build_object('on',p_received_on,'recordedBy',actor,'recordedAt',now()));
 update public.sc_cases set revision=p_expected+1,data=changed,updated_at=now(),updated_by=actor
  where tenant_id=p_tenant and case_id=p_case and revision=p_expected returning * into result;
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values(p_tenant,p_case,p_expected+1,actor,'tm_deposit_received',encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
 return to_jsonb(result);
end $$;

revoke all on function public.sc_tm_deposit_received(text,text,bigint,date) from public,anon;
grant execute on function public.sc_tm_deposit_received(text,text,bigint,date) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.sc_tm_deposit_received(text,text,bigint,date) from service_role';
 end if;
end $$;
commit;
