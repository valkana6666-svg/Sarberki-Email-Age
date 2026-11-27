-- TEST – owner 2026-11-27: a PRELIMINARY confirmation letter may go out while Previo still shows an option („Foglalását
-- rögzítettük … a foglaló beérkezése után válik véglegessé”). When the staff later switch the option to a confirmed
-- booking in Previo, the daily view offers „Véglegesített foglalás visszaigazolása e-mailben”: the server writes the
-- confirmed letter („Foglalását megerősítettük”, same booking number, price and deposit deadline as stored), attests it,
-- and saves it here as the case's newest machine draft – once per booking (booking.finalLetter). Nothing is sent
-- here: the operator's click sends it through the existing send path (test pair only, send ledger).
-- Requires install.sql and booking-status.sql. Rollback: final-letter-rollback.sql.
begin;
do $$ begin
 if coalesce(current_setting('sarberki.tm_install_project_ref',true),'')!~'^[a-z]{20}$'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or to_regprocedure('public.sc_tm_actor(text,text)') is null
 or to_regprocedure('public.sc_isolated_approval_mac(text,text)') is null then
  raise exception 'verified project, fresh backup and test-mailbox install required';
 end if;
end $$;

create or replace function public.sc_tm_final_letter(p_tenant text,p_case text,p_expected bigint,p_draft jsonb,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; c public.sc_cases%rowtype; result public.sc_cases%rowtype; changed jsonb; key text; fields text[];
begin
 actor:=public.sc_tm_actor(p_tenant,'write');
 if p_expected is null or p_expected<1 or jsonb_typeof(p_draft) is distinct from 'object'
 or exists(select 1 from jsonb_object_keys(p_draft) k where k not in ('text','operatorReviewText'))
 or jsonb_typeof(p_draft->'text') is distinct from 'string' or btrim(p_draft->>'text')='' or length(p_draft->>'text')>20000
 or jsonb_typeof(p_draft->'operatorReviewText') is distinct from 'string' or length(p_draft->>'operatorReviewText')>20000 then
  raise exception 'invalid final letter' using errcode='22023';
 end if;
 select * into c from public.sc_cases where tenant_id=p_tenant and case_id=p_case and revision=p_expected for update;
 if not found then return null; end if;
 if not exists(select 1 from public.sc_test_mailbox_cases where tenant_id=p_tenant and case_id=p_case) then
  raise exception 'test-mailbox case required' using errcode='42501';
 end if;
 if c.data->'booking'->>'status' is distinct from 'finalized' then raise exception 'finalized booking required' using errcode='22023'; end if;
 if c.data->'booking' ? 'finalLetter' then raise exception 'final letter already prepared' using errcode='22023'; end if;
 begin
  fields:=array['test-mailbox-final-letter-v1',p_tenant,p_case,p_expected::text,encode(sha256(convert_to(p_draft->>'text','UTF8')),'hex'),
   encode(sha256(convert_to(p_draft->>'operatorReviewText','UTF8')),'hex'),c.data->'booking'->'previo'->>'reference',p_proof->>'checkedAt'];
  if jsonb_typeof(p_proof) is distinct from 'object' or p_proof->>'scope' is distinct from 'test-mailbox-final-letter-v1'
  or coalesce(p_proof->>'attestation','')!~'^[a-f0-9]{64}$' or exists(select 1 from unnest(fields) v where v is null or v='' or position(chr(10) in v)>0)
  or (p_proof->>'checkedAt')::timestamptz<now()-interval '120 seconds' or (p_proof->>'checkedAt')::timestamptz>now()+interval '1 second' then
   raise exception 'invalid proof';
  end if;
  select key_hex into key from public.sc_isolated_approval_key where singleton;
  if key is null or public.sc_isolated_approval_mac(array_to_string(fields,chr(10)),key) is distinct from p_proof->>'attestation' then raise exception 'invalid proof'; end if;
 exception when others then raise exception 'server-attested final letter required' using errcode='42501'; end;
 changed:=jsonb_set(c.data,'{drafts}',(c.data->'drafts')||jsonb_build_array(p_draft||jsonb_build_object('createdBy',actor,'createdAt',now(),
  'basedOnRevision',p_expected,'machineDraft',true,'confirmation',true,'finalLetter',true)));
 changed:=jsonb_set(changed,'{state,approval}','"pending"');
 changed:=changed-'internalApproval';
 changed:=jsonb_set(changed,'{booking,finalLetter}',jsonb_build_object('preparedAt',now(),'preparedBy',actor));
 update public.sc_cases set revision=p_expected+1,data=changed,updated_at=now(),updated_by=actor
  where tenant_id=p_tenant and case_id=p_case and revision=p_expected returning * into result;
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values(p_tenant,p_case,p_expected+1,actor,'tm_final_letter',encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
 return to_jsonb(result);
end $$;

revoke all on function public.sc_tm_final_letter(text,text,bigint,jsonb,jsonb) from public,anon;
grant execute on function public.sc_tm_final_letter(text,text,bigint,jsonb,jsonb) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.sc_tm_final_letter(text,text,bigint,jsonb,jsonb) from service_role';
 end if;
end $$;
commit;
