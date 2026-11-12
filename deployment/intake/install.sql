-- TEST – V3-1 shared intake (owner-approved V3 plan, 2026-11-12, #9 6822281802): a phone call (voice agent) or a
-- chat conversation becomes a booking request in the SAME case store, as a test-mailbox case, so every existing
-- operator step (price, finalize, V2 Previo option, cancel, modify, approval) works unchanged. Nothing is sent or
-- booked here; a human approves as before. Requires deployment/test-mailbox/install.sql.
-- Writer: a dedicated intake account (Supabase Auth user) listed in sc_intake_actors. It has NO read/write/approve
-- membership, so it can call nothing but sc_intake_create (least privilege; no service role, AGENTS.md).
-- Source proof: server HMAC attestation (scope intake-source-v1) with the isolated approval key, as sc_tm_create.
-- Idempotent per (channel, external id): the same call/conversation can never create two cases.
-- Rollback: deployment/intake/rollback.sql.
begin;
do $$ begin
 if coalesce(current_setting('sarberki.tm_install_project_ref',true),'')!~'^[a-z]{20}$'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or to_regprocedure('public.sc_tm_create(text,text,jsonb,jsonb)') is null
 or to_regprocedure('public.sc_isolated_approval_mac(text,text)') is null
 or to_regclass('public.sc_test_mailbox_cases') is null then
  raise exception 'verified project, fresh backup and test-mailbox install required';
 end if;
end $$;

create table if not exists public.sc_intake_actors(
 tenant_id text not null references public.sc_tenants, user_id uuid not null,
 created_at timestamptz not null default now(), primary key(tenant_id,user_id)
);
alter table public.sc_intake_actors enable row level security;
revoke all on public.sc_intake_actors from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on public.sc_intake_actors from service_role';
 end if;
end $$;

-- Same session guard as sc_tm_actor (switch, project binding, real unexpired session), but the right is the
-- intake registry, not a membership. TEST only: a deployment profile (live) is refused until configured.
create or replace function public.sc_intake_actor(p_tenant text)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); claims jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
begin
 if to_regclass('public.sc_deployment_profile') is not null then
  raise exception 'intake not configured for this deployment' using errcode='42501';
 end if;
 if p_tenant is distinct from 'sarberki-test'
 or not exists(select 1 from public.sc_test_mailbox_config where singleton and enabled)
 or not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref='mojnqizbcaczstguikpv')
 or not exists(select 1 from public.sc_tenants where tenant_id=p_tenant and test_only)
 or actor is null or not exists(select 1 from public.sc_intake_actors where tenant_id=p_tenant and user_id=actor)
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

