# Exact receipt: authenticated read-only write-audit projection

2026-10-15. Branch `gmail-test-subject-allowlist`; coordinator code baseline `7654c5d`, documentation HEAD `1624ad2c85d51e8e59d4015e416018f6aa5ba183`. This patch has not been committed, deployed or verified against the managed service by Codex.

## Change

The existing `preview-draft` action can verify the current database write audit only for the privately configured exact receipt. It reuses the ordinary authenticated user transport and existing `sc_cases` / `sc_audit` RLS. There is no new endpoint, permission, database object, SQL migration, approval mechanism or provider call.

Verification requires all of:

- Stored source/message match the private receipt; the case is pending and has no server approval.
- One `sc_cases` snapshot matches tenant, case, revision, last writer, and the entire parsed case payload.
- One same-tenant/case/revision `sc_audit` row has the matching actor and ordinary `insert` (v1) or `update` kind.
- SHA256 of the database-returned `data::text` equals the audit's `data_hash`.

The existing database audit hashes PostgreSQL `jsonb::text`. The patch obtains that exact representation through PostgREST column casting, rather than imitating PostgreSQL JSON formatting in JavaScript. Official PostgREST column-casting documentation: https://docs.postgrest.org/en/v14/references/api/tables_views.html#casting-columns . The local test maps this documented GET selection to an actual PostgreSQL `data::text` SELECT; live PostgREST compatibility still requires coordinator verification.

Missing, duplicated, malformed, inconsistent, changed or unavailable snapshot/audit leaves the existing preview unverified. The response never exposes the raw case snapshot or original source through the new proof. Only verified scope, tenant/case/revision, actor, write kind and hash are projected.

The existing operator audit field displays the current write proof and explicitly says it is not approval. Guest text, business rules, capacity/price state, editor authority, approval allowlist and `sc_approve_case` are unchanged. This proves the current ordinary write event, not an approval or a complete audit-history chain.

## Targeted verification

Command:

```sh
node --test tests/exact-receipt-audit.test.mjs tests/synthetic-server-preview.test.mjs
```

**22 PASS / 0 FAIL / 0 SKIP**: five new audit checks (including four nested integration checks) plus seventeen existing preview checks, rerun because their view module changed.

The new test uses wholly fictional receipt data and controlled fake Auth/PostgREST HTTP. Actual PGlite PostgreSQL enforces the existing authenticated roles and RLS. It verifies:

- Writer and Reader receive the same consistent last-writer/revision/hash proof.
- A foreign tenant cannot read the proof; direct RLS audit selection is empty.
- Reader write and approval attempts are forbidden.
- Missing/duplicate audit, actor/revision/case/tenant/kind/hash tampering, query failure, missing/changed/malformed text snapshot remain unverified.
- A nonmatching private receipt triggers no audit query.
- The view rejects proof bound to another case/revision/scope or malformed actor/hash/kind.
- Case data/revision and one initial audit entry remain unchanged; only the initial synthetic fixture insertion writes. All subsequent transport calls are GET; no provider path exists in the test.
- Pending approval and unknown capacity/price stay explicit.

No prior full suite ran. No private canonical source file was read, printed or included. No real Gmail, Previo, email, cloud mutation, admin/service-role credential, Git push or deployment was used.

## Files and next verification

1. `shared-core/server-exact-gmail-receipt.mjs` — server-only bounded audit verification.
2. `netlify/functions/booking-cases.mjs` — existing exact-receipt preview integration.
3. `synthetic-server-preview.mjs` — existing audit status field renders the minimal proof.
4. `tests/exact-receipt-audit.test.mjs` — targeted role/consistency/read-only proof.
5. This report.

Next: coordinator review and test deployment; verify actual PostgREST text casting and the authenticated live Writer/Reader preview. The receipt remains pending and cannot be approved while capacity/price are unknown. Existing approved cases must not be rewritten or reapproved.

V2/V3 value: the shared read-only projection can substantiate a stored write without conferring any execution permission. Evidence here is local database-role verification and browser-view tests; managed-cloud readback is not yet claimed for this patch.
