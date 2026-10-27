# Sárberki V1 – Gmail send authority + dispatch ledger (TEST-only implementation candidate)
Date: 2026-10-27
STATUS: NOT INSTALLED / NOT RUN / NO MAIL SENT.

## Existing authority
`sc_memberships` currently has `can_read`, `can_write`, `can_approve`. These do **not** imply permission to send. No live `sender` membership can be asserted by browser input. Existing cookie Auth and CSRF must stay in force.

## Proposed *separate* TEST-only persistence
New migration requires project-ref verification, newly verified restorable encrypted backup, isolated rollback, and owner approval before execution. Migration must abort closed without these.

1. `sc_mail_send_memberships`: `tenant_id`, `user_id`, `can_send`, timestamps. FK to existing tenant/auth membership where possible. No rows by default. RLS: only authenticated self can inspect their own status; no client INSERT/UPDATE/DELETE. Owner provisions permission separately after review. No implicit inheritance from can_write/can_approve.
2. `sc_mail_dispatches`: `dispatch_id`, `tenant_id`, `case_id`, `approval_revision`, `draft_sha256`, `destination`, `status` (reserved | sent | uncertain | failed_before_send), `gmail_message_id`, `actor`, `created_at`, `updated_at`. UNIQUE on (tenant_id, case_id, approval_revision, draft_sha256, destination). Restrict destination to sarberkiprojecttest@gmail.com and exact case in TEST V1. Server-only access through tightly scoped authenticated RPC, no direct anon/Reader CRUD.
3. Immutable append-only audit event for each attempted reservation/transition. Never include email content, token, OAuth secret or cookies.

## Transactional reservation
- Authenticated server cookie + anti-CSRF; refresh identity and independent send membership in database, check correct tenant/case and enabled TEST feature.
- Freshly fetch stored case, verify exact Gmail receipt, original source and saved facts, latest draft literal/sha256, `clarificationApproval` revision and signature/metadata. Prevent stale editing and ordinary lodging approvals from authorizing a send.
- Atomic insert of one `reserved` dispatch key. Collision rejects as duplicate; avoid SELECT-then-INSERT races. A reservation alone authorizes **no Gmail API call** without a second independent explicit owner-approved send gate.
- Before external API: reservation persists; a timeout or unknown response transitions to `uncertain`, and **automatic retry is forbidden**. Resolve by checking Gmail's authoritative message IDs/thread or sending status, then only manually decide.
- Response `sent` only when Gmail confirms message ID, stored transactionally with audit. Gmail's API is not a distributed exactly-once transaction: unique DB reservation prevents concurrent duplicate attempts but does not by itself prove exactly-once delivery.
- Invalid membership, mismatched recipient, revoked approval, hash mismatch, different tenant, session invalidation and stale revision: 0 sends, no reservation.
- Private service token storage and Google `gmail.send` consent are distinct later gates; use minimum scope and only test account.

## Rollback design
Keep test feature disabled before any migration and on any failure. Never drop audit/history in a rollback. Capture schema, owners, grants, policies and checks before DDL; verify restoring them in disposable PostgreSQL before managed execution. No uncontrolled `install.sql` rerun, no service-role bypass. Production/main untouched.

## Verification gates
- SQL isolated tests: two simultaneous reservations on same key -> exactly one reserved; other 409/duplicate.
- Permission: Reader/Writer/Approver without separate send grant -> denied; revoked send grant -> denied; foreign tenant/recipient -> denied.
- Revoked clarification, v5-v6 stale approval, altered text and forged hash -> denied.
- State machine: reserved -> uncertain; uncertain never auto retry; reserved -> sent needs verified Gmail ID; sent immutable.
- CI run + owner-reviewed backup restore + rollback PASS required before any TEST hosted SQL, then explicit deployment and consent; until then no mail send.

This is a specification for the next implementation, not a claim that any DB table, RPC, credential or send route exists.
