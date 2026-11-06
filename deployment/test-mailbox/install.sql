-- TEST ONLY (mojnqizbcaczstguikpv). Additive capability for server-attested, fictional test-mailbox
-- cases. Existing functions (sc_write_case, sc_approve_case, sc_approve_clarification), memberships,
-- RLS policies and grants are NOT changed. Disabled by default; the owner enables it explicitly.
-- sc_write_case keeps rejecting these cases (non-.invalid sender), so only the RPCs below can change them.
-- Live store slice 2 (2026-11-06): when the deployment profile (deployment/deployment-profile/install.sql) is
-- installed, the project, tenant, Auth issuer and mailbox come from it; without it the original TEST literals apply.
begin;
do $$ declare p record; begin
 if to_regclass('public.sc_deployment_profile') is not null then
  execute 'select environment,tenant_id,project_ref from public.sc_deployment_profile where singleton' into p;
  if p.project_ref is null or current_setting('sarberki.tm_install_project_ref',true) is distinct from p.project_ref
  or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
  or not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref=p.project_ref)
  or not exists(select 1 from public.sc_isolated_approval_key where singleton)
  or not exists(select 1 from public.sc_tenants where tenant_id=p.tenant_id and test_only=(p.environment='test'))
  or exists(select 1 from public.sc_tenants where tenant_id<>p.tenant_id and not (p.environment='test' and tenant_id='demo-test' and test_only)) then
   raise exception 'verified test project, attestation key and fresh backup required';
  end if;
 elsif current_setting('sarberki.tm_install_project_ref',true) is distinct from 'mojnqizbcaczstguikpv'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref='mojnqizbcaczstguikpv')
 or not exists(select 1 from public.sc_isolated_approval_key where singleton)
 or not exists(select 1 from public.sc_tenants where tenant_id='sarberki-test' and test_only)
 or exists(select 1 from public.sc_tenants where not test_only or tenant_id not in ('sarberki-test','demo-test')) then
  raise exception 'verified test project, attestation key and fresh backup required';
 end if;
end $$;

-- Owner switch, default off. Clients cannot read or change it.
create table if not exists public.sc_test_mailbox_config(
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 backup_sha256 text not null check(backup_sha256~'^[a-f0-9]{64}$')
);
insert into public.sc_test_mailbox_config(enabled,backup_sha256) values(false,current_setting('sarberki.tm_backup_sha256'))
 on conflict(singleton) do update set backup_sha256=excluded.backup_sha256;

-- Provenance registry: written only by sc_tm_create. A case that is not here is never a test-mailbox case,
-- whatever its JSON says.
create table if not exists public.sc_test_mailbox_cases(
 tenant_id text not null, case_id text not null, mailbox_id text not null, message_id text not null,
 body_sha256 text not null check(body_sha256~'^[a-f0-9]{64}$'), created_by uuid not null, created_at timestamptz not null default now(),
 primary key(tenant_id,case_id), unique(tenant_id,mailbox_id,message_id),
 foreign key(tenant_id,case_id) references public.sc_cases
);
alter table public.sc_test_mailbox_config enable row level security;
alter table public.sc_test_mailbox_cases enable row level security;
revoke all on public.sc_test_mailbox_config,public.sc_test_mailbox_cases from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on public.sc_test_mailbox_config,public.sc_test_mailbox_cases from service_role';
 end if;
end $$;

-- The one mailbox this project may ingest: from the deployment profile, else the fictional TEST mailbox.
create or replace function public.sc_tm_mailbox() returns text
language plpgsql stable security definer set search_path='' as $$
declare m text;
begin
 if to_regclass('public.sc_deployment_profile') is not null then
  execute 'select mailbox_address from public.sc_deployment_profile where singleton' into m;
  if m is null then raise exception 'deployment profile required' using errcode='55000'; end if;
  return m;
 end if;
 return 'sarberkiprojecttest@gmail.com';
end $$;

