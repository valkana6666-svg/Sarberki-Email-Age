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
