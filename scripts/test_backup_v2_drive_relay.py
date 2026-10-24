import hashlib
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('relay',Path(__file__).with_name('backup-v2-drive-relay.py'))
relay=importlib.util.module_from_spec(spec);spec.loader.exec_module(relay)

class DriveRelayBoundary(unittest.TestCase):
    def setUp(self):
        self.data=b'synthetic encrypted Drive response'
        self.blob=hashlib.sha1(b'blob '+str(len(self.data)).encode()+b'\0'+self.data).hexdigest()
        self.meta={'sha':self.blob,'size':len(self.data)}
        self.patches=patch.multiple(relay,BLOB=self.blob,HASH=hashlib.sha256(self.data).hexdigest(),BYTES=len(self.data))
        self.patches.start();self.addCleanup(self.patches.stop)

    def test_exact_drive_bytes_and_git_blob_identity(self):
        relay.validate_relay(self.meta,self.data)

    def test_changed_download_rejected(self):
        with self.assertRaises(ValueError):relay.validate_relay(self.meta,b'X'+self.data[1:])

    def test_wrong_blob_or_size_rejected(self):
        for meta in [{'sha':'a'*40,'size':len(self.data)}, {'sha':self.blob,'size':1}]:
            with self.assertRaises(ValueError):relay.validate_relay(meta,self.data)

    def test_git_object_digest_independently_checked(self):
        with patch.object(relay,'BLOB','a'*40):
            with self.assertRaisesRegex(ValueError,'RELAY_BLOB_HASH_MISMATCH'):
                relay.validate_relay({'sha':'a'*40,'size':len(self.data)},self.data)

    def test_snapshot_origin_preserved_and_verification_identity_unchanged(self):
        values={'GITHUB_SHA':'b'*40,'GITHUB_RUN_ID':'999','GITHUB_REF':relay.BRANCH}
        adapted=relay.snapshot_identity(values)
        self.assertEqual(adapted['GITHUB_SHA'],relay.SNAPSHOT_COMMIT)
        self.assertEqual(adapted['GITHUB_RUN_ID'],relay.SNAPSHOT_RUN)
        self.assertEqual(values['GITHUB_RUN_ID'],'999')
        self.assertEqual(adapted['GITHUB_REF'],relay.BRANCH)

if __name__=='__main__':unittest.main()
