-- TEST – owner 2026-11-27 („Nagyon fontos, hogy napi kezelőben a teljes beszélgetés szövege megjelenjen”): after a
-- phone booking request is saved, the call goes on (questions, hot tub). The intake account may replace ONLY the
-- transcript field (callTranscript) of a phone case it created itself, during the 3 hours after it, and only with a
-- longer, server-attested transcript (scope intake-transcript-v1, the isolated approval key). Nothing else in the
-- case changes (state, drafts, values, booking); revision + 1 and an audit row as for every case change.
-- The intake account still cannot read cases. Rollback: phone-transcript-rollback.sql.
begin;
do $$ begin
 if coalesce(current_setting('sarberki.tm_install_project_ref',true),'')!~'^[a-z]{20}$'
 or coalesce(current_setting('sarberki.tm_backup_sha256',true),'')!~'^[a-f0-9]{64}$'
 or to_regprocedure('public.sc_intake_actor(text)') is null
 or to_regprocedure('public.sc_isolated_approval_mac(text,text)') is null then
  raise exception 'verified project, fresh backup and intake install required';
 end if;
end $$;

create or replace function public.sc_intake_phone_transcript(p_tenant text,p_case text,p_text text,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; t jsonb; key text; text_hash text; fields text[]; row_before public.sc_cases%rowtype; changed jsonb; old_n int;
begin
 actor:=public.sc_intake_actor(p_tenant);
 if p_case!~'^tm-[a-f0-9]{24}$' or p_text is null or octet_length(p_text)>131072 then raise exception 'invalid transcript' using errcode='22023'; end if;
 begin t:=p_text::jsonb; exception when others then raise exception 'invalid transcript' using errcode='22023'; end;
 if jsonb_typeof(t) is distinct from 'object' or jsonb_typeof(t->'lines') is distinct from 'array'
 or jsonb_array_length(t->'lines') not between 1 and 300 or coalesce(t->>'updatedAt','')=''
 or exists(select 1 from jsonb_array_elements(t->'lines') l where jsonb_typeof(l) is distinct from 'object'
   or coalesce(l->>'role','') not in ('agent','caller') or jsonb_typeof(l->'text') is distinct from 'string'
   or length(l->>'text') not between 1 and 1500 or (select count(*) from jsonb_object_keys(l))<>2)
 or (select count(*) from jsonb_object_keys(t))<>2 then
  raise exception 'invalid transcript' using errcode='22023';
 end if;
 text_hash:=encode(sha256(convert_to(p_text,'UTF8')),'hex');
 begin
  fields:=array['intake-transcript-v1',p_tenant,p_case,text_hash,p_proof->>'checkedAt'];
  if jsonb_typeof(p_proof) is distinct from 'object' or p_proof->>'scope' is distinct from 'intake-transcript-v1'
  or p_proof->>'textSha256' is distinct from text_hash or coalesce(p_proof->>'attestation','')!~'^[a-f0-9]{64}$'
  or exists(select 1 from unnest(fields) v where v is null or v='' or position(chr(10) in v)>0 or position(chr(13) in v)>0)
  or (p_proof->>'checkedAt')::timestamptz<now()-interval '120 seconds' or (p_proof->>'checkedAt')::timestamptz>now()+interval '1 second' then
   raise exception 'invalid proof';
  end if;
  select key_hex into key from public.sc_isolated_approval_key where singleton;
  if key is null or public.sc_isolated_approval_mac(array_to_string(fields,chr(10)),key) is distinct from p_proof->>'attestation' then
   raise exception 'invalid proof';
  end if;
 exception when others then raise exception 'server-attested transcript required' using errcode='42501'; end;
 if not exists(select 1 from public.sc_test_mailbox_cases where tenant_id=p_tenant and case_id=p_case and mailbox_id='intake:phone'
   and created_by=actor and created_at>now()-interval '3 hours') then
  raise exception 'recent own phone case required' using errcode='42501';
 end if;
 select * into row_before from public.sc_cases where tenant_id=p_tenant and case_id=p_case for update;
 if not found or row_before.data->>'sender' is distinct from 'intake:phone' then raise exception 'phone case required' using errcode='42501'; end if;
 old_n:=coalesce(jsonb_array_length(case when jsonb_typeof(row_before.data->'callTranscript'->'lines')='array' then row_before.data->'callTranscript'->'lines' end),0);
 -- Only a longer transcript replaces the stored one (a late, shorter tool call never cuts it back).
 if jsonb_array_length(t->'lines')<=old_n then return jsonb_build_object('caseId',p_case,'revision',row_before.revision,'changed',false); end if;
 changed:=row_before.data||jsonb_build_object('callTranscript',t);
 update public.sc_cases set revision=row_before.revision+1,data=changed,updated_at=now(),updated_by=actor
  where tenant_id=p_tenant and case_id=p_case and revision=row_before.revision;
 insert into public.sc_audit(tenant_id,case_id,revision,actor,kind,data_hash) values(p_tenant,p_case,row_before.revision+1,actor,'intake_transcript',encode(sha256(convert_to(changed::text,'UTF8')),'hex'));
 return jsonb_build_object('caseId',p_case,'revision',row_before.revision+1,'changed',true);
end $$;

revoke all on function public.sc_intake_phone_transcript(text,text,text,jsonb) from public,anon;
grant execute on function public.sc_intake_phone_transcript(text,text,text,jsonb) to authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.sc_intake_phone_transcript(text,text,text,jsonb) from service_role';
 end if;
end $$;
commit;
