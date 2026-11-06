-- Minimal TEST install of ONLY sc_tm_unavailable_redraft (the "Nincs szabad hely – ár nélküli válasz" button).
-- Owner video 2026-11-06: the button failed because this function was never installed on the TEST database
-- (the full test-mailbox install was not re-run after 2026-11-04). Identical to the definition in
-- deployment/test-mailbox/install.sql; requires that install (sc_tm_actor, registry, attestation key).
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
-- Owner request 2026-11-04: the operator checked Previo by hand and no suitable cabin is free. Same shape as the
-- price redraft: server-built, server-attested text (scope test-mailbox-unavailable-v1), no price, booking flow stops.
create or replace function public.sc_tm_unavailable_redraft(p_tenant text,p_case text,p_expected bigint,p_draft jsonb,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; row_before public.sc_cases%rowtype; result public.sc_cases%rowtype; state text; latest jsonb; changed jsonb; key text; fields text[]; text_hash text;
begin
 actor:=public.sc_tm_actor(p_tenant,'write');
 if p_expected is null or p_expected<1 or jsonb_typeof(p_draft) is distinct from 'object'
 or exists(select 1 from jsonb_object_keys(p_draft) k where k not in ('text','operatorReviewText'))
 or jsonb_typeof(p_draft->'text') is distinct from 'string' or btrim(p_draft->>'text')='' or length(p_draft->>'text')>20000
 or jsonb_typeof(p_draft->'operatorReviewText') is distinct from 'string' or length(p_draft->>'operatorReviewText')>40000 then
  raise exception 'invalid draft' using errcode='22023';
 end if;
 text_hash:=encode(sha256(convert_to(p_draft->>'text','UTF8')),'hex');
 begin
  fields:=array['test-mailbox-unavailable-v1',p_tenant,p_case,p_expected::text,text_hash,encode(sha256(convert_to(p_draft->>'operatorReviewText','UTF8')),'hex'),p_proof->>'checkedAt'];
  if jsonb_typeof(p_proof) is distinct from 'object' or p_proof->>'scope' is distinct from 'test-mailbox-unavailable-v1'
  or coalesce(p_proof->>'attestation','')!~'^[a-f0-9]{64}$' or exists(select 1 from unnest(fields) v where v is null or v='')
  or (p_proof->>'checkedAt')::timestamptz<now()-interval '120 seconds' or (p_proof->>'checkedAt')::timestamptz>now()+interval '1 second' then
   raise exception 'invalid proof';
  end if;
  select key_hex into key from public.sc_isolated_approval_key where singleton;
  if key is null or public.sc_isolated_approval_mac(array_to_string(fields,chr(10)),key) is distinct from p_proof->>'attestation' then raise exception 'invalid proof'; end if;
 exception when others then raise exception 'server-attested unavailability required' using errcode='42501'; end;
 select * into row_before from public.sc_cases where tenant_id=p_tenant and case_id=p_case and revision=p_expected for update;
 if not found then return null; end if;
 if not exists(select 1 from public.sc_test_mailbox_cases where tenant_id=p_tenant and case_id=p_case) then
  raise exception 'test-mailbox case required' using errcode='42501';
 end if;
 state:=row_before.data->'state'->>'approval';latest:=row_before.data->'drafts'->-1;
 if state not in ('pending','returned_for_edit','rejected') then raise exception 'draft cannot change in this state' using errcode='22023'; end if;
 if latest->>'text'=p_draft->>'text' then raise exception 'changed draft required' using errcode='22023'; end if;
 changed:=jsonb_set(row_before.data,'{drafts}',(row_before.data->'drafts')||jsonb_build_array(p_draft||jsonb_build_object('createdBy',actor,'createdAt',now(),
  'basedOnRevision',p_expected,'priceInserted',false,'unavailableByOperator',true,'machineDraft',coalesce(latest->'machineDraft','false'::jsonb)='true'::jsonb)));
 changed:=jsonb_set(changed,'{state,approval}','"pending"');
 update public.sc_cases set revision=p_expected+1,data=changed,updated_at=now(),updated_by=actor
  where tenant_id=p_tenant and case_id=p_case and revision=p_expected returning * into result;
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values(p_tenant,p_case,p_expected+1,actor,'tm_unavailable_redraft',encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
 return to_jsonb(result);
end $$;
revoke all on function public.sc_tm_unavailable_redraft(text,text,bigint,jsonb,jsonb) from public,anon;
grant execute on function public.sc_tm_unavailable_redraft(text,text,bigint,jsonb,jsonb) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.sc_tm_unavailable_redraft(text,text,bigint,jsonb,jsonb) from service_role';
 end if;
end $$;
commit;
