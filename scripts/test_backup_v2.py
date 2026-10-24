import importlib.util,unittest
from pathlib import Path
from unittest.mock import patch
def load(name):
    s=importlib.util.spec_from_file_location(name,Path(__file__).with_name(name+'.py'))
    m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
runner=load('backup-v2');storage=load('backup-v2-storage')
class Safety(unittest.TestCase):
    def good(self):
        return {'GITHUB_REPOSITORY':'valkana6666-svg/Sarberki-Email-Age','GITHUB_REF':runner.BRANCH,
            'SARBERKI_V2_ENABLED':'yes','SARBERKI_V2_PASSPHRASE':'synthetic-only-'+'x'*40,
            'SARBERKI_BACKUP_DB_URL':'synthetic-fixture','SARBERKI_V2_BUCKET':'synthetic-private-bucket'}
    def test_configuration_failure_has_exact_nonsecret_code(self):
        self.assertEqual(runner.safe_failure(ValueError('NEW_PROTECTED_PASSPHRASE_REQUIRED')), 'NEW_PROTECTED_PASSPHRASE_REQUIRED')
    def test_untrusted_exception_or_secret_never_becomes_diagnostic(self):
        for exc in [ValueError('synthetic-secret-value'), ValueError('NEW_PROTECTED_PASSPHRASE_REQUIRED synthetic-secret'), RuntimeError('V2_NOT_ENABLED')]:
            self.assertEqual(runner.safe_failure(exc), 'UPSTREAM_OPERATION_FAILED')
    def test_valid_isolated_identity(self):self.assertTrue(runner.validate(self.good()))
    def test_other_branches_and_main_rejected(self):
        for ref in ['refs/heads/main','refs/heads/backup/issue-6-cloud-recovery','refs/heads/unapproved']:
            v=self.good();v['GITHUB_REF']=ref
            with self.assertRaises(ValueError):runner.validate(v)
    def test_disabled_rejected(self):
        v=self.good();v['SARBERKI_V2_ENABLED']='no'
        with self.assertRaises(ValueError):runner.validate(v)
    def test_new_secret_required(self):
        v=self.good();v['SARBERKI_V2_PASSPHRASE']=''
        with self.assertRaises(ValueError):runner.validate(v)
    def test_durable_target_required(self):
        v=self.good();v['SARBERKI_V2_BUCKET']=''
        with self.assertRaises(ValueError):runner.validate(v)
    def test_unversioned_bucket_rejected(self):
        with patch.object(storage,'aws',return_value={}):
            with self.assertRaises(ValueError):storage.validate_bucket('synthetic-bucket')
    def test_public_bucket_rejected(self):
        with patch.object(storage,'aws',side_effect=[{'Status':'Enabled'},{}]):
            with self.assertRaises(ValueError):storage.validate_bucket('synthetic-bucket')
    def test_private_versioned_bucket(self):
        block=dict.fromkeys(['BlockPublicAcls','IgnorePublicAcls','BlockPublicPolicy','RestrictPublicBuckets'],True)
        with patch.object(storage,'aws',side_effect=[{'Status':'Enabled'},{'PublicAccessBlockConfiguration':block}]):
            storage.validate_bucket('synthetic-bucket')
if __name__=='__main__':unittest.main()
