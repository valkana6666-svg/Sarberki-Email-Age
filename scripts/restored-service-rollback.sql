-- Disposable restored DB only; provisioned identities/decisions are rolled back.
-- Simulated JWT claims, not proof of a real Auth login. Never execute on the source.
begin;
insert into auth.users(id) values
 ('99999999-1111-4111-8111-111111111111'),('99999999-2222-4222-8222-222222222222'),
 ('99999999-3333-4333-8333-333333333333'),('99999999-4444-4444-8444-444444444444');
insert into auth.sessions(id,user_id) values('99999999-aaaa-4aaa-8aaa-aaaaaaaaaaaa','99999999-1111-4111-8111-111111111111');
insert into public.sc_memberships(tenant_id,user_id,can_read,can_write,can_approve) values
 ('sarberki-test','99999999-1111-4111-8111-111111111111',true,true,true),
 ('sarberki-test','99999999-2222-4222-8222-222222222222',true,true,false),
 ('sarberki-test','99999999-3333-4333-8333-333333333333',true,false,false),
 ('demo-test','99999999-4444-4444-8444-444444444444',true,false,false);
select set_config('request.jwt.claim.sub','99999999-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','99999999-1111-4111-8111-111111111111','iss','https://mojnqizbcaczstguikpv.supabase.co/auth/v1','role','authenticated','exp',floor(extract(epoch from clock_timestamp()))::bigint+3600,'session_id','99999999-aaaa-4aaa-8aaa-aaaaaaaaaaaa')::text,true);
set local role authenticated;
do $test$
declare target jsonb; review jsonb; result jsonb;
begin
 target:=jsonb_build_object('id','restore_service_target','tenantId','sarberki-test','sender','restore-service@synthetic.invalid','caseKind','booking','state',jsonb_build_object('intent','booking_request','approval','pending','values',jsonb_build_object('arrival','2026-11-13','departure','2026-11-16')),'messages',jsonb_build_array(jsonb_build_object('mailbox_id','restore-services','message_id','stay','text','Synthetic stay')),'drafts','[]'::jsonb);
 review:=jsonb_build_object('id','restore_service_review','tenantId','sarberki-test','sender','restore-service@synthetic.invalid','caseKind','service_link_review','state',jsonb_build_object('approval','pending','revision',1,'values','{}'::jsonb),'serviceRequests',jsonb_build_array(jsonb_build_object('sourceMessageId','restore-services:request','startDate','2026-11-14','startTime','18:00','durationHours',24,'at',clock_timestamp(),'cancelled',false)),'messages',jsonb_build_array(jsonb_build_object('mailbox_id','restore-services','message_id','request','text','Please add a hot tub on 2026-11-14 at 18:00 for 24 hours.')),'drafts','[]'::jsonb);
 if not public.sc_write_case('sarberki-test','restore_service_target',0,target) or not public.sc_write_case('sarberki-test','restore_service_review',0,review) then raise exception 'SERVICE_FIXTURE_CREATE_FAILED'; end if;
 result:=public.sc_resolve_service_link('sarberki-test','restore_service_review',1,'restore_service_target',1,'Isolated synthetic identity verified');
 if result->>'revision'<>'2' then raise exception 'SERVICE_LINK_FAILED'; end if;
 if public.sc_resolve_service_link('sarberki-test','restore_service_review',1,'restore_service_target',1,'Stale synthetic retry') is not null then raise exception 'SERVICE_LINK_STALE_ACCEPTED'; end if;
 if (select count(*) from public.sc_service_link_decisions where review_case_id='restore_service_review')<>1 then raise exception 'SERVICE_LINK_DUPLICATED'; end if;
 if not exists(select 1 from public.sc_audit where case_id='restore_service_review' and revision=2 and kind='resolve_service_link') then raise exception 'SERVICE_LINK_AUDIT_MISSING'; end if;
end $test$;
reset role;
-- Only this disposable transaction receives a new synthetic signed proof.
-- Restored attestation key remains inside SQL and is never returned or logged.
create temporary table restore_service_proof(payload jsonb,attestation text);
grant select on restore_service_proof to authenticated;
do $proof$
declare p jsonb; signing text; key_hex text;
 fields text[]:=array['tenantId','caseId','caseRevision','actor','targetCaseId','targetRevision','decisionRevision','requestId','requestHash','houseNumber','resourceId','start','end','timezone','bindingProvenance','bindingReference','bindingVersion','bindingCheckedAt','bindingValidUntil','sourceId','provenance','evidenceReference','version','checkedAt','validUntil','requestDate','requestTime','durationHours','status','previewHash'];
begin
 p:=jsonb_build_object('tenantId','sarberki-test','caseId','restore_service_review','caseRevision',2,'actor','99999999-1111-4111-8111-111111111111','targetCaseId','restore_service_target','targetRevision',1,'decisionRevision',2,'requestId','restore-services:request','requestHash',encode(sha256(convert_to('Please add a hot tub on 2026-11-14 at 18:00 for 24 hours.','UTF8')),'hex'),'houseNumber',1,'resourceId','synthetic-tub-one','start','2026-11-14T18:00:00+01:00','end','2026-11-15T18:00:00+01:00','timezone','Europe/Budapest','bindingProvenance','synthetic-binding','bindingReference','restore-binding','bindingVersion','v1','bindingCheckedAt',clock_timestamp()-interval '1 second','bindingValidUntil',clock_timestamp()+interval '90 seconds','sourceId','synthetic-calendar','provenance','trusted-fixture-adapter','evidenceReference','restore-proof','version','v1','checkedAt',clock_timestamp()-interval '1 second','validUntil',clock_timestamp()+interval '90 seconds','requestDate','2026-11-14','requestTime','18:00','durationHours',24,'status','AVAILABLE','previewHash',repeat('ab',32));
 select 'sarberki:tub-service-approval:v1'||chr(10)||string_agg(p->>f,chr(10) order by n) into signing from unnest(fields) with ordinality x(f,n);
 select k.key_hex into key_hex from public.sc_isolated_approval_key k where singleton;
 if key_hex is null then raise exception 'RESTORED_ATTESTATION_KEY_MISSING'; end if;
 insert into restore_service_proof values(p,public.sc_isolated_approval_mac(signing,key_hex));
