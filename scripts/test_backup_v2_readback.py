import hashlib
import importlib.util
import json
from pathlib import Path
import stat
import tempfile
import unittest
import warnings
import zipfile
from unittest.mock import patch


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name+'.py'))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


reader = load('backup-v2-readback')
restore = load('backup-v2-restore')


class ReadbackBoundary(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.zip = self.root/'sarberki-recovery.zip'
        self.receipt = self.root/'receipt.json'
        self.dest = self.root/'input'
        self.values = dict(GITHUB_REPOSITORY='valkana6666-svg/Sarberki-Email-Age',
            GITHUB_REF='refs/heads/gmail-test-subject-allowlist', GITHUB_SHA='a'*40,
            GITHUB_RUN_ID='123', GITHUB_RUN_ATTEMPT='1')
        self.data = {name: b'synthetic ciphertext' for name in reader.MEMBERS}
        self.data['evidence/ISOLATED-RESTORE.json'] = json.dumps(dict(full_restore='PASS',verification_completed=True)).encode()
        self.data['database/PROVENANCE.json'] = json.dumps(dict(project='mojnqizbcaczstguikpv',
            source_commit='a'*40,run_id='123',source_read_only=True)).encode()

    def build(self, extra=None):
        with zipfile.ZipFile(self.zip,'w') as archive:
            for name, data in self.data.items():
                archive.writestr(name,data)
            if extra:
                with warnings.catch_warnings():
                    warnings.simplefilter('ignore', UserWarning)
                    archive.writestr(*extra)
        self.sign()

    def sign(self):
        digest = hashlib.sha256(self.zip.read_bytes()).hexdigest()
        sidecar = self.zip.with_suffix('.zip.sha256')
        sidecar.write_text(digest+'  sarberki-recovery.zip\n')
        prefix='sarberki-123-1-'+'a'*40
        objects=[]
        for index,p in enumerate((self.zip,sidecar)):
            objects.append(dict(name=prefix+('.zip' if index==0 else '.zip.sha256'),
                file_id='synthetic_'+str(index),exact_id_readback='PASS',bytes=p.stat().st_size,
                sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
        self.receipt.write_text(json.dumps(dict(provider='google-drive',folder_id=reader.FOLDER,objects=objects)))

    def verify(self):
        return reader.validate_and_extract(self.zip,self.receipt,self.dest,self.values)

    def rejected(self):
        with self.assertRaises((ValueError, RuntimeError)):
            self.verify()
        self.assertFalse(self.dest.exists())

    def test_only_database_ciphertexts_extracted_from_download(self):
        self.build()
        evidence=self.verify()
        self.assertEqual(evidence['input_source'],'exact_id_download')
        self.assertEqual(evidence['sql_restore'],'NOT_YET_RUN')
        self.assertEqual({p.name for p in self.dest.iterdir()},reader.DATABASE)
        self.assertFalse((self.dest/'source.bundle').exists())
        self.assertEqual((self.dest/'database.dump.gpg').read_bytes(),b'synthetic ciphertext')

    def test_corrupt_remote_zip_rejected(self):
        self.build();self.zip.write_bytes(self.zip.read_bytes()+b'corrupt');self.rejected()

    def test_corrupt_remote_checksum_rejected(self):
        self.build();self.zip.with_suffix('.zip.sha256').write_text('corrupt');self.rejected()

    def test_traversal_rejected(self):
        self.build(('../outside',b'synthetic'));self.rejected()

    def test_duplicate_member_rejected(self):
        self.build(('database/database.dump.gpg',b'synthetic'));self.rejected()

    def test_symlink_rejected(self):
        del self.data['source.bundle']
        member=zipfile.ZipInfo('source.bundle');member.create_system=3
        member.external_attr=(stat.S_IFLNK|0o777)<<16
        self.build((member,b'/outside'));self.rejected()

    def test_missing_ciphertext_rejected(self):
        del self.data['database/database.dump.gpg'];self.build();self.rejected()

    def test_wrong_commit_rejected(self):
        self.build();self.values['GITHUB_SHA']='b'*40;self.rejected()

    def test_unverified_preupload_proof_rejected(self):
        self.data['evidence/ISOLATED-RESTORE.json']=b'{"full_restore":"PASS","verification_completed":false}'
        self.build();self.rejected()

    def test_wrong_source_project_rejected(self):
        self.data['database/PROVENANCE.json']=json.dumps(dict(project='other',source_commit='a'*40,run_id='123',source_read_only=True)).encode()
        self.build();self.rejected()

    def test_wrong_folder_rejected(self):
        self.build();meta=json.loads(self.receipt.read_text());meta['folder_id']='other'
        self.receipt.write_text(json.dumps(meta));self.rejected()

    def test_unverified_readback_rejected(self):
        self.build();meta=json.loads(self.receipt.read_text());meta['objects'][0]['exact_id_readback']='FAILED'
        self.receipt.write_text(json.dumps(meta));self.rejected()

    def test_download_mode_uses_current_identity(self):
        values=dict(self.values,SARBERKI_RESTORE_INPUT='drive-readback-v1')
        identity,pins=restore.restore_input_identity('drive-readback-v1',values)
        self.assertIs(identity,values);self.assertIsNone(pins)
        with self.assertRaises(RuntimeError):restore.fresh_identity(restore.FRESH_DIRECTORY,values)

    def test_pinned_drive_relay_uses_snapshot_identity(self):
        identity, pins = restore.restore_input_identity('drive-relay-40466496030', self.values)
        self.assertEqual(identity['GITHUB_RUN_ID'], '40466496030')
        self.assertEqual(identity['GITHUB_SHA'], '2ca4f322eaa2878c2b62164a4b6d7fc50c4b0e67')
        self.assertIsNone(pins)
        self.assertEqual(restore.REMOTE_MODES['drive-relay-40466496030'][2], 'exact_id_drive_download_via_ciphertext_relay')

    def test_dynamic_drive_relay_snapshot_identity(self):
        selection = dict(relay_blob_sha='a'*40, sha256='b'*64, bytes=123,
                         file_id='synthetic-drive-id', snapshot_commit='c'*40, snapshot_run='12345')
        values = dict(self.values, SARBERKI_DRIVE_RESTORE_SELECTION=json.dumps(selection))
        identity, pins = restore.restore_input_identity('drive-relay-v1', values)
        self.assertEqual(identity['GITHUB_SHA'], 'c'*40)
        self.assertEqual(identity['GITHUB_RUN_ID'], '12345')
        self.assertIsNone(pins)
        values['SARBERKI_DRIVE_RESTORE_SELECTION'] = '{}'
        with self.assertRaisesRegex(ValueError, 'RESTORE_SELECTION_INVALID'):
            restore.restore_input_identity('drive-relay-v1', values)

    def test_expansion_limit_rejected(self):
        self.build()
        # ZIP size passes, but declared total expansion exceeds the bound.
        with zipfile.ZipFile(self.zip, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name, data in self.data.items():
                archive.writestr(name, b'x'*20000 if name=='source.bundle' else data)
        self.sign()
        with patch.object(reader,'LIMIT',10000):self.rejected()

    def test_wrong_branch_rejected(self):
        self.build();self.values['GITHUB_REF']='refs/heads/main';self.rejected()


if __name__=='__main__':
    unittest.main()
