# V1 completion fix — 2026-10-26

Base: 8dc9eda6921c7db45f24d8b80d2e0e2c7e11f145, authorized gmail-test-subject-allowlist branch. Its branch-filtered GitHub CI run 40316798814 is successful. Browser observed hosted build c01fe0a.

## Actual fixes

1. index.html: a short dated accommodation request containing contact details could become general_question. Reproduced in the hosted closed Slovenian MIME fixture: only foreign-language warning, enabled local approval, no reservation-status paragraph. A manual German booking with explicit buchen correctly retained all booking warnings. The browser parser now promotes a general question only when it has two dates, a recognized cabin and a known positive party total. Cancellation/modification intents remain unchanged. This restores the existing booking review and server capacity gate; no new approval path is introduced.
2. scripts/netlify-test-build-gate.cjs: the existing recovery site skips automatic builds, including V1 release commits. The original V1 site's explicit-release rule and production build behavior remain unchanged. This is source protection; current remote Netlify settings have not been verified.

## New verification

- Targeted Node regression: 18 PASS / 0 FAIL / 0 SKIP, including four languages, two contact-only negatives, existing local approval persistence/failure checks and build gate checks.
- Full npm test after npm ci --ignore-scripts: 2173 PASS / 0 FAIL / 0 SKIP. Synthetic local tests include PGlite tests; not a hosted Supabase acceptance run.
- The initial run before installing dependencies reported 2084 PASS / 19 FAIL: every failed test file lacked @electric-sql/pglite. The installed-dependency run above supersedes that environmental failure.
- git diff --check: PASS.
- No live Previo action was deliberately requested. The ordinary manual analysis UI attempted its existing capacity path and reported blocked/unverified; no availability is claimed.

## Hosted boundaries and blockers

The existing browser operator session reports authenticated read access. Writer fixture action returned that the server answered but a pending synthetic draft is unverified and an existing approved case cannot be overwritten. This does not prove a successful write or diagnose the earlier exact-Gmail FORBIDDEN. That exact Gmail chain, edits/approval/reload and role boundaries remain unverified for this session.

Netlify recovery configuration opened at the exact existing project URL but showed login. The secure authentication method picker returned submitted / google. The next Google observation was rejected by automatic security review because separate Google identity-provider origin approval was absent. No workaround was attempted. Thus automatic build settings, scoped variables and recovery Auth/HTTPS remain unverified. Source changes are kept locally and are not pushed or deployed pending that check. No production/main change or secret disclosure.

## Delivery status

Source fix and tests complete locally; hosted acceptance and GitHub publication pending. Existing 85% estimate is retained; new tests alone do not increase it. Next action: authorize Google sign-in to Netlify, inspect/stop recovery auto-builds as needed, then publish the tested changes to the authorized branch and deploy only the intended V1 test release. Verify the corrected exact Slovenian fixture and finish the existing Gmail write/approval chain. No backup/SQL restore rerun is required.

## Published acceptance result

Superseding local-only delivery statements: connected GitHub publication is afe8b9af65024f340e86c62522e43d5ec67b04b9, identical tested source tree. CI 40320997514 completed SUCCESS. Release b682d6dea6ab836ff8966182144e83dc785a11b8 published on leafy-chimera-2403e5 in 18 seconds; browser BUILD b682d6d verified. Fresh Slovenian manual synthetic inquiry for 2026-11-13 to 15, 2 adults / 0 children / Deluxe shows full price, capacity and terms warnings and disabled approval, plus Slovenian reservation-status paragraph. The previously saved closed fixture remains wrongly classified because duplicate ingestion reuses its historical local case intent; this cached-case migration is still open. Do not call all closed fixtures accepted.

Recovery admin confirmed expected repository and branch, build settings Active -> Stopped and persisted Stopped. No project environment variables set, confirmed authenticated. No restore deployment and no secrets copied.

Gmail read button opened Google unverified-app warning. Continue was rejected by automatic security review for lack of specific approval of that warning. No bypass. Complete current Gmail write/approval/reload chain remains NOT VERIFIED. Owner approval is needed for that exact warning step. Current estimate remains 85%; no 100% acceptance claimed.

## Gmail follow-up after explicit warning approval

Gmail readonly OAuth succeeded on hosted b682d6d. The November 13–15 synthetic message parsed as 2 adults + 2 children, 4 total, 2 nights; missing child ages and phone were flagged. Exact Writer save returned FORBIDDEN. The historically approved October 30–November 1 Test Guest synthetic message was independently located, opened via the application's Gmail list and parsed as 8 adults, 0 children, 2 nights; exact Writer save also returned FORBIDDEN. No private allowlist changes or permission bypass.

The historical exact case 13c8ecb7-f836-4e2c-9833-d58ee96f2dda v1 and creation audit were successfully read through the normal operator UI. Audit SHA256 remains b04dc79ee54c1de22db89e3936b8ee631ef4f3347ba160a14a8eac6878e92b3c.

A closed English MIME fixture through its existing normal Writer action succeeded as an existing-cloud-case dedup: 926cc81d-16a1-435f-bfd3-41e874c1b1bc v3. This establishes the closed Writer route works in the current session, not a new insert or approval. Exact-receipt-specific gates/configuration/request equality remain the narrowed blocker. CASE_EXACT_RECEIPT_ENABLED and CASE_EXACT_RECEIPT_PRIVATE_JSON exist; enabled key is configured in Production context (the test site's published branch). Secret values were not revealed. A transient browser transport error recovered on a single retry.

No source fix or new deploy in this follow-up. No email, notification, Previo write, or new booking. Full exact Gmail -> cloud approval/reload is still not verified. Next concrete task: diagnose exact receipt/request equality versus deployed private configuration without logging secrets, preserve strict single-message authorization and repair only the proven mismatch. Existing cached-case intent issue also remains open.
