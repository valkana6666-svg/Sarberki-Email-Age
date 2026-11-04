# Daily cloud backup request

Date: 2026-11-03 (Europe/Vienna).
Requested at: 2026-11-03T08:36:00+01:00 (2026-11-03T07:36:00Z).
Request ID: cloud-daily-20261103-083600-572d9fbe.
Provider: github-bridge.
Branch: gmail-test-subject-allowlist.
Request marker: [backup-v2-cloud-bridge-run].
Base commit: 572d9fbe179c23c536d2864bc51a38f6426185d7.
Previous request blob SHA: c906f662818ddfc3a4884e2029d5976d2a8eccae.

Single authorized daily read-only export request. This is not evidence of success. Preserve encrypted exact-ID GitHub readback and isolated SQL restore; no production, Netlify, bookings or Previo changes.

Previous proven github-bridge snapshot: GitHub Actions run 41410412064 (2026-11-02), safety and export-restore SUCCESS; encrypted cloud staging, exact-ID download validation and isolated SQL restore steps SUCCESS. Separate Drive-mode full export and Drive readback restore also succeeded in run 41531603671 (2026-11-02), not a github-bridge snapshot.

## Historical requests (preserved)

# Daily cloud backup request

Date: 2026-11-02 (Europe/Vienna).
Requested at: 2026-11-02T08:04:22.572Z (local 2026-11-02T09:04:22+01:00).
Request ID: cloud-daily-20261102-090422-b9a2eccd.
Provider: github-bridge.
Branch: gmail-test-subject-allowlist.
Request marker: [backup-v2-cloud-bridge-run].
Base commit: b9a2eccd914bd4dafe2b542dab66d836b2d6b601.
Previous request blob SHA: e2ca257435d1ae673f33c2a03341b8dc36920421.

Single authorized daily read-only export request. Not evidence of backup success. Preserve encryption, exact-ID GitHub artifact readback and isolated SQL restore; no production, Netlify, live booking or Previo changes.

Previous proven snapshot: GitHub Actions run 41325591254 (2026-11-01), source commit aa4db7362facb44e1bd024645de5e6e2d9a42eee; safety and export-restore SUCCESS; encrypted staging artifact 13090139495, proof artifact 13090463991; exact-ID GitHub readback and isolated SQL restore PASS (52 tables compared). Separate Drive transfer/readback/restore remains independently verifiable.

## Historical requests (preserved)

# Daily cloud backup request

Date: 2026-11-01 (Europe/Vienna).
Requested at: 2026-11-01T07:26:18.900Z (UTC; local 2026-11-01 08:26:18+01:00).
Request ID: cloud-daily-20261101-082618-676ee69e.
Provider: github-bridge.
Branch: gmail-test-subject-allowlist.
Request marker: [backup-v2-cloud-bridge-run].
Base commit: 676ee69e7886cacc80f434f8d625a160434c62f0.
Previous request blob SHA: 77612cab877fa17d210910fc3ab19685c8ed5de5.

Single authorized daily read-only export request. This request is not evidence of backup success. Preserve encryption, exact-ID GitHub artifact readback and isolated SQL restore; do not touch production, Netlify or live bookings.

Previous proven snapshot: GitHub Actions run 41181952052 (2026-10-31), source commit 2998dbe05d6666791f6ba22f0a370d7dd4cc920b, safety and export-restore SUCCESS, encrypted GitHub staging artifact 13035387291, proof artifact 13035746055, exact-ID GitHub readback and isolated SQL restore PASS (50 tables compared). Separate Drive transfer, exact-ID Drive byte readback and Drive SQL restore remain independently verifiable.

## Owner-authorized WP3 pre-migration refresh (manual, not the daily automation)
Requested at: 2026-11-01T08:17:38.859Z.
Request ID: wp3-pre-migration-refresh-20261101.
Provider: github-bridge.
Branch: gmail-test-subject-allowlist.
Reason: owner conditionally authorized WP3 TEST migration and requested a fresh verified backup/isolated restore if unchanged-since-backup cannot be established. The earlier daily backup remains valid; its complete freshness cannot be established from the public proof alone.
Source project only: mojnqizbcaczstguikpv.
Use the existing encrypted read-only export, exact-ID readback and isolated SQL restore workflow unchanged. No source migration, activation switch, Netlify deployment, e-mail, booking or Previo operation is authorized by this request.
Before refresh: DML counter baseline and nonsecret schema fingerprints captured by Work; compare again before any migration.
Previous backup run: 41284787609; verified ciphertext package SHA256: 2b0906b984359a4d446f57a539a767411ea9920375b9a63813806ac9d321753a.

