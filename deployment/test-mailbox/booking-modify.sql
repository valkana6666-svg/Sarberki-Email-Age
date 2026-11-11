-- TEST (later the live profile) – V2 booking modification, owner 2026-11-11 ("álljál neki a módosításnak").
-- sc_tm_modify_booking: a finalized or deposit_received single-unit booking gets new dates and/or a new unit of the
-- same type. The server attests the change and the new confirmation draft (scope test-mailbox-modify-v1); the
-- database re-checks collisions under the same tenant-wide lock as the finalize step, keeps the previous values in
-- booking.modifications, resets the approval (the new letter must be approved again) and writes an audit row.
-- The deposit percentage and deadline stay; only the amount follows the new price. Requires booking-multiunit.sql.
begin;
do $$ begin
 if coalesce(current_setting('sarberki.tm_install_project_ref',true),'')!~'^[a-z]{20}$'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or to_regprocedure('public.sc_tm_cancel_booking(text,text,bigint,text)') is null
 or to_regprocedure('public.sc_isolated_approval_mac(text,text)') is null
 or to_regclass('public.sc_test_mailbox_cases') is null then
  raise exception 'verified project, fresh backup and booking-cancel/multiunit install required';
 end if;
end $$;

create or replace function public.sc_tm_modify_booking(p_tenant text,p_case text,p_expected bigint,p_change jsonb,p_draft jsonb,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; c public.sc_cases%rowtype; result public.sc_cases%rowtype; changed jsonb; key text; fields text[];
begin
 actor:=public.sc_tm_actor(p_tenant,'write');
 if p_expected is null or p_expected<1 or jsonb_typeof(p_draft) is distinct from 'object' or jsonb_typeof(p_change) is distinct from 'object'
 or exists(select 1 from jsonb_object_keys(p_draft) k where k not in ('text','operatorReviewText'))
 or exists(select 1 from jsonb_object_keys(p_change) k where k not in ('arrival','departure','unit','depositAmount'))
 or jsonb_typeof(p_draft->'text') is distinct from 'string' or btrim(p_draft->>'text')='' or length(p_draft->>'text')>20000
 or jsonb_typeof(p_draft->'operatorReviewText') is distinct from 'string' or length(p_draft->>'operatorReviewText')>40000
 or coalesce(p_change->>'arrival','')!~'^\d{4}-\d{2}-\d{2}$' or coalesce(p_change->>'departure','')!~'^\d{4}-\d{2}-\d{2}$'
 or (p_change->>'departure')<=(p_change->>'arrival') or (p_change->>'arrival')::date<current_date
 or coalesce(p_change->>'unit','')!~'^(?:[1-9]|1[0-5]|(?:7|8|9|10)/[ABC])$'
 or jsonb_typeof(p_change->'depositAmount') is distinct from 'number' or (p_change->>'depositAmount')::numeric<=0 or (p_change->>'depositAmount')::numeric%1<>0 then
  raise exception 'invalid modification' using errcode='22023';
 end if;
 begin
  fields:=array['test-mailbox-modify-v1',p_tenant,p_case,p_expected::text,encode(sha256(convert_to(p_draft->>'text','UTF8')),'hex'),
   encode(sha256(convert_to(p_draft->>'operatorReviewText','UTF8')),'hex'),p_change->>'arrival',p_change->>'departure',p_change->>'unit',
   p_change->>'depositAmount',p_proof->>'checkedAt'];
  if jsonb_typeof(p_proof) is distinct from 'object' or p_proof->>'scope' is distinct from 'test-mailbox-modify-v1'
  or coalesce(p_proof->>'attestation','')!~'^[a-f0-9]{64}$' or exists(select 1 from unnest(fields) v where v is null or v='' or position(chr(10) in v)>0)
  or (p_proof->>'checkedAt')::timestamptz<now()-interval '120 seconds' or (p_proof->>'checkedAt')::timestamptz>now()+interval '1 second' then
   raise exception 'invalid proof';
  end if;
  select key_hex into key from public.sc_isolated_approval_key where singleton;
  if key is null or public.sc_isolated_approval_mac(array_to_string(fields,chr(10)),key) is distinct from p_proof->>'attestation' then raise exception 'invalid proof'; end if;
 exception when others then raise exception 'server-attested modification required' using errcode='42501'; end;
 perform pg_advisory_xact_lock(hashtext('sc_tm_unit:'||p_tenant));
 select * into c from public.sc_cases where tenant_id=p_tenant and case_id=p_case and revision=p_expected for update;
 if not found then return null; end if;
 if not exists(select 1 from public.sc_test_mailbox_cases where tenant_id=p_tenant and case_id=p_case) then
  raise exception 'test-mailbox case required' using errcode='42501';
 end if;
 if coalesce(c.data->'booking'->>'status','') not in ('finalized','deposit_received') then
  raise exception 'active booking required' using errcode='22023';
 end if;
 if jsonb_typeof(c.data->'booking'->'units')='array' then
  raise exception 'multi-unit modification not supported' using errcode='22023';
 end if;
 if exists(select 1 from public.sc_cases o where o.tenant_id=p_tenant and o.case_id<>p_case
  and o.data->'booking'->>'status' in ('finalized','deposit_received')
  and (o.data->'booking'->>'unit'=p_change->>'unit' or exists(select 1 from jsonb_array_elements_text(coalesce(o.data->'booking'->'units','[]'::jsonb)) u where u=p_change->>'unit'))
  and (o.data->'state'->'values'->>'arrival')<(p_change->>'departure')
  and (p_change->>'arrival')<(o.data->'state'->'values'->>'departure')) then
  raise exception 'unit already booked for these dates' using errcode='23P01';
 end if;
 changed:=jsonb_set(c.data,'{booking,modifications}',coalesce(c.data->'booking'->'modifications','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
  'at',now(),'by',actor,'from',jsonb_build_object('arrival',c.data->'state'->'values'->>'arrival','departure',c.data->'state'->'values'->>'departure',
  'unit',c.data->'booking'->>'unit','depositAmount',c.data->'booking'->'deposit'->'amount'))));
 changed:=jsonb_set(changed,'{state,values,arrival}',to_jsonb(p_change->>'arrival'));
 changed:=jsonb_set(changed,'{state,values,departure}',to_jsonb(p_change->>'departure'));
 changed:=jsonb_set(changed,'{booking,unit}',to_jsonb(p_change->>'unit'));
 changed:=jsonb_set(changed,'{booking,deposit,amount}',p_change->'depositAmount');
 changed:=jsonb_set(changed,'{drafts}',(changed->'drafts')||jsonb_build_array(p_draft||jsonb_build_object('createdBy',actor,'createdAt',now(),
  'basedOnRevision',p_expected,'machineDraft',true,'confirmation',true,'modification',true)));
 changed:=jsonb_set(changed,'{state,approval}','"pending"');
 changed:=changed-'internalApproval';
 update public.sc_cases set revision=p_expected+1,data=changed,updated_at=now(),updated_by=actor
  where tenant_id=p_tenant and case_id=p_case and revision=p_expected returning * into result;
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values(p_tenant,p_case,p_expected+1,actor,'tm_booking_modified',encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
 return to_jsonb(result);
end $$;

revoke all on function public.sc_tm_modify_booking(text,text,bigint,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.sc_tm_modify_booking(text,text,bigint,jsonb,jsonb,jsonb) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.sc_tm_modify_booking(text,text,bigint,jsonb,jsonb,jsonb) from service_role';
 end if;
end $$;
commit;
