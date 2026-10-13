# Sárberki managed-test approval binding — 2026-10-13

The existing isolated approval SQL, application runtime, review bridge and panel
now have an explicit managed-test binding. Business rules and reply planners
are unchanged. Only the established synthetic Writer fixture is accepted.

## Pre-migration backup and scope

- Exact target: sarberki-test / mojnqizbcaczstguikpv; both tenants test_only.
- Three cases, all synthetic; four existing audit events; no approver membership.
- Fresh snapshot source commit: 3317e70faaeea6df5fa9ee0df56917261f8727df.
- Verified export/restore: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38443053567
- Ciphertext ZIP SHA256: 140265f2727204bf4be7644220c92ce7700d38ce405c14073c0a8dc78b25df7d.
- ZIP CRC and every ciphertext checksum matched. Isolated SQL restore compared
  all 43 tables successfully. This fresh restore did not run Auth API login.
- A separate encrypted ZIP plus restore evidence was preserved durably. Earlier
  backups were not modified. Actions artifact expiry: 2026-10-20.

## Applied schema and verification

Migration `sarberki_cloud_synthetic_approval_after_verified_backup` was applied
through Supabase MCP with the exact project_id after backup verification.
Installer source: deployment/cloud-approval/install.sql; generated from the
unchanged recovery/sql/isolated-approval.sql. Exact issuer, Auth identity/live
session, tenant permission, attestation, CAS, draft hash and transactional audit
are still required. The recorded install binding includes the verified backup
SHA256. The operator-declared install project setting is not independent
database identity proof; exact MCP target metadata and runtime signed issuer
are the scope checks.

Post-migration: sc_approve_case exists; anonymous execute denied; private
binding/key tables have RLS and no client grants; key table has zero rows.
Case count=3; audit count=4; approved case count=0; approve membership count=0.
Existing Writer and Reader permissions were not changed. No application write
was performed with admin SQL or service_role.

## Targeted tests and deployment boundary

- Parent targeted verification: 52 PASS / 0 FAIL / 0 SKIP, including real
  PostgreSQL PGlite SQL, simulated HTTP/Auth, reader rejection, issuer/CAS/hash
  boundaries, atomic audit, cookie CSRF and existing isolated protections.
- Additional final session-epoch queue tests: 3 PASS / 0 FAIL / 0 SKIP.
- Final changed cloud/cookie/panel verification by coding agent: 40 PASS;
  overlapping subset, not added to the parent count.
- Syntax/diff checks and static build PASS; server approval fixture module
  excluded from static assets. Existing full 1429 suite was not manually rerun.
  Repository CI may independently run its configured checks on pushed commits.
- UI approval load is read-only; Writer preparation is a separate explicit
  action. Queued requests from an old login cannot run under the next operator.

Local tests do not prove managed-cloud Auth/approval execution. No guest email,
Previo request/write, real booking, main or production operation was performed.

## Remaining activation requirements

Netlify test-site configuration requires a privately provisioned matching
32-byte signing key and CASE_APPROVAL_ENABLED=sarberki-test-synthetic-only.
Netlify dashboard currently requires login. No key was provisioned or exposed.
There is no cloud approve-role user. A separately authorized approver account
is required; Writer/Reader must not silently gain that permission.
The official UI is /cloud-approval.html; after authorized setup, verify Writer
preparation, Reader read-only and write rejection, explicit approver review,
approval, exact revision/hash/actor audit and authenticated readback. Full cloud
approval and its readback are NOT VERIFIED.

Rollback first disables CASE_APPROVAL_ENABLED and redeploys only the test site.
If needed, revoke authenticated execution of the new RPC on the exact project.
Preserve audit, existing data and backups. Do not restore over later work.

V2/V3 value: same channel-independent approval runtime and authority; no second
engine or external automation. Fixture approval is not a real guest offer.
