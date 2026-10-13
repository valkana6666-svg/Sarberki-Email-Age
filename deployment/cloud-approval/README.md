# Managed test approval binding

This binds the existing isolated synthetic approval module to the single
`sarberki-test` project `mojnqizbcaczstguikpv`. It approves only the exact
`syntheticReaderFixtureRequest()` message; the quoted price and availability are
fictional test fixtures, not a guest offer. No planner or business rule changed.

`install.sql` is generated from the original guarded SQL implementation:
`node scripts/build-cloud-synthetic-approval-sql.mjs > deployment/cloud-approval/install.sql`.
The original isolated installer is unchanged. Apply through an explicitly
targeted Supabase MCP migration, after verifying project metadata and a fresh
encrypted backup/export with checksum and isolated restore evidence. No broad
CLI migration push is intended. The installer deliberately aborts by default.

In that same target session, set `sarberki.approval_install_project_ref` to
`mojnqizbcaczstguikpv` and `sarberki.approval_backup_sha256` to the SHA-256 of the
verified fresh backup. These settings are explicit operator declarations after
external project verification, not proof of DB identity. The RPC also requires
the signed Auth JWT issuer `https://mojnqizbcaczstguikpv.supabase.co/auth/v1`,
a live `auth.sessions` row, current tenant permission, and a test-only tenant.

Provision one random 32-byte hex key privately into `sc_isolated_approval_key`
and into Netlify `ISOLATED_APPROVAL_ATTESTATION_KEY` on the test site only. Never
print it, expose it through a static config, or commit it. The schema does not
embed a key; no key means no approval. Netlify must also have existing case store,
publishable Supabase key, and operator session configuration, plus the explicit
`CASE_APPROVAL_ENABLED=sarberki-test-synthetic-only` opt-in. Exact host and project
gates remain mandatory; deployed code alone does not enable the feature.

The official test-host UI is `/cloud-approval.html`. It reuses the existing
approval panel and review bridge with the existing encrypted operator cookie,
same-origin POST and CSRF. It never receives an access/refresh token. Writer
permission prepares a freshly stored review; separate approve permission saves
it after explicit human consent. Reader cannot prepare or approve. The readback
button reads the case approval metadata and its RLS-protected audit rows.

Rollback: disable `CASE_APPROVAL_ENABLED` first and redeploy the test site. Keep
all backups and audit rows. If schema rollback is necessary, revoke authenticated
execution of `sc_approve_case(text,text,bigint,text,jsonb)` on this exact test
project; retain private key/binding tables until rollback verification is done.
Never restore the full database over later work merely to disable this feature.

Local tests use PGlite PostgreSQL plus simulated Supabase HTTP/Auth. They do not
prove managed-cloud execution, live operator login or Netlify configuration.

The follow-up `separate-approver-permission.sql` replaces only the original
`approve => write` membership CHECK with `approve => read`. This lets a separate
read+approve operator review and approve without editing cases. It does not add
users or memberships, change Writer/Reader permissions, or modify the approval
RPC. It requires the same exact project declaration and verified fresh backup
as the installer. The original constraint is located by its definition and must
exist; an unexpected schema aborts the migration transaction.
