-- TEST (later the live profile) – V1 booking completion, owner/ChatGPT task 2026-11-06. Additive; requires
-- deployment/test-mailbox/install.sql. The operator records the booking in Previo BY HAND; nothing here books,
-- pays or sends.
-- 1. sc_tm_confirm_booking: the operator attests the Previo recording (reference + time). The SERVER builds the
--    confirmation draft (price list, deposit % of accommodation and receipt deadline from the central policy) and
--    attests it (scope test-mailbox-confirm-v1). Booking status -> 'finalized' ("Véglegesítve"); the new draft goes
--    to pending, i.e. it still needs the usual human approval before the separate send step.
-- 2. sc_tm_deposit_received: separate operator step; only a finalized booking; status -> 'deposit_received'.
--    Recording in Previo is never treated as payment.
begin;
do $$ begin
 if coalesce(current_setting('sarberki.tm_install_project_ref',true),'')!~'^[a-z]{20}$'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or to_regprocedure('public.sc_tm_actor(text,text)') is null
 or to_regclass('public.sc_test_mailbox_cases') is null
 or not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref=current_setting('sarberki.tm_install_project_ref')) then
  raise exception 'verified project, fresh backup and test-mailbox install required';
 end if;
end $$;

create or replace function public.sc_tm_confirm_booking(p_tenant text,p_case text,p_expected bigint,p_booking jsonb,p_draft jsonb,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; c public.sc_cases%rowtype; result public.sc_cases%rowtype; changed jsonb; key text; fields text[];
begin
 actor:=public.sc_tm_actor(p_tenant,'write');
 if p_expected is null or p_expected<1 or jsonb_typeof(p_draft) is distinct from 'object' or jsonb_typeof(p_booking) is distinct from 'object'
 or exists(select 1 from jsonb_object_keys(p_draft) k where k not in ('text','operatorReviewText'))
 or exists(select 1 from jsonb_object_keys(p_booking) k where k not in ('previoReference','previoRecordedAt','depositPct','depositAmount','depositDeadlineUtc'))
 or jsonb_typeof(p_draft->'text') is distinct from 'string' or btrim(p_draft->>'text')='' or length(p_draft->>'text')>20000
 or jsonb_typeof(p_draft->'operatorReviewText') is distinct from 'string' or length(p_draft->>'operatorReviewText')>40000
 or coalesce(p_booking->>'previoReference','')!~'^[A-Za-z0-9/_.-]{1,40}$'
 or jsonb_typeof(p_booking->'depositPct') is distinct from 'number' or (p_booking->>'depositPct')::numeric not in (50,80)
 or jsonb_typeof(p_booking->'depositAmount') is distinct from 'number' or (p_booking->>'depositAmount')::numeric<=0 or (p_booking->>'depositAmount')::numeric%1<>0
 or jsonb_typeof(p_booking->'previoRecordedAt') is distinct from 'string' or jsonb_typeof(p_booking->'depositDeadlineUtc') is distinct from 'string' then
  raise exception 'invalid confirmation' using errcode='22023';
 end if;
 begin
  fields:=array['test-mailbox-confirm-v1',p_tenant,p_case,p_expected::text,encode(sha256(convert_to(p_draft->>'text','UTF8')),'hex'),
   encode(sha256(convert_to(p_draft->>'operatorReviewText','UTF8')),'hex'),p_booking->>'previoReference',p_booking->>'previoRecordedAt',
   p_booking->>'depositPct',p_booking->>'depositAmount',p_booking->>'depositDeadlineUtc',p_proof->>'checkedAt'];
  if jsonb_typeof(p_proof) is distinct from 'object' or p_proof->>'scope' is distinct from 'test-mailbox-confirm-v1'
  or coalesce(p_proof->>'attestation','')!~'^[a-f0-9]{64}$' or exists(select 1 from unnest(fields) v where v is null or v='' or position(chr(10) in v)>0)
  or (p_proof->>'checkedAt')::timestamptz<now()-interval '120 seconds' or (p_proof->>'checkedAt')::timestamptz>now()+interval '1 second'
  or (p_booking->>'previoRecordedAt')::timestamptz>now()+interval '1 second' or (p_booking->>'previoRecordedAt')::timestamptz<now()-interval '1 day'
  or (p_booking->>'depositDeadlineUtc')::timestamptz<=(p_booking->>'previoRecordedAt')::timestamptz then
   raise exception 'invalid proof';
  end if;
  select key_hex into key from public.sc_isolated_approval_key where singleton;
  if key is null or public.sc_isolated_approval_mac(array_to_string(fields,chr(10)),key) is distinct from p_proof->>'attestation' then raise exception 'invalid proof'; end if;
 exception when others then raise exception 'server-attested confirmation required' using errcode='42501'; end;
 select * into c from public.sc_cases where tenant_id=p_tenant and case_id=p_case and revision=p_expected for update;
 if not found then return null; end if;
 if not exists(select 1 from public.sc_test_mailbox_cases where tenant_id=p_tenant and case_id=p_case) then
  raise exception 'test-mailbox case required' using errcode='42501';
 end if;
 if coalesce(c.data->'booking'->>'status','') in ('finalized','deposit_received') then
  raise exception 'booking already finalized' using errcode='22023';
 end if;
 changed:=jsonb_set(c.data,'{drafts}',(c.data->'drafts')||jsonb_build_array(p_draft||jsonb_build_object('createdBy',actor,'createdAt',now(),
  'basedOnRevision',p_expected,'machineDraft',true,'confirmation',true)));
 changed:=jsonb_set(changed,'{state,approval}','"pending"');
 changed:=(changed-'internalApproval')||jsonb_build_object('booking',jsonb_build_object('status','finalized',
  'previo',jsonb_build_object('reference',p_booking->>'previoReference','recordedAt',p_booking->>'previoRecordedAt','attestedBy',actor,'attestedAt',now()),
  'deposit',jsonb_build_object('pct',p_booking->'depositPct','amount',p_booking->'depositAmount','deadlineUtc',p_booking->>'depositDeadlineUtc')));
 update public.sc_cases set revision=p_expected+1,data=changed,updated_at=now(),updated_by=actor
  where tenant_id=p_tenant and case_id=p_case and revision=p_expected returning * into result;
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values(p_tenant,p_case,p_expected+1,actor,'tm_booking_finalized',encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
 return to_jsonb(result);
end $$;

create or replace function public.sc_tm_deposit_received(p_tenant text,p_case text,p_expected bigint,p_received_on date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; c public.sc_cases%rowtype; result public.sc_cases%rowtype; changed jsonb;
begin
 actor:=public.sc_tm_actor(p_tenant,'write');
 if p_expected is null or p_expected<1 or p_received_on is null or p_received_on>current_date then
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

revoke all on function public.sc_tm_confirm_booking(text,text,bigint,jsonb,jsonb,jsonb) from public,anon;
revoke all on function public.sc_tm_deposit_received(text,text,bigint,date) from public,anon;
grant execute on function public.sc_tm_confirm_booking(text,text,bigint,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.sc_tm_deposit_received(text,text,bigint,date) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.sc_tm_confirm_booking(text,text,bigint,jsonb,jsonb,jsonb) from service_role';
  execute 'revoke all on function public.sc_tm_deposit_received(text,text,bigint,date) from service_role';
 end if;
end $$;
commit;
