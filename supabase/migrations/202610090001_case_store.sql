begin;
create table if not exists public.sc_tenants (
 tenant_id text primary key check (tenant_id ~ '^[a-z][a-z0-9-]{1,63}$'),
 name text not null, test_only boolean not null default true check (test_only)
);
create table if not exists public.sc_memberships (
 tenant_id text not null references public.sc_tenants, user_id uuid not null references auth.users,
 can_read boolean not null default false, can_write boolean not null default false,
 can_approve boolean not null default false, primary key(tenant_id,user_id),
 check (not can_write or can_read), check (not can_approve or can_write)
);
create table if not exists public.sc_cases (
 tenant_id text not null references public.sc_tenants, case_id text not null check(case_id ~ '^[a-zA-Z0-9_-]{4,128}$'),
 revision bigint not null check(revision>0), data jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users, primary key(tenant_id,case_id),
 check(data->>'id'=case_id and data->>'tenantId'=tenant_id),
 check(jsonb_typeof(data->'state')='object'), check(jsonb_typeof(data->'messages')='array')
);
create index if not exists sc_cases_updated on public.sc_cases(tenant_id,updated_at,case_id);
-- Payload remains in the existing engine snapshot; this table stores identity only.
create table if not exists public.sc_message_keys (
 tenant_id text not null, mailbox_id text not null, message_id text not null,
 case_id text not null, primary key(tenant_id,mailbox_id,message_id),
 foreign key(tenant_id,case_id) references public.sc_cases on delete cascade
);
create table if not exists public.sc_audit (
 event_id bigint generated always as identity primary key, tenant_id text not null,
 case_id text not null, revision bigint not null, actor uuid not null,
 at timestamptz not null default now(), kind text not null, data_hash text not null,
 unique(tenant_id,case_id,revision)
);
-- No membership mutation or case mutation grants to clients, even authenticated ones.
alter table public.sc_tenants enable row level security;
alter table public.sc_memberships enable row level security;
alter table public.sc_cases enable row level security;
alter table public.sc_message_keys enable row level security;
alter table public.sc_audit enable row level security;
create or replace function public.sc_has_permission(t text, p text) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.sc_memberships m where m.tenant_id=t and m.user_id=auth.uid()
 and case p when 'read' then m.can_read when 'write' then m.can_write when 'approve' then m.can_approve else false end);
$$;
revoke all on function public.sc_has_permission(text,text) from public,anon;
grant execute on function public.sc_has_permission(text,text) to authenticated;
drop policy if exists sc_members_self on public.sc_memberships;
create policy sc_members_self on public.sc_memberships for select to authenticated using(user_id=auth.uid());
drop policy if exists sc_tenant_read on public.sc_tenants;
create policy sc_tenant_read on public.sc_tenants for select to authenticated using(public.sc_has_permission(tenant_id,'read'));
drop policy if exists sc_case_read on public.sc_cases;
create policy sc_case_read on public.sc_cases for select to authenticated using(public.sc_has_permission(tenant_id,'read'));
drop policy if exists sc_key_read on public.sc_message_keys;
create policy sc_key_read on public.sc_message_keys for select to authenticated using(public.sc_has_permission(tenant_id,'read'));
drop policy if exists sc_audit_read on public.sc_audit;
create policy sc_audit_read on public.sc_audit for select to authenticated using(public.sc_has_permission(tenant_id,'read'));
revoke all on public.sc_tenants,public.sc_memberships,public.sc_cases,public.sc_message_keys,public.sc_audit from public,anon,authenticated;
grant select on public.sc_tenants,public.sc_memberships,public.sc_cases,public.sc_message_keys,public.sc_audit to authenticated;

