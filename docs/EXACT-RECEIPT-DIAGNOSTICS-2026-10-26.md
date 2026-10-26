# Exact Gmail receipt – authenticated diagnostics

Base: 396441573aced25ce15a629e4fcc43affe1929c0, gmail-test-subject-allowlist only.

The base report proves normal closed MIME Writer dedup works and the historical exact case/audit can be read. It does not identify a differing receipt field. No private allowlist value is available in this coding session, so no body/header/mailbox mutation is justified.

## Source comparison and repair

Both writes use the same operator cookie, same-origin/CSRF verification, freshly resolved Auth/DB membership, case service and CAS repository. The closed fixture requires closedSyntheticMailLanguage(envelope). The exact path additionally requires the private feature/config gates and exact equality of the complete envelope and sourceReceipt.

Previously the exact equality gate returned FORBIDDEN before protectedWrite, and the browser reduced every server rejection to the same generic error. Therefore configuration, payload shape, equality and Writer failures were indistinguishable. The repair authenticates exact attempts before diagnosing and renders only a fixed safe vocabulary. It does not change the approved receipt, relax equality or change SQL permissions.

## Diagnostics

POST booking-cases with the same exact payload and action diagnose-exact-receipt performs no write. It requires the original test host, enabled synthetic case store/cloud cookie mode, sarberki-test tenant, same-origin/CSRF and freshly verified Writer permission. Ordinary exact ingest failures also include the same safe diagnostic after authentication.

Categories: CONFIG_INVALID, REQUEST_SHAPE_INVALID, ENVELOPE_MISMATCH, SOURCE_RECEIPT_MISMATCH, WRITER_DENIED; MATCH means equality only, not database insertion or approval.

Only fixed field names are returned. Unknown caller property names, values, text, headers, hashes, private JSON, credentials and configuration values are never returned or logged. Writer denial takes precedence over any receipt comparison. Anonymous, wrong-origin, wrong-CSRF, foreign-tenant and Bearer probes receive no diagnostic. A rotated authenticated Reader cookie can receive only WRITER_DENIED, never equality details.

The SQL private allowlist remains an independent gate; a server MATCH is not proof its DB row is enabled. Later DB denial remains a normal error, not a fabricated equality diagnosis.

## Work browser acceptance after one collected test release

No deployment is triggered by this change. Keep the current explicit test-release gate.

In Work's existing authenticated browser load the historically allowed Gmail message and use exact Writer save. Capture only diagnostic category and fixed field names. Never copy the private config or body into logs/chat/issues. If a diagnostic identifies an actual mismatch, compare locally to the approved source; repair the producer or deployment configuration only after the mismatch is established. Never normalize headers/body to make it pass.

After a successful exact save, record only case ID, revision, duplicate/new status and safe audit result. Reload, restore operator session, open the same case through Reader preview and verify saved draft/revision/audit. Do not approve, send, notify, query live Previo or create bookings for this diagnosis. The receipt's capacity and price remain unverified.

Live exact mismatch correction and cloud save/reload are NOT VERIFIED by this code change; the existing Work session is required for that evidence.
