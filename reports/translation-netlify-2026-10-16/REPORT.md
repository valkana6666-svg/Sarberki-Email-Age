# Test translation configuration — 2026-10-16

Baseline: 80eda93c826133740fc2d2fcd55182cc8b476336 (1539 CI tests passed).

Only gmail-test-subject-allowlist and the leafy-chimera-2403e5 test site are in scope.

The operator saved the provider key directly in Netlify as the secret AI_TRANSLATION_API_KEY and explicitly chose to retain/reuse it. No credential value is included here or in the code. Server configuration now accepts that alias only when OPENAI_TRANSLATION_API_KEY is absent; an invalid canonical value never falls back.

Test-site deployment-context settings: OPENAI_TRANSLATION_MODEL=gpt-5.6-luna and SARBERKI_TRANSLATION_ENABLED=closed-synthetic-only. The existing endpoint remains restricted to the three exact fictional DE/EN/SI bodies, authenticated Writer and CSRF. No guest data, mail/Pushover send, Previo write or production/main change. Existing backups untouched.

The selected model supports Responses and reasoning effort none, set explicitly for this model to retain the existing 15-second timeout and 1200-output-token bound. Official source: https://developers.openai.com/api/docs/models/gpt-5.6-luna (checked 2026-10-16).

Targeted transport suite: 10 passed, 0 failed/skipped; syntax and diff checks passed. Full prior suite was not rerun locally. Deployment and actual provider translation are pending verification; configured settings alone do not establish provider acceptance, funding or translation quality.

## Deployment and follow-up

Commit a89a152b65b16f8cb7953baef239ce831b816832: CI run 38826326659, test job 116734528554, 1542 passed / 0 failed / 0 skipped; exact deployment sync passed. Capacity run 38826326398 passed. The test browser restored the existing operator session and loaded the closed English MIME fixture locally. One explicit translation button request returned the previous generic failure state; no translation was displayed. DE/SI were deferred to avoid extra requests before classification.

This follow-up exposes only fixed, whitelisted error classes for operator authentication/Writer permission, disabled config, upstream key/access/model/quota/rate limit, and unverified translation. No provider message, content, key or model value is reflected. Existing timeout/cache/no-retry behavior is unchanged. 27 targeted tests passed with no failures/skips, syntax and diff checks passed. Actual failure class remains pending the deployed diagnostic UI.