-- Explicit authority checks are mandatory: this definer route bypasses RLS.
create or replace function public.sc_write_case(p_tenant text,p_case text,p_expected bigint,p_data jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare old_data jsonb; msg jsonb; changed integer; actor uuid := auth.uid();
begin
 if actor is null or not public.sc_has_permission(p_tenant,'write') then
  raise exception 'forbidden' using errcode='42501';
 end if;
 if p_expected is null or p_expected<0 or p_data->>'id' is distinct from p_case
 or p_data->>'tenantId' is distinct from p_tenant
 or jsonb_typeof(p_data->'state') is distinct from 'object'
 or jsonb_typeof(p_data->'state'->'values') is distinct from 'object'
 or jsonb_typeof(p_data->'messages') is distinct from 'array'
 or jsonb_typeof(p_data->'drafts') is distinct from 'array'
 or octet_length(p_data::text)>262144 then raise exception 'invalid case' using errcode='22023'; end if;
 if (p_data->'state'->'quote' is not null and p_data->'state'->'quote'<>'null'::jsonb)
 or (p_data->'state'->'availability' is not null and p_data->'state'->'availability'<>'null'::jsonb) then
 raise exception 'verified evidence route disabled' using errcode='42501'; end if;
 if coalesce(p_data->>'sender','') !~ '^[^@[:space:]]+@[^@[:space:]]+\.invalid$' then
 raise exception 'synthetic sender required' using errcode='22023'; end if;
 if coalesce(p_data->'state'->>'approval','pending') <> 'pending' then
  raise exception 'approval route disabled' using errcode='42501'; end if;
 if p_expected=0 then
  insert into public.sc_cases(tenant_id,case_id,revision,data,updated_by)
  values(p_tenant,p_case,1,p_data,actor) on conflict(tenant_id,case_id) do nothing;
  get diagnostics changed = row_count;
 else
  select data into old_data from public.sc_cases where tenant_id=p_tenant and case_id=p_case and revision=p_expected for update;
  if not found then return false; end if;
  -- Existing messages and draft versions are append-only during ordinary writes.
  if jsonb_array_length(p_data->'messages') < jsonb_array_length(old_data->'messages')
   or jsonb_array_length(p_data->'drafts') < jsonb_array_length(old_data->'drafts')
   or exists(select 1 from jsonb_array_elements(old_data->'messages') with ordinality x(value,n)
     where x.value is distinct from (p_data->'messages')->(x.n::integer-1))
   or exists(select 1 from jsonb_array_elements(old_data->'drafts') with ordinality x(value,n)
     where x.value is distinct from (p_data->'drafts')->(x.n::integer-1)) then
   raise exception 'history removal forbidden' using errcode='22023'; end if;
  update public.sc_cases set revision=p_expected+1,data=p_data,updated_by=actor,updated_at=now()
  where tenant_id=p_tenant and case_id=p_case and revision=p_expected;
  get diagnostics changed = row_count;
 end if;
 if changed=0 then return false; end if;
 for msg in select value from jsonb_array_elements(p_data->'messages') loop
  if coalesce(msg->>'mailbox_id','')='' or coalesce(msg->>'message_id','')='' then
   raise exception 'message identity required' using errcode='22023'; end if;
  insert into public.sc_message_keys(tenant_id,mailbox_id,message_id,case_id)
  values(p_tenant,msg->>'mailbox_id',msg->>'message_id',p_case)
  on conflict(tenant_id,mailbox_id,message_id) do nothing;
  if exists(select 1 from public.sc_message_keys where tenant_id=p_tenant and mailbox_id=msg->>'mailbox_id'
    and message_id=msg->>'message_id' and case_id<>p_case) then
   raise exception 'message already belongs to a different case' using errcode='23505'; end if;
 end loop;
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash)
 values(p_tenant,p_case,p_expected+1,actor,case when p_expected=0 then 'insert' else 'update' end,encode(sha256(convert_to(p_data::text,'UTF8')),'hex'));
 return true;
end;
$$;
revoke all on function public.sc_write_case(text,text,bigint,jsonb) from public,anon;
grant execute on function public.sc_write_case(text,text,bigint,jsonb) to authenticated;
commit;
