"""One-off recovery of actual Drive-downloaded ciphertext via a Git blob relay.
No source connection, connector token, private key or bundled code is consumed.
"""
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import urllib.request

REPO = 'valkana6666-svg/Sarberki-Email-Age'
BRANCH = 'refs/heads/gmail-test-subject-allowlist'
BLOB = 'b98749e4ea31a51841f25fed0073f17dde9149ff'
HASH = '3ea25b89805a62f8bfe0956398b5e65f9b54d36e09cba939f5074d0ab42870f8'
BYTES = 3315880
DRIVE_ID = '1Q2FnZL9O2_Fkq83koM2z-LOi4wTo9VoQ'
SNAPSHOT_COMMIT = '1e17a56b50fe8ef8ca0aab3119dda8f66581e2f9'
SNAPSHOT_RUN = '40124286342'
ROOT = Path(__file__).resolve().parent

def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT/(name+'.py'))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

def validate_relay(meta, data):
    if meta.get('sha') != BLOB or meta.get('size') != BYTES:
        raise ValueError('RELAY_IDENTITY_INVALID')
    if len(data) != BYTES or hashlib.sha256(data).hexdigest() != HASH:
        raise ValueError('DRIVE_BYTE_HASH_MISMATCH')
    git_sha = hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
    if git_sha != BLOB:
        raise ValueError('RELAY_BLOB_HASH_MISMATCH')

def snapshot_identity(values):
    return dict(values, GITHUB_SHA=SNAPSHOT_COMMIT, GITHUB_RUN_ID=SNAPSHOT_RUN)

def main():
    if os.environ.get('GITHUB_REPOSITORY') != REPO or os.environ.get('GITHUB_REF') != BRANCH:
        raise ValueError('UNAPPROVED_EXECUTION_IDENTITY')
    if any(os.environ.get(k) for k in os.environ if k.startswith('SARBERKI_BACKUP_DB_')):
        raise ValueError('SOURCE_CREDENTIALS_FORBIDDEN')
    probe = os.environ.get('SARBERKI_OWNER_KEY_PROBE') == 'yes'
    key_name = 'SARBERKI_OWNER_RECOVERY_PASSPHRASE' if probe else 'SARBERKI_BACKUP_V2_PASSPHRASE'
    phrase = os.environ.pop(key_name, '')
    if not 32 <= len(phrase) <= 1024 or any(c in phrase for c in '\r\n'):
        raise ValueError('OWNER_RECOVERY_KEY_REQUIRED' if probe else 'V2_KEY_REQUIRED')
    req = urllib.request.Request('https://api.github.com/repos/'+REPO+'/git/blobs/'+BLOB,
        headers={'Authorization':'Bearer '+os.environ['GITHUB_TOKEN'], 'Accept':'application/vnd.github+json',
                 'X-GitHub-Api-Version':'2022-11-28'})
    with urllib.request.urlopen(req, timeout=45) as response:
        raw = response.read(8*1024*1024+1)
    if len(raw) > 8*1024*1024:
        raise ValueError('RELAY_RESPONSE_LIMIT')
    meta = json.loads(raw)
    if meta.get('encoding') != 'base64':
        raise ValueError('RELAY_ENCODING_INVALID')
    data = base64.b64decode(''.join(meta['content'].split()), validate=True)
    validate_relay(meta, data)
    artifact, reader = module('backup-v2-artifact'), module('backup-v2-readback')
    plain = artifact.crypt(data, phrase, decrypt=True)
    phrase = None
    if len(plain) > reader.LIMIT:
        raise ValueError('PLAINTEXT_LIMIT_EXCEEDED')
    with tempfile.TemporaryDirectory(dir='/dev/shm') as ram:
        path = Path(ram)/'recovery.zip'
        path.write_bytes(plain); path.chmod(0o600)
        reader.validate_archive(path, Path('/tmp/sarberki-v2-drive-input'), snapshot_identity(os.environ))
    proof = {'provider':'google-drive', 'file_id':DRIVE_ID, 'sha256':HASH, 'bytes':BYTES,
        'snapshot_commit':SNAPSHOT_COMMIT, 'snapshot_run':SNAPSHOT_RUN,
        'relay_blob_sha':BLOB, 'relay_kind':'actual_drive_download_bytes_relayed_unchanged',
        'input_source':'exact_id_drive_download_via_ciphertext_relay', 'archive_boundary':'PASS',
        'whole_package_decryption':'PASS', 'independent_owner_key_probe':'PASS' if probe else 'NOT_RUN',
        'owner_key_source':'independently_reentered_owner_secret' if probe else 'existing_runner_secret',
        'verification_run':os.environ['GITHUB_RUN_ID'], 'verification_commit':os.environ['GITHUB_SHA'],
        'sql_restore':'NOT_YET_RUN'}
    target=Path('/tmp/sarberki-v2-drive-readback'); target.mkdir(exist_ok=False)
    (target/'VALIDATED-INPUT.json').write_text(json.dumps(proof,indent=2)+'\n')
    print('Actual Drive download ciphertext relay, exact hashes and package decryption: PASS; SQL restore required.')

if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('BLOCKED: pinned Drive ciphertext relay or protected key validation failed; details withheld.',file=sys.stderr)
        sys.exit(1)
