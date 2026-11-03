-- Approver role (slice 5 of the live case store). Same end state as the TEST-only
-- deployment/cloud-approval/separate-approver-permission.sql: approving requires read permission
-- instead of write permission, so an approve-only member can decide without drafting.
-- Equivalence with the TEST migration is enforced by tests/approver-role-pglite.test.mjs.
-- Requires the deployment profile. Idempotent: a no-op where the new constraint already exists
-- (e.g. the TEST project). No users, memberships, grants, RPCs or RLS policies are changed.
begin;
do $$
declare old_constraint text;
begin
 if to_regprocedure('public.sc_deployment_tenant()') is null then raise exception 'DEPLOYMENT_PROFILE_REQUIRED' using errcode='55000'; end if;
 if public.sc_deployment_tenant() is null then raise exception 'DEPLOYMENT_PROFILE_REQUIRED' using errcode='55000'; end if;
 if exists(select 1 from pg_constraint where conrelid='public.sc_memberships'::regclass and conname='sc_memberships_approve_requires_read') then return; end if;
 -- Identify the actual prior definition, not only an auto-generated name.
 select conname into old_constraint from pg_constraint
 where conrelid='public.sc_memberships'::regclass and contype='c'
 and lower(regexp_replace(pg_get_constraintdef(oid),'[[:space:]()]','','g'))='checknotcan_approveorcan_write';
 if old_constraint is null then raise exception 'expected original approve/write constraint missing'; end if;
 execute format('alter table public.sc_memberships drop constraint %I',old_constraint);
 alter table public.sc_memberships add constraint sc_memberships_approve_requires_read check (not can_approve or can_read);
end $$;
commit;
