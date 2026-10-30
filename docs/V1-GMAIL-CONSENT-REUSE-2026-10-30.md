# Gmail consent reuse and V1 live inspection — 2026-10-30

## Starting evidence and scope

The full current test-branch AGENTS.md was fetched before other substantive work
at 14:11 Europe/Budapest. File blob:
`be27bd2dfb4795496bd9f3d64ad60ada1123de5b` (not a commit identifier).
Starting branch HEAD and live `/api/health` both identify
`21fe2a7352d628b33687016aeb983fe0b4d78a4e`.
The live health response reports `autoSend=false` and
`autoBookingModification=false`.

The existing Google web session and direct Gmail connection work for the
designated test account. In this same conversation, actual application OAuth
and Gmail reads succeeded without password/OTP entry, including after closing
and reopening the application tab. The current synthetic message opens again
with the same local case ID and `duplicate` status. This latter operation uses
the loaded message and retains its earlier read timestamp; it is not a new API
read or a server-persistence proof. The original and extracted fields and reply
draft are visible. Missing facts and unverified capacity/price keep approval
disabled. No override or approval was performed.

The daily page requires a separate operator login; protected mailbox/case
controls are disabled. Google sign-in does not authenticate the operator.
No password, cookie, token or private receipt was read or exported.

## Reproduced cause and decision

Both `gmail-readonly.js` and `napi-kezelo/napi-email.mjs` passed
`prompt: 'consent'` to every `requestAccessToken()` invocation. This explicitly
forces renewed consent even when an existing grant is available. It explains
the application's repeated consent request; it does NOT establish the cause
of Work's black screen, a prior password/OTP challenge or an expired browser
handoff.

Alternatives: keep repeatedly confirming the existing grant, or stop forcing
re-consent in the two existing entry points. The latter is the minimal fix:
two application lines, no new dependency, token store or server auth path.
Both now request `prompt: ''`, allowing Google to reuse a prior grant and to
show authentication/consent whenever Google requires it. This is not
`prompt: 'none'`. No bypass or silent retry is introduced.

References:
- https://developers.google.com/identity/oauth2/web/reference/js-reference
- https://developers.google.com/identity/oauth2/web/guides/use-token-model

Readonly scope, `include_granted_scopes: false`, designated-account verification,
token-in-memory handling, explicit user gesture, logout/visibility handling,
source receipt allowlist, Auth/RLS/CSRF/CAS and independent approval are
unchanged. Business rules and protected reply/chatbot modules are unchanged.

## Validation

- Updated existing policy regression rejects the previous forced-consent request.
- Targeted Gmail policy/daily reader group: 11 PASS, 0 FAIL, 0 SKIP.
- Full local `npm test`: 2410 PASS, 0 FAIL, 0 SKIP; 39.1 seconds.
- This includes isolated PostgreSQL-semantics Gmail/cookie/Writer/Reader/separate
  Approver tests, with synthetic provider identities. It is not hosted E2E.
- Both modified application files pass Node syntax checks; diff whitespace PASS.
- Starting source `ce6432a51fd7d78fc13cb99c36935f8e8fca302e` CI independently
  inspected: run 41051701906, 2410 PASS / 0 FAIL / 0 SKIP; daily synthetic mobile
  run 41051701859, Chromium/WebKit 30 PASS. These are pre-change results, not
  this patch's CI or a physical iPhone test. Optional deployed-site CI was skipped.

## Remaining acceptance work

This patch's remote CI, test release and live grant-reuse behavior must be
verified separately after publication. No new Work task/conversation was
created by these tools: cross-task session persistence and lasting absence of
browser expiry remain NOT VERIFIED. Reopening a tab or continuing this
conversation must not be labeled a new-Work-session test.

Hosted Writer receipt, persisted daily visibility, independent Approver and
audit/readback need existing authorized operator sessions. The exact Gmail
case's missing case-bound review evidence must not be replaced with an override.
General daily-mail ingestion and reject/close backend remain incomplete.
Physical iPhone/Safari/PWA and direct Drive restore are not verified here.
No new completion percentage is justified; full V1 acceptance is not PASS.

No email/Pushover send, Previo call, booking, cloud schema/role change, main or
production mutation. V2/V3 value: preserves the existing shared transport and
authority boundaries without adding a second engine or authentication system.


## Publication, release and later browser observation

- Published source: `59c236bccfb48294c2c4c93d8ad5402a733b2251`.
- Full CI https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/41124482699 completed SUCCESS; logs independently confirm 2410 PASS, 0 FAIL, 0 SKIP.
- Targeted Gmail run 41124482688 and capacity run 41124482690 completed SUCCESS.
- Synthetic Gmail/operator mobile run 41124482674 completed SUCCESS: 14 + 28 checks. The separate daily mobile run 41124482778 was SKIPPED by its explicit commit-marker condition; it is not a new daily-mobile PASS.
- Exact same-tree test release: `1dcbe7c0cb4e861d0eeadbad5926b5463ae6ca94`. A fresh browser health page returned that complete deployed SHA, with autoSend=false and autoBookingModification=false. Only the existing test release was requested.
- At final live verification, the browser inventory had no remaining old tabs and the earlier JavaScript bindings were unavailable. A fresh canonical Gmail navigation showed the designated account as signed out. No model-initiated cookie deletion, browser-profile reset or Google logout occurred. These observations do not prove why the website session became unavailable or that a new independent Work task was created.
- Consequently, password-free browser access is NOT currently reverified, cross-Work persistence is NOT VERIFIED, and the post-patch live Gmail/Google grant-reuse test is BLOCKED at sign-in. The code/configuration fix must not be called a repair of Work's session expiry. No new credential request or repeated sign-in attempt was made.
- The direct ChatGPT Gmail connection was freshly rechecked after that observation: account identity and matching synthetic inbox-message search PASS without browser authentication. This does not verify the application's own OAuth or substitute for its hosted approval chain.
- Full Gmail -> hosted Writer -> independent Approver remains NOT VERIFIED; separate authorized operator sessions and the existing evidence gates remain necessary. No approval override, send, booking, Previo or production change occurred.
