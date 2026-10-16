# Closed incoming translation terminology — 2026-10-16

Baseline code b7f859793cd30d546bff1bc9af7070bb64070d44 (1547 CI PASS), documentation HEAD025d451b6d5277df6b9dd3adaa34ac34c9a0c20d. The earlier actual EN/DE/SI provider outputs preserved all fixture data, but translated the accommodation noun inconsistently: kabin / nyaralóház / házikó. Sárberki uses faház.

The minimal server-instructions change supplies cabin/Ferienhaus/hiška→faház and preserves Deluxe unchanged. No source rewriting, replacement of provider output, policy expansion, new prompt framework, model/timeout/token/cache/auth/numeric-guard change or business-rule change. No answer, facts, prices or availability claims may be added.

Offline HTTP-boundary coverage verifies all three original source messages and glossary/safety instructions, and rejects altered input without additional provider calls. Targeted transport suite:13PASS/0FAIL/0SKIP; node syntax and diff checks PASS. Mock output proves the request contract, not actual model terminology. The baseline full suite was not repeated locally.

Verified code commit: 343fe609843f09f36d8aa83fb577affc7bf3fc56. GitHub CI completed 1548 tests / 1548 PASS / 0 FAIL / 0 SKIP and reported DEPLOY SYNC PASS with that exact expected and deployed SHA. Run: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38872816644 ; test job: https://github.com/valkana6666-svg/Sarberki-Email-Age/actions/runs/38872816644/job/116880698888 . Capacity workflow 38872816608 and offline Windows backup-copy job 116880698973 also succeeded. Live Previo workflow step remained skipped.

Exactly three new actual provider requests were made after reloading the test site and observing BUILD343fe60. These are justified by the changed prompt, with no retries. All three original closed synthetic messages returned Deluxe faház:

- EN: Üdvözlöm! Egy Deluxe faház 2026-10-23-tól 2026-10-25-ig 2 felnőtt és 0 gyermek részére. Telefon: +36 00 000 0000.
- DE: Jó napot kívánok! Deluxe faház 2026-10-23-tól 2026-10-25-ig, 2 felnőtt, 0 gyermek. Telefon: +36 00 000 0000.
- SI: Üdvözlöm! Deluxe faház 2026-10-23-tól 2026-10-25-ig, 2 felnőtt, 0 gyermek. Telefon: +36 00 000 0000.

Dates, adult/child counts and phone remained intact; no price or availability claim appeared. The UI retained machine-translation/operator-review status. Both incoming panels showed the result without the obsolete duplicate. Local screenshot: live-terminology-proof.jpg. This is evidence for three fixtures only, not broad translation quality, real guest processing or iPhone home-screen certification. Reply translation and backtranslation still need separate implementation and synthetic verification. Previously exposed API-key rotation remains open before real deployment; no key was read or changed during this work.

Only gmail-test-subject-allowlist and leafy-chimera-2403e5 are in scope. No real guest data, mail/Pushover send, Previo call/write, main/production or existing backup change. Reply/backtranslation remains disabled and arbitrary incoming text remains forbidden. V2/V3 value: tenant vocabulary stays in the existing translation adapter without modifying the shared business decision core.

Official prompt guidance checked: https://developers.openai.com/api/docs/guides/prompt-engineering .
