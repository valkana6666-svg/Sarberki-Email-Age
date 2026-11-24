-- Rollback of deposit-alerts.sql: removes the read function (no data was ever written by it).
begin;
drop function if exists public.sc_deposit_alerts(text);
commit;
