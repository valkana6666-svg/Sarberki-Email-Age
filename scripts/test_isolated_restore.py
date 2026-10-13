"""Offline restore boundary tests: no credentials, database commands or network."""
import hashlib
import importlib.util
import json
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('isolated_restore', Path(__file__).with_name('verify-isolated-restore.py'))
restore = importlib.util.module_from_spec(spec)
spec.loader.exec_module(restore)


class RestoreBoundarySafety(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name)
        self.values = {'GITHUB_SHA': 'a' * 40, 'GITHUB_RUN_ID': '12345',
                       'GITHUB_REF': 'refs/heads/gmail-test-subject-allowlist',
                       'GITHUB_REPOSITORY': 'valkana6666-svg/Sarberki-Email-Age'}
        self.provenance = {'source_commit': self.values['GITHUB_SHA'], 'run_id': '12345',
                           'project': restore.cloud.owner.PROJECT, 'source_read_only': True}
        self.ciphertexts = {name: ('synthetic encrypted fixture: ' + name).encode()
                            for name in restore.CIPHERTEXT_NAMES}
        for name, data in self.ciphertexts.items():
            (self.directory / name).write_bytes(data)
        (self.directory / 'SHA256SUMS.txt').write_text(''.join(
            hashlib.sha256(data).hexdigest() + '  ' + name + '\n'
            for name, data in self.ciphertexts.items()))
        (self.directory / 'STATUS.txt').write_text(
            'Source: ' + restore.cloud.owner.PROJECT + '; source connection read-only.\n'
            'Ciphertext decryption/readback: VERIFIED (AES256 symmetric).\n')
        self.write_provenance()
        self.pinned = patch.object(restore, 'FRESH_DIRECTORY', self.directory)
        self.pinned.start()
        self.addCleanup(self.pinned.stop)

    def write_provenance(self):
        (self.directory / 'PROVENANCE.json').write_text(json.dumps(self.provenance))

    def identity(self):
        return restore.fresh_identity(self.directory, self.values)

    def test_same_job_identity_and_exact_ciphertexts(self):
        expected, provenance = self.identity()
        self.assertEqual(restore.read_ciphertexts(self.directory, expected), self.ciphertexts)
        self.assertEqual(provenance, self.provenance)
        self.assertEqual(set(expected), set(restore.CIPHERTEXT_NAMES))

    def test_ciphertext_changed_after_manifest_is_rejected(self):
        expected, _ = self.identity()
        (self.directory / 'database.dump.gpg').write_bytes(b'altered')
        with self.assertRaisesRegex(RuntimeError, 'SNAPSHOT_IDENTITY_FAILED'):
            restore.read_ciphertexts(self.directory, expected)

    def test_wrong_project_commit_run_or_read_only_is_rejected(self):
        for field, value in [('project', 'another-project'), ('source_commit', 'b' * 40),
                             ('run_id', '12346'), ('source_read_only', False)]:
            with self.subTest(field=field):
                original = self.provenance[field]
                self.provenance[field] = value
                self.write_provenance()
                with self.assertRaisesRegex(RuntimeError, 'FRESH_PROVENANCE_INVALID'):
                    self.identity()
                self.provenance[field] = original

    def test_other_ref_or_repository_is_rejected(self):
        for field, value in [('GITHUB_REF', 'refs/heads/unapproved-branch'),
                             ('GITHUB_REPOSITORY', 'another/repository')]:
            with self.subTest(field=field):
                with patch.dict(self.values, {field: value}):
                    with self.assertRaisesRegex(RuntimeError, 'FRESH_PROVENANCE_INVALID'):
                        self.identity()

    def test_checksum_missing_duplicate_or_traversal_is_rejected(self):
        path = self.directory / 'SHA256SUMS.txt'
        original = path.read_text()
        for content in [original.splitlines()[0] + '\n', original + original.splitlines()[0] + '\n',
                        original.replace('database.dump.gpg', '../database.dump.gpg')]:
            with self.subTest(content=content):
                path.write_text(content)
                with self.assertRaisesRegex(RuntimeError, 'FRESH_CHECKSUM_MANIFEST_INVALID'):
                    self.identity()

    def test_plaintext_extra_missing_and_symlink_files_are_rejected(self):
        extra = self.directory / 'plaintext.dump'
        extra.write_bytes(b'synthetic')
        with self.assertRaisesRegex(RuntimeError, 'FRESH_FILES_INVALID'):
            self.identity()
        extra.unlink()
        path = self.directory / 'database.dump.gpg'
        data = path.read_bytes()
        path.unlink()
        with self.assertRaisesRegex(RuntimeError, 'FRESH_FILES_INVALID'):
            self.identity()
        external = self.directory.parent / (self.directory.name + '-synthetic.gpg')
        self.addCleanup(external.unlink, missing_ok=True)
        external.write_bytes(data)
        path.symlink_to(external)
        with self.assertRaisesRegex(RuntimeError, 'FRESH_FILES_INVALID'):
            self.identity()

    def test_arbitrary_directory_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'FRESH_DIRECTORY_INVALID'):
            restore.fresh_identity(self.directory.parent, self.values)

    def test_unverified_encryption_status_is_rejected(self):
        (self.directory / 'STATUS.txt').write_text('Decryption/readback NOT VERIFIED\n')
        with self.assertRaisesRegex(RuntimeError, 'FRESH_EXPORT_STATUS_INVALID'):
            self.identity()

    def test_only_disposable_destination_without_source_credentials_is_accepted(self):
        values = {'PGHOST': 'postgres', 'PGUSER': 'restore_admin', 'PGDATABASE': 'postgres',
                  'PGPASSWORD': 'ephemeral-isolated-test-only'}
        restore.validate_destination(values)
        restore.validate_destination(dict(values, PG_MAJOR='17', PG_VERSION='17.11-1.pgdg12+2',
                                         PGDATA='/var/lib/postgresql/data'))
        for field, value in [('PGHOST', 'remote.invalid'), ('PGUSER', 'postgres'),
                             ('PGDATABASE', 'source-db'), ('PGPORT', '6543'),
                             ('PGPASSWORD', 'other'), ('PGSERVICE', 'source'),
                             ('PGSERVICEFILE', '/tmp/source'), ('PGHOSTADDR', '192.0.2.1'),
                             ('PGOPTIONS', '-c search_path=foreign'), ('PGSSLMODE', 'disable'),
                             ('PGPASSFILE', '/tmp/source'), ('PGDATABASE_EXTRA', 'source'),
                             ('SARBERKI_BACKUP_DB_URL', 'synthetic-source-uri')]:
            with self.subTest(field=field):
                with self.assertRaisesRegex(RuntimeError, 'DESTINATION_NOT_ISOLATED'):
                    restore.validate_destination(dict(values, **{field: value}))

    def test_pinned_previous_snapshot_remains_distinct(self):
        self.assertEqual(len(restore.PINNED_HASHES), 3)
        with self.assertRaisesRegex(RuntimeError, 'SNAPSHOT_IDENTITY_FAILED'):
            restore.read_ciphertexts(self.directory, restore.PINNED_HASHES)


if __name__ == '__main__':
    unittest.main()