end $proof$;
-- Prove approve can remain separate from write, on the restored constraint.
update public.sc_memberships set can_write=false where user_id='99999999-1111-4111-8111-111111111111';
set local role authenticated;
do $test$
declare p jsonb; mac text; result jsonb;
begin
 select payload,attestation into p,mac from pg_temp.restore_service_proof;
 begin perform public.sc_approve_tub_service(p,repeat('0',64)); raise exception 'SERVICE_BAD_MAC_ACCEPTED'; exception when insufficient_privilege then null; end;
 result:=public.sc_approve_tub_service(p,mac);
 if result is null or result->>'case_id'<>'restore_service_review' or (result->'payload') is distinct from p then raise exception 'SERVICE_APPROVAL_FAILED'; end if;
 if public.sc_approve_tub_service(p,mac) is not null then raise exception 'SERVICE_REPLAY_ACCEPTED'; end if;
 if (select revision from public.sc_cases where case_id='restore_service_review')<>2 or (select revision from public.sc_cases where case_id='restore_service_target')<>1 then raise exception 'SERVICE_CHANGED_CASE_REVISION'; end if;
 if exists(select 1 from public.sc_cases where case_id in('restore_service_review','restore_service_target') and data->'state'->>'approval'<>'pending') then raise exception 'SERVICE_CHANGED_ACCOMMODATION_APPROVAL'; end if;
 if (select count(*) from public.sc_service_approvals where case_id='restore_service_review')<>1 then raise exception 'SERVICE_APPROVAL_AUDIT_MISMATCH'; end if;
end $test$;
select set_config('request.jwt.claim.sub','99999999-2222-4222-8222-222222222222',true);
select set_config('request.jwt.claims',jsonb_set(current_setting('request.jwt.claims')::jsonb,'{sub}',to_jsonb('99999999-2222-4222-8222-222222222222'::text))::text,true);
do $test$
begin
 begin perform public.sc_resolve_service_link('sarberki-test','restore_service_review',2,'restore_service_target',1,'Writer cannot resolve'); raise exception 'WRITER_RESOLVE_ACCEPTED'; exception when insufficient_privilege then null; end;
 begin perform public.sc_approve_tub_service((select payload from pg_temp.restore_service_proof),(select attestation from pg_temp.restore_service_proof)); raise exception 'WRITER_APPROVE_ACCEPTED'; exception when insufficient_privilege then null; end;
end $test$;
select set_config('request.jwt.claim.sub','99999999-3333-4333-8333-333333333333',true);
select set_config('request.jwt.claims',jsonb_set(current_setting('request.jwt.claims')::jsonb,'{sub}',to_jsonb('99999999-3333-4333-8333-333333333333'::text))::text,true);
do $test$
begin
 if (select count(*) from public.sc_service_link_decisions where review_case_id='restore_service_review')<>1 or (select count(*) from public.sc_service_approvals where case_id='restore_service_review')<>1 then raise exception 'READER_SERVICE_READ_FAILED'; end if;
 begin insert into public.sc_service_approvals default values; raise exception 'DIRECT_SERVICE_INSERT_ACCEPTED'; exception when insufficient_privilege then null; end;
 begin update public.sc_service_approvals set payload='{}'; raise exception 'DIRECT_SERVICE_UPDATE_ACCEPTED'; exception when insufficient_privilege then null; end;
 begin delete from public.sc_service_approvals; raise exception 'DIRECT_SERVICE_DELETE_ACCEPTED'; exception when insufficient_privilege then null; end;
 begin insert into public.sc_service_link_decisions default values; raise exception 'DIRECT_LINK_INSERT_ACCEPTED'; exception when insufficient_privilege then null; end;
 begin update public.sc_service_link_decisions set reason='tampered'; raise exception 'DIRECT_LINK_UPDATE_ACCEPTED'; exception when insufficient_privilege then null; end;
 begin delete from public.sc_service_link_decisions; raise exception 'DIRECT_LINK_DELETE_ACCEPTED'; exception when insufficient_privilege then null; end;
end $test$;
select set_config('request.jwt.claim.sub','99999999-4444-4444-8444-444444444444',true);
select set_config('request.jwt.claims',jsonb_set(current_setting('request.jwt.claims')::jsonb,'{sub}',to_jsonb('99999999-4444-4444-8444-444444444444'::text))::text,true);
do $test$
begin
 if exists(select 1 from public.sc_service_link_decisions where tenant_id='sarberki-test') or exists(select 1 from public.sc_service_approvals where tenant_id='sarberki-test') then raise exception 'CROSS_TENANT_SERVICE_READ'; end if;
end $test$;
set local role anon;
do $test$
begin
 begin perform 1 from public.sc_service_approvals; raise exception 'ANON_SERVICE_READ'; exception when insufficient_privilege then null; end;
 begin perform public.sc_approve_tub_service('{}',''); raise exception 'ANON_SERVICE_RPC'; exception when insufficient_privilege then null; end;
 begin perform public.sc_resolve_service_link('sarberki-test','x',1,'y',1,'anonymous'); raise exception 'ANON_LINK_RPC'; exception when insufficient_privilege then null; end;
end $test$;
rollback;
select 'RESTORED_SERVICE_ROLLBACK_PASS';
