# Exact receipt ingress: storage boundary diagnosis

2026-10-15. Allowed branch: `gmail-test-subject-allowlist`. Coordination baseline: remote `77cf97cfad2d594ae33a967946f889b4df301fe2`; not a new local commit or deployment.

The previous receipt task produced a proposal only. The initial diagnosis added one targeted regression test; at that stage no application, SQL, configuration, or cloud state changed. The subsequent authorized offline candidate is documented below. The private canonical receipt was not read or copied into these artifacts.

## Confirmed blocker

The requested combination of preserving the actual sender, forbidding aliases, and forbidding database migration cannot currently reach the existing Writer persistence route:

- `shared-core/server-booking-runtime.mjs`, `validateSyntheticMessage`, requires an `.invalid` sender.
- Independently, `supabase/migrations/202610090001_case_store.sql`, `sc_write_case`, rejects any `data.sender` outside `.invalid` with SQLSTATE `22023`, `synthetic sender required`.
- A server-only exact receipt validator would not remove the database rejection. No alternate persistence route, credential escalation, or sender substitution was introduced.

## Targeted evidence

Command: `node --test tests/actual-receipt-storage-boundary.test.mjs`

Result: **2 PASS, 0 FAIL, 0 SKIP**. Realistic fictional provider message/thread IDs, with a fictional equivalent sender, mailbox and body; no personal sender or actual RFC header. Existing SQL runs on PGlite PostgreSQL, with the authenticated role and a Writer membership. External sender rejection leaves case, message-key, and audit counts at zero. An `.invalid` positive control using the same shape and role succeeds, isolating the sender policy as the cause. This control is not a proposed aliasing strategy.

No previous suites or real Gmail/Previo requests ran. No actual OAuth, deployed receipt ingestion, Reader readback, or receipt approval is claimed.

## Next review decision

A concrete sender-preserving implementation requires a separately authorized database change with a verified fresh backup and an exact private receipt binding. The existing SQL cannot trust an arbitrary client-provided receipt marker. The diagnosis stopped there. The subsequently authorized candidate below remains offline and unconfigured; no UI or cloud activation was added.

The Oct30–Nov1 / eight-adult receipt has no verified capacity or price. The old fixture evidence must not be reused; approval must remain blocked. Existing approved cases and backups are untouched. The previously observed normalized guest-count/children-question discrepancy remains unresolved; protected business rules/renderers were not changed.

V2/V3 value: the test records a real persistence boundary so later ingress work cannot silently bypass the shared authority model. Its evidence is local PostgreSQL policy enforcement, not live Google or managed-cloud verification.

## Initial database proposal — superseded by offline candidate below

Current `sc_write_case` condition:

```sql
if coalesce(p_data->>'sender','') !~ '^[^@[:space:]]+@[^@[:space:]]+\.invalid$' then
 raise exception 'synthetic sender required' using errcode='22023';
end if;
```

Propose exactly one private, inactive-by-default receipt row, not a domain allowlist. Proposed table `public.sc_private_exact_receipt` columns:

- `slot smallint primary key check (slot=1)` — at most one row;
- `enabled boolean not null default false`;
- `tenant_id text not null check (tenant_id='sarberki-test')`;
- `case_id text not null` — pinned server-chosen ID, prevents using the receipt to create unrelated cases;
- `expected_source jsonb not null` — exact canonical provider, mailbox, actual message/thread IDs, received_at, original raw from header, parsed sender, recipient, subject, RFC Message-ID, explicit null in_reply_to and exact references array; no caller trust flag;
- `expected_message jsonb not null` — exact existing runtime message-envelope representation including the original sender and unmodified CRLF body, actual IDs/date/RFC and exact optional-key presence;
- `body_sha256 text not null check (body_sha256 ~ '^[a-f0-9]{64}$')`.

Install-time checks must reject inconsistent source/message pairs (sender, mailbox, IDs, date, RFC/reply/references), unexpected keys, a non-Gmail provider, or a body hash that differs from `sha256(convert_to(expected_message->>'text','UTF8'))`. Canonical source preserves explicit null and array values even where the existing message envelope omits null fields. No aliases. The row and personal values are provisioned privately, never committed or bundled.

Proposed replacement of only that sender condition:

```sql
if coalesce(p_data->>'sender','') !~ '^[^@[:space:]]+@[^@[:space:]]+\.invalid$'
 and not exists (
  select 1 from public.sc_private_exact_receipt r
  where r.slot=1 and r.enabled
   and r.tenant_id=p_tenant and r.case_id=p_case
   and p_data->>'sender'=r.expected_message->>'sender'
   and p_data->'sourceReceipt'=r.expected_source
   and p_data->'messages'=jsonb_build_array(r.expected_message)
   and encode(sha256(convert_to(r.expected_message->>'text','UTF8')),'hex')=r.body_sha256
 ) then
 raise exception 'synthetic sender required' using errcode='22023';
end if;
```

