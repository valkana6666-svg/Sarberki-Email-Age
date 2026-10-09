-- Cloud PostgreSQL policy test: simulated JWT claims, NOT real Auth sessions.
-- Entire fixture is rolled back. Execute only on the designated synthetic project.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','d6c910cd-d0bf-4470-a1f2-2def40a1ab1c',true);
select set_config('request.jwt.claims','{"sub":"d6c910cd-d0bf-4470-a1f2-2def40a1ab1c","role":"authenticated"}',true);
do $test$
declare d jsonb := '{"id":"cloud_verify_20261009","tenantId":"sarberki-test","sender":"probe@synthetic.invalid","state":{"values":{},"approval":"pending"},"messages":[{"mailbox_id":"cloud-verify","message_id":"cloud_verify_20261009"}],"drafts":[]}'::jsonb;
begin
 if not public.sc_write_case('sarberki-test','cloud_verify_20261009',0,d) then raise exception 'insert failed'; end if;
 if public.sc_write_case('sarberki-test','cloud_verify_20261009',0,d) then raise exception 'duplicate insert accepted'; end if;
 if not public.sc_write_case('sarberki-test','cloud_verify_20261009',1,jsonb_set(d,'{state,values}', '{"guests":"4"}')) then raise exception 'CAS failed'; end if;
 if public.sc_write_case('sarberki-test','cloud_verify_20261009',1,d) then raise exception 'stale CAS accepted'; end if;
 if (select revision from public.sc_cases where case_id='cloud_verify_20261009')<>2 then raise exception 'revision mismatch'; end if;
 begin perform public.sc_write_case('sarberki-test','cloud_verify_20261009',2,jsonb_set(d,'{messages}','[]')); raise exception 'history change accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.sc_write_case('sarberki-test','cloud_verify_duplicate',0,jsonb_set(d,'{id}','"cloud_verify_duplicate"')); raise exception 'duplicate message accepted'; exception when unique_violation then null; end;
 if exists(select 1 from public.sc_cases where case_id='cloud_verify_duplicate') then raise exception 'rollback failed'; end if;
 if (select count(*) from public.sc_audit where case_id='cloud_verify_20261009')<>2 then raise exception 'audit mismatch'; end if;
 begin update public.sc_memberships set can_approve=true; raise exception 'membership mutation accepted'; exception when insufficient_privilege then null; end;
 begin delete from public.sc_audit; raise exception 'audit deletion accepted'; exception when insufficient_privilege then null; end;
end $test$;
select set_config('request.jwt.claim.sub','d7faae9a-79a9-4219-9b7e-0758a6282f6b',true);
select set_config('request.jwt.claims','{"sub":"d7faae9a-79a9-4219-9b7e-0758a6282f6b","role":"authenticated"}',true);
do $test$
begin
 if (select count(*) from public.sc_cases where case_id='cloud_verify_20261009')<>1 then raise exception 'reader cannot read'; end if;
 begin perform public.sc_write_case('sarberki-test','cloud_verify_20261009',2,'{}'); raise exception 'reader write accepted'; exception when insufficient_privilege then null; end;
end $test$;
select set_config('request.jwt.claim.sub','c5a7d98b-9c7d-4852-9221-dbef53cba6ef',true);
select set_config('request.jwt.claims','{"sub":"c5a7d98b-9c7d-4852-9221-dbef53cba6ef","role":"authenticated"}',true);
do $test$
begin
 if exists(select 1 from public.sc_cases where tenant_id='sarberki-test') then raise exception 'cross tenant read'; end if;
 begin perform public.sc_write_case('sarberki-test','cloud_verify_20261009',2,'{}'); raise exception 'cross tenant write'; exception when insufficient_privilege then null; end;
end $test$;
set local role anon;
do $test$
begin
 begin perform 1 from public.sc_cases; raise exception 'anonymous read'; exception when insufficient_privilege then null; end;
 begin perform public.sc_write_case('sarberki-test','cloud_verify_20261009',2,'{}'); raise exception 'anonymous RPC'; exception when insufficient_privilege then null; end;
end $test$;
rollback;
select 'PASS: cloud PostgreSQL RLS/CAS/history/uniqueness/audit; simulated claims; fixtures rolled back' as result;
