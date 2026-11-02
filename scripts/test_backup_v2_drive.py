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
    def test_verified_copy_saves_remote_response(self):
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            copy=Path(directory)/'remote.zip'
            with patch.object(drive,'request',side_effect=[b'{"id":"synthetic_id"}',b'remote']):
                drive.upload('synthetic',drive.FOLDER_ID,'synthetic.zip',b'remote',copy)
            self.assertEqual(copy.read_bytes(),b'remote')
            self.assertEqual(copy.stat().st_mode & 0o777,0o600)
    def test_failed_readback_never_saved(self):
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            copy=Path(directory)/'remote.zip'
            with patch.object(drive,'request',side_effect=[b'{"id":"synthetic_id"}',b'corrupt']):
                with self.assertRaises(ValueError):drive.upload('synthetic',drive.FOLDER_ID,'synthetic.zip',b'correct',copy)
            self.assertFalse(copy.exists())
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
class DriveDiagnostics(unittest.TestCase):
    def test_failure_code_is_fixed_and_secret_free(self):
        import urllib.error,io
        self.assertEqual(drive.failure_code(ValueError('UNAPPROVED_FOLDER')),'UNAPPROVED_FOLDER')
        self.assertEqual(drive.failure_code(urllib.error.HTTPError('https://www.googleapis.com/x',404,'secret-body',{},io.BytesIO(b'secret'))),'HTTP_404')
        self.assertEqual(drive.failure_code(ValueError('token=ya29.secret-value')),'UNEXPECTED_ValueError')
        self.assertEqual(drive.failure_code(KeyError('refresh_token')),'UNEXPECTED_KeyError')
    def test_blocked_line_names_stage_but_no_secret(self):
        import io,json,os,sys,contextlib
        env={'SARBERKI_V2_DRIVE_FOLDER_ID':drive.FOLDER_ID,'SARBERKI_V2_DRIVE_OAUTH_JSON':json.dumps(dict(client_id='cid-secret',client_secret='GOCSPX-secret',refresh_token='1//secret'))}
        err=io.StringIO()
        with patch.dict(os.environ,env),patch.object(sys,'argv',['backup-v2-drive.py','preflight']),patch.object(drive,'request',side_effect=ValueError('NARROW_DRIVE_FILE_SCOPE_REQUIRED')),contextlib.redirect_stderr(err):
            with self.assertRaises(SystemExit):
                try:drive.main()
                except Exception as e:
                    print('BLOCKED (stage='+drive.STAGE+', code='+drive.failure_code(e)+')',file=sys.stderr);sys.exit(1)
        out=err.getvalue()
        self.assertIn('stage=oauth_token',out);self.assertIn('NARROW_DRIVE_FILE_SCOPE_REQUIRED',out)
        for secret in ('cid-secret','GOCSPX-secret','1//secret'):self.assertNotIn(secret,out)
if __name__=='__main__':unittest.main()