create or replace function public.sc_intake_create(p_tenant text,p_case text,p_data jsonb,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; src jsonb; msg jsonb; draft jsonb; key text; body_hash text; fields text[]; changed jsonb; result public.sc_cases%rowtype; box text;
begin
 actor:=public.sc_intake_actor(p_tenant);
 if p_case!~'^tm-[a-f0-9]{12,32}$' or jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>262144
 or p_data->>'id' is distinct from p_case or p_data->>'tenantId' is distinct from p_tenant
 or jsonb_typeof(p_data->'state') is distinct from 'object' or coalesce(p_data->'state'->>'approval','pending')<>'pending'
 or p_data ?| array['serverApproval','clarificationApproval','testMailbox','decisions','internalApproval','caseKind','linkReview','booking']
 or jsonb_typeof(p_data->'messages') is distinct from 'array' or jsonb_array_length(p_data->'messages')<>1
 or jsonb_typeof(p_data->'drafts') is distinct from 'array' or jsonb_array_length(p_data->'drafts')<>1 then
  raise exception 'invalid intake case' using errcode='22023';
 end if;
 src:=p_data->'sourceReceipt';msg:=p_data->'messages'->0;draft:=p_data->'drafts'->0;
 if jsonb_typeof(src) is distinct from 'object' or coalesce(src->>'provider','') not in ('phone','chat')
 or coalesce(src->>'external_id','')!~'^[A-Za-z0-9_.:-]{6,128}$'
 or coalesce(src->>'received_at','')='' or msg->>'received_at' is distinct from src->>'received_at'
 or p_data->>'sender' is distinct from 'intake:'||(src->>'provider')
 or jsonb_typeof(msg->'text') is distinct from 'string' or length(msg->>'text')>20000 or btrim(msg->>'text')=''
 or jsonb_typeof(draft->'text') is distinct from 'string' or length(draft->>'text')>20000 or btrim(draft->>'text')='' then
  raise exception 'invalid intake source' using errcode='22023';
 end if;
 box:='intake:'||(src->>'provider');
 body_hash:=encode(sha256(convert_to(msg->>'text','UTF8')),'hex');
 begin
  fields:=array['intake-source-v1',p_tenant,src->>'provider',src->>'external_id',src->>'received_at',body_hash,p_proof->>'checkedAt'];
  if jsonb_typeof(p_proof) is distinct from 'object' or p_proof->>'scope' is distinct from 'intake-source-v1'
  or p_proof->>'bodySha256' is distinct from body_hash or coalesce(p_proof->>'attestation','')!~'^[a-f0-9]{64}$'
  or exists(select 1 from unnest(fields) v where v is null or v='' or position(chr(10) in v)>0 or position(chr(13) in v)>0)
  or (p_proof->>'checkedAt')::timestamptz<now()-interval '120 seconds' or (p_proof->>'checkedAt')::timestamptz>now()+interval '1 second' then
   raise exception 'invalid proof';
  end if;
  select key_hex into key from public.sc_isolated_approval_key where singleton;
  if key is null or public.sc_isolated_approval_mac(array_to_string(fields,chr(10)),key) is distinct from p_proof->>'attestation' then
   raise exception 'invalid proof';
  end if;
 exception when others then raise exception 'server-attested intake source required' using errcode='42501'; end;
 if exists(select 1 from public.sc_cases where tenant_id=p_tenant and case_id=p_case)
 or exists(select 1 from public.sc_message_keys where tenant_id=p_tenant and mailbox_id=box and message_id=src->>'external_id') then
  raise exception 'intake already recorded' using errcode='23505';
 end if;
 changed:=jsonb_set(p_data,'{drafts,0}',draft||jsonb_build_object('createdBy',actor,'createdAt',now(),'basedOnRevision',0,'machineDraft',true))
  ||jsonb_build_object('testMailbox',jsonb_build_object('scope','intake-source-v1','channel',src->>'provider','checkedAt',p_proof->>'checkedAt','bodySha256',body_hash,'createdBy',actor),
   'decisions','[]'::jsonb);
 changed:=jsonb_set(changed,'{state,approval}','"pending"');
 insert into public.sc_cases(tenant_id,case_id,revision,data,updated_by) values(p_tenant,p_case,1,changed,actor) returning * into result;
 insert into public.sc_message_keys(tenant_id,mailbox_id,message_id,case_id) values(p_tenant,box,src->>'external_id',p_case);
 insert into public.sc_test_mailbox_cases(tenant_id,case_id,mailbox_id,message_id,body_sha256,created_by) values(p_tenant,p_case,box,src->>'external_id',body_hash,actor);
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values(p_tenant,p_case,1,actor,'intake_create',encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
 -- Only the identifiers go back: the intake account cannot read cases (no read membership).
 return jsonb_build_object('caseId',result.case_id,'revision',result.revision);
end $$;

revoke all on function public.sc_intake_actor(text) from public,anon,authenticated;
revoke all on function public.sc_intake_create(text,text,jsonb,jsonb) from public,anon;
grant execute on function public.sc_intake_create(text,text,jsonb,jsonb) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.sc_intake_actor(text) from service_role';
  execute 'revoke all on function public.sc_intake_create(text,text,jsonb,jsonb) from service_role';
 end if;
end $$;
commit;
