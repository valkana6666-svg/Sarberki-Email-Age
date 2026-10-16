begin;
-- Protected decisions are deliberately separate from caller-writable case JSON.
create table public.sc_service_link_decisions (
 tenant_id text not null, review_case_id text not null, review_revision bigint not null check(review_revision>1),
 target_case_id text not null, target_revision bigint not null check(target_revision>0),
 reason text not null check(length(btrim(reason)) between 5 and 1000),
 actor uuid not null references auth.users, at timestamptz not null default now(),
 primary key(tenant_id,review_case_id,review_revision),
 foreign key(tenant_id,review_case_id) references public.sc_cases,
 foreign key(tenant_id,target_case_id) references public.sc_cases,
 check(review_case_id<>target_case_id)
);
alter table public.sc_service_link_decisions enable row level security;
revoke all on public.sc_service_link_decisions from public,anon,authenticated;
grant select on public.sc_service_link_decisions to authenticated;
create policy sc_service_link_read on public.sc_service_link_decisions for select to authenticated
 using(public.sc_has_permission(tenant_id,'read'));
-- Like sc_write_case, this narrowly scoped definer checks authority explicitly.
create function public.sc_resolve_service_link(p_tenant text,p_case text,p_expected bigint,p_target text,p_target_expected bigint,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); review_row public.sc_cases; target_row public.sc_cases; changed_data jsonb; result jsonb;
begin
 if actor is null or p_tenant<>'sarberki-test' or not public.sc_has_permission(p_tenant,'write') or not public.sc_has_permission(p_tenant,'approve') then
  raise exception 'forbidden' using errcode='42501'; end if;
 if p_case is null or p_target is null or p_case=p_target or p_expected is null or p_expected<1 or p_target_expected is null or p_target_expected<1
 or p_reason is null or length(btrim(p_reason)) not between 5 and 1000 then raise exception 'invalid resolution' using errcode='22023'; end if;
 -- Stable lock ordering avoids reciprocal requests deadlocking; both revisions stay fixed until commit.
 perform 1 from public.sc_cases where tenant_id=p_tenant and case_id in(p_case,p_target) order by case_id for update;
 select * into review_row from public.sc_cases where tenant_id=p_tenant and case_id=p_case;
 if not found or review_row.revision<>p_expected then return null; end if;
 select * into target_row from public.sc_cases where tenant_id=p_tenant and case_id=p_target;
 if not found or target_row.revision<>p_target_expected then return null; end if;
 if review_row.data->>'caseKind' is distinct from 'service_link_review'
 or target_row.data->>'caseKind'='service_link_review'
 or coalesce(review_row.data->>'sender','') !~ '^[^@[:space:]]+@[^@[:space:]]+\.invalid$'
 or lower(btrim(review_row.data->>'sender')) is distinct from lower(btrim(target_row.data->>'sender'))
 or coalesce(target_row.data->'state'->>'intent','') not in ('booking_request','availability_request','price_request','modification_request')
 or coalesce(target_row.data->'state'->'values'->>'arrival','')=''
 or coalesce(target_row.data->'state'->'values'->>'departure','')=''
 or jsonb_typeof(review_row.data->'serviceRequests') is distinct from 'array'
 or jsonb_array_length(review_row.data->'serviceRequests')=0 then raise exception 'invalid service link' using errcode='22023'; end if;
 if exists(select 1 from public.sc_service_link_decisions d join public.sc_cases t on t.tenant_id=d.tenant_id and t.case_id=d.target_case_id
  where d.tenant_id=p_tenant and d.review_case_id=p_case and d.review_revision=p_expected and d.target_revision=t.revision) then return null; end if;
 changed_data:=review_row.data-'serverApproval';
 changed_data:=jsonb_set(changed_data,'{state,approval}','"pending"'::jsonb);
 changed_data:=jsonb_set(changed_data,'{state,revision}',to_jsonb(coalesce((changed_data->'state'->>'revision')::bigint,0)+1));
 update public.sc_cases set revision=p_expected+1,data=changed_data,updated_by=actor,updated_at=now()
 where tenant_id=p_tenant and case_id=p_case and revision=p_expected returning to_jsonb(sc_cases.*) into result;
 if result is null then return null; end if;
 insert into public.sc_service_link_decisions(tenant_id,review_case_id,review_revision,target_case_id,target_revision,reason,actor)
 values(p_tenant,p_case,p_expected+1,p_target,p_target_expected,btrim(p_reason),actor);
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash)
 values(p_tenant,p_case,p_expected+1,actor,'resolve_service_link',encode(sha256(convert_to(changed_data::text,'UTF8')),'hex'));
 return result;
end;
$$;
revoke all on function public.sc_resolve_service_link(text,text,bigint,text,bigint,text) from public,anon;
grant execute on function public.sc_resolve_service_link(text,text,bigint,text,bigint,text) to authenticated;
commit;
