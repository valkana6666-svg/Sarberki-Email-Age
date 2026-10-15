-- OFFLINE REVIEW CANDIDATE. Preserve case/audit; disable receipt before restore.
begin;
do $guard$ begin
 if current_setting('sarberki.receipt_install_project_ref',true) is distinct from 'mojnqizbcaczstguikpv'
 or (select prosrc from pg_proc where oid='public.sc_write_case(text,text,bigint,jsonb)'::regprocedure)
 is distinct from $installed$
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
$installed$ then
  raise exception 'unexpected project or Writer definition';
 end if;
end $guard$;
update public.sc_private_exact_receipt set enabled=false;
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
drop table public.sc_private_exact_receipt;
commit;
