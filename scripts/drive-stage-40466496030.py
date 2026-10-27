"""Read the pinned Drive stage directly; decrypt only into ephemeral memory.

No export, source DB access, credential disclosure or archive code execution.
"""
import hashlib, importlib.util, io, json, os, sys, tempfile, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / (name + '.py'))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod

def main():
    if os.environ.get('GITHUB_REPOSITORY') != 'valkana6666-svg/Sarberki-Email-Age' or os.environ.get('GITHUB_REF') != 'refs/heads/gmail-test-subject-allowlist':
        raise ValueError('EXECUTION_IDENTITY')
    if any(os.environ.get(k) for k in os.environ if k.startswith('SARBERKI_BACKUP_DB_')):
        raise ValueError('SOURCE_CREDENTIALS_FORBIDDEN')
    drive, artifact, reader = load('backup-v2-drive'), load('backup-v2-artifact'), load('backup-v2-readback')
    secret = os.environ.pop('SARBERKI_V2_DRIVE_OAUTH_JSON', '')
    if not secret:
        raise ValueError('DRIVE_OAUTH_SECRET_UNAVAILABLE')
    token = drive.access_token(secret); secret = None
    data = drive.request('https://www.googleapis.com/drive/v3/files/1l9_dg1dr65LhdoZXzxix2nRAeWex7FcC?alt=media', token)
    token = None
    if len(data) != 3262449 or hashlib.sha256(data).hexdigest() != 'b80f82a584e4506340b596205caaab405c9574c7e6187ce14e1df255cbf59f7a':
        raise ValueError('DRIVE_STAGE_IDENTITY_MISMATCH')
    with zipfile.ZipFile(io.BytesIO(data)) as outer:
        entries = outer.infolist()
        if len(entries) != 2 or {e.filename for e in entries} != {'sarberki-recovery.zip.gpg', 'sarberki-recovery.zip.gpg.sha256'} or any(e.is_dir() or e.file_size > 4000000 for e in entries):
            raise ValueError('STAGE_ARCHIVE_BOUNDARY')
        encrypted = outer.read('sarberki-recovery.zip.gpg')
        if hashlib.sha256(encrypted).hexdigest() != 'e51dde88cea323bb43bf7c168f73f6d8a845b3cccf0a9ce18d113c54bb05d04c':
            raise ValueError('CIPHERTEXT_IDENTITY_MISMATCH')
    phrase = os.environ.pop('SARBERKI_BACKUP_V2_PASSPHRASE', '')
    if not 32 <= len(phrase) <= 1024 or '\n' in phrase or '\r' in phrase:
        raise ValueError('BACKUP_SECRET_UNAVAILABLE')
    plain = artifact.crypt(encrypted, phrase, decrypt=True); phrase = None
    if len(plain) > reader.LIMIT: raise ValueError('PLAINTEXT_LIMIT')
    identity = dict(os.environ, GITHUB_SHA='2ca4f322eaa2878c2b62164a4b6d7fc50c4b0e67', GITHUB_RUN_ID='40466496030')
    with tempfile.TemporaryDirectory(dir='/dev/shm') as ram:
        path = Path(ram)/'recovery.zip'; path.write_bytes(plain); path.chmod(0o600)
        reader.validate_archive(path, Path('/tmp/sarberki-v2-drive-input'), identity)
    proof = {'provider':'google-drive', 'file_id':'1l9_dg1dr65LhdoZXzxix2nRAeWex7FcC', 'input_source':'exact_id_drive_download', 'archive_boundary':'PASS', 'whole_package_decryption':'PASS', 'sql_restore':'NOT_YET_RUN'}
    dest = Path('/tmp/sarberki-v2-drive-readback'); dest.mkdir(mode=0o700)
    (dest/'VALIDATED-INPUT.json').write_text(json.dumps(proof, indent=2)+'\n')
    print('Direct exact-ID Drive readback and decryption: PASS; SQL restore required.')

if __name__ == '__main__':
    try: main()
    except Exception as exc:
        safe = str(exc) if isinstance(exc, ValueError) and str(exc) in {'EXECUTION_IDENTITY','SOURCE_CREDENTIALS_FORBIDDEN','DRIVE_OAUTH_SECRET_UNAVAILABLE','BACKUP_SECRET_UNAVAILABLE','DRIVE_STAGE_IDENTITY_MISMATCH','STAGE_ARCHIVE_BOUNDARY','CIPHERTEXT_IDENTITY_MISMATCH','PLAINTEXT_LIMIT'} else 'DRIVE_ACCESS_OR_DECRYPTION_FAILED'
        print('BLOCKED: '+safe, file=sys.stderr); sys.exit(1)
