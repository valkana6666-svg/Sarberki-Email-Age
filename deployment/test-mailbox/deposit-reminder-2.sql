-- TEST – owner 2026-11-24: TWO guest reminders per booking ("előtte 2 nappal egy emlékeztető, meg ugye aznap,
-- amikor lejár, akkor is egyet"). Replaces sc_tm_deposit_reminder (same signature). The kind follows the clock:
--   final – on the deadline's Budapest day, or up to 12 hours after the deadline;
--   first – otherwise within the 48 hours before the deadline.
-- Each kind once per booking (booking.depositReminder / booking.depositReminderFinal). The server attests the text
-- together with the kind; the database recomputes the kind by its own clock and refuses a mismatch. Nothing is sent
-- here. Requires deposit-reminder.sql. Rollback: deposit-reminder-2-rollback.sql (back to one reminder).
begin;
do $$ begin
 if coalesce(current_setting('sarberki.tm_install_project_ref',true),'')!~'^[a-z]{20}$'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or to_regprocedure('public.sc_tm_deposit_reminder(text,text,bigint,jsonb,jsonb)') is null then
  raise exception 'verified project, fresh backup and deposit-reminder install required';
 end if;
end $$;

create or replace function public.sc_tm_deposit_reminder(p_tenant text,p_case text,p_expected bigint,p_draft jsonb,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; c public.sc_cases%rowtype; result public.sc_cases%rowtype; changed jsonb; key text; fields text[]; deadline timestamptz; kind text; mark text;
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
 deadline:=(c.data->'booking'->'deposit'->>'deadlineUtc')::timestamptz;
 if deadline is null then raise exception 'reminder not due' using errcode='22023'; end if;
 kind:=case
  when now()<deadline+interval '12 hours' and (now()>=deadline or (now() at time zone 'Europe/Budapest')::date=(deadline at time zone 'Europe/Budapest')::date) then 'final'
  when now()<deadline and now()>deadline-interval '48 hours' then 'first' end;
 if kind is null then raise exception 'reminder not due' using errcode='22023'; end if;
 mark:=case kind when 'final' then 'depositReminderFinal' else 'depositReminder' end;
 if c.data->'booking' ? mark then raise exception 'reminder already prepared' using errcode='22023'; end if;
 begin
  fields:=array['test-mailbox-deposit-reminder-v2',p_tenant,p_case,p_expected::text,encode(sha256(convert_to(p_draft->>'text','UTF8')),'hex'),
   c.data->'booking'->'deposit'->>'deadlineUtc',kind,p_proof->>'checkedAt'];
  if jsonb_typeof(p_proof) is distinct from 'object' or p_proof->>'scope' is distinct from 'test-mailbox-deposit-reminder-v2'
  or coalesce(p_proof->>'attestation','')!~'^[a-f0-9]{64}$' or exists(select 1 from unnest(fields) v where v is null or v='' or position(chr(10) in v)>0)
  or (p_proof->>'checkedAt')::timestamptz<now()-interval '120 seconds' or (p_proof->>'checkedAt')::timestamptz>now()+interval '1 second' then
   raise exception 'invalid proof';
  end if;
  select key_hex into key from public.sc_isolated_approval_key where singleton;
  if key is null or public.sc_isolated_approval_mac(array_to_string(fields,chr(10)),key) is distinct from p_proof->>'attestation' then raise exception 'invalid proof'; end if;
 exception when others then raise exception 'server-attested reminder required' using errcode='42501'; end;
 changed:=jsonb_set(c.data,'{drafts}',(c.data->'drafts')||jsonb_build_array(p_draft||jsonb_build_object('createdBy',actor,'createdAt',now(),
  'basedOnRevision',p_expected,'machineDraft',true,'depositReminder',true,'reminderKind',kind)));
 changed:=jsonb_set(changed,'{state,approval}','"pending"');
 changed:=changed-'internalApproval';
 changed:=jsonb_set(changed,array['booking',mark],jsonb_build_object('preparedAt',now(),'preparedBy',actor));
 update public.sc_cases set revision=p_expected+1,data=changed,updated_at=now(),updated_by=actor
  where tenant_id=p_tenant and case_id=p_case and revision=p_expected returning * into result;
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values(p_tenant,p_case,p_expected+1,actor,'tm_deposit_reminder_'||kind,encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
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
