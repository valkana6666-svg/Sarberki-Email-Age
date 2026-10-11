-- Rehearsal only. Not a Supabase migration; NEVER install on the source project.
begin;
do $$ begin
 if current_database() <> 'sc_approval_test' then
  raise exception 'new isolated sc_approval_test database required';
 end if;
end $$;

-- Disposable server-only signing material. A single row is provisioned by the
-- isolated harness owner; user-token REST clients cannot read or mutate it.
create table if not exists public.sc_isolated_approval_key (
 singleton boolean primary key default true check (singleton),
 key_hex text not null check (key_hex ~ '^[a-f0-9]{64}$')
);
alter table public.sc_isolated_approval_key enable row level security;
revoke all on public.sc_isolated_approval_key from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on public.sc_isolated_approval_key from service_role';
 end if;
end $$;

-- RFC 2104 HMAC-SHA256 using PostgreSQL's built-in SHA-256. Isolated keys are
-- exactly 32 bytes, shorter than the 64-byte SHA-256 block; no extension needed.
create or replace function public.sc_isolated_approval_mac(p_message text,p_key_hex text)
returns text language plpgsql immutable strict set search_path='' as $$
declare
 padded bytea; ipad bytea; opad bytea; i integer;
begin
 if p_key_hex!~'^[a-f0-9]{64}$' then
  raise exception 'invalid attestation key' using errcode='22023';
 end if;
 padded:=decode(rpad(p_key_hex,128,'0'),'hex');
 ipad:=padded;opad:=padded;
 for i in 0..63 loop
  ipad:=set_byte(ipad,i,get_byte(padded,i) # 54);
  opad:=set_byte(opad,i,get_byte(padded,i) # 92);
 end loop;
 return encode(sha256(opad || sha256(ipad || convert_to(p_message,'UTF8'))),'hex');
end $$;
revoke all on function public.sc_isolated_approval_mac(text,text) from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.sc_isolated_approval_mac(text,text) from service_role';
 end if;
end $$;

-- Only this specialized RPC can approve. Ordinary sc_write_case remains closed.
create or replace function public.sc_approve_case(
 p_tenant text,p_case text,p_expected bigint,p_draft_hash text,p_evidence jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); claims jsonb; current_row public.sc_cases%rowtype;
 latest jsonb; changed_data jsonb; result public.sc_cases%rowtype;
 attestation_fields text[]; attestation_message text; approval_key text;
 expected_attestation text;
begin
 if current_database()<>'sc_approval_test' or p_tenant<>'sarberki-test' then
  raise exception 'isolated approval only' using errcode='42501';
 end if;
 claims:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
 if actor is null or not public.sc_has_permission(p_tenant,'approve')
 or coalesce(claims->>'role','')<>'authenticated'
 or coalesce(claims->>'exp','')!~'^[0-9]+$'
 or (claims->>'exp')::numeric<=extract(epoch from now())
 or coalesce(claims->>'session_id','')!~'^[a-f0-9-]{36}$' then
  raise exception 'forbidden or expired' using errcode='42501';
 end if;
 if not exists(select 1 from auth.sessions where id=(claims->>'session_id')::uuid
 and user_id=actor and (not_after is null or not_after>now())) then
  raise exception 'session revoked' using errcode='42501';
 end if;
 if p_expected is null or p_expected<1 or p_draft_hash is null or p_draft_hash!~'^[a-f0-9]{64}$' then
  raise exception 'invalid approval' using errcode='22023';
 end if;
 -- Operator membership alone cannot attest fresh capacity. The API signs the
 -- exact scope, revision, draft and provider evidence after its own checks.
 -- Fail closed with one non-secret authorization error on absent/bad proof.
 begin
  attestation_fields:=array[
   p_tenant,p_case,p_expected::text,p_draft_hash,
   p_evidence->>'tenantId',p_evidence->>'source',p_evidence->>'status',
   p_evidence->>'unit',p_evidence->>'arrival',p_evidence->>'departure',
   p_evidence->>'availableUnits',p_evidence->>'checkedAt'
  ];
  if jsonb_typeof(p_evidence) is distinct from 'object'
  or coalesce(p_evidence->>'attestation','')!~'^[a-f0-9]{64}$'
  or exists(select 1 from unnest(attestation_fields) as fields(value)
   where value is null or value='' or position(chr(10) in value)>0
   or position(chr(13) in value)>0) then
   raise exception 'invalid evidence attestation';
  end if;
  select key_hex into approval_key from public.sc_isolated_approval_key
  where singleton=true;
  if approval_key is null then raise exception 'missing attestation key'; end if;
  attestation_message:=array_to_string(attestation_fields,chr(10));
  expected_attestation:=public.sc_isolated_approval_mac(attestation_message,approval_key);
  if not coalesce(expected_attestation=p_evidence->>'attestation',false) then
   raise exception 'invalid evidence attestation';
  end if;
 exception when others then
  raise exception 'server-attested evidence required' using errcode='42501';
 end;
 select * into current_row from public.sc_cases
 where tenant_id=p_tenant and case_id=p_case and revision=p_expected for update;
 if not found then return null; end if;
 if current_row.data->'state'->>'approval' is distinct from 'pending'
 or coalesce(current_row.data->>'sender','')!~'^[^@[:space:]]+@[^@[:space:]]+\.invalid$'
 or jsonb_typeof(current_row.data->'drafts') is distinct from 'array'
 or jsonb_array_length(current_row.data->'drafts')<1 then
  raise exception 'pending synthetic draft required' using errcode='22023';
 end if;
 latest:=(current_row.data->'drafts')->-1;
 if latest->>'synthetic' is distinct from 'true'
 or latest->>'reviewStatus' is distinct from 'internal_review_required'
 or coalesce(latest->>'text','')=''
 or encode(sha256(convert_to(latest->>'text','UTF8')),'hex')<>p_draft_hash then
  raise exception 'reviewed draft mismatch' using errcode='22023';
 end if;
 if jsonb_typeof(p_evidence) is distinct from 'object'
 or p_evidence->>'source' is distinct from 'synthetic-fixture'
 or p_evidence->>'status' is distinct from 'AVAILABLE'
 or p_evidence->>'tenantId' is distinct from p_tenant
 or p_evidence->>'arrival' is distinct from current_row.data->'state'->'values'->>'arrival'
 or p_evidence->>'departure' is distinct from current_row.data->'state'->'values'->>'departure'
 or p_evidence->>'unit' is distinct from current_row.data->'state'->'values'->>'unit'
 or coalesce(p_evidence->>'availableUnits','')!~'^[1-9][0-9]*$'
 or (p_evidence->>'availableUnits')::numeric<coalesce(nullif(current_row.data->'state'->'values'->>'units_requested',''),'1')::numeric
 or p_evidence->>'checkedAt' is null
 or (p_evidence->>'checkedAt')::timestamptz<now()-interval '120 seconds'
 or (p_evidence->>'checkedAt')::timestamptz>now()+interval '1 second' then
  raise exception 'current matching synthetic evidence required' using errcode='22023';
 end if;
 changed_data:=jsonb_set(current_row.data,'{state,approval}','"internally_approved"');
 changed_data:=jsonb_set(changed_data,'{serverApproval}',jsonb_build_object(
  'scope','isolated_synthetic_review','actor',actor,'at',now(),
  'reviewedRevision',p_expected,'draftHash',p_draft_hash,'evidence',p_evidence));
 update public.sc_cases set data=changed_data,revision=p_expected+1,updated_by=actor,updated_at=now()
 where tenant_id=p_tenant and case_id=p_case and revision=p_expected returning * into result;
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash)
 values(p_tenant,p_case,p_expected+1,actor,'approve_isolated_synthetic',encode(sha256(convert_to(changed_data::text,'UTF8')),'hex'));
 return to_jsonb(result);
end $$;
revoke all on function public.sc_approve_case(text,text,bigint,text,jsonb) from public,anon;
grant execute on function public.sc_approve_case(text,text,bigint,text,jsonb) to authenticated;
commit;
