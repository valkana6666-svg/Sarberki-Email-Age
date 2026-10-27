# Saved draft versus regenerated preview — Reader handoff

Baseline: `f490a6bcb4058782a5a2e476674188769729f000` on `gmail-test-subject-allowlist`; no later remote changes existed at task start. Work reports the exact Gmail case is v2 pending with durable edited text and update audit. No hosted record was written or deployment started here.

## Fix

The main Reader field previously displayed `result.text` (a freshly regenerated preview), while saved text was only populated in the editing copy. The primary read-only field now displays only `storedDraft.text` when case revision, facts revision, draft revision, message counts and pending state all match. Its current-status claim uses the identical predicate. Missing, stale or malformed stored snapshots leave this field and the editing copy empty, with an explicit warning.

The regenerated text and its Hungarian review text are in a separate collapsed section, explicitly labeled as regenerated and not saved. They never substitute for missing saved text. A new read-only runtime projection field exposes the current saved draft's own Hungarian review text only for unedited drafts. Edited drafts always show Hungarian translation as unverified; regenerated or old Hungarian wording is never attributed to the saved edit.

Case/revision changes, either session invalidation event and failed/malformed reads clear saved, generated, Hungarian and editing fields. Epoch guards suppress late responses. This change does not alter Auth, CSRF, receipt matching, RLS, tenant or Writer/Approver authorization or approval evidence gates. No persistence mutation was added.

## Work: one consolidated test release, read only

1. After green CI, coordinate the test release. Sign in as the existing Reader and select exact case `13c8ecb7-f836-4e2c-9833-d58ee96f2dda`, current revision v2. Click **Mentett tervezet visszaolvasása és külön előnézet (nem ment)**.
2. The primary **Aktuális, szerveresen mentett szöveg** field must match the previously saved edited v2 text exactly. Current revision status must agree; Reader editing remains disabled. Do not paste message text or private receipt values into the report.
3. Expand **Újragenerált előnézet – nem a mentett szöveg, nincs mentve**. The regenerated original may differ, but must appear only here. The saved edited text's Hungarian field must say **NEM IGAZOLT**; regenerated Hungarian text must remain separately labeled.
4. Refresh the page, restore the existing session, reopen the case and repeat the read. The saved v2 text must remain the primary display. No write is needed.
5. Change the case/revision or log out: all prior text fields clear. For a permitted existing case without a current stored draft, the primary field stays empty and the warning forbids a current-saved-text claim. Do not mutate a hosted case merely to create this negative scenario; stale/missing snapshots are covered by automated tests.
6. Approval remains blocked where case-bound review evidence is absent. This UI fix adds no approval permission.

## Automated evidence and limits

Targeted tests cover exact-shaped fictional Gmail v1 → edited v2 → a fresh Reader panel, exact text including trailing whitespace, separate regenerated fields, old Hungarian suppression, missing/stale snapshots, case/session clearing and late responses. The existing exact-receipt PGlite test also verifies the real runtime's edited-v2 preview projection through cookie Reader API, alongside RLS/CAS/audit and authorization regression. Existing HU and closed fixture regressions are included. Mobile scripts use intercepted fictional transport; full CI and mobile results accompany delivery. Hosted browser acceptance remains Work's task.

V2/V3 value: the existing read model now keeps persisted content and recomputed suggestions visibly separate without adding a second case store or reply engine.
