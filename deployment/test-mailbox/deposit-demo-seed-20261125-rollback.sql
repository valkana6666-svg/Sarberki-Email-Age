-- Rollback of deposit-demo-seed-20261125.sql: deletes exactly the four demo bookings (ids tm-dee0000000000001..4).
begin;
delete from public.sc_test_mailbox_cases where tenant_id='sarberki-test' and case_id in ('tm-dee0000000000001','tm-dee0000000000002','tm-dee0000000000003','tm-dee0000000000004');
delete from public.sc_cases where tenant_id='sarberki-test' and case_id in ('tm-dee0000000000001','tm-dee0000000000002','tm-dee0000000000003','tm-dee0000000000004');
commit;
