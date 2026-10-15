# Test translation configuration — 2026-10-16

Baseline: 80eda93c826133740fc2d2fcd55182cc8b476336 (1539 CI tests passed).

Only gmail-test-subject-allowlist and the leafy-chimera-2403e5 test site are in scope.

The operator saved the provider key directly in Netlify as the secret AI_TRANSLATION_API_KEY and explicitly chose to retain/reuse it. No credential value is included here or in the code. Server configuration now accepts that alias only when OPENAI_TRANSLATION_API_KEY is absent; an invalid canonical value never falls back.

Test-site deployment-context settings: OPENAI_TRANSLATION_MODEL=gpt-5.6-luna and SARBERKI_TRANSLATION_ENABLED=closed-synthetic-only. The existing endpoint remains restricted to the three exact fictional DE/EN/SI bodies, authenticated Writer and CSRF. No guest data, mail/Pushover send, Previo write or production/main change. Existing backups untouched.

The selected model supports Responses and reasoning effort none, set explicitly for this model to retain the existing 15-second timeout and 1200-output-token bound. Official source: https://developers.openai.com/api/docs/models/gpt-5.6-luna (checked 2026-10-16).

Targeted transport suite: 10 passed, 0 failed/skipped; syntax and diff checks passed. Full prior suite was not rerun locally. Deployment and actual provider translation are pending verification; configured settings alone do not establish provider acceptance, funding or translation quality.
