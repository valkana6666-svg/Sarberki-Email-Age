import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent
def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT/(name+'.py'))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod

stage = load('drive-stage-40466496030')
restore = load('backup-v2-restore')

class StageBoundary(unittest.TestCase):
    def test_restoration_uses_pinned_original_snapshot_not_workflow_commit(self):
        values = {'GITHUB_SHA':'a'*40, 'GITHUB_RUN_ID':'9'}
        identity, pins = restore.restore_input_identity('drive-stage-40466496030', values)
        self.assertEqual(identity['GITHUB_SHA'], '2ca4f322eaa2878c2b62164a4b6d7fc50c4b0e67')
        self.assertEqual(identity['GITHUB_RUN_ID'], '40466496030')
        self.assertEqual(values['GITHUB_RUN_ID'], '9')
        self.assertIsNone(pins)

    def test_bad_branch_and_source_credentials_fail_closed(self):
        with patch.dict(stage.os.environ, {'GITHUB_REPOSITORY':'valkana6666-svg/Sarberki-Email-Age', 'GITHUB_REF':'refs/heads/main'}, clear=True):
            with self.assertRaisesRegex(ValueError, 'EXECUTION_IDENTITY'): stage.main()
        with patch.dict(stage.os.environ, {'GITHUB_REPOSITORY':'valkana6666-svg/Sarberki-Email-Age', 'GITHUB_REF':'refs/heads/gmail-test-subject-allowlist', 'SARBERKI_BACKUP_DB_URL':'forbidden'}, clear=True):
            with self.assertRaisesRegex(ValueError, 'SOURCE_CREDENTIALS_FORBIDDEN'): stage.main()

    def test_missing_drive_secret_fails_without_remote_or_key_access(self):
        with patch.dict(stage.os.environ, {'GITHUB_REPOSITORY':'valkana6666-svg/Sarberki-Email-Age', 'GITHUB_REF':'refs/heads/gmail-test-subject-allowlist'}, clear=True):
            with self.assertRaisesRegex(ValueError, 'DRIVE_OAUTH_SECRET_UNAVAILABLE'): stage.main()

if __name__ == '__main__': unittest.main()
