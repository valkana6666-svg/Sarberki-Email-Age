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

## Verified checkpoint / authentication blocker

Runtime commit 97030326f694a2564277b2b17ca0b5938bb965f0 is verified: CI 38826676537 / job 116735638039, 1545 PASS, 0 FAIL, 0 SKIP; exact Netlify deployment sync PASS. Capacity run 38826676612 passed. Static build and server-module exclusion passed.

The diagnostic English button request returned Operator FORBIDDEN before the provider call; no translated text was accepted. This is an operator authorization/session rejection, not evidence that the provider key is invalid, accepted or funded. The existing helper also uses FORBIDDEN for origin/CSRF and membership checks, so this code alone is not conclusive proof of a Reader role. Next step is a fresh normal Writer login and one closed English request. DE/SI remain pending. No provider bypass, admin SQL or service-role workaround was used.

The secure Writer login request timed out with no verified successful transition. A fresh test tab still restored read access, but no successful Writer login is established. Manual login handoff is required. Do not repeat the successful CI, backup restore or prior Gmail OAuth proofs.

A local screenshot writer-login-20261016.jpg shows the empty login form and restored read-only status; no credentials are visible. No production/main, real guest data, mail/Pushover sends, Previo write or backup changes occurred. This documentation-only checkpoint requests CI skipping to avoid rerunning already-passed code tests.


## 2026-10-16 08:55 Europe/Budapest — authorization advanced, provider 429

After the operator completed manual test-site login and confirmed continuation, a single closed English MIME fixture was loaded locally and its translation button invoked. The UI returned TRANSLATION_RATE_LIMITED. This branch is reached only after protectedWrite succeeds and the provider returns HTTP 429. Therefore the prior operator gate no longer blocks this request. No translated output was accepted; DE/SI were not invoked, and no automated retries occurred. This is not a successful translation-quality proof.

Diagnostic limit: the current transport maps exact error.code insufficient_quota separately, but all other or unreadable 429 bodies become TRANSLATION_RATE_LIMITED. The precise provider code is not preserved; do not claim definite transient throttling or rule out spend/usage limits. Official rate-limit documentation also lists hard spend limits as possible HTTP429 causes: https://developers.openai.com/api/docs/guides/rate-limits . No new code was required or tested this session. Previously verified code remains 97030326f694a2564277b2b17ca0b5938bb965f0 with1545 passing CI tests.

The connected Platform plugin exposes key-provisioning operations, not account limits/billing reads. Direct navigation to https://platform.openai.com/settings/organization/limits rendered a login page. Next required action is normal user sign-in to inspect the account limits. No purchase, credit top-up, limit increase, new key, production or main modification was performed. Existing key value was never read out of Netlify.

## 2026-10-16 09:37 Europe/Budapest — Platform account inspection

The operator completed normal Google sign-in and OpenAI MFA. The authenticated Platform Limits page was visible for the previously selected project, followed by Billing Overview. Billing showed no remaining API credit and explicitly separated API credits from ChatGPT. This establishes an account-funding blocker for further provider translation verification; the earlier generic429 classification alone did not establish this. The limits page also listed the configured model.

No payment details were entered, credit purchase performed, limit changed, key rotated or further provider request made. Next action belongs to the operator: establish API credit in the same account, then resume one closed English test, followed by DE/SI only if successful. Previously passed1545 CI tests and Gmail/restore proofs remain valid and were not rerun. Code remains97030326f694a2564277b2b17ca0b5938bb965f0; this checkpoint changes documentation only.

## 2026-10-16 09:47–09:50 Europe/Budapest — three live translations PASS

The operator reported completing the credit purchase in their own browser. A fresh authenticated Billing Overview showed an available API balance and Auto-reload OFF. The agent performed no financial transaction or change.

On deployed code97030326f694a2564277b2b17ca0b5938bb965f0, the existing normal test-operator session was restored. Each exact syntheticMailEnvelope EN/DE/SI MIME fixture was loaded locally and translated by one explicit incoming translation button click. All three displayed the machine-translation status requiring operator review, in both incoming panels, with source messages unchanged. Each retained2026-10-23,2026-10-25,2 adults,0 children and+36 00 000 0000. No cloud case save, guest email, Pushover, Previo call/write, production/main change or automatic retry was performed.

Observed English result:
> Üdvözlöm! Egy Deluxe kabin 2026-10-23-tól 2026-10-25-ig 2 felnőtt és 0 gyermek számára. Telefon: +36 00 000 0000.

Observed German result:
> Jó napot! Deluxe nyaralóház 2026-10-23-tól 2026-10-25-ig, 2 felnőtt, 0 gyermek. Telefon: +36 00 000 0000.

Observed Slovenian result:
> Üdvözlöm! Deluxe házikó 2026-10-23-tól 2026-10-25-ig, 2 felnőtt, 0 gyermek. Telefon: +36 00 000 0000.

This proves actual configured provider transport and numeric checks for these three closed fictional messages. It is not general/private Gmail approval, full translation-quality certification, reply/backtranslation or human approval. Terminology such as English cabin→kabin remains subject to domain-language review. Previous1545 CI tests were not rerun to obtain this evidence.

UI issue observed: old bilingual-preview incoming panels still show an empty unconfigured-service placeholder below the working explicit clone panel. A minimal follow-up will suppress only these duplicate legacy incoming panels when the new ones exist, retaining legacy-only fallback and reply/editor/approval protections.

The UI follow-up hides the two old incoming wrappers whenever their explicit replacement exists, in both initialization orders and after source updates/remount. Without a replacement the legacy fallback remains. Reply editors and approval code are unchanged. Targeted DOM/translation suites:17 PASS,0 FAIL,0 SKIP; syntax and diff checks PASS. No repeat provider calls were used to test this cosmetic change.

## Final verified code checkpoint

b7f859793cd30d546bff1bc9af7070bb64070d44: CI38869904994/job116871296341,1547PASS/0FAIL/0SKIP; exact Netlify deployment syncPASS. Capacity run38869904908 also succeeded. A fresh browser tab visibly showed BUILDb7f8597; loading the closed SI MIME fixture showed both old incoming wrappers hidden and the explicit incoming panels present. This cosmetic verification made no provider request; successful EN/DE/SI provider evidence remains the9703032 run above.

Next V1 scope: domain terminology/translation quality review, then separately scoped reply/backtranslation integration; arbitrary/private/real Gmail remains disallowed by the closed input policy. No automatic guest communication or Previo write is enabled. Existing backups preserved.
