-- Sárberki V1 test-only Pushover idempotency ledger.
-- SOURCE-ONLY, NOT APPLIED. No Pushover endpoint is connected by this migration.
-- Requires separate Supabase test-project authorization, privilege audit, and
-- real PostgreSQL concurrency tests before deployment.
begin;
-- BEGIN LEDGER DDL (also exercised in isolated local SQL tests)
create table if not exists public.sc_pushover_delivery_claims (
  tenant_id text not null check (tenant_id = 'sarberki-test'),
  mailbox text not null check (mailbox = 'sarberkiprojecttest@gmail.com'),
  gmail_message_id text not null check (gmail_message_id ~ '^[A-Za-z0-9_-]{5,128}$'),
  notification_type text not null check (notification_type = 'gmail-new-message'),
  claim_id uuid not null default gen_random_uuid(),
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'outcome_unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider_request_id text null check (provider_request_id is null or length(provider_request_id) <= 128),
  primary key (tenant_id, mailbox, gmail_message_id, notification_type),
  unique (claim_id)
);
-- END LEDGER DDL
alter table public.sc_pushover_delivery_claims enable row level security;
revoke all on public.sc_pushover_delivery_claims from public, anon, authenticated;
-- Service role only; no RLS policies for browser users.
grant select, insert, update on public.sc_pushover_delivery_claims to service_role;

-- Atomic insert wins exactly once. NEVER reset or delete a claim on timeout.
-- Only the server can call these SECURITY INVOKER functions with service role.
create function public.sc_pushover_claim_once(p_tenant text,p_mailbox text,p_message text,p_kind text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_claim uuid;
begin
  if p_tenant is distinct from 'sarberki-test' or p_mailbox is distinct from 'sarberkiprojecttest@gmail.com'
     or p_kind is distinct from 'gmail-new-message'
     or coalesce(p_message,'') !~ '^[A-Za-z0-9_-]{5,128}$' then
    raise exception 'invalid notification claim' using errcode='22023';
  end if;
  insert into public.sc_pushover_delivery_claims(tenant_id,mailbox,gmail_message_id,notification_type)
  values(p_tenant,p_mailbox,p_message,p_kind)
  on conflict (tenant_id,mailbox,gmail_message_id,notification_type) do nothing
  returning claim_id into v_claim;
  if v_claim is null then return jsonb_build_object('status','duplicate'); end if;
  return jsonb_build_object('status','claimed','claimId',v_claim::text);
end;
$$;
create function public.sc_pushover_mark_sent(p_claim uuid,p_provider_request_id text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_claim is null or coalesce(p_provider_request_id,'')='' or length(p_provider_request_id)>128 then
   return false;
 end if;
 update public.sc_pushover_delivery_claims
 set status='sent',updated_at=clock_timestamp(),provider_request_id=p_provider_request_id
 where claim_id=p_claim and status='sending';
 return found;
end;
$$;
create function public.sc_pushover_mark_unknown(p_claim uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_claim is null then return false; end if;
 update public.sc_pushover_delivery_claims
 set status='outcome_unknown',updated_at=clock_timestamp()
 where claim_id=p_claim and status='sending';
 return found;
end;
$$;
revoke all on function public.sc_pushover_claim_once(text,text,text,text) from public, anon, authenticated;
revoke all on function public.sc_pushover_mark_sent(uuid,text) from public, anon, authenticated;
revoke all on function public.sc_pushover_mark_unknown(uuid) from public, anon, authenticated;
grant execute on function public.sc_pushover_claim_once(text,text,text,text) to service_role;
grant execute on function public.sc_pushover_mark_sent(uuid,text) to service_role;
grant execute on function public.sc_pushover_mark_unknown(uuid) to service_role;
commit;
