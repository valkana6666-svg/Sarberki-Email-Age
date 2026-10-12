# Sárberki: efficiency and quality benchmark plan

Tracking: #3. Scope: `gmail-test-subject-allowlist` only. No production deployment, live booking, PMS write, or outbound email.

## Parallel-work boundary
This workstream adds measurement instrumentation, synthetic fixtures and CI reports. Do not alter booking/availability business logic owned by the ongoing capacity optimization workstream. Reuse existing tests and instrumentation. Coordinate before editing shared modules.

## Request-level measurement schema
- anonymous `request_id`, test scenario ID, implementation revision
- elapsed milliseconds by parse/filter/Previo/response phase
- number of Previo calls by endpoint and whether required by parsed intent
- skipped-query reason, timeout/error count
- model name, input/output token usage as reported by provider (null when unavailable)
- cost estimate and price-version only when usage and pricing are available (otherwise null)
- outcome labels: correct intent, capacity eligibility, availability verified, extra bed disclosure, unauthorized split recommendation, unsupported price claim

No raw guest emails, names, addresses, phone numbers, credentials, or access tokens in metrics. Document retention policy before persistence.

## Synthetic regression matrix
- 1 and 2 guests: default A/B search; explicit C request checks C only.
- 3 and 4 guests: avoid unnecessary A/B checks; C may be eligible at 4.
- 5 guests: C requires extra bed and confirmation; no invented surcharge.
- 6 guests: never offer a single C; no unsolicited split accommodation.
- Explicit A+C or B+C: split allowed, availability must be checked.
- Previo timeout/unavailable: never claim verified availability or make a booking.
- Test HU, DE, EN, SL guest-facing phrasing and missing details.

## Comparison protocol
Run identical frozen synthetic inputs against the baseline revision and optimized revision with deterministic mocked Previo results. Compare average/p95 latency, mean Previo calls, token use when observed, estimated cost when supported, and error rate. Report counts and denominators, absolute differences and percent change (N/A if baseline zero). Do not assert lower token costs merely from fewer Previo calls. Any increase in false availability claims is a release blocker. Store a machine-readable JSON report and concise CI summary.

## Completion criteria
CI is green; test fixtures cover the matrix; baseline and optimized report is reproducible; no new production behavior or secrets exposure. Check `a9282dc` and `8a1af4a` status before beginning implementation.
