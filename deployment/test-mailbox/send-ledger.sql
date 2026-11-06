-- TEST ONLY (mojnqizbcaczstguikpv). Atomic send ledger for the test-mailbox "Válasz küldése" button.
-- One row per (tenant, case, approved draft hash): the first claim wins, a second click, a second tab or
-- a retry after a timeout cannot send the same approved reply twice. Requires deployment/test-mailbox/install.sql.
-- Additive: no existing table, function, grant or policy is changed. The server uses it only when the
-- Netlify switch CASE_TEST_MAILBOX_SEND_LEDGER=required is set (until then the thread-header check remains).
-- Statuses: sending (claimed, Gmail call in flight) -> sent | failed (Gmail refused before sending: may be
-- claimed again) | outcome_unknown (timeout/5xx: never retried automatically; a human checks Gmail).
begin;
do $$ begin
 if current_setting('sarberki.tm_install_project_ref',true) is distinct from 'mojnqizbcaczstguikpv'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or to_regprocedure('public.sc_tm_actor(text,text)') is null
 or to_regclass('public.sc_test_mailbox_cases') is null then
  raise exception 'verified test project, fresh backup and test-mailbox install required';
 end if;
end $$;

create table if not exists public.sc_tm_send_ledger(
 tenant_id text not null,
 case_id text not null,
 draft_hash text not null check(draft_hash~'^[a-f0-9]{64}$'),
 claim_id uuid not null unique,
 status text not null default 'sending' check(status in ('sending','sent','failed','outcome_unknown')),
 claimed_by uuid not null,
 claimed_at timestamptz not null default now(),
 finished_at timestamptz,
 gmail_message_id text check(gmail_message_id is null or gmail_message_id~'^[A-Za-z0-9_-]{5,128}$'),
 primary key(tenant_id,case_id,draft_hash),
 foreign key(tenant_id,case_id) references public.sc_test_mailbox_cases(tenant_id,case_id)
);
alter table public.sc_tm_send_ledger enable row level security;
revoke all on public.sc_tm_send_ledger from public,anon,authenticated;
-- Members with read permission may see the send status; nobody writes except the definer functions below.
grant select on public.sc_tm_send_ledger to authenticated;
drop policy if exists sc_tm_send_ledger_read on public.sc_tm_send_ledger;
create policy sc_tm_send_ledger_read on public.sc_tm_send_ledger for select to authenticated using(public.sc_has_permission(tenant_id,'read'));
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on public.sc_tm_send_ledger from service_role';
 end if;
end $$;

-- Claim: approver only; the exact reviewed revision; the case must be internally approved and the hash must
-- be both the approved hash and the hash of the latest draft. Returns {status:'claimed',claimId} once;
-- afterwards {status:<existing>}. A 'failed' row (Gmail refused before sending) may be claimed again.
create or replace function public.sc_tm_send_claim(p_tenant text,p_case text,p_expected bigint,p_draft_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; c public.sc_cases%rowtype; latest jsonb; claim uuid:=gen_random_uuid(); won uuid; existing text;
begin
 actor:=public.sc_tm_actor(p_tenant,'approve');
 if p_expected is null or p_expected<1 or coalesce(p_draft_hash,'')!~'^[a-f0-9]{64}$' then
  raise exception 'invalid send claim' using errcode='22023';
 end if;
 select * into c from public.sc_cases where tenant_id=p_tenant and case_id=p_case and revision=p_expected for update;
 if not found then return null; end if;
 if not exists(select 1 from public.sc_test_mailbox_cases where tenant_id=p_tenant and case_id=p_case) then
  raise exception 'test-mailbox case required' using errcode='42501';
 end if;
 latest:=c.data->'drafts'->-1;
 if c.data->'state'->>'approval' is distinct from 'approved_internal'
 or c.data->'internalApproval'->>'scope' is distinct from 'test-mailbox-v1'
 or c.data->'internalApproval'->>'draftHash' is distinct from p_draft_hash
 or encode(sha256(convert_to(coalesce(latest->>'text',''),'UTF8')),'hex') is distinct from p_draft_hash then
  raise exception 'approved latest draft required' using errcode='22023';
 end if;
 insert into public.sc_tm_send_ledger(tenant_id,case_id,draft_hash,claim_id,claimed_by)
  values(p_tenant,p_case,p_draft_hash,claim,actor)
  on conflict(tenant_id,case_id,draft_hash) do nothing returning claim_id into won;
 if won is not null then return jsonb_build_object('status','claimed','claimId',won::text); end if;
 update public.sc_tm_send_ledger set status='sending',claim_id=claim,claimed_by=actor,claimed_at=now(),finished_at=null
  where tenant_id=p_tenant and case_id=p_case and draft_hash=p_draft_hash and status='failed' returning claim_id into won;
 if won is not null then return jsonb_build_object('status','claimed','claimId',won::text); end if;
 select status into existing from public.sc_tm_send_ledger where tenant_id=p_tenant and case_id=p_case and draft_hash=p_draft_hash;
 return jsonb_build_object('status',existing);
end $$;

-- Finish: only the claimer, only from 'sending'. 'sent' requires the Gmail message id.
create or replace function public.sc_tm_send_finish(p_tenant text,p_claim uuid,p_status text,p_gmail_message_id text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=public.sc_tm_actor(p_tenant,'approve');
 if p_claim is null or p_status not in ('sent','failed','outcome_unknown')
 or (p_status='sent')<>(p_gmail_message_id is not null)
 or (p_gmail_message_id is not null and p_gmail_message_id!~'^[A-Za-z0-9_-]{5,128}$') then
  raise exception 'invalid send result' using errcode='22023';
 end if;
 update public.sc_tm_send_ledger set status=p_status,finished_at=now(),gmail_message_id=p_gmail_message_id
  where tenant_id=p_tenant and claim_id=p_claim and claimed_by=actor and status='sending';
 return found;
end $$;

revoke all on function public.sc_tm_send_claim(text,text,bigint,text),public.sc_tm_send_finish(text,uuid,text,text) from public,anon;
grant execute on function public.sc_tm_send_claim(text,text,bigint,text),public.sc_tm_send_finish(text,uuid,text,text) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.sc_tm_send_claim(text,text,bigint,text),public.sc_tm_send_finish(text,uuid,text,text) from service_role';
 end if;
end $$;
commit;
