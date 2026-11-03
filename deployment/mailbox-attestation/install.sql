-- Mailbox source attestation (slice 4 of the live case store). Installs only the server-only attestation key
-- table and HMAC that sc_tm_* (deployment/test-mailbox/install.sql) need, so a LIVE project does not need the
-- TEST-only synthetic approval package (deployment/cloud-approval). The block between the markers is a verbatim
-- copy of deployment/cloud-approval/install.sql (enforced by tests/mailbox-attestation-pglite.test.mjs);
-- re-running it on the TEST project is a no-op. Requires the deployment profile. Operator only, one transaction.
begin;
do $$ begin
 if to_regprocedure('public.sc_deployment_tenant()') is null then raise exception 'DEPLOYMENT_PROFILE_REQUIRED' using errcode='55000'; end if;
 if public.sc_deployment_tenant() is null then raise exception 'DEPLOYMENT_PROFILE_REQUIRED' using errcode='55000'; end if;
end $$;
-- BEGIN SHARED ATTESTATION BLOCK
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
-- END SHARED ATTESTATION BLOCK
commit;
