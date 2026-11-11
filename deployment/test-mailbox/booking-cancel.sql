-- V2 (owner 2026-11-11): booking cancellation from the daily operator view, test-mailbox cases only.
-- sc_tm_cancel_booking: a finalized or deposit_received booking -> 'cancelled' (unit freed for our own collision
-- check), with who/when/reason; audit row 'tm_booking_cancelled'. The Previo TEST record is cancelled by the server
-- (V2 bookings only); no guest letter is sent here. Requires install.sql, booking-status.sql and booking-unit.sql.
begin;
do $$ begin
 if coalesce(current_setting('sarberki.tm_install_project_ref',true),'')!~'^[a-z]{20}$'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or to_regprocedure('public.sc_tm_actor(text,text)') is null
 or to_regprocedure('public.sc_tm_deposit_received(text,text,bigint,date)') is null
 or to_regclass('public.sc_test_mailbox_cases') is null
 or not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref=current_setting('sarberki.tm_install_project_ref')) then
  raise exception 'verified project, fresh backup and booking-status install required';
 end if;
end $$;

create or replace function public.sc_tm_cancel_booking(p_tenant text,p_case text,p_expected bigint,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; c public.sc_cases%rowtype; result public.sc_cases%rowtype; changed jsonb;
begin
 actor:=public.sc_tm_actor(p_tenant,'write');
 if p_expected is null or p_expected<1 or p_reason is null or btrim(p_reason)='' or length(p_reason)>300 or position(chr(10) in p_reason)>0 then
  raise exception 'invalid cancellation' using errcode='22023';
 end if;
 select * into c from public.sc_cases where tenant_id=p_tenant and case_id=p_case and revision=p_expected for update;
 if not found then return null; end if;
 if not exists(select 1 from public.sc_test_mailbox_cases where tenant_id=p_tenant and case_id=p_case) then
  raise exception 'test-mailbox case required' using errcode='42501';
 end if;
 if coalesce(c.data->'booking'->>'status','') not in ('finalized','deposit_received') then
  raise exception 'active booking required' using errcode='22023';
 end if;
 changed:=jsonb_set(c.data,'{booking,status}','"cancelled"');
 changed:=jsonb_set(changed,'{booking,cancelled}',jsonb_build_object('at',now(),'by',actor,'reason',btrim(p_reason),'previousStatus',c.data->'booking'->>'status'));
 update public.sc_cases set revision=p_expected+1,data=changed,updated_at=now(),updated_by=actor
  where tenant_id=p_tenant and case_id=p_case and revision=p_expected returning * into result;
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values(p_tenant,p_case,p_expected+1,actor,'tm_booking_cancelled',encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
 return to_jsonb(result);
end $$;

revoke all on function public.sc_tm_cancel_booking(text,text,bigint,text) from public,anon;
grant execute on function public.sc_tm_cancel_booking(text,text,bigint,text) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.sc_tm_cancel_booking(text,text,bigint,text) from service_role';
 end if;
end $$;
commit;
