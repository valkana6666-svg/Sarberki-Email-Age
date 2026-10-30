# Gmail P0 inspection and recoverable message errors — 2026-10-30

## Source and scope

Branch: `gmail-test-subject-allowlist`. Inspected HEAD:
`a233eef1e12d1676cfb26ba6b3831094b1464f9d`.
The complete current AGENTS.md was retrieved from GitHub before implementation;
blob `be27bd2dfb4795496bd9f3d64ad60ada1123de5b`, checked on 2026-10-30
at 11:00 Europe/Vienna. Its policy agrees with the project instructions supplied
in this conversation. Native Work instruction persistence/loading is NOT VERIFIED;
the project settings themselves were not accessible.

## Existing implementation and decision

- Both interfaces reuse `gmail-policy.mjs`: designated-account verification,
  readonly GETs, bounded pagination, sequential body reads and deadlines.
- Detailed-page opening uses the existing shared analysis and local case/draft
  pipeline. Its local read marker is not evidence of a server case save.
- Only the first locally unread message is opened automatically; any listed
  message can be selected manually. This is not by itself a proven ingestion bug.
- Daily mailbox viewing explicitly does not ingest arbitrary mail into cloud
  cases. The existing exact-receipt Writer path permits one privately allowlisted
  synthetic message. Daily stored cases use the existing authenticated case API,
  stored draft, edit and independent approval paths. Rejection/closure and new
  mailbox-to-cloud ingestion remain incomplete.

Alternatives: expanding cloud ingestion requires a separately validated receipt
and lifecycle design; silently broadening that boundary is not a small safe fix.
The selected minimal fix handles a reproduced message-conversion failure inside
the existing Gmail display error boundary. No business logic, authorization,
receipt allowlist, automatic processing volume or cloud write is changed.

## Reproduced fault and change

`displayMessage` called `transform` outside its try/catch. An unreadable body
therefore rejected the promise; the manual picker handlers did not handle that
rejection. The regression failed on the original code (4 PASS, 1 FAIL).
Conversion and origin attachment now run inside the existing error boundary.
The UI reports the failure, does not mark the message read, and permits another
message to be processed. Regression covers failure and subsequent selection.

The existing mobile proof also exercises actual login/list/picker controls with
fully intercepted synthetic OAuth/Gmail replies: auto-open then manual reopen of
an unreadable message, no unhandled page error and no local read marker. The
existing mobile workflow now watches the Gmail bridge/policy/regression paths.

## Verification

- Targeted transform/policy/dedup group: 91 PASS / 0 FAIL / 0 SKIP.
- Existing `npm run test:gmail`: 189 PASS / 0 FAIL / 0 SKIP.
- JavaScript syntax and diff whitespace checks: PASS.
- Pre-change HEAD CI run 41028039369: 2408 PASS / 0 FAIL / 0 SKIP;
  optional deployed-site verification SKIPPED. Not the new commit's CI result.
- Local Playwright proof: NOT_RUN past browser launch; executable absent and
  browser download failed. This is a tooling blocker, not a mobile application
  failure. New GitHub mobile result must be checked after push.
- Live `/api/health`: deployed commit
  `4fedcc7bdfb91b2c0abd81995e49b04d3f868c34`, autoSend=false and
  autoBookingModification=false. The daily page loaded and required operator login;
  mailbox and case controls stayed disabled. This is not a physical iPhone test.
- A probe of `/api/operator-session` returned 404; inspection confirmed the actual
  client endpoint is `/.netlify/functions/operator-session`. No auth conclusion
  is drawn from the guessed alias.

## Backup/restore evidence rechecked, not rerun

Run https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41019946431
on `9debd60f65efe695f8ab07ef879676acc556a2f3`:
job 123944782487 logs prove a readonly source export, isolated full SQL restore,
and another full SQL restore from the exact-ID downloaded GitHub artifact.
Both reported full_restore=PASS, case_manifest=PASS, tables_compared=50 and
verification_completed=true. The encrypted envelope readback, artifact digest
and downloaded-package checks passed. No new export/restore was started here.

Direct Drive upload, exact-file download, restore and drive-acceptance were
SKIPPED in this run. They are NOT_RUN, not Drive PASS. No real database was
overwritten and no missing Drive secret was bypassed.

## Remaining blockers / next concrete task

Verify this commit's Node and synthetic mobile CI; a test deployment is not yet
claimed. With an authorized operator session and the application's own readonly
Google consent, exercise the existing exact synthetic receipt Writer path,
reload/dedup, daily stored-case visibility and independent Approver flow.
Daily arbitrary-new-mail ingestion and reject/close backend are still missing;
do not label the full Gmail chain complete. Physical iPhone operation and direct
Drive restore remain NOT VERIFIED/NOT_RUN. No new completion percentage is given.

No mail/Pushover sending, Previo access, production/main change or hosted schema
change. V2/V3 value: preserved single engine, shared transport and separate read,
write and approval authority. This patch does not claim a new platform capability.
