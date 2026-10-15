-- OFFLINE REVIEW CANDIDATE: never applied by application startup.
-- Requires verified fresh backup and explicit test-project targeting before use.
begin;
do $$ begin
 if current_setting('sarberki.receipt_install_project_ref',true) is distinct from 'mojnqizbcaczstguikpv'
 or coalesce(current_setting('sarberki.receipt_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or not exists(select 1 from public.sc_tenants where tenant_id='sarberki-test' and test_only)
 or exists(select 1 from public.sc_tenants where not test_only or tenant_id not in ('sarberki-test','demo-test'))
 then raise exception 'verified test project and fresh backup required'; end if;
end $$;
do $guard$ begin
 if (select prosrc from pg_proc where oid='public.sc_write_case(text,text,bigint,jsonb)'::regprocedure)
 is distinct from $baseline$
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
$baseline$ then
  raise exception 'unexpected existing Writer definition';
 end if;
end $guard$;
create table public.sc_private_exact_receipt (
 slot smallint primary key default 1 check(slot=1),
 enabled boolean not null default false,
 tenant_id text not null check(tenant_id='sarberki-test'),
 case_id text not null check(case_id ~ '^[a-zA-Z0-9_-]{4,128}$'),
 expected_source jsonb not null,
 expected_message jsonb not null,
 body_sha256 text not null check(body_sha256 ~ '^[a-f0-9]{64}$'),
 check((jsonb_typeof(expected_source->'provider')='string' and length(expected_source->>'provider')>0) is true),
 check((jsonb_typeof(expected_source->'mailbox_id')='string' and length(expected_source->>'mailbox_id')>0) is true),
 check((jsonb_typeof(expected_source->'message_id')='string' and length(expected_source->>'message_id')>0) is true),
 check((jsonb_typeof(expected_source->'thread_id')='string' and length(expected_source->>'thread_id')>0) is true),
 check((jsonb_typeof(expected_source->'received_at')='string' and length(expected_source->>'received_at')>0) is true),
 check((jsonb_typeof(expected_source->'rfc_message_id')='string' and length(expected_source->>'rfc_message_id')>0) is true),
 check((jsonb_typeof(expected_source->'subject')='string' and length(expected_source->>'subject')>0) is true),
 check((jsonb_typeof(expected_source->'to')='string' and length(expected_source->>'to')>0) is true),
 check((jsonb_typeof(expected_source->'from')='string' and length(expected_source->>'from')>0) is true),
 check((jsonb_typeof(expected_source->'from_email')='string' and length(expected_source->>'from_email')>0) is true),
 check((jsonb_typeof(expected_message->'sender')='string' and length(expected_message->>'sender')>0) is true),
 check((jsonb_typeof(expected_message->'text')='string' and length(expected_message->>'text')>0) is true),
 check((jsonb_typeof(expected_message->'mailbox_id')='string' and length(expected_message->>'mailbox_id')>0) is true),
 check((jsonb_typeof(expected_message->'message_id')='string' and length(expected_message->>'message_id')>0) is true),
 check((jsonb_typeof(expected_message->'thread_id')='string' and length(expected_message->>'thread_id')>0) is true),
 check((jsonb_typeof(expected_message->'rfc_message_id')='string' and length(expected_message->>'rfc_message_id')>0) is true),
 check((jsonb_typeof(expected_message->'received_at')='string' and length(expected_message->>'received_at')>0) is true),
 check(jsonb_typeof(expected_source)='object' and jsonb_typeof(expected_message)='object'),
 check(expected_source->>'provider'='gmail'),
 check(expected_source->>'from_email'=expected_message->>'sender'),
 check(expected_source->>'mailbox_id'=expected_message->>'mailbox_id'),
 check(expected_source->>'message_id'=expected_message->>'message_id'),
 check(expected_source->>'thread_id'=expected_message->>'thread_id'),
 check(expected_source->>'received_at'=expected_message->>'received_at'),
 check(expected_source->>'rfc_message_id'=expected_message->>'rfc_message_id'),
 check(expected_source->'in_reply_to'='null'::jsonb and not expected_message ? 'in_reply_to'),
 check(expected_source->'references'='[]'::jsonb and expected_message->'references'='[]'::jsonb),
 check(encode(sha256(convert_to(expected_message->>'text','UTF8')),'hex')=body_sha256),
 check(expected_source ?& array['provider','mailbox_id','message_id','thread_id','received_at','rfc_message_id','in_reply_to','references','subject','to','from','from_email']),
 check(expected_source - array['provider','mailbox_id','message_id','thread_id','received_at','rfc_message_id','in_reply_to','references','subject','to','from','from_email']='{}'::jsonb),
 check(expected_message ?& array['sender','text','mailbox_id','message_id','thread_id','rfc_message_id','references','received_at']),
 check(expected_message - array['sender','text','mailbox_id','message_id','thread_id','rfc_message_id','references','received_at']='{}'::jsonb)
);
alter table public.sc_private_exact_receipt enable row level security;
revoke all on public.sc_private_exact_receipt from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on public.sc_private_exact_receipt from service_role';
 end if;
end $$;
-- NO receipt or personal configuration is inserted. enabled defaults false.
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
 if coalesce(p_data->>'sender','') !~ '^[^@[:space:]]+@[^@[:space:]]+\.invalid$'
 and not exists (
  select 1 from public.sc_private_exact_receipt r
  where r.slot=1 and r.enabled and r.tenant_id=p_tenant and r.case_id=p_case
   and p_data->>'sender'=r.expected_message->>'sender'
   and p_data->'sourceReceipt'=r.expected_source
   and p_data->'messages'=jsonb_build_array(r.expected_message)
   and encode(sha256(convert_to(r.expected_message->>'text','UTF8')),'hex')=r.body_sha256
 ) then
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
