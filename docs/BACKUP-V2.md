# Issue #6: isolated cloud backup V2

The existing backup implementation from PR #7 is integrated into the owner-authorized gmail-test-subject-allowlist branch. The original backup branch is unchanged. Main, production and source DB remain unchanged.

## Execution

Backup-only pushes run targeted synthetic safety tests. Export requires SARBERKI_V2_ENABLED=yes plus workflow_dispatch export=true or a commit on the authorized test branch containing [backup-v2-run]. Export reuses the existing read-only PostgreSQL 17 code, pinned test project/TLS CA, stable manifest and full archive checks. The new secret SARBERKI_BACKUP_V2_PASSPHRASE is mandatory; no old-password fallback. Existing secrets/archives are not overwritten.

A separate restore entry point preserves the existing algorithm and changes only its approved branch identity. The disposable destination uses the previously verified pinned Vault source commit. Packaging requires full_restore=PASS and verification_completed=true. Public source history, ciphertext, evidence and explicit platform gaps are packaged.

## Existing approved private S3 storage

No bucket, subscription, lifecycle or public URL is created. Owner approval of target and costs is required. Upload rejects disabled versioning or missing public access blocks. It records VersionId and downloads the exact uploaded version for SHA256 readback. GPG ciphertext also receives server-side AES256. No delete permission is needed. Retention/lifecycle, owner recovery and independent account failure domain remain owner-verified requirements.

Secrets: existing SARBERKI_BACKUP_DB_URL; NEW SARBERKI_BACKUP_V2_PASSPHRASE (32–1024 characters, owner recovery copy); SARBERKI_V2_STORAGE_ACCESS_KEY_ID and SARBERKI_V2_STORAGE_SECRET_ACCESS_KEY.
Variables: SARBERKI_V2_BUCKET, SARBERKI_V2_STORAGE_REGION, SARBERKI_V2_ENABLED.
Values belong only in provider Secrets UI, never issues/PR/chat.

## Daily scheduling and notification: NOT ACTIVATED

GitHub schedule normally uses default branch. No misleading schedule is added here and application main remains untouched. An approved external scheduler must dispatch this workflow against the authorized test branch and verify acceptance. If default-branch dispatch restrictions prevent that, use a separately approved private backup-control repository. No scheduler or new paid service is activated implicitly.

Implemented GitHub job summary is UI reporting, not immediate independent notification or expiry monitoring. Daily execution and a freshness monitor require an actual cloud run before PASS. No email/Pushover delivery is used as proof.

## Recovery gates

Historical source/hash/archive evidence remains valid only for its original snapshots. New owner-key recovery, V2 DB export/restore/storage readback, full hosted Auth/RLS/Edge/Vault configuration, Storage binaries, Netlify contexts/secrets, provider reconnection, HTTPS service E2E, restart durability, daily freshness and independent owner copies require actual evidence. Full SQL proof is not full platform recovery.

Code/test ZIP is an implementation package, not a fresh database backup. The owner only needs one-time provider access/secret setup; no PowerShell operation is requested.

## 2026-10-24 integration evidence

Implementation integrated at 92fa6ba5e0c6f4b7ae574dd97820a8ed70cbfe4b, preserving both Gmail commits on the test branch. Local targeted suite: 23 PASS, 0 FAIL. Python syntax and workflow YAML parsing passed. The integration commit skipped CI to avoid a full unrelated application regression after changing workflow path filters. This documentation-only follow-up triggers only the backup safety workflow. Cloud export/restore remains disabled; missing OAuth and new passphrase secrets were confirmed in GitHub UI. No live backup or owner key recovery is claimed.

## Exact-ID Drive download recovery acceptance

Drive uploads now save the remote GET response after SHA256 equality. The new `backup-v2-readback.py` validates the downloaded ZIP and checksum against the exact-ID receipt, allowlists archive members, caps expansion, rejects links/duplicates/traversal, and binds provenance to the current test-branch run. It extracts only the six database payloads into a new protected directory.

A second isolated SQL restore consumes this downloaded input with no source DB credentials. Its sanitized evidence is retained separately at `drive-restore-evidence/ISOLATED-RESTORE.json` in the delivery artifact; it records the Drive ID/hash and does not claim SQL PASS before verification. Preupload SQL verification remains an upload safety gate. Thirty-two affected local synthetic tests pass (17 Drive, 15 readback). This is implementation evidence only; OAuth rotation, secrets, owner key custody, a live full-chain run and scheduling remain blocked/unverified. Public OAuth-page drafts are in BACKUP-V2-PUBLIC-PAGES.md; no URL or compliance claim is invented.