Exact JSONB equality rejects changed/extra source or message fields, reply/references changes and newline/body changes. This is a bounded single-message case: follow-up messages require a separate reviewed scope. The row binds the actual sender instead of translating it to a synthetic identity. `sourceReceipt` describes a user-device export matched against a privately approved receipt, not an independently fetched server-Google attestation. It grants no operation rights.

Enable RLS on the private table with no client policies; revoke all table privileges from PUBLIC, anon, authenticated and service_role, including any inherited/default grants. Only the existing definer-function owner reads it. Do not add a public RPC, membership grant or bypass. The existing function's write permission check, tenant rules, append-only payload, expected-revision CAS, unique message keys and transactional audit remain unchanged. No direct client table writes are granted.

Before any cloud installation: fresh verified encrypted backup; confirm exact test project and deployed function definition; review this gate plus server-only exact validator/runtime envelope change. The offline implementation and fictional-equivalent tests are described below. No live migration is authorized by this document alone.

Rollback: disable the private row first, restore the original sender condition, then remove the private table after preserving its private backup. Keep any imported case and audit intact; document that ordinary mutations of that retained external-sender case then fail closed. The existing cloud approval allowlist and SQL approval guard stay unchanged, so the new unknown-capacity/unknown-price receipt is not approvable. No provider calls, capacity evidence or approval-key changes are part of this proposal.


## Authorized offline candidate — not deployed or applied to cloud

Files in this phase:

- `deployment/exact-receipt/install.sql`: reviewable installer, project/backup preconditions, exact original Writer-definition check, one private table, and the single sender-condition exception. No receipt row, credentials, or personal values are included. No automatic application startup migration.
- `deployment/exact-receipt/rollback.sql`: checks the expected installed Writer body and target project setting, disables the row, restores the original function and drops only the private configuration table. Case/message-key/audit history remains intact.
- `shared-core/server-exact-gmail-receipt.mjs`: private opt-in exact validator; never a browser import. Exact original raw `from`, parsed `from_email`, recipient, subject, provider IDs/thread, RFC, received time, explicit null reply/empty references, unmodified CRLF body and hash are bound. Extra keys and any changed value fail closed.
- `shared-core/server-booking-runtime.mjs`: optional trusted matcher injection, pinned case ID, exact provenance persistence and exact duplicate-record validation. The exported ordinary synthetic validator still requires `.invalid`; no client boolean bypass exists. Existing parsing/planning/engine are reused.
- `netlify/functions/booking-cases.mjs`: the existing explicit cookie Writer ingest action accepts this exact private binding. Current Auth/CSRF/tenant/host/project gates remain; Reader gets metadata and read-only preview only when both config and stored record match. Approval/review allowlists are unchanged and deny this receipt.
- `tests/exact-receipt-offline.test.mjs`: the sole new test target for this phase.
- This report. The earlier two-test boundary proof remains unchanged and was not rerun.

Private deployment configuration, only after review and fresh verified backup:

1. `CASE_EXACT_RECEIPT_ENABLED=sarberki-test-one-receipt` (absent means closed).
2. `CASE_EXACT_RECEIPT_PRIVATE_JSON` containing exactly `{caseId,source,envelope,bodySha256}`. No such actual configuration is committed, logged, bundled or activated. Use one server-chosen UUID matching the private database row.
3. `source` has exactly `provider,mailbox_id,message_id,thread_id,rfc_message_id,in_reply_to,references,subject,to,from,from_email,received_at`. `from` is the unmodified display header; `from_email` is the original parsed address, never an alias. `mailbox_id` is an explicitly added stable technical namespace, not a Google-provided ID; `to` preserves actual mailbox identity. No source-Google-server attestation is claimed.
4. `envelope` has exactly `sender,text,mailbox_id,message_id,thread_id,rfc_message_id,references,received_at`, with sender equal to the source address. The source retains explicit null `in_reply_to`; the existing engine envelope omits that null. Body hash is SHA256 of the exact UTF8 text including CRLF.
5. Provision the same private source/message/hash/case binding privately in `sc_private_exact_receipt`, initially disabled. The installer inserts no row. Enabling is a separate coordinated test-only action. Existing deployment host/project configuration and authenticated Writer permissions remain mandatory.

