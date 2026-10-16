begin;
create table public.sc_service_approvals (
 approval_id bigint generated always as identity primary key,
 tenant_id text not null,case_id text not null,actor uuid not null references auth.users,
 at timestamptz not null default now(),payload jsonb not null,payload_digest text not null check(payload_digest~'^[a-f0-9]{64}$'),
 foreign key(tenant_id,case_id) references public.sc_cases,
 unique(tenant_id,case_id,payload_digest)
);
create index sc_service_approval_lookup on public.sc_service_approvals(tenant_id,case_id,approval_id desc);
alter table public.sc_service_approvals enable row level security;
revoke all on public.sc_service_approvals from public,anon,authenticated;
grant select on public.sc_service_approvals to authenticated;
create policy sc_service_approval_read on public.sc_service_approvals for select to authenticated using(public.sc_has_permission(tenant_id,'read'));
-- Separate service approval never changes case data/revision or accommodation approval.
create function public.sc_approve_tub_service(p_payload jsonb,p_attestation text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); claims jsonb; r public.sc_cases; t public.sc_cases; request jsonb; message jsonb;
 fields text[]:=array['tenantId','caseId','caseRevision','actor','targetCaseId','targetRevision','decisionRevision','requestId','requestHash','houseNumber','resourceId','start','end','timezone','bindingProvenance','bindingReference','bindingVersion','bindingCheckedAt','bindingValidUntil','sourceId','provenance','evidenceReference','version','checkedAt','validUntil','requestDate','requestTime','durationHours','status','previewHash'];
 signing text; key_hex text; result jsonb; checked_at timestamptz; deadline timestamptz; binding_checked timestamptz; binding_deadline timestamptz; starts timestamptz; ends timestamptz;
