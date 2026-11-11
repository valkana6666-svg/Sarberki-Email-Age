-- Rollback of booking-multiunit.sql: re-apply the single-unit definition.
-- Run deployment/test-mailbox/booking-unit.sql again (with the same install settings). Stored bookings keep their data;
-- a stored 'units' list is then ignored by the single-unit collision check (finish/cancel multi-unit bookings first).
select 'Run deployment/test-mailbox/booking-unit.sql to roll back' as instruction;
