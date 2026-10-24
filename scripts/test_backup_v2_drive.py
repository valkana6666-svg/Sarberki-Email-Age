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
    def test_additional_oauth_scopes_rejected(self):
        import json
        config=json.dumps(dict(client_id='synthetic',client_secret='synthetic',refresh_token='synthetic'))
        for scope in (drive.SCOPE+' https://www.googleapis.com/auth/gmail.readonly', '', drive.SCOPE+' openid'):
            with self.subTest(scope=scope), patch.object(drive,'request',return_value=json.dumps(dict(access_token='synthetic',scope=scope)).encode()):
                with self.assertRaises(ValueError):drive.access_token(config)
    def test_missing_or_empty_access_token_rejected(self):
        import json
        config=json.dumps(dict(client_id='synthetic',client_secret='synthetic',refresh_token='synthetic'))
        for token in (None, '', ' ', 123):
            with self.subTest(token=token), patch.object(drive,'request',return_value=json.dumps(dict(access_token=token,scope=drive.SCOPE)).encode()):
                with self.assertRaises(ValueError):drive.access_token(config)
    def test_exact_scope_token_accepted(self):
        import json
        config=json.dumps(dict(client_id='synthetic',client_secret='synthetic',refresh_token='synthetic'))
        with patch.object(drive,'request',return_value=json.dumps(dict(access_token='synthetic',scope=drive.SCOPE)).encode()):
            self.assertEqual(drive.access_token(config),'synthetic')
    def test_large_resumable_upload(self):
        import json
        data=b'x'*(5*1024*1024+1)
        session='https://www.googleapis.com/upload/drive/v3/files?upload_id=synthetic'
        with patch.object(drive,'request',side_effect=[(b'',{'Location':session}),b'{"id":"synthetic_large"}',data]) as req:
            result=drive.upload('synthetic',drive.FOLDER_ID,'synthetic.zip',data)
            self.assertEqual(result['exact_id_readback'],'PASS')
            self.assertEqual(req.call_args_list[1].kwargs['method'],'PUT')
    def test_unapproved_resumable_endpoint(self):
        with patch.object(drive,'request',return_value=(b'',{'Location':'https://example.invalid/upload'})):
            with self.assertRaises(ValueError):drive.upload('synthetic',drive.FOLDER_ID,'synthetic.zip',b'x'*(5*1024*1024+1))
if __name__=='__main__':unittest.main()
