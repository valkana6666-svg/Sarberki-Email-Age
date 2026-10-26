# Targeted stored readback repair — 2026-10-26

Base: b017d37fc70861ca2dd193d0d793dabe2a4aaa60. Only gmail-test-subject-allowlist.

## HU functional fix

The old approval-state GET reused assertCloudSyntheticReviewCase. The pinned HU booking case fa570d0b-1ea9-4568-a8f2-08b4dec446d0 now has the original closed Hungarian message and its exact registered tub follow-up, so it correctly fails the one-message review/write/approval registry.

A separate assertCloudSyntheticReadCase retains the existing read scope and adds ONLY that case ID, tenant/data ID, valid revision and the exact two-message isClosedTubPreviousRecord shape (including mailbox, sender, order, timestamps, fixed stay/party/unit and pending approval). Arbitrary .invalid senders, other case IDs, different follow-ups and extra messages do not qualify. The application still resolves fresh Auth/DB read membership through the user transport; RLS is unchanged. No service role or new DB grants.

Only GET approval-state uses the expanded read predicate. POST review-draft and approve, and GET review-record (the approvable draft loader), retain the original strict review predicate. Read access never makes this multi-message case approvable.

The response projects the exact saved latest text/operatorReviewText plus revision/message-count freshness metadata. It never generates or persists a draft. Approval audit is an ordered, tenant/case/kind-filtered history. A prior v3 approval is returned as history alongside current v4 pending/serverApproval=null, never as approval of the new message. Audit snapshot hashes and draft hashes remain distinct.

cloud-approval.html has separate readonly stored-content fields populated by the state/audit readback button. Case input, authentication changes/background, errors and late responses clear or invalidate content. Readback clears prior approval consent and leaves submit disabled. No write action is added.

## Exact Gmail restriction — precise cause, unchanged

The earlier exactReceipt.matchesRecord exception exists only in Reader preview and case summaries. The approval page loads GET review-record. In booking-cases.mjs the cloud action gate and review-record branch call assertCloudSyntheticReviewCase, which accepts only the original synthetic Reader fixture or one of four exact closed fictional one-message records. The exact Gmail record matches neither registry. This is the direct FORBIDDEN source; it is separate from exact Writer ingest.

Even bypassing that gate would not be sufficient or safe: the server approval runtime requires a current internal_review_required synthetic draft and matching freshly rechecked synthetic providers; the fixed provider scope is Oct23–25 / two guests / Deluxe, whereas the exact receipt is a different scope. Existing edit/SQL synthetic-sender protections also remain. The private receipt match is not a per-user grant to edit/approve or evidence of real capacity/price. No new explicit per-case/per-operator approval authorization and evidence model was requested/proven here, so Gmail edit/approval access remains closed. Do not change the sender or loosen bytes/headers to make it qualify.

## Work browser acceptance after the next necessary combined test release

1. Verify deployed SHA, use the existing eligible test operator session; no new account/grant is needed.
2. Open cloud-approval.html with HU case fa570d0b-1ea9-4568-a8f2-08b4dec446d0. Use only the stored-state/draft/audit readback button. Do NOT use Writer preparation or approve.
3. Verify current v4 pending, serverApproval=null, actual saved reply and Hungarian operatorReviewText are visible in separate readonly fields. The historical v3 approval audit remains visible and is explicitly history, not current approval. A stale stored-draft binding must be labelled stale.
4. Reload the complete page, restore the session and repeat only this GET. Verify same case/revision/text/history, no case/audit mutation.
5. Change the case ID and log out: stored content must clear and approve must remain disabled. In a pre-existing Reader-only session the read must work; writer/review/approve remain unavailable. Do not broaden a user's membership to perform a test.
6. On the exact Gmail case, the established index Reader preview remains available; the approval review loader remains FORBIDDEN and submit disabled. This unchanged negative is intentional, not the earlier ingest bug.

Targeted tests include exact helper positives/negatives, cookie+real PGlite RLS readback/session restore with unchanged DB revision/audit, no write RPC, fully privileged test actor still excluded from the HU review scope, foreign tenant/origin/CSRF/membership negatives, exact receipt without approval scope, and UI readonly/epoch/consent clearing. Full CI is required before handoff. No source SQL, production, main, secret, guest send, booking or deployment change.
