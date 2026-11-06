-- TEST (and later the live profile) – owner decision 2026-11-06: a guest's reply continues the EXISTING case in the
-- operator system instead of staying in Gmail. Additive; requires deployment/test-mailbox/install.sql.
-- One server-attested follow-up message (scope test-mailbox-followup-v1) is appended to the case whose Gmail thread
-- and guest it belongs to; the server-merged facts and a new machine draft are saved; the case returns to
-- pending (an earlier internal approval no longer covers the new state). Nothing is sent or booked here.
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

create or replace function public.sc_tm_followup(p_tenant text,p_case text,p_expected bigint,p_message jsonb,p_values jsonb,p_draft jsonb,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; c public.sc_cases%rowtype; result public.sc_cases%rowtype; src jsonb; key text; fields text[]; body_hash text; changed jsonb;
 allowed_values text[]:=array['arrival','departure','nights','guests','adults','children','child_ages','phone','unit','units_requested','language','request','split_request_text','name'];
begin
 actor:=public.sc_tm_actor(p_tenant,'write');
 if p_expected is null or p_expected<1
 or jsonb_typeof(p_message) is distinct from 'object' or jsonb_typeof(p_values) is distinct from 'object' or jsonb_typeof(p_draft) is distinct from 'object'
 or exists(select 1 from jsonb_object_keys(p_message) k where k not in ('sender','text','mailbox_id','message_id','thread_id','rfc_message_id','references','in_reply_to','received_at'))
 or exists(select 1 from jsonb_each(p_values) e where e.key<>all(allowed_values) or jsonb_typeof(e.value) is distinct from 'string' or length(e.value#>>'{}')>4000)
 or exists(select 1 from jsonb_object_keys(p_draft) k where k not in ('text','operatorReviewText'))
 or jsonb_typeof(p_message->'text') is distinct from 'string' or btrim(p_message->>'text')='' or length(p_message->>'text')>20000
 or jsonb_typeof(p_draft->'text') is distinct from 'string' or btrim(p_draft->>'text')='' or length(p_draft->>'text')>20000
 or (p_draft ? 'operatorReviewText' and (jsonb_typeof(p_draft->'operatorReviewText') is distinct from 'string' or length(p_draft->>'operatorReviewText')>40000)) then
  raise exception 'invalid follow-up' using errcode='22023';
 end if;
 select * into c from public.sc_cases where tenant_id=p_tenant and case_id=p_case and revision=p_expected for update;
 if not found then return null; end if;
 if not exists(select 1 from public.sc_test_mailbox_cases where tenant_id=p_tenant and case_id=p_case) then
  raise exception 'test-mailbox case required' using errcode='42501';
 end if;
 src:=c.data->'sourceReceipt';
 -- Same Gmail mailbox and thread, same guest as the case; a new message id.
 if p_message->>'thread_id' is distinct from src->>'thread_id' or p_message->>'mailbox_id' is distinct from src->>'mailbox_id'
 or lower(p_message->>'sender') is distinct from lower(c.data->>'sender')
 or coalesce(p_message->>'message_id','')!~'^[A-Za-z0-9_-]{6,128}$' or coalesce(p_message->>'rfc_message_id','')='' or length(p_message->>'rfc_message_id')>2000
 or exists(select 1 from jsonb_array_elements(c.data->'messages') m where m->>'message_id'=p_message->>'message_id') then
  raise exception 'follow-up does not belong to this case' using errcode='22023';
 end if;
 body_hash:=encode(sha256(convert_to(p_message->>'text','UTF8')),'hex');
 begin
  fields:=array['test-mailbox-followup-v1',p_tenant,p_case,p_expected::text,p_message->>'mailbox_id',p_message->>'message_id',p_message->>'thread_id',
   p_message->>'rfc_message_id',lower(p_message->>'sender'),p_message->>'received_at',body_hash,encode(sha256(convert_to(p_draft->>'text','UTF8')),'hex'),p_proof->>'checkedAt'];
  if jsonb_typeof(p_proof) is distinct from 'object' or p_proof->>'scope' is distinct from 'test-mailbox-followup-v1'
  or coalesce(p_proof->>'attestation','')!~'^[a-f0-9]{64}$'
  or exists(select 1 from unnest(fields) v where v is null or v='' or position(chr(10) in v)>0 or position(chr(13) in v)>0)
  or (p_proof->>'checkedAt')::timestamptz<now()-interval '120 seconds' or (p_proof->>'checkedAt')::timestamptz>now()+interval '1 second' then
   raise exception 'invalid proof';
  end if;
  select key_hex into key from public.sc_isolated_approval_key where singleton;
  if key is null or public.sc_isolated_approval_mac(array_to_string(fields,chr(10)),key) is distinct from p_proof->>'attestation' then raise exception 'invalid proof'; end if;
 exception when others then raise exception 'server-attested follow-up required' using errcode='42501'; end;
 if exists(select 1 from public.sc_message_keys where tenant_id=p_tenant and mailbox_id=p_message->>'mailbox_id' and message_id=p_message->>'message_id') then
  raise exception 'message already stored' using errcode='23505';
 end if;
 changed:=jsonb_set(c.data,'{messages}',(c.data->'messages')||jsonb_build_array(p_message));
 changed:=jsonb_set(changed,'{state,values}',p_values);
 changed:=jsonb_set(changed,'{drafts}',(c.data->'drafts')||jsonb_build_array(p_draft||jsonb_build_object('createdBy',actor,'createdAt',now(),'basedOnRevision',p_expected,'machineDraft',true,'followup',true)));
 changed:=jsonb_set(changed,'{state,approval}','"pending"');
 changed:=(changed-'internalApproval')||jsonb_build_object('latestReceipt',jsonb_build_object('message_id',p_message->>'message_id','rfc_message_id',p_message->>'rfc_message_id','received_at',p_message->>'received_at'));
 update public.sc_cases set revision=p_expected+1,data=changed,updated_at=now(),updated_by=actor
  where tenant_id=p_tenant and case_id=p_case and revision=p_expected returning * into result;
 insert into public.sc_message_keys(tenant_id,mailbox_id,message_id,case_id) values(p_tenant,p_message->>'mailbox_id',p_message->>'message_id',p_case);
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values(p_tenant,p_case,p_expected+1,actor,'tm_followup',encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
 return to_jsonb(result);
end $$;
revoke all on function public.sc_tm_followup(text,text,bigint,jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.sc_tm_followup(text,text,bigint,jsonb,jsonb,jsonb,jsonb) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.sc_tm_followup(text,text,bigint,jsonb,jsonb,jsonb,jsonb) from service_role';
 end if;
end $$;
commit;
