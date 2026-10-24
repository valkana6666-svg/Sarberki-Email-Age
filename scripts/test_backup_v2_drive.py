import importlib.util,unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('drive',Path(__file__).with_name('backup-v2-drive.py'))
drive=importlib.util.module_from_spec(spec);spec.loader.exec_module(drive)
class DriveSafety(unittest.TestCase):
    def good(self):
        return dict(id=drive.FOLDER_ID,mimeType='application/vnd.google-apps.folder',permissions=[
            dict(type='user',role='owner',emailAddress=drive.OWNER)])
    def test_owner_only_folder(self):drive.validate_folder(self.good(),drive.FOLDER_ID)
    def test_wrong_target(self):
        with self.assertRaises(ValueError):drive.validate_folder(self.good(),'other-folder')
    def test_public_rejected(self):
        m=self.good();m['permissions'].append(dict(type='anyone',role='reader'))
        with self.assertRaises(ValueError):drive.validate_folder(m,drive.FOLDER_ID)
    def test_other_user_rejected(self):
        m=self.good();m['permissions'].append(dict(type='user',role='writer',emailAddress='synthetic@example.invalid'))
        with self.assertRaises(ValueError):drive.validate_folder(m,drive.FOLDER_ID)
    def test_missing_acl_rejected(self):
        m=self.good();m.pop('permissions')
        with self.assertRaises(ValueError):drive.validate_folder(m,drive.FOLDER_ID)
    def test_full_quota_rejected(self):
        with self.assertRaises(ValueError):drive.validate_quota(dict(limit='100',usage='100'),1)
    def test_unknown_quota_rejected(self):
        with self.assertRaises(ValueError):drive.validate_quota({},1)
    def test_sufficient_quota(self):drive.validate_quota(dict(limit=str(1024**3),usage='0'),1000)
    def test_broad_oauth_rejected(self):
        import json
        with patch.object(drive,'request',return_value=json.dumps(dict(access_token='synthetic',scope='https://www.googleapis.com/auth/drive')).encode()):
            with self.assertRaises(ValueError):drive.access_token(json.dumps(dict(client_id='synthetic',client_secret='synthetic',refresh_token='synthetic')))
    def test_corrupt_readback_rejected(self):
        with patch.object(drive,'request',side_effect=[b'{"id":"synthetic_id"}',b'corrupt']):
            with self.assertRaises(ValueError):drive.upload('synthetic',drive.FOLDER_ID,'synthetic.zip',b'correct')
if __name__=='__main__':unittest.main()
