# Exact Gmail: pending edit only — 2026-10-27

## Scope and observed baseline

Baseline: `d0688c5dfc31970f6ff43bbc6e37b42faa209ccb`, the current remote test branch when work started; no later remote changes existed. Work's hosted Writer/save and Reader/readback acceptance is taken as reported. This change does not repeat login, pricing or restore work.

Only case `13c8ecb7-f836-4e2c-9833-d58ee96f2dda`, only `sarberki-test`, only the exact previously configured private receipt and its single original stored message. No message body, private receipt values, credentials or tokens belong in this handoff.

## Four independent gates

1. **Edit identity**: existing valid private receipt configuration AND new `CASE_EXACT_EDIT_ENABLED=sarberki-test-one-exact-record`; the receipt's case ID must equal the hard-coded authorized ID. Both record tenant fields, data ID, sender, exact original message array and source receipt must match. Service/link cases are excluded. Missing/invalid configuration adds no capability. The closed fixture review/read predicates remain unchanged; an exact edit exception is evaluated separately.
2. **Authority**: the existing cookie endpoints still require fresh Auth, same origin, CSRF on writes, tenant membership and the appropriate write/approve permission. Ordinary authenticated Supabase transport, existing RLS and existing Writer SQL remain in use. No grant, policy, private allowlist entry, SQL business function or hosted data is changed here. The existing DB exact receipt must already be enabled and consistent; otherwise the ordinary write fails closed.
3. **Persistence**: only a current pending draft without server approval can be edited. Expected case revision and old SHA-256 must match. A new draft is appended, preserving original messages, receipt and draft history. It records server-derived editor, previous text hash, new text hash and `manual_edit_requires_review`. It is NOT marked as a reviewed synthetic fixture. The existing CAS write rechecks authority and appends a transactional DB snapshot-hash audit entry. Reader reload uses the same saved record; approval-history readback remains explicitly separate from write audit.
4. **Approval evidence**: NO approval capability is added. The server returns `EXACT_REVIEW_EVIDENCE_REQUIRED` and the UI disables approval independently of edit capability. `review-draft` cannot invoke the two-person Deluxe fixture provider for this case. An independent Approver with current revision/hash receives HTTP 422 `REVIEW_NOT_READY`; same editor/approver receives 403. Old revision/hash and CSRF denials remain distinct. No provider is called, even when supplied stale, absent, wrong-scope or superficially positive mock evidence.

## Remaining approval blocker

There is no authorized, current, case-bound evidence contract for this eight-person inquiry. A future approval change must independently establish the normalized dates, actual party composition, requested/accepted unit allocation and physical capacity for ALL guests; current availability for each required pool/unit; verified price components and tariff year; evidence source, freshness and versions; and binding to this exact tenant, case, source receipt/message, facts revision, saved revision and reviewed draft hash. Real evidence must be read-only and verified; explicitly fictional evidence needs separate owner authorization and an unmistakable synthetic label with exactly the same scope bindings. Receipt equality proves provenance only.

The existing synthetic review adapter rejects non-`.invalid` senders; the existing DB approval function independently requires `.invalid` plus a reviewed synthetic draft and matching synthetic evidence. Those protections are deliberately unchanged. Future exact approval therefore requires a separately reviewed application AND database evidence contract, not merely a new flag or receipt reuse. There is no successful exact Approver → approval audit test because the required evidence/gates do not exist; its EXPECTED result is rejection without mutation. Existing closed fixture lifecycle tests provide the positive independent Approver/audit regression.

## Work acceptance: one consolidated TEST deployment

1. Review this commit and green CI, then coordinate one test release. No Codex deploy has been started. On the test site only, set `CASE_EXACT_EDIT_ENABLED` to the literal value above; keep all existing private receipt, project/origin, session, approval and tenant configuration intact. Never paste private receipt values into reports. No DB/role change is needed for pending edits.
2. Open `/cloud-approval.html?caseId=13c8ecb7-f836-4e2c-9833-d58ee96f2dda` as the existing Writer. Use **load stored draft**, NOT the fixture/review preparation action. Confirm the current revision loads, editing is available, and approval is visibly blocked for missing case-bound evidence.
3. Make a clearly fictional test-only edit and save once. Require revision +1, pending state and no approval. Reload in an independent existing Reader session and compare exact saved text and revision. Reader must have no edit capability. Do not grant roles as part of this test.
4. As a distinct authorized Approver, load the saved revision: text is readable, approval remains disabled. A controlled API negative probe, if used, must return 422 `REVIEW_NOT_READY` for current revision/hash; do not log cookies, hashes or text. No approval audit entry or additional case revision may result. Same-editor approval, Reader write, wrong CSRF, stale revision/hash and other-tenant operations must reject.
5. Verify existing write audit via the ordinary Reader preview (stored write proof), and existing approval-history readback shows no new approval. Report only safe IDs/revisions, HTTP/error categories and PASS/FAIL. Keep hosted completion unconfirmed until these steps pass. This does not release the exact case's full Writer–Approver workflow.

## Automated evidence

Targeted tests include real PostgreSQL semantics via isolated PGlite with deployed Writer SQL, RLS, real cookie handlers and app runtime; Auth/network identities are synthetic test doubles. They prove append-only edit/readback/audit, configured identity restrictions, independent role denials, CAS/hash/CSRF checks and no cross-use of fixture evidence. They do not prove private hosted configuration or a hosted browser result. CI results and full commit SHA accompany delivery.

V2/V3 value: keeps provenance, edit authority and review evidence as separate capabilities on the existing case service; no second review engine or external execution capability is introduced.
