# Exact clarification-only internal approval

Baseline: `11a62bbbf8308734dc63e5ff2c73403bd4f85d4c`, authorized test branch. No local parallel changes or later remote commits were present. No hosted SQL/data write, deploy, email or Previo operation was performed.

## Closed scope

Only exact case `13c8ecb7-f836-4e2c-9833-d58ee96f2dda`, tenant `sarberki-test`, English, with a missing contact phone. Existing valid exact receipt and exact-edit configuration are prerequisites. New flag: `CASE_CLARIFICATION_ENABLED=sarberki-test-exact-phone-only-v1`.

The server freshly extracts the original exact message and checks the saved facts: both must lack a phone. It appends one fixed English missing-phone question and a fixed Hungarian review rendition. There is no caller text, classification checkbox, arbitrary template or keyword-based acceptance. Other missing-data questions/languages remain unsupported. If a phone is already recognized, preparation fails closed; do not remove facts to force eligibility.

## Independent protections

`prepare-clarification` requires fresh cookie Writer authority and CSRF; `approve-clarification` requires fresh independent Approver authority and CSRF. Both remain exact-receipt, case and tenant bound. Reader cannot write. Ordinary accommodation approval remains blocked without its separate capacity/price/review evidence. The two-person fixture provider is never used here.

Approval rechecks full literal text, current facts/message revision, exact text hash, preparer and CAS revision. A separate HMAC domain `clarification-only-v1` binds tenant/case/revision/hash/template/facts/message count and a fresh timestamp. The SQL independently checks the original enabled private receipt, one exact message, fixed template, missing stored phone, Auth issuer/session/expiry, DB approval membership, distinct preparer, revision/hash and signed classification. No capacity/price assertion is substituted.

The result is `clarificationApproval` with scope, actor/time, reviewed/approved revisions and hash, plus transactional `approve_clarification_only` audit. Accommodation `state.approval` stays `pending`, with no `serverApproval`. Later exact manual edit or new preparation removes current clarification approval; append-only historical audit remains. Ordinary Writer SQL rejects any submitted `clarificationApproval` field, preventing forged or carried approval metadata.

## Database prerequisite — not executed here

Review `deployment/cloud-approval/clarification-only.sql` as an additive TEST-only installation candidate. Do not rerun the original `install.sql`: its original synthetic-only guard rejects the exact Gmail case. The addon requires verified test project, fresh backup SHA, existing approval binding, existing enabled exact receipt and existing private signing key. Use the established owner SQL workflow with `sarberki.approval_install_project_ref` and `sarberki.approval_backup_sha256` set to the verified values.

The file adds one specialized authenticated RPC with independent scope/authority checks and tightens ordinary Writer metadata protection. It changes no membership, RLS policy, existing grant or allowlist row. No service-role route is used. Hosted readiness of these private prerequisites is NOT VERIFIED; no new key or private receipt should be provisioned as a workaround.

The legacy exact-receipt rollback deliberately refuses a changed Writer definition. A separate owner-reviewed addon removal plan is necessary before legacy rollback; no restore/rollback file was modified. The isolated test restores its captured Writer definition only during disposable test teardown.

## Work acceptance — one coordinated test release

1. Review green CI and the SQL candidate. Coordinate the reviewed SQL prerequisite and one consolidated TEST release; enable the new flag only on the established test site. Preserve private configuration. No hosted action was performed by Codex.
2. Writer: open the exact case on `/cloud-approval.html`; under **Külön adatpontosító válasz**, save the closed question. Require one new pending revision. Do not use ordinary fixture review preparation.
3. Separate Approver: separately load the question, read the full fixed text, confirm its dedicated checkbox and approve only the clarification. Require revision +1 and `clarification-only-v1`; accommodation remains pending. No guest send occurs.
4. Reader after reload: stored state/audit readback must show the exact saved question, clarification actor/hash/revisions and one clarification audit. Reader write/approval, same-preparer approval, stale revision/hash, bad CSRF, other tenant/case and mismatched receipt must reject.
5. Authorized Writer: make one clearly fictional manual edit using current revision/hash. Reader reload must show no current clarification approval while preserving historical audit. The edit cannot load as a closed approvable question; old approval requests reject. Generic accommodation approval stays blocked.
6. Report only safe IDs/revisions, scope/error categories and PASS/FAIL; no bodies, private allowlist values, tokens or cookies. Hosted completion remains unconfirmed until Work acceptance.

## Evidence limits

Targeted tests use isolated PGlite PostgreSQL semantics, actual Writer/exact-receipt SQL, cookie API/runtime/repository, role-isolated sessions, CAS, hashes and audit. Hostile owner-row changes exist only in disposable negative tests. UI tests exercise separate preparation/consent, fixed text, rejection of claims, session/case/edit invalidation and no replay. Full CI results accompany delivery.

Follow-up local Chromium proof: 8 PASS at 390px using the actual HTML/module and an intercepted fictional transport. It covers preparation, Reader denial, explicit reload after denial, independent clarification approval, stored approval readback without replay, manual-edit invalidation, session clearing and layout. This exposed and fixed a UI busy-state issue: denial cleared consent but left reload disabled. The Node regression now checks that explicit reload/preparation remain available while approval stays disabled. Work should include denial → explicit reload in acceptance. This browser proof is not hosted Auth/SQL or WebKit acceptance.

V2/V3 value: a closed versioned classification and separately scoped approval reuse the common case service. This does not enable arbitrary clarification, multilingual free text, accommodation approval, sending, booking or Previo execution.
