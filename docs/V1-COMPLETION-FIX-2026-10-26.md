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

## Follow-up after owner Google sign-in approval

Netlify sign-in succeeded. Recovery project is linked to the expected repository and gmail-test-subject-allowlist branch; branch deploys limited to that branch. Builds were Active and were changed to Stopped, then read back. Project environment page confirms no environment variables set. Recovery is not functional yet; no secrets copied. Git push lacked CLI credentials, so the connected GitHub API published identical tested tree df61d074813b59a2183dbd887747c2e563ff4ec9 as afe8b9af65024f340e86c62522e43d5ec67b04b9 on the authorized branch, using expected-head compare and no force.
