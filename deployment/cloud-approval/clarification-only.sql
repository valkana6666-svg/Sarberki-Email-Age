-- Additive TEST-only exact clarification capability. Never rerun install.sql on
-- the hosted exact-receipt database: its original synthetic-only guard rejects it.
-- No membership, RLS policy, existing grant or private allowlist row is changed.
begin;
do $$
declare definition text; marker text := ' if coalesce(p_data->''state''->>''approval'',''pending'') <> ''pending'' then';
begin
 if current_setting('sarberki.approval_install_project_ref',true) is distinct from 'mojnqizbcaczstguikpv'
 or coalesce(current_setting('sarberki.approval_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref='mojnqizbcaczstguikpv')
 or not exists(select 1 from public.sc_tenants where tenant_id='sarberki-test' and test_only)
 or exists(select 1 from public.sc_tenants where not test_only or tenant_id not in ('sarberki-test','demo-test'))
 or not exists(select 1 from public.sc_private_exact_receipt where enabled and case_id='13c8ecb7-f836-4e2c-9833-d58ee96f2dda' and tenant_id='sarberki-test') then
  raise exception 'verified test binding, existing exact receipt and fresh backup required';
 end if;
 select pg_get_functiondef('public.sc_write_case(text,text,bigint,jsonb)'::regprocedure) into definition;
 if position('clarification approval RPC only' in definition)=0 then
  if position('sc_private_exact_receipt' in definition)=0 or position(marker in definition)=0 then raise exception 'expected exact Writer guard missing'; end if;
  -- Ordinary writes must remove prior clarification approval. They cannot copy,
  -- forge or carry approval metadata into a later revision.
  definition:=replace(definition,marker,E' if p_data ? ''clarificationApproval'' then\n  raise exception ''clarification approval RPC only'' using errcode=''42501'';\n end if;\n'||marker);
  execute definition;
 end if;
end $$;

create or replace function public.sc_approve_clarification(
 p_tenant text,p_case text,p_expected bigint,p_draft_hash text,p_evidence jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); claims jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
 row_before public.sc_cases%rowtype; row_after public.sc_cases%rowtype;
 d jsonb; c jsonb; changed jsonb; proof_key text; signed_fields text[];
 canonical text:=E'Hello,\n\nPlease provide a contact phone number.\n\nThank you.';
begin
 if p_tenant is distinct from 'sarberki-test' or p_case is distinct from '13c8ecb7-f836-4e2c-9833-d58ee96f2dda'
 or not exists(select 1 from public.sc_cloud_approval_binding where singleton and project_ref='mojnqizbcaczstguikpv')
 or not exists(select 1 from public.sc_tenants where tenant_id=p_tenant and test_only)
 or actor is null or not public.sc_has_permission(p_tenant,'approve')
 or claims->>'iss' is distinct from 'https://mojnqizbcaczstguikpv.supabase.co/auth/v1'
 or claims->>'role' is distinct from 'authenticated'
 or coalesce(claims->>'exp','')!~'^[0-9]+$' or (claims->>'exp')::numeric<=extract(epoch from now())
 or coalesce(claims->>'session_id','')!~'^[a-f0-9-]{36}$' then
  raise exception 'forbidden or expired' using errcode='42501';
 end if;
 if not exists(select 1 from auth.sessions where id=(claims->>'session_id')::uuid and user_id=actor and (not_after is null or not_after>now())) then
  raise exception 'session revoked' using errcode='42501';
 end if;
 if p_expected is null or p_expected<1 or coalesce(p_draft_hash,'')!~'^[a-f0-9]{64}$' then raise exception 'invalid approval' using errcode='22023'; end if;
 select * into row_before from public.sc_cases where tenant_id=p_tenant and case_id=p_case and revision=p_expected for update;
 if not found then return null; end if;
 if row_before.data->>'id' is distinct from p_case or row_before.data->>'tenantId' is distinct from p_tenant
 or not exists(select 1 from public.sc_private_exact_receipt r where r.enabled and r.slot=1 and r.tenant_id=p_tenant and r.case_id=p_case
  and row_before.data->>'sender'=r.expected_message->>'sender' and row_before.data->'sourceReceipt'=r.expected_source
  and row_before.data->'messages'=jsonb_build_array(r.expected_message)
  and encode(sha256(convert_to(r.expected_message->>'text','UTF8')),'hex')=r.body_sha256)
 or row_before.data->'state'->>'approval' is distinct from 'pending' or row_before.data ? 'serverApproval'
 or row_before.data ? 'clarificationApproval' or row_before.data->>'caseKind' is not null or row_before.data->'linkReview' is not null and row_before.data->'linkReview'<>'null'::jsonb
 or row_before.data->'state'->'values'->>'language' is distinct from 'en'
 or btrim(coalesce(row_before.data->'state'->'values'->>'phone',''))<>'' then
  raise exception 'exact pending clarification scope required' using errcode='42501';
 end if;
 d:=row_before.data->'drafts'->-1;c:=d->'clarification';
 if d->>'text' is distinct from canonical or d->>'reviewStatus' is distinct from 'clarification_review_required'
 or coalesce(d->>'edited','false')<>'false' or c->>'templateId' is distinct from 'missing-phone-en-v1'
 or d->'revision' is distinct from row_before.data->'state'->'revision'
 or c->'factsRevision' is distinct from row_before.data->'state'->'revision'
 or d->>'basedOnMessageCount' is distinct from '1'
 or c->>'preparedBy' is distinct from row_before.updated_by::text
 or actor=row_before.updated_by or c->>'preparedBy'=actor::text
 or encode(sha256(convert_to(canonical,'UTF8')),'hex')<>p_draft_hash then
  raise exception 'closed clarification draft and independent approver required' using errcode='42501';
 end if;
 begin
  signed_fields:=array[p_tenant,p_case,p_expected::text,p_draft_hash,p_evidence->>'scope',p_evidence->>'templateId',p_evidence->>'factsRevision',p_evidence->>'messageCount',p_evidence->>'checkedAt'];
  select key_hex into proof_key from public.sc_isolated_approval_key where singleton;
  if jsonb_typeof(p_evidence) is distinct from 'object' or proof_key is null
  or exists(select 1 from unnest(signed_fields) as f(v) where v is null or v='' or position(chr(10) in v)>0 or position(chr(13) in v)>0)
  or p_evidence->>'scope' is distinct from 'clarification-only-v1'
  or p_evidence->>'templateId' is distinct from 'missing-phone-en-v1'
  or p_evidence->>'factsRevision' is distinct from d->>'revision'
  or p_evidence->>'messageCount' is distinct from '1'
  or (p_evidence->>'checkedAt')::timestamptz<now()-interval '120 seconds'
  or (p_evidence->>'checkedAt')::timestamptz>now()+interval '1 second'
  or public.sc_isolated_approval_mac(array_to_string(signed_fields,chr(10)),proof_key) is distinct from p_evidence->>'attestation' then
   raise exception 'invalid proof';
  end if;
 exception when others then raise exception 'server-attested clarification classification required' using errcode='42501'; end;
 changed:=jsonb_set(row_before.data,'{clarificationApproval}',jsonb_build_object('scope','clarification-only-v1',
  'templateId','missing-phone-en-v1','actor',actor,'at',now(),'reviewedRevision',p_expected,'approvedRevision',p_expected+1,
  'factsRevision',d->'revision','draftHash',p_draft_hash));
 update public.sc_cases set data=changed,revision=p_expected+1,updated_by=actor,updated_at=now()
 where tenant_id=p_tenant and case_id=p_case and revision=p_expected returning * into row_after;
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash)
 values(p_tenant,p_case,p_expected+1,actor,'approve_clarification_only',encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
 return to_jsonb(row_after);
end $$;
revoke all on function public.sc_approve_clarification(text,text,bigint,text,jsonb) from public,anon;
grant execute on function public.sc_approve_clarification(text,text,bigint,text,jsonb) to authenticated;
commit;
