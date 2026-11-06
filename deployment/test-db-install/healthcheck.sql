-- READ-ONLY first run of the owner-approved TEST install workflow (2026-11-06): proves the gate, the owner
-- approval, the TEST-project URL and the connection without changing anything. Fictional TEST data only.
begin read only;
select current_setting('server_version') as server_version,
 (select count(*) from public.sc_tenants) as tenants,
 (select count(*) from public.sc_cases) as cases,
 (select count(*) from public.sc_audit) as audit_rows,
 to_regclass('public.sc_tm_send_ledger') is not null as send_ledger_installed,
 to_regclass('public.sc_deployment_profile') is not null as deployment_profile_installed;
commit;
