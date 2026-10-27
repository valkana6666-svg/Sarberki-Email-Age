-- TEST-ONLY CANDIDATE. DO NOT APPLY WITHOUT BACKUP/RESTORE AND OWNER REVIEW.
-- No Gmail API, no dispatch RPC, no direct client grants.
begin;
do $guard$
begin
 if current_setting('sarberki.approval_install_project_ref',true) is distinct from 'mojnqizbcaczstguikpv'
 or coalesce(current_setting('sarberki.approval_backup_sha256',true),'') !~ '^[a-f0-9]{64}$'
 or current_setting('sarberki.mail_schema_reviewed',true) is distinct from 'yes'
 or not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref='mojnqizbcaczstguikpv')
 or not exists(select 1 from public.sc_tenants where tenant_id='sarberki-test' and test_only)
 or exists(select 1 from public.sc_tenants where not test_only or tenant_id not in ('sarberki-test','demo-test'))
 then raise exception 'test-only reviewed migration and verified restore proof required';
 end if;
end $guard$;

create table public.sc_mail_send_memberships (
 tenant_id text not null,
 user_id uuid not null,
 can_send boolean not null default false,
 created_at timestamptz not null default now(),
 primary key(tenant_id,user_id),
 constraint sc_mail_send_memberships_test_tenant check(tenant_id='sarberki-test'),
 constraint sc_mail_send_memberships_existing_member foreign key(tenant_id,user_id)
   references public.sc_memberships(tenant_id,user_id) on delete cascade
);
alter table public.sc_mail_send_memberships enable row level security;
alter table public.sc_mail_send_memberships force row level security;
revoke all on public.sc_mail_send_memberships from public, anon, authenticated;

create table public.sc_mail_dispatches (
 dispatch_id uuid primary key default gen_random_uuid(),
 tenant_id text not null,
 case_id text not null,
 approval_revision bigint not null check(approval_revision>0),
 draft_sha256 text not null check(draft_sha256 ~ '^[a-f0-9]{64}$'),
 destination text not null,
 status text not null default 'reserved',
 gmail_message_id text,
 actor uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint sc_mail_dispatches_exact_tenant check(tenant_id='sarberki-test'),
 constraint sc_mail_dispatches_exact_case check(case_id='13c8ecb7-f836-4e2c-9833-d58ee96f2dda'),
 constraint sc_mail_dispatches_test_destination check(destination='sarberkiprojecttest@gmail.com'),
 constraint sc_mail_dispatches_status check(status in ('reserved','sent','uncertain','failed_before_send')),
 constraint sc_mail_dispatches_sent_has_gmail_id check(status<>'sent' or (gmail_message_id is not null and length(gmail_message_id)>0)),
 constraint sc_mail_dispatches_unique unique(tenant_id,case_id,approval_revision,draft_sha256,destination),
 constraint sc_mail_dispatches_case_fk foreign key(tenant_id,case_id) references public.sc_cases(tenant_id,case_id)
);
alter table public.sc_mail_dispatches enable row level security;
alter table public.sc_mail_dispatches force row level security;
revoke all on public.sc_mail_dispatches from public, anon, authenticated;

-- Deliberately NO policies, NO user-accessible RPCs, NO initial can_send=true rows.
-- Explicit owner-controlled migration is needed before permission or reservation.
commit;
