# Pushover protected runtime binding — 2026-10-25

The default server entry point now connects the existing endpoint, RPC transport and persistent delivery ledger. This is source-only preparation; no cloud migration, environment change, deployment or real notification was performed.

Both `PUSHOVER_ENABLED=true` and `PUSHOVER_LEDGER_ENABLED=true` are required. Neither is enabled by this change. Disabled gates never resolve the dedicated credential or make network calls. Site/origin/event validation precedes runtime resolution. Runtime errors return a sanitized 503. The transport pins the exact sarberki-test origin and three notification RPC functions.

Protected server configuration names: `PUSHOVER_SUPABASE_URL`, `PUSHOVER_SUPABASE_SERVICE_ROLE_KEY`. The existing transport expects a legacy service-role bearer credential; no credential was read or provisioned. Do not substitute a publishable/anon key. New secret-key support requires separate protocol validation. This dedicated adapter is not the case-store path and must not be imported into browser code.

Activation remains blocked until cloud migration, grants/RLS, rollback safeguards and explicit live-send authorization are verified. Never enable either switch merely to probe missing migrations. Keep Netlify builds stopped. Disable `PUSHOVER_ENABLED` to block subsequent requests; this does not retract an already submitted external request. A provider acceptance is not proof of iPhone delivery.

Targeted local synthetic verification: 19 PASS, 0 FAIL, 0 SKIP across runtime (9), endpoint/RPC chain (5), receipt (2), transport (3). Includes two concurrent requests, recreated handler with persistent fake database state, DB outage, false transition, provider timeout, expired Gmail authorization, disabled gates, wrong project/site and sanitized credentials. This is not a new real PostgreSQL or cloud test; the previously proved PostgreSQL concurrency result remains separate. No automatic retries occur after ambiguous delivery.

Rollback: revert only the runtime wiring and its new tests on the authorized branch. Do not reset the durable ledger or delete claim records; disabling the feature is the first response to uncertainty.
