# Daily Gmail original-message recovery — 2026-10-30

## Verified starting point

Full GitHub AGENTS.md read on `gmail-test-subject-allowlist`, 2026-10-30
12:47 Europe/Vienna; blob `be27bd2dfb4795496bd9f3d64ad60ada1123de5b`.
Starting commit `7ec69e78a4e4bb39eeccfa6b6d394cae6cd78eee` has successful
main checks, Gmail targeted checks, capacity regression and synthetic Gmail
mobile workflows. Native Work instruction persistence remains NOT VERIFIED.
The supplied project instructions agree on test-branch-only work, evidence
before changes, minimal fixes, a shared engine and no production activation.

The existing daily UI loaded in a fresh cloud browser, required operator
login and disabled protected controls. No authenticated session was available;
no credentials or additional OAuth permissions were supplied. The live health
response identified `4fedcc7bdfb91b2c0abd81995e49b04d3f868c34`, with
`autoSend=false` and `autoBookingModification=false`.
This is not authenticated Gmail E2E or a physical iPhone test.

## Decision and reproduced fault

The detailed Gmail display already catches conversion errors. The daily view
uses the same MIME reader but called it without a per-message error boundary.
A synthetic invalid base64 body reproduced an unhandled manual-selection
rejection (5 PASS / 1 FAIL). When switching from a readable message, the old
body could remain while the picker and header selection had advanced.

Alternatives: modify the shared MIME decoder globally, or isolate the daily
presentation failure. Choose the latter: smaller impact, no change to parsing
or authorization policy, no new dependency or maintenance path.

Changes:
- `napi-kezelo/napi-email.mjs`: catch body conversion failure per message,
  replace previous content with the selected headers and a recoverable error,
  retain picker/list/previous/next navigation.
- `tests/napi-email.test.mjs`: malformed first and later messages, automatic
  and manual opening, no stale body, and recovery via another selection.
- `scripts/napi-kezelo-browser-proof.mjs`: extend the existing intercepted
  Chromium/WebKit mobile proof with automatic/manual malformed-mail recovery.

No cloud ingestion, database lifecycle, business rules, OAuth scopes, shared
engine, receipt allowlist, sending, Previo or production changes.

## Verification and limits

- Targeted daily/policy/scoped-reader Node group: 18 PASS / 0 FAIL / 0 SKIP.
- Full local `npm test`: 2410 PASS / 0 FAIL / 0 SKIP (48.7 seconds).
- Syntax and diff whitespace: PASS.
- Local browser proof: NOT_RUN past launch because the Playwright browser
  executable is absent. This is a tooling blocker, not an application failure.
- GitHub push: BLOCKED by automatic approval review, which requires explicit
  user authorization for external publication. Remote URL and branch were
  verified; no further publication attempt is permitted without approval.
- New commit CI and test deployment: NOT_RUN. No live or physical iPhone PASS
  is inferred from synthetic checks.

Remaining P0: authenticated application Gmail OAuth/read, exact synthetic
Writer receipt, persisted daily visibility, reload/dedup and separate Approver
flow. General new-mail ingestion and reject/close backend remain incomplete.
The existing isolated GitHub backup/restore proof is documented in
`V1-GMAIL-RECOVERY-2026-10-30.md`; direct Drive restore remains NOT_RUN.
No updated completion percentage or V1 100% claim.

V2/V3 value: preserves the shared transport/engine and separate authority
boundaries; this is a daily presentation fix, not a new platform capability.
