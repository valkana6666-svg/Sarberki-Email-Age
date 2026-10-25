# V1 Gmail/Pushover timeout correction — 2026-10-25

Baseline HEAD: 0e5d06b214e2693a69a7271ecee9c21b255bd9f2. Work prioritized and verified the change; a separate Codex reviewer reproduced the unbounded Gmail profile/metadata fetch and JSON waits without editing files. All observations used synthetic transports, not Gmail or Pushover services.

The protected notification endpoint now bounds each Gmail fetch plus JSON parsing operation with a 10-second default timeout, AbortController and Promise.race. The test-only injectable limit is an integer from 1 to 15000 milliseconds. Redirects are rejected. Timers are cleared after completion. There is no retry. Two sequential Gmail operations may take up to approximately 20 seconds in total; this is not an overall request deadline.

Gmail transport, timeout and JSON failures return sanitized GMAIL_UNAVAILABLE / 503 with deliveryUnknown=false, because this path precedes any notification claim or provider call. Existing HTTP authentication and unavailable-message handling remain unchanged. Notification provider ambiguity still remains a separate state.

Local targeted tests: 24 PASS, 0 FAIL, 0 SKIP: 10 new Gmail timeout/error tests, 9 runtime tests and 5 endpoint/RPC chain tests. The new tests cover both stages and header/body stalls, parse/network errors, bounds, and timer cleanup before a slower provider response. No real database, cloud migration, guest message or live notification was used.

Release guard reviewed before editing: netlify.toml delegates ignore to scripts/netlify-test-build-gate.cjs; the test site builds only the authorized branch with the standalone release marker. This commit has no release marker and carries skip-netlify. Netlify deployment remains suspended.

Backup prerequisite reviewed: BACKUP-V2-CLOUD-CONTROL.md and CLOUD-ALTERNATIVE.md, plus V1 completion evidence. Latest documented snapshot 2026-10-25 08:24 Europe/Vienna, run 40172605691, commit 817212439d3ac426ca4ce1b1005015054701e832. GitHub SQL restore: 49 tables; exact-ID Drive byte SHA256 previously proved. No fresh backup/download/SQL restore was performed in this change. Today's Drive bytes have no separate SQL restore proof. Independent owner key probe and complete Auth/config/platform restoration remain open. Artifact expiry 2027-01-23T07:23:48Z.

Remaining deployment/activation gates are unchanged: notification cloud migration is not applied; explicit real-send permission is absent; Netlify release is suspended. Previo side-effect-free read access and physical tub availability evidence remain unresolved. Safari/iPhone acceptance and successful historical tests were not reopened.

Rollback is a focused revert of this change on the authorized branch. It requires no schema change and must not erase notification claim records. V2/general commercial engine work remains paused.