begin
 claims:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
 if actor is null or p_payload->>'tenantId' is distinct from 'sarberki-test'
 or not public.sc_has_permission('sarberki-test','read') or not public.sc_has_permission('sarberki-test','approve')
 or not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref='mojnqizbcaczstguikpv')
 or claims->>'iss' is distinct from 'https://mojnqizbcaczstguikpv.supabase.co/auth/v1'
 or claims->>'role' is distinct from 'authenticated'
 or coalesce(claims->>'exp','')!~'^[0-9]+$' or (claims->>'exp')::numeric<=extract(epoch from clock_timestamp())
 or coalesce(claims->>'session_id','')!~'^[a-f0-9-]{36}$'
 or not exists(select 1 from auth.sessions where id=(claims->>'session_id')::uuid and user_id=actor and (not_after is null or not_after>clock_timestamp())) then
  raise exception 'forbidden' using errcode='42501'; end if;
 -- Authenticate every scalar with a different domain from accommodation proofs.
 begin
  if jsonb_typeof(p_payload) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_payload))<>array_length(fields,1)
  or exists(select 1 from unnest(fields) f where coalesce(p_payload->>f,'')='' or position(chr(10) in (p_payload->>f))>0 or position(chr(13) in (p_payload->>f))>0)
  or coalesce(p_attestation,'')!~'^[a-f0-9]{64}$' then raise exception 'bad proof'; end if;
  select 'sarberki:tub-service-approval:v1'||chr(10)||string_agg(p_payload->>f,chr(10) order by n) into signing from unnest(fields) with ordinality x(f,n);
  select k.key_hex into key_hex from public.sc_isolated_approval_key k where singleton;
  if key_hex is null or public.sc_isolated_approval_mac(signing,key_hex) is distinct from p_attestation then raise exception 'bad proof'; end if;
 exception when others then raise exception 'invalid service evidence' using errcode='42501'; end;
 if p_payload->>'actor' is distinct from actor::text or p_payload->>'status'<>'AVAILABLE' or p_payload->>'timezone'<>'Europe/Budapest'
 or (p_payload->>'houseNumber')::integer not in (1,2,3,4,5,6,11,12,13,14,15) then raise exception 'invalid service scope' using errcode='42501'; end if;
 checked_at:=(p_payload->>'checkedAt')::timestamptz;deadline:=(p_payload->>'validUntil')::timestamptz;
 binding_checked:=(p_payload->>'bindingCheckedAt')::timestamptz;binding_deadline:=(p_payload->>'bindingValidUntil')::timestamptz;
 starts:=(p_payload->>'start')::timestamptz;ends:=(p_payload->>'end')::timestamptz;
 if checked_at>clock_timestamp() or deadline<=clock_timestamp() or deadline<=checked_at or deadline-checked_at>interval '120 seconds' or clock_timestamp()-checked_at>=interval '120 seconds'
 or binding_checked>clock_timestamp() or binding_deadline<=clock_timestamp() or binding_deadline<=binding_checked or binding_deadline-binding_checked>interval '120 seconds' or clock_timestamp()-binding_checked>=interval '120 seconds'
 or ends<=starts or ends-starts<>((p_payload->>'durationHours')::numeric*interval '1 hour') then return null; end if;
 perform 1 from public.sc_cases where tenant_id='sarberki-test' and case_id in(p_payload->>'caseId',p_payload->>'targetCaseId') order by case_id for update;
 select * into r from public.sc_cases where tenant_id='sarberki-test' and case_id=p_payload->>'caseId';
 if not found or r.revision<>(p_payload->>'caseRevision')::bigint then return null; end if;
 select * into t from public.sc_cases where tenant_id='sarberki-test' and case_id=p_payload->>'targetCaseId';
 if not found or t.revision<>(p_payload->>'targetRevision')::bigint then return null; end if;
 if t.data->>'caseKind'='service_link_review' or coalesce(t.data->'state'->>'intent','') not in ('booking_request','availability_request','price_request','modification_request')
 or coalesce(t.data->'state'->'values'->>'arrival','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 or coalesce(t.data->'state'->'values'->>'departure','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 or (t.data->'state'->'values'->>'departure')::date<=(t.data->'state'->'values'->>'arrival')::date then return null; end if;
 if r.data->>'caseKind'='service_link_review' then
  if not exists(select 1 from public.sc_service_link_decisions d where d.tenant_id='sarberki-test' and d.review_case_id=r.case_id and d.review_revision=r.revision and d.review_revision=(p_payload->>'decisionRevision')::bigint and d.target_case_id=t.case_id and d.target_revision=t.revision) then return null; end if;
 else
  if r.case_id<>t.case_id or (p_payload->>'decisionRevision')::bigint<>0 then return null; end if;
 end if;
 if lower(r.data->>'sender') is distinct from lower(t.data->>'sender') or coalesce(r.data->>'sender','')!~'^[^@[:space:]]+@[^@[:space:]]+\.invalid$' then return null; end if;
 select value into request from jsonb_array_elements(r.data->'serviceRequests') with ordinality x(value,n)
 order by (value->>'at')::timestamptz desc,coalesce((value->>'cancelled')::boolean,false) desc,n asc limit 1;
 if request is null or coalesce((request->>'cancelled')::boolean,false) or coalesce((request->>'actionConflict')::boolean,false)
 or request->>'sourceMessageId' is distinct from p_payload->>'requestId'
 or request->>'startDate' is distinct from p_payload->>'requestDate' or request->>'startTime' is distinct from p_payload->>'requestTime'
 or (request->>'durationHours')::numeric is distinct from (p_payload->>'durationHours')::numeric
 or starts<>date_trunc('minute',starts)
 or to_char(starts at time zone 'Europe/Budapest','YYYY-MM-DD')<>p_payload->>'requestDate'
 or to_char(starts at time zone 'Europe/Budapest','HH24:MI:SS')<>(p_payload->>'requestTime')||':00' then return null; end if;
 if (select count(*) from jsonb_array_elements(r.data->'messages') where value->>'message_id'=p_payload->>'requestId' or (value->>'mailbox_id')||':'||(value->>'message_id')=p_payload->>'requestId')<>1 then return null; end if;
 select value into message from jsonb_array_elements(r.data->'messages') where value->>'message_id'=p_payload->>'requestId' or (value->>'mailbox_id')||':'||(value->>'message_id')=p_payload->>'requestId';
 if message is null or encode(sha256(convert_to(message->>'text','UTF8')),'hex') is distinct from p_payload->>'requestHash' then return null; end if;
 -- Lock waits must not extend the lifespan of either proof.
 if deadline<=clock_timestamp() or binding_deadline<=clock_timestamp() then return null; end if;
 perform 1 from public.sc_memberships where tenant_id='sarberki-test' and user_id=actor and can_read and can_approve for share;
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 perform 1 from auth.sessions where id=(claims->>'session_id')::uuid and user_id=actor for share;
 if not found then raise exception 'forbidden' using errcode='42501'; end if;
 if deadline<=clock_timestamp() or binding_deadline<=clock_timestamp() then return null; end if;
 -- Auth/session and membership may change while waiting for the case locks.
 if not public.sc_has_permission('sarberki-test','read') or not public.sc_has_permission('sarberki-test','approve')
 or (claims->>'exp')::numeric<=extract(epoch from clock_timestamp())
 or not exists(select 1 from auth.sessions where id=(claims->>'session_id')::uuid and user_id=actor and (not_after is null or not_after>clock_timestamp())) then
  raise exception 'forbidden' using errcode='42501'; end if;
 -- Case lock serializes replay/renewal. Same human-reviewed scope may be
 -- renewed only after its earlier proof expired; exact payload replay stays unique.
 if exists(select 1 from public.sc_service_approvals a where a.tenant_id='sarberki-test' and a.case_id=r.case_id
  and a.payload->>'previewHash'=p_payload->>'previewHash' and (a.payload->>'validUntil')::timestamptz>clock_timestamp()
  and (a.payload->>'bindingValidUntil')::timestamptz>clock_timestamp()) then return null; end if;
 insert into public.sc_service_approvals(tenant_id,case_id,actor,payload,payload_digest)
 values('sarberki-test',r.case_id,actor,p_payload,encode(sha256(convert_to(signing,'UTF8')),'hex'))
 on conflict do nothing returning to_jsonb(sc_service_approvals.*) into result;
 return result;
end;
$$;
revoke all on function public.sc_approve_tub_service(jsonb,text) from public,anon;
grant execute on function public.sc_approve_tub_service(jsonb,text) to authenticated;
commit;
