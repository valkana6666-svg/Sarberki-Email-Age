# Closed incoming translation terminology — 2026-10-16

Baseline code b7f859793cd30d546bff1bc9af7070bb64070d44 (1547 CI PASS), documentation HEAD025d451b6d5277df6b9dd3adaa34ac34c9a0c20d. The earlier actual EN/DE/SI provider outputs preserved all fixture data, but translated the accommodation noun inconsistently: kabin / nyaralóház / házikó. Sárberki uses faház.

The minimal server-instructions change supplies cabin/Ferienhaus/hiška→faház and preserves Deluxe unchanged. No source rewriting, replacement of provider output, policy expansion, new prompt framework, model/timeout/token/cache/auth/numeric-guard change or business-rule change. No answer, facts, prices or availability claims may be added.

Offline HTTP-boundary coverage verifies all three original source messages and glossary/safety instructions, and rejects altered input without additional provider calls. Targeted transport suite:13PASS/0FAIL/0SKIP; node syntax and diff checks PASS. Mock output proves the request contract, not actual model terminology. The baseline full suite was not repeated locally.

The changed prompt requires three new narrow actual EN/DE/SI checks on its exact deployed SHA. These are not repetitions of the unchanged baseline: their specific purpose is proving the new word choice. Actual results, CI and deployment are pending.

Only gmail-test-subject-allowlist and leafy-chimera-2403e5 are in scope. No real guest data, mail/Pushover send, Previo call/write, main/production or existing backup change. Reply/backtranslation remains disabled and arbitrary incoming text remains forbidden. V2/V3 value: tenant vocabulary stays in the existing translation adapter without modifying the shared business decision core.

Official prompt guidance checked: https://developers.openai.com/api/docs/guides/prompt-engineering .