-- Shared guard: enabled switch, project binding, real Auth session (not revoked, not expired), permission.
-- With the deployment profile: the profile-bound sc_deployment_actor (own tenant, own issuer) + binding.
create or replace function public.sc_tm_actor(p_tenant text,p_permission text)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); claims jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb; ref text;
begin
 if to_regclass('public.sc_deployment_profile') is not null then
  execute 'select project_ref from public.sc_deployment_profile where singleton' into ref;
  if not exists(select 1 from public.sc_test_mailbox_config where singleton and enabled)
  or not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref=ref) then
   raise exception 'forbidden or expired' using errcode='42501';
  end if;
  execute 'select public.sc_deployment_actor($1,$2)' into actor using p_tenant,p_permission;
  return actor;
 end if;
 if p_tenant is distinct from 'sarberki-test'
 or not exists(select 1 from public.sc_test_mailbox_config where singleton and enabled)
 or not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref='mojnqizbcaczstguikpv')
 or not exists(select 1 from public.sc_tenants where tenant_id=p_tenant and test_only)
 or actor is null or not public.sc_has_permission(p_tenant,p_permission)
 or claims->>'iss' is distinct from 'https://mojnqizbcaczstguikpv.supabase.co/auth/v1'
 or claims->>'role' is distinct from 'authenticated'
 or coalesce(claims->>'exp','')!~'^[0-9]+$' or (claims->>'exp')::numeric<=extract(epoch from now())
 or coalesce(claims->>'session_id','')!~'^[a-f0-9-]{36}$' then
  raise exception 'forbidden or expired' using errcode='42501';
 end if;
 if not exists(select 1 from auth.sessions where id=(claims->>'session_id')::uuid and user_id=actor and (not_after is null or not_after>now())) then
  raise exception 'session revoked' using errcode='42501';
 end if;
 return actor;
end $$;

