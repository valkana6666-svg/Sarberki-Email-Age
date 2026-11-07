-- TEST (later the live profile) – V2 step 1b, owner 2026-11-07 ("1": collision protection in the finalize step).
-- Replaces ONLY sc_tm_confirm_booking (same signature): the operator names the unit (e.g. "7/A"), the server
-- attests it, and the database refuses an overlapping finalized booking on the same unit (half-open stays,
-- tenant-wide advisory lock against races). Requires deployment/test-mailbox/booking-status.sql.
-- Rollback: re-run deployment/test-mailbox/booking-status.sql (previous definition).
begin;
do $$ begin
 if coalesce(current_setting('sarberki.tm_install_project_ref',true),'')!~'^[a-z]{20}$'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or to_regprocedure('public.sc_tm_confirm_booking(text,text,bigint,jsonb,jsonb,jsonb)') is null then
  raise exception 'verified project, fresh backup and booking-status install required';
 end if;
end $$;

create or replace function public.sc_tm_confirm_booking(p_tenant text,p_case text,p_expected bigint,p_booking jsonb,p_draft jsonb,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; c public.sc_cases%rowtype; result public.sc_cases%rowtype; changed jsonb; key text; fields text[];
begin
 actor:=public.sc_tm_actor(p_tenant,'write');
 if p_expected is null or p_expected<1 or jsonb_typeof(p_draft) is distinct from 'object' or jsonb_typeof(p_booking) is distinct from 'object'
 or exists(select 1 from jsonb_object_keys(p_draft) k where k not in ('text','operatorReviewText'))
 or exists(select 1 from jsonb_object_keys(p_booking) k where k not in ('previoReference','previoRecordedAt','depositPct','depositAmount','depositDeadlineUtc','unit'))
 or jsonb_typeof(p_draft->'text') is distinct from 'string' or btrim(p_draft->>'text')='' or length(p_draft->>'text')>20000
 or jsonb_typeof(p_draft->'operatorReviewText') is distinct from 'string' or length(p_draft->>'operatorReviewText')>40000
 or coalesce(p_booking->>'previoReference','')!~'^[A-Za-z0-9/_.-]{1,40}$'
 or coalesce(p_booking->>'unit','')!~'^(?:[1-9]|1[0-5]|(?:7|8|9|10)/[ABC])$'
 or jsonb_typeof(p_booking->'depositPct') is distinct from 'number' or (p_booking->>'depositPct')::numeric not in (50,80)
 or jsonb_typeof(p_booking->'depositAmount') is distinct from 'number' or (p_booking->>'depositAmount')::numeric<=0 or (p_booking->>'depositAmount')::numeric%1<>0
 or jsonb_typeof(p_booking->'previoRecordedAt') is distinct from 'string' or jsonb_typeof(p_booking->'depositDeadlineUtc') is distinct from 'string' then
  raise exception 'invalid confirmation' using errcode='22023';
 end if;
 begin
  fields:=array['test-mailbox-confirm-v1',p_tenant,p_case,p_expected::text,encode(sha256(convert_to(p_draft->>'text','UTF8')),'hex'),
   encode(sha256(convert_to(p_draft->>'operatorReviewText','UTF8')),'hex'),p_booking->>'previoReference',p_booking->>'previoRecordedAt',
   p_booking->>'depositPct',p_booking->>'depositAmount',p_booking->>'depositDeadlineUtc',p_booking->>'unit',p_proof->>'checkedAt'];
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
 -- Collision protection (V2 step, owner 2026-11-07): one tenant-wide lock, so two concurrent finalizations
 -- cannot take the same unit; stays are half-open [arrival, departure).
 perform pg_advisory_xact_lock(hashtext('sc_tm_unit:'||p_tenant));
 select * into c from public.sc_cases where tenant_id=p_tenant and case_id=p_case and revision=p_expected for update;
 if not found then return null; end if;
 if not exists(select 1 from public.sc_test_mailbox_cases where tenant_id=p_tenant and case_id=p_case) then
  raise exception 'test-mailbox case required' using errcode='42501';
 end if;
 if coalesce(c.data->'booking'->>'status','') in ('finalized','deposit_received') then
  raise exception 'booking already finalized' using errcode='22023';
 end if;
 if coalesce(c.data->'state'->'values'->>'arrival','')!~'^\d{4}-\d{2}-\d{2}$' or coalesce(c.data->'state'->'values'->>'departure','')!~'^\d{4}-\d{2}-\d{2}$'
 or (c.data->'state'->'values'->>'departure')<=(c.data->'state'->'values'->>'arrival') then
  raise exception 'stay dates required' using errcode='22023';
 end if;
 if exists(select 1 from public.sc_cases o where o.tenant_id=p_tenant and o.case_id<>p_case
  and o.data->'booking'->>'status' in ('finalized','deposit_received') and o.data->'booking'->>'unit'=p_booking->>'unit'
  and (o.data->'state'->'values'->>'arrival')<(c.data->'state'->'values'->>'departure')
  and (c.data->'state'->'values'->>'arrival')<(o.data->'state'->'values'->>'departure')) then
  raise exception 'unit already booked for these dates' using errcode='23P01';
 end if;
 changed:=jsonb_set(c.data,'{drafts}',(c.data->'drafts')||jsonb_build_array(p_draft||jsonb_build_object('createdBy',actor,'createdAt',now(),
  'basedOnRevision',p_expected,'machineDraft',true,'confirmation',true)));
 changed:=jsonb_set(changed,'{state,approval}','"pending"');
 changed:=(changed-'internalApproval')||jsonb_build_object('booking',jsonb_build_object('status','finalized','unit',p_booking->>'unit',
  'previo',jsonb_build_object('reference',p_booking->>'previoReference','recordedAt',p_booking->>'previoRecordedAt','attestedBy',actor,'attestedAt',now()),
  'deposit',jsonb_build_object('pct',p_booking->'depositPct','amount',p_booking->'depositAmount','deadlineUtc',p_booking->>'depositDeadlineUtc')));
 update public.sc_cases set revision=p_expected+1,data=changed,updated_at=now(),updated_by=actor
  where tenant_id=p_tenant and case_id=p_case and revision=p_expected returning * into result;
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values(p_tenant,p_case,p_expected+1,actor,'tm_booking_finalized',encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
 return to_jsonb(result);
end $$;

revoke all on function public.sc_tm_confirm_booking(text,text,bigint,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.sc_tm_confirm_booking(text,text,bigint,jsonb,jsonb,jsonb) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.sc_tm_confirm_booking(text,text,bigint,jsonb,jsonb,jsonb) from service_role';
 end if;
end $$;
commit;
