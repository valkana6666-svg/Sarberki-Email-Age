-- Rollback of deposit-reminder-2.sql: restores the one-reminder version (identical to deposit-reminder.sql).
-- TEST – owner 2026-11-23: "jelezne a vendégnek az e-mail címen 2 nappal előtte, hogy lejár a határideje az
-- előrefizetésnek". Adds ONE new function, sc_tm_deposit_reminder: for a finalized booking whose deposit deadline is
-- within the next 2 days, the server-written reminder text (HMAC-attested with the existing isolated approval key,
-- like the confirmation letter) becomes the case's newest machine draft, pending approval. The operator approves and
-- sends it with the existing sc_tm_decide + send ledger (a human click; nothing is sent here). Once per booking.
-- Requires booking-status.sql. Rollback: deposit-reminder-rollback.sql.
begin;
do $$ begin
 if coalesce(current_setting('sarberki.tm_install_project_ref',true),'')!~'^[a-z]{20}$'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or to_regprocedure('public.sc_tm_deposit_received(text,text,bigint,date)') is null
 or to_regprocedure('public.sc_isolated_approval_mac(text,text)') is null then
  raise exception 'verified project, fresh backup and booking-status install required';
 end if;
end $$;

create or replace function public.sc_tm_deposit_reminder(p_tenant text,p_case text,p_expected bigint,p_draft jsonb,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; c public.sc_cases%rowtype; result public.sc_cases%rowtype; changed jsonb; key text; fields text[]; deadline timestamptz;
begin
 actor:=public.sc_tm_actor(p_tenant,'write');
 if p_expected is null or p_expected<1 or jsonb_typeof(p_draft) is distinct from 'object'
 or exists(select 1 from jsonb_object_keys(p_draft) k where k<>'text')
 or jsonb_typeof(p_draft->'text') is distinct from 'string' or btrim(p_draft->>'text')='' or length(p_draft->>'text')>20000 then
  raise exception 'invalid reminder' using errcode='22023';
 end if;
 select * into c from public.sc_cases where tenant_id=p_tenant and case_id=p_case and revision=p_expected for update;
 if not found then return null; end if;
 if not exists(select 1 from public.sc_test_mailbox_cases where tenant_id=p_tenant and case_id=p_case) then
  raise exception 'test-mailbox case required' using errcode='42501';
 end if;
 if c.data->'booking'->>'status' is distinct from 'finalized' then raise exception 'finalized booking required' using errcode='22023'; end if;
 if c.data->'booking' ? 'depositReminder' then raise exception 'reminder already prepared' using errcode='22023'; end if;
 begin
  deadline:=(c.data->'booking'->'deposit'->>'deadlineUtc')::timestamptz;
  fields:=array['test-mailbox-deposit-reminder-v1',p_tenant,p_case,p_expected::text,encode(sha256(convert_to(p_draft->>'text','UTF8')),'hex'),
   c.data->'booking'->'deposit'->>'deadlineUtc',p_proof->>'checkedAt'];
  if deadline is null or jsonb_typeof(p_proof) is distinct from 'object' or p_proof->>'scope' is distinct from 'test-mailbox-deposit-reminder-v1'
  or coalesce(p_proof->>'attestation','')!~'^[a-f0-9]{64}$' or exists(select 1 from unnest(fields) v where v is null or v='' or position(chr(10) in v)>0)
  or (p_proof->>'checkedAt')::timestamptz<now()-interval '120 seconds' or (p_proof->>'checkedAt')::timestamptz>now()+interval '1 second' then
   raise exception 'invalid proof';
  end if;
  select key_hex into key from public.sc_isolated_approval_key where singleton;
  if key is null or public.sc_isolated_approval_mac(array_to_string(fields,chr(10)),key) is distinct from p_proof->>'attestation' then raise exception 'invalid proof'; end if;
 exception when others then raise exception 'server-attested reminder required' using errcode='42501'; end;
 -- Only in the last 2 days before the deadline (the owner's rule), never after it.
 if deadline<=now() or deadline>now()+interval '2 days' then raise exception 'reminder not due' using errcode='22023'; end if;
 changed:=jsonb_set(c.data,'{drafts}',(c.data->'drafts')||jsonb_build_array(p_draft||jsonb_build_object('createdBy',actor,'createdAt',now(),
  'basedOnRevision',p_expected,'machineDraft',true,'depositReminder',true)));
 changed:=jsonb_set(changed,'{state,approval}','"pending"');
 changed:=changed-'internalApproval';
 changed:=jsonb_set(changed,'{booking,depositReminder}',jsonb_build_object('preparedAt',now(),'preparedBy',actor));
 update public.sc_cases set revision=p_expected+1,data=changed,updated_at=now(),updated_by=actor
  where tenant_id=p_tenant and case_id=p_case and revision=p_expected returning * into result;
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values(p_tenant,p_case,p_expected+1,actor,'tm_deposit_reminder',encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
 return to_jsonb(result);
end $$;

revoke all on function public.sc_tm_deposit_reminder(text,text,bigint,jsonb,jsonb) from public,anon;
grant execute on function public.sc_tm_deposit_reminder(text,text,bigint,jsonb,jsonb) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.sc_tm_deposit_reminder(text,text,bigint,jsonb,jsonb) from service_role';
 end if;
end $$;
commit;
