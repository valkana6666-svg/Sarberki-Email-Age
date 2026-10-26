# Next functional handoff: editable cloud reply, 2026-10-26

Base: 6a77ec379d9a6b66ccf5ea8c152cbfc3090ed8a0. Only gmail-test-subject-allowlist. No deploy until targeted and full CI pass; no production/main/restore changes.

HU hosted read-only acceptance is already complete on release e21f3664a07c6b6b0492e55c904f8fb32e05cdd3; evidence docs/HU-STORED-READBACK-HOSTED-ACCEPTANCE-2026-10-26.md. Do not repeat that acceptance or approvals of existing closed cases.

## Proven next functional gap

At this base, cloud-approval-session.mjs exposes review-record GET and approve POST, but no edit-and-save client operation. In netlify/functions/booking-cases.mjs the cookie POST action allowlist excludes edit-draft and its allowed fields exclude editedDraftText (lines 69-70), although the later runtime dispatch has editDraft (line 164). Thus the existing cookie-based hosted workflow cannot persist an operator's edited guest reply through that action. This is a deliberately closed route today, not an instruction to widen it indiscriminately.

## Codex implementation task

Inspect shared-core runtime editDraft, SQL permissions and isolated-approval-panel.mjs before changes. Implement the smallest safe edit/save/reload/independent-human-approval path for the ALREADY eligible closed synthetic review scope only, with a pre-existing eligible pending record. Do not edit or approve a previously accepted closed case just for a test; if no pending eligible fixture exists, report the fixture prerequisite before hosted writes.

Candidate files: netlify/functions/booking-cases.mjs, cloud-approval-session.mjs, isolated-approval-panel.mjs and its HTML controls, existing draft-edit runtime helper and targeted tests. Do not alter unrelated tariff/backup code. First establish precise existing Writer versus approver policy; editing must use fresh cookie Auth/CSRF and existing Writer membership. Approval must retain its current independent actor policy and reviewed revision/hash check. Scope every edit to assertCloudSyntheticReviewCase, never the broader read predicate. If existing SQL cannot safely support this, document the concrete restriction rather than adding service-role access or broad grants.

Persist the operator's exact edited guest text with revision concurrency, proper draft hash/audit binding and invalidation of earlier consent/approval. Reload and Reader readback must return saved content, not a recomputed preview. Changing case/auth, late responses and save errors must clear stale consent and prevent approval of unsaved/stale text. Preserve validation and language/operator review semantics; do not fabricate translated text as a verified human edit.

Exact Gmail case and the two-message HU read-only case must remain FORBIDDEN for edit/review/approve. Receipt match is provenance, not per-user approval authority or capacity evidence. No Gmail approval enablement is included in this task.

## Required targeted evidence

- Eligible pending closed synthetic record: Writer saves edit; actual persistent record has the exact edited text, incremented revision and bound hash; reload/Reader reads it unchanged.
- Independent eligible approver loads saved revision, explicitly consents and approves that hash; persisted audit binds actor/revision/hash. Do not send mail.
- Stale revision, altered hash, same-actor prohibited approval, Reader edit, foreign tenant/case, absent CSRF, arbitrary payload fields, non-registry record, HU two-message and exact Gmail edits/approvals reject without state/audit mutation.
- Save/load failure, case/auth switch and late-response UI tests leave submit disabled.
- Full CI once after final source changes. No hosted deployment solely for documentation.

This closes a narrower synthetic editable-workflow gap only. Real Gmail human approval still requires a separate explicit per-case/per-operator authorization and evidence model; do not claim operational V1 completeness from synthetic acceptance alone. Existing unknown capacity and 2027 extra-guest prices remain fail-closed.
