# Daily operator reading and Gmail test inbox — 2026-10-29

Source commit: 2b124ebce2d2dd21c632fcb903b6bfd233884923

## Changes

- Remove the 30-second display timer. Reading and typed edits remain visible while the page is active.
- Automatically load stored cases after login/session restoration; select an available category when the default is empty.
- Preserve protected reads, separate Writer/Approver permissions, revision/hash checks, logout clearing and late-response rejection.
- Add explicit readonly Gmail consent, inbox list and original-message display to the daily interface.
- Extract the existing account-checked, paginated, sequential, deadline-bound Gmail GET transport and MIME reader into gmail-policy.mjs and reuse them in the existing and daily interfaces. No second business rules engine.
- Add clear distinction between mailbox messages and persisted cloud test cases.

## Evidence

- Full CI: 2406 PASS, 0 FAIL, 0 SKIP.
  https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40942753202
- Chromium + WebKit synthetic mobile proof: 22 PASS, 0 FAIL.
  https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40942753143
- Gmail targeted acceptance: SUCCESS.
  https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/40942753299
- Browser evidence includes reading beyond 30 seconds, retaining edits, rejecting an outdated revision, automatic loading, readonly Gmail list/open, and clearing messages after denied access.
- Tests simulate OAuth, Gmail HTTP and operator sessions; no external mail access, sending or booking creation. Actual iPhone and live Google consent: NOT VERIFIED.

## Remaining work

- Gmail reading is restricted to sarberkiprojecttest@gmail.com by the existing policy. Google readonly consent is required on the user's device.
- The info@sarberki.hu Outlook mailbox is not connected by this change.
- Mailbox reading does not ingest arbitrary messages into the restricted cloud test-case backend, does not generate/approve a new cloud reply, and does not broaden its receipt allowlist.
- Cloud ingestion, shared-case lifecycle for newly read mail, Outlook application authentication and end-to-end live acceptance remain outstanding. Do not describe this release as a completed daily email workflow.
- Release commit requests only the existing Netlify TEST deployment; deployed build identity must be checked separately.

## V2/V3 value

Both surfaces share one readonly transport and MIME reader; authorization and business decisions remain separate. No automatic outbound execution was added.
