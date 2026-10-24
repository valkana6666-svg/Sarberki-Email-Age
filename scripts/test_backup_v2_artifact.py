import datetime as dt
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import socket
import unittest


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name+'.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


artifact = load('backup-v2-artifact')
restore = load('backup-v2-restore')
runner = load('backup-v2')


class ArtifactBoundary(unittest.TestCase):
    def setUp(self):
        self.now = dt.datetime(2026, 10, 24, tzinfo=dt.timezone.utc)
        self.values = dict(GITHUB_REPOSITORY=artifact.REPO,
            GITHUB_REF='refs/heads/'+artifact.BRANCH, GITHUB_SHA='a'*40,
            GITHUB_RUN_ID='123', GITHUB_RUN_ATTEMPT='1', SARBERKI_STAGE_ARTIFACT_ID='456')
        self.meta = dict(id=456, name='sarberki-cloud-stage-123-1', expired=False,
            expires_at='2027-01-22T00:00:00Z', workflow_run=dict(id=123, head_sha='a'*40, head_branch=artifact.BRANCH))

    def test_exact_identity_and_actual_retention(self):
        self.assertIn('2027-01-22', artifact.validate_metadata(self.meta, self.values, self.now))

    def test_other_artifact_rejected(self):
        self.meta['id'] = 457
        with self.assertRaises(ValueError): artifact.validate_metadata(self.meta, self.values, self.now)

    def test_wrong_run_rejected(self):
        self.meta['workflow_run']['id'] = 122
        with self.assertRaises(ValueError): artifact.validate_metadata(self.meta, self.values, self.now)

    def test_wrong_commit_rejected(self):
        self.meta['workflow_run']['head_sha'] = 'b'*40
        with self.assertRaises(ValueError): artifact.validate_metadata(self.meta, self.values, self.now)

    def test_main_rejected(self):
        self.values['GITHUB_REF'] = 'refs/heads/main'
        with self.assertRaises(ValueError): artifact.validate_metadata(self.meta, self.values, self.now)

    def test_expired_rejected(self):
        self.meta['expired'] = True
        with self.assertRaises(ValueError): artifact.validate_metadata(self.meta, self.values, self.now)

    def test_short_actual_retention_rejected(self):
        self.meta['expires_at'] = '2026-10-31T00:00:00Z'
        with self.assertRaises(ValueError): artifact.validate_metadata(self.meta, self.values, self.now)

    def fixture(self, root):
        original = root/'original'; original.mkdir()
        remote = root/'download'; remote.mkdir()
        data = b'synthetic encrypted package placeholder'
        digest = hashlib.sha256(data).hexdigest()
        sums = (digest+'  sarberki-recovery.zip.gpg\n').encode()
        (original/'sarberki-recovery.zip.gpg.sha256').write_bytes(sums)
        (remote/'sarberki-recovery.zip.gpg').write_bytes(data)
        (remote/'sarberki-recovery.zip.gpg.sha256').write_bytes(sums)
        return original, remote, digest

    def test_remote_download_matches_uploaded_checksum(self):
        with tempfile.TemporaryDirectory() as d:
            original, remote, digest = self.fixture(Path(d))
            self.assertEqual(artifact.verify_files(original, remote), digest)

    def test_changed_remote_and_sidecar_rejected_against_upload(self):
        with tempfile.TemporaryDirectory() as d:
            original, remote, _ = self.fixture(Path(d))
            (remote/'sarberki-recovery.zip.gpg').write_bytes(b'altered')
            h = hashlib.sha256(b'altered').hexdigest()
            (remote/'sarberki-recovery.zip.gpg.sha256').write_text(h+'  sarberki-recovery.zip.gpg\n')
            with self.assertRaises(ValueError): artifact.verify_files(original, remote)

    def test_download_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            original, remote, _ = self.fixture(Path(d))
            (remote/'sarberki-recovery.zip.gpg').unlink()
            (remote/'sarberki-recovery.zip.gpg').symlink_to(original/'sarberki-recovery.zip.gpg.sha256')
            with self.assertRaises(ValueError): artifact.verify_files(original, remote)

    def test_real_gpg_whole_package_and_wrong_key_rejection(self):
        # This local executor can prohibit Unix sockets; GitHub Ubuntu must run the real GPG test.
        with tempfile.TemporaryDirectory() as probe:
            try:
                with socket.socket(socket.AF_UNIX) as sock:
                    sock.bind(str(Path(probe)/'agent.sock'))
            except PermissionError:
                self.skipTest('Executor prohibits Unix sockets required by gpg-agent; CI must verify real GPG')
        phrase = 'synthetic-envelope-fixture-'+'q'*32
        with tempfile.TemporaryDirectory() as d:
            directory = Path(d)
            data = b'synthetic project files and encrypted database package'
            (directory/'sarberki-recovery.zip').write_bytes(data)
            artifact.seal(directory, phrase)
            cipher = (directory/'sarberki-recovery.zip.gpg').read_bytes()
            self.assertNotIn(data, cipher)
            self.assertEqual(artifact.crypt(cipher, phrase, decrypt=True), data)
            with self.assertRaises(RuntimeError):
                artifact.crypt(cipher, 'wrong-synthetic-envelope-key-'+'z'*32, decrypt=True)

    def test_cloud_restore_fixed_directory_and_new_secret_required(self):
        self.assertEqual(restore.REMOTE_MODES['github-readback-v1'][0], Path('/tmp/sarberki-v2-github-input'))
        values = dict(self.values, SARBERKI_V2_ENABLED='yes', SARBERKI_V2_STORAGE_PROVIDER='github-bridge', SARBERKI_BACKUP_DB_URL='synthetic')
        with self.assertRaises(ValueError): runner.validate(values)
        values['SARBERKI_V2_PASSPHRASE'] = 'synthetic-only-'+'x'*40
        self.assertEqual(runner.validate(values), values['SARBERKI_V2_PASSPHRASE'])


if __name__ == '__main__':
    unittest.main()