## Drive-útvonal próbája új OAuth-secrettel (tulajdonos beállította, 2026-11-02)
Requested at: 2026-11-02T17:14:18Z.
Request ID: drive-proof-20261102.
Provider: drive (vars.SARBERKI_V2_STORAGE_PROVIDER), marker: [backup-v2-run].
Branch: gmail-test-subject-allowlist. Base commit: 97edcdd58aa0d7cdee880913857e1010b6a78ea0.
Reason: the owner created a new client secret and drive.file refresh token for the dedicated "Sarberki Drive Backup" OAuth client (Testing, External, test user added) and stored SARBERKI_V2_DRIVE_OAUTH_JSON. Previous blocker: run 41325441753, empty secret.
Unchanged existing workflow: read-only source export, isolated SQL restore, encrypted Drive upload, exact-file SHA256 readback, restore from the Drive download. No migration, switch, Netlify deployment, e-mail, booking or Previo operation.
Known limits: Testing refresh tokens expire after about 7 days; the client secret ending …Stz3 appeared in a chat screenshot and is to be rotated at the next token renewal (owner chose "later").
Retry 2026-11-02T21:17:39Z: the owner updated SARBERKI_V2_DRIVE_OAUTH_JSON with a PowerShell-validated JSON and a fresh drive.file refresh token (previous run 41490109148: stage=oauth_token, UNEXPECTED_JSONDecodeError). Same workflow, no other change.
Retry 2026-11-02T21:44:11Z: the owner re-entered SARBERKI_V2_DRIVE_OAUTH_JSON from the clipboard right after the PowerShell validator (previous run 41527407691: stage=oauth_config(len=35), the secret held only the client secret). Same workflow, no other change.
Drive folder init 2026-11-02T21:46:40Z: run 41531057792 passed OAuth (new JSON secret works) but stopped at stage=folder, HTTP_404. Root cause: the drive.file scope only reaches folders created by this OAuth app; 1EE2ioPs… was created by another client (see BACKUP-V2-DRIVE-HU.md). One-time [backup-v2-drive-init] job creates or reuses the owner-only folder 'Sarberki V2 mentes'; no export, no database access.
Drive full proof 2026-11-02T21:47:47Z: app folder 19WOxZQK6M-kqou3OU43084bZce9Dnhyg created by run 41531436566 (owner-only ACL PASS) and pinned in code and workflow (the old repository variable is no longer read). Same export, restore, upload, exact-ID readback and Drive-download restore.

## Owner-requested Drive durability proof (manual, not the daily automation)
Requested at: 2026-11-03 (Europe/Vienna), after the owner published the "Sarberki Drive Backup" OAuth app to production (Google Auth Platform: In production) and stored a NEW drive.file refresh token in SARBERKI_V2_DRIVE_OAUTH_JSON (same client, client secret unchanged by owner decision).
Request ID: drive-durable-token-proof-20261103.
Provider: drive (vars.SARBERKI_V2_STORAGE_PROVIDER), same workflow, folder 19WOxZQK… (app-created, owner-only).
Purpose: prove the new token end to end (preflight, export, isolated restore, Drive upload, exact-ID readback, restore from the Drive bytes). Token durability beyond 7 days is only proven by a later run after 2026-11-10.
No production, Netlify, booking, Previo or source DB change.

## Owner-authorized TEST approval-rule pre-install backup (not daily automation)
Requested at: 2026-11-04T05:01:54.271Z.
Source project: mojnqizbcaczstguikpv (sarberki-test).
Source code: eb5687ce46806e492b59522b24e728b76d5fe802.
Purpose: fresh verified encrypted Drive backup and isolated restore before owner-authorized deployment/test-mailbox/install.sql and reader membership restoration. No source changes until backup succeeds; no Netlify deployment.
Provider: drive. Request marker: [backup-v2-run].

## Owner-authorized TEST price RPC pre-install backup
Requested at: 2026-11-04T05:34:11.415Z.
Source project: mojnqizbcaczstguikpv (sarberki-test).
Authorized SQL: 123f3c6f1a24689198d72df83f3d6acceea4d667 deployment/test-mailbox/install.sql.
Purpose: fresh encrypted Drive backup, exact-ID readback and isolated restore before deployment. Provider: drive. No DB changes until verified success. No Netlify deployment.
