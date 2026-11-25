-- Read-only verification after deposit-demo-seed-20261125.sql.
do $$ declare c int; begin
 select count(*) into c from public.sc_cases where tenant_id='sarberki-test' and case_id like 'tm-dee000000000000_'
  and data->'booking'->>'status'='finalized' and data->'booking'->'previo'->>'reference' like 'DEMO-_'
  and (data->'booking'->'previo'->>'reference')!~'^V2-' and data->'booking'->'deposit'->>'deadlineUtc' is not null;
 if c<>4 then raise exception 'VERIFY FAIL: % of 4 demo bookings',c; end if;
 select count(*) into c from public.sc_test_mailbox_cases where tenant_id='sarberki-test' and case_id like 'tm-dee000000000000_';
 if c<>4 then raise exception 'VERIFY FAIL: % of 4 registrations',c; end if;
end $$;
select 'VERIFY PASS' as result,(select count(*) from public.sc_cases) as cases,(select count(*) from public.sc_audit) as audit_rows;