The table has RLS enabled and no client policies; explicit REVOKE covers PUBLIC, anon, authenticated and service_role even with inherited default table grants. No new RPC, definer helper, role grant, approval module, MAC or engine is introduced. The existing Writer function owner reads the private row. Installer verifies its pre-existing function body rather than overwriting an unexpected definition; targeted tests prove the rest of the Writer body is byte-identical outside the sender condition, and rollback restores it exactly.

**Final targeted command:** `node --test tests/exact-receipt-offline.test.mjs`

**10 PASS / 0 FAIL / 0 SKIP** (including seven nested integration checks; not ten different end-to-end deliveries). Evidence uses controlled fake Auth/HTTP and actual PGlite PostgreSQL SQL/RLS/roles/repository/runtime/cookie handler. Checks cover wrong project/default-off/config/body hash; every source/message field, raw from and extra-key/CRLF tampering; authenticated-subject mismatch; same-origin CSRF and tenant boundaries; private table denial under anon/authenticated/service_role with default grants deliberately enabled; old `.invalid` route preservation; explicit Writer insert and idempotent replay at revision one; Reader metadata/preview with ingest denied; SQL independent tamper rejection; quote/availability/nonpending rejection; separate read+approve operator denial by unchanged approval allowlist; zero provider calls; and rollback retaining case/audit.

Actual static builder ran with an explicitly fictional build reference; the original local build-info file was restored. Public index exists and the private new server module is absent from its output. Initial test-harness failures (missing build reference, then an inaccurate fake membership filter during the added identity-mismatch check) were corrected; the final targeted run above passes. No application logic was changed to accommodate those harness failures.

No old full suite, old targeted suite, real Gmail request, live provider, cloud SQL, deployment, human approval, Git commit or push occurred in this phase. Parent separately observed the deployed Writer sender guard through read-only schema metadata; the candidate is still uninstalled. The Oct30–Nov1/eight-adult case has no verified capacity or price, no approval path, and no provider request from this ingress. The existing normalization/children-question business discrepancy is unchanged. At the end of the backend phase UI staging was still unimplemented. The subsequent local UI phase below adds the explicit control; neither phase is deployed or a successful live Gmail-to-cloud import.


## Minimal existing-panel UI phase — local source only

Only `operator-login-ui.mjs`, new `tests/exact-receipt-ui.test.mjs`, this report, and explicit CRLF assertions in the existing new offline target changed in this phase. `index.html`, protected renderers/rules, Gmail policy, and private server configuration were not changed.

The existing Gmail panel receives one dynamically created explicit **Betöltött Gmail-tesztlevél mentése · Writer** button and a short status/explanation. A canonical record/current message plus an active session can enable this attempt; this is not proof of private server authorization. The server alone accepts its configured single receipt. Normalization, ordinary reads, restore and input events make no new POST.

On click the helper preserves raw `from`, parsed original sender, actual provider/thread/RFC/date fields, null reply, empty references and original body bytes. It adds only the stable technical namespace `sarberki_gmail_test`; private deployment configuration must use that same namespace. It requires the designated mailbox recipient. Neither normalized facts, a proposed reply nor a caller trust flag is uploaded. HTML textarea CRLF-to-LF display normalization is allowed only for the current-text comparison; the original CRLF body is still sent unchanged.

The same controller busy gate, cookie transport, session identity/epoch checks and CSRF token protect the explicit existing ingest action. Changed record IDs, stale content, session replacement and late responses cannot overwrite the selected Reader case. Success or duplicate feedback selects the existing server preview ID/revision. It explicitly states capacity/price are unverified and makes no approval link for the receipt. Existing four-fixture load/save behavior is retained.

Focused UI command: `node --test tests/exact-receipt-ui.test.mjs tests/operator-login-ui.test.mjs` → **19 PASS / 0 FAIL / 0 SKIP** (six new UI checks and thirteen existing controller checks, rerun because their controller changed).

After the coordinator requested an explicit CRLF codepoint/hash oracle, the only affected exact-receipt targets ran: `node --test tests/exact-receipt-offline.test.mjs tests/exact-receipt-ui.test.mjs` → **16 PASS / 0 FAIL / 0 SKIP**. Both fixtures assert actual carriage-return/line-feed code points; the offline body hash differs from its LF-only representation. These counts overlap the earlier results and must not be added as distinct tests.

UI evidence is a controlled DOM/request harness, including explicit save, duplicate feedback, Reader/server403, inactive/missing/stale/mismatched records, pre-send session/content changes, late response invalidation, CRLF preservation and zero automatic POST/provider calls. It does not prove actual iPhone layout, live OAuth, deployed backend configuration, cloud receipt installation or a human approval. All live approved cases remain untouched.
