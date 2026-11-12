-- Read-only verification after oneclick-approver-write.sql (counts only, no user ids).
do $$ begin
 if to_regclass('public.sc_oneclick_write_grants') is null then raise exception 'VERIFY FAIL: grant log missing'; end if;
 if has_table_privilege('authenticated','public.sc_oneclick_write_grants','select') or has_table_privilege('anon','public.sc_oneclick_write_grants','select') then
  raise exception 'VERIFY FAIL: grant log readable by clients'; end if;
 if not exists(select 1 from public.sc_memberships where tenant_id='sarberki-test' and can_read and can_write and can_approve) then
  raise exception 'VERIFY FAIL: no read+write+approve membership'; end if;
 if exists(select 1 from public.sc_tenants where not test_only) then raise exception 'VERIFY FAIL: non-test tenant present'; end if;
end $$;
select 'VERIFY PASS' as result,
 (select count(*) from public.sc_memberships where tenant_id='sarberki-test') as memberships,
 (select count(*) from public.sc_memberships where tenant_id='sarberki-test' and can_approve and can_write) as approve_and_write,
 (select count(*) from public.sc_memberships where tenant_id='sarberki-test' and can_write and not can_approve) as write_only,
 (select count(*) from public.sc_oneclick_write_grants) as logged_grants,
 (select count(*) from public.sc_cases) as cases,(select count(*) from public.sc_audit) as audit_rows;