-- Create: only server-attested source (test-mailbox-source-v1, recomputed here), one message, pending.
create or replace function public.sc_tm_create(p_tenant text,p_case text,p_data jsonb,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; src jsonb; msg jsonb; draft jsonb; key text; body_hash text; fields text[]; changed jsonb; result public.sc_cases%rowtype;
begin
 actor:=public.sc_tm_actor(p_tenant,'write');
 if p_case!~'^[a-zA-Z0-9_-]{4,128}$' or jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>262144
 or p_data->>'id' is distinct from p_case or p_data->>'tenantId' is distinct from p_tenant
 or jsonb_typeof(p_data->'state') is distinct from 'object' or coalesce(p_data->'state'->>'approval','pending')<>'pending'
 or p_data ?| array['serverApproval','clarificationApproval','testMailbox','decisions','internalApproval','caseKind','linkReview']
 or jsonb_typeof(p_data->'messages') is distinct from 'array' or jsonb_array_length(p_data->'messages')<>1
 or jsonb_typeof(p_data->'drafts') is distinct from 'array' or jsonb_array_length(p_data->'drafts')<>1 then
  raise exception 'invalid test-mailbox case' using errcode='22023';
 end if;
 src:=p_data->'sourceReceipt';msg:=p_data->'messages'->0;draft:=p_data->'drafts'->0;
 if jsonb_typeof(src) is distinct from 'object' or src->>'provider' is distinct from 'gmail' or src->>'to' is distinct from public.sc_tm_mailbox()
 or src->'in_reply_to' is distinct from 'null'::jsonb or src->'references' is distinct from '[]'::jsonb or msg->'references' is distinct from '[]'::jsonb
 or p_data->>'sender' is distinct from src->>'from_email' or msg->>'sender' is distinct from src->>'from_email'
 or coalesce(src->>'from_email','')~'\.invalid$'
 or exists(select 1 from unnest(array['mailbox_id','message_id','thread_id','rfc_message_id','received_at']) k where msg->>k is distinct from src->>k)
 or jsonb_typeof(msg->'text') is distinct from 'string' or length(msg->>'text')>20000 or btrim(msg->>'text')=''
 or jsonb_typeof(draft->'text') is distinct from 'string' or length(draft->>'text')>20000 or btrim(draft->>'text')='' then
  raise exception 'invalid test-mailbox source' using errcode='22023';
 end if;
 body_hash:=encode(sha256(convert_to(msg->>'text','UTF8')),'hex');
 begin
  fields:=array['test-mailbox-source-v1',p_tenant,src->>'mailbox_id',src->>'message_id',src->>'thread_id',src->>'rfc_message_id',
   src->>'from_email',src->>'to',src->>'subject',src->>'received_at',body_hash,p_proof->>'checkedAt'];
  if jsonb_typeof(p_proof) is distinct from 'object' or p_proof->>'scope' is distinct from 'test-mailbox-source-v1'
  or p_proof->>'bodySha256' is distinct from body_hash or coalesce(p_proof->>'attestation','')!~'^[a-f0-9]{64}$'
  or exists(select 1 from unnest(fields) v where v is null or v='' or position(chr(10) in v)>0 or position(chr(13) in v)>0)
  or (p_proof->>'checkedAt')::timestamptz<now()-interval '120 seconds' or (p_proof->>'checkedAt')::timestamptz>now()+interval '1 second' then
   raise exception 'invalid proof';
  end if;
  select key_hex into key from public.sc_isolated_approval_key where singleton;
  if key is null or public.sc_isolated_approval_mac(array_to_string(fields,chr(10)),key) is distinct from p_proof->>'attestation' then
   raise exception 'invalid proof';
  end if;
 exception when others then raise exception 'server-attested test-mailbox source required' using errcode='42501'; end;
 if exists(select 1 from public.sc_cases where tenant_id=p_tenant and case_id=p_case)
 or exists(select 1 from public.sc_message_keys where tenant_id=p_tenant and mailbox_id=src->>'mailbox_id' and message_id=src->>'message_id') then
  raise exception 'message or case already exists' using errcode='23505';
 end if;
 -- machineDraft is set here (never by a client): the first draft is the server engine's text, saved unedited.
 changed:=jsonb_set(p_data,'{drafts,0}',draft||jsonb_build_object('createdBy',actor,'createdAt',now(),'basedOnRevision',0,'machineDraft',true))
  ||jsonb_build_object('testMailbox',jsonb_build_object('scope','test-mailbox-source-v1','checkedAt',p_proof->>'checkedAt','bodySha256',body_hash,'createdBy',actor),
   'decisions','[]'::jsonb);
 changed:=jsonb_set(changed,'{state,approval}','"pending"');
 insert into public.sc_cases(tenant_id,case_id,revision,data,updated_by) values(p_tenant,p_case,1,changed,actor) returning * into result;
 insert into public.sc_message_keys(tenant_id,mailbox_id,message_id,case_id) values(p_tenant,src->>'mailbox_id',src->>'message_id',p_case);
 insert into public.sc_test_mailbox_cases(tenant_id,case_id,mailbox_id,message_id,body_sha256,created_by) values(p_tenant,p_case,src->>'mailbox_id',src->>'message_id',body_hash,actor);
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values(p_tenant,p_case,1,actor,'tm_create',encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
 return to_jsonb(result);
end $$;

-- New draft by a Writer: append-only; allowed while pending, after return (must differ) or after rejection (reopen).
create or replace function public.sc_tm_redraft(p_tenant text,p_case text,p_expected bigint,p_draft jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; row_before public.sc_cases%rowtype; result public.sc_cases%rowtype; state text; changed jsonb; latest jsonb;
begin
 actor:=public.sc_tm_actor(p_tenant,'write');
 if p_expected is null or p_expected<1 or jsonb_typeof(p_draft) is distinct from 'object'
 or exists(select 1 from jsonb_object_keys(p_draft) k where k not in ('text','operatorReviewText'))
 or jsonb_typeof(p_draft->'text') is distinct from 'string' or btrim(p_draft->>'text')='' or length(p_draft->>'text')>20000
 or (p_draft ? 'operatorReviewText' and (jsonb_typeof(p_draft->'operatorReviewText') is distinct from 'string' or length(p_draft->>'operatorReviewText')>40000)) then
  raise exception 'invalid draft' using errcode='22023';
 end if;
 select * into row_before from public.sc_cases where tenant_id=p_tenant and case_id=p_case and revision=p_expected for update;
 if not found then return null; end if;
 if not exists(select 1 from public.sc_test_mailbox_cases where tenant_id=p_tenant and case_id=p_case) then
  raise exception 'test-mailbox case required' using errcode='42501';
 end if;
 state:=row_before.data->'state'->>'approval';latest:=row_before.data->'drafts'->-1;
 if state not in ('pending','returned_for_edit','rejected') then raise exception 'draft cannot change in this state' using errcode='22023'; end if;
 if state='returned_for_edit' and latest->>'text'=p_draft->>'text' then raise exception 'changed draft required' using errcode='22023'; end if;
 changed:=jsonb_set(row_before.data,'{drafts}',(row_before.data->'drafts')||jsonb_build_array(p_draft||jsonb_build_object('createdBy',actor,'createdAt',now(),'basedOnRevision',p_expected)));
 changed:=jsonb_set(changed,'{state,approval}','"pending"');
 update public.sc_cases set revision=p_expected+1,data=changed,updated_at=now(),updated_by=actor
  where tenant_id=p_tenant and case_id=p_case and revision=p_expected returning * into result;
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values(p_tenant,p_case,p_expected+1,actor,'tm_redraft',encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
 return to_jsonb(result);
end $$;

-- Price insertion (owner decision 2026-11-04): the SERVER computes the price-list price, replaces the
-- engine's generic price sentence and attests the exact new text (scope test-mailbox-price-v1, same server
-- key). A priced draft built on an unedited machine draft stays a machine draft, so the same operator may
-- approve it; on a human-edited draft it stays human (independent approver). The operator's availability
-- confirmation (Previo checked by hand) is recorded on the draft.
create or replace function public.sc_tm_price_redraft(p_tenant text,p_case text,p_expected bigint,p_draft jsonb,p_proof jsonb)
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
  fields:=array['test-mailbox-price-v1',p_tenant,p_case,p_expected::text,text_hash,encode(sha256(convert_to(p_draft->>'operatorReviewText','UTF8')),'hex'),p_proof->>'checkedAt'];
  if jsonb_typeof(p_proof) is distinct from 'object' or p_proof->>'scope' is distinct from 'test-mailbox-price-v1'
  or coalesce(p_proof->>'attestation','')!~'^[a-f0-9]{64}$' or exists(select 1 from unnest(fields) v where v is null or v='')
  or (p_proof->>'checkedAt')::timestamptz<now()-interval '120 seconds' or (p_proof->>'checkedAt')::timestamptz>now()+interval '1 second' then
   raise exception 'invalid proof';
  end if;
  select key_hex into key from public.sc_isolated_approval_key where singleton;
  if key is null or public.sc_isolated_approval_mac(array_to_string(fields,chr(10)),key) is distinct from p_proof->>'attestation' then raise exception 'invalid proof'; end if;
 exception when others then raise exception 'server-attested price required' using errcode='42501'; end;
 select * into row_before from public.sc_cases where tenant_id=p_tenant and case_id=p_case and revision=p_expected for update;
 if not found then return null; end if;
 if not exists(select 1 from public.sc_test_mailbox_cases where tenant_id=p_tenant and case_id=p_case) then
  raise exception 'test-mailbox case required' using errcode='42501';
 end if;
 state:=row_before.data->'state'->>'approval';latest:=row_before.data->'drafts'->-1;
 if state not in ('pending','returned_for_edit','rejected') then raise exception 'draft cannot change in this state' using errcode='22023'; end if;
 if latest->>'text'=p_draft->>'text' then raise exception 'changed draft required' using errcode='22023'; end if;
 changed:=jsonb_set(row_before.data,'{drafts}',(row_before.data->'drafts')||jsonb_build_array(p_draft||jsonb_build_object('createdBy',actor,'createdAt',now(),
  'basedOnRevision',p_expected,'priceInserted',true,'availabilityConfirmedByOperator',true,'machineDraft',coalesce(latest->'machineDraft','false'::jsonb)='true'::jsonb)));
 changed:=jsonb_set(changed,'{state,approval}','"pending"');
 update public.sc_cases set revision=p_expected+1,data=changed,updated_at=now(),updated_by=actor
  where tenant_id=p_tenant and case_id=p_case and revision=p_expected returning * into result;
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values(p_tenant,p_case,p_expected+1,actor,'tm_price_redraft',encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
 return to_jsonb(result);
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

-- Independent Approver decision on the exact reviewed draft: approve (internal, test-mailbox-v1), return or reject.
create or replace function public.sc_tm_decide(p_tenant text,p_case text,p_expected bigint,p_draft_hash text,p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; row_before public.sc_cases%rowtype; result public.sc_cases%rowtype; latest jsonb; changed jsonb; next_state text; decided_at timestamptz:=now();
begin
 actor:=public.sc_tm_actor(p_tenant,'approve');
 if p_expected is null or p_expected<1 or coalesce(p_draft_hash,'')!~'^[a-f0-9]{64}$' or p_decision not in ('approve','return','reject')
 or (p_reason is not null and (length(p_reason)>500 or p_reason~'[\r\n]')) then
  raise exception 'invalid decision' using errcode='22023';
 end if;
 select * into row_before from public.sc_cases where tenant_id=p_tenant and case_id=p_case and revision=p_expected for update;
 if not found then return null; end if;
 if not exists(select 1 from public.sc_test_mailbox_cases where tenant_id=p_tenant and case_id=p_case) then
  raise exception 'test-mailbox case required' using errcode='42501';
 end if;
 latest:=row_before.data->'drafts'->-1;
 if row_before.data->'state'->>'approval' is distinct from 'pending' then raise exception 'pending draft required' using errcode='22023'; end if;
 if encode(sha256(convert_to(coalesce(latest->>'text',''),'UTF8')),'hex') is distinct from p_draft_hash then raise exception 'reviewed draft mismatch' using errcode='22023'; end if;
 -- Owner decision 2026-11-04: an unedited machine draft may be approved by the operator who saved it;
 -- a human-written draft (sc_tm_redraft) still needs an approver other than its author.
 if (latest->>'createdBy')::uuid=actor and (latest->'machineDraft') is distinct from 'true'::jsonb then raise exception 'independent approver required' using errcode='42501'; end if;
 next_state:=case p_decision when 'approve' then 'approved_internal' when 'return' then 'returned_for_edit' else 'rejected' end;
 changed:=jsonb_set(row_before.data,'{decisions}',coalesce(row_before.data->'decisions','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
  'decision',p_decision,'actor',actor,'at',decided_at,'draftHash',p_draft_hash,'reviewedRevision',p_expected,'reason',p_reason)));
 changed:=jsonb_set(changed,'{state,approval}',to_jsonb(next_state));
 if p_decision='approve' then
  changed:=changed||jsonb_build_object('internalApproval',jsonb_build_object('scope','test-mailbox-v1','actor',actor,'at',decided_at,'draftHash',p_draft_hash,
   'reviewedRevision',p_expected,'capacityVerified',false,'priceVerified',false,'sendAllowed',false,'bookingAllowed',false));
 end if;
 update public.sc_cases set revision=p_expected+1,data=changed,updated_at=now(),updated_by=actor
  where tenant_id=p_tenant and case_id=p_case and revision=p_expected returning * into result;
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values(p_tenant,p_case,p_expected+1,actor,'tm_'||p_decision,encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
 return to_jsonb(result);
end $$;

revoke all on function public.sc_tm_actor(text,text),public.sc_tm_mailbox() from public,anon,authenticated;
revoke all on function public.sc_tm_create(text,text,jsonb,jsonb),public.sc_tm_redraft(text,text,bigint,jsonb),public.sc_tm_price_redraft(text,text,bigint,jsonb,jsonb),public.sc_tm_unavailable_redraft(text,text,bigint,jsonb,jsonb),public.sc_tm_decide(text,text,bigint,text,text,text) from public,anon;
grant execute on function public.sc_tm_create(text,text,jsonb,jsonb),public.sc_tm_redraft(text,text,bigint,jsonb),public.sc_tm_price_redraft(text,text,bigint,jsonb,jsonb),public.sc_tm_unavailable_redraft(text,text,bigint,jsonb,jsonb),public.sc_tm_decide(text,text,bigint,text,text,text) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.sc_tm_mailbox(),public.sc_tm_actor(text,text),public.sc_tm_create(text,text,jsonb,jsonb),public.sc_tm_redraft(text,text,bigint,jsonb),public.sc_tm_price_redraft(text,text,bigint,jsonb,jsonb),public.sc_tm_unavailable_redraft(text,text,bigint,jsonb,jsonb),public.sc_tm_decide(text,text,bigint,text,text,text) from service_role';
 end if;
end $$;
commit;
