"""Verify an exact-ID GitHub staging download before isolated SQL recovery.

Only the ephemeral Actions token is used. This is not independent durable storage.
"""
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import urllib.request

REPO = 'valkana6666-svg/Sarberki-Email-Age'
BRANCH = 'gmail-test-subject-allowlist'


def validate_metadata(meta, values, now):
    artifact_id = values.get('SARBERKI_STAGE_ARTIFACT_ID', '')
    run = values.get('GITHUB_RUN_ID', '')
    attempt = values.get('GITHUB_RUN_ATTEMPT', '')
    sha = values.get('GITHUB_SHA', '')
    if (values.get('GITHUB_REPOSITORY') != REPO
            or values.get('GITHUB_REF') != 'refs/heads/'+BRANCH
            or not all(re.fullmatch(r'[1-9][0-9]*', v) for v in (artifact_id, run, attempt))
            or not re.fullmatch(r'[0-9a-f]{40}', sha)):
        raise ValueError('UNAPPROVED_EXECUTION_IDENTITY')
    origin = meta.get('workflow_run', {})
    if (str(meta.get('id')) != artifact_id or meta.get('expired') is not False
            or meta.get('name') != 'sarberki-cloud-stage-'+run+'-'+attempt
            or str(origin.get('id')) != run or origin.get('head_sha') != sha
            or origin.get('head_branch') != BRANCH):
        raise ValueError('ARTIFACT_IDENTITY_INVALID')
    expiry = dt.datetime.fromisoformat(meta['expires_at'].replace('Z', '+00:00'))
    if expiry-now < dt.timedelta(days=80):
        raise ValueError('ACTUAL_RETENTION_TOO_SHORT')
    return expiry.isoformat()


def verify_files(original, downloaded):
    names = {'sarberki-recovery.zip.gpg', 'sarberki-recovery.zip.gpg.sha256'}
    if downloaded.is_symlink() or {p.name for p in downloaded.iterdir()} != names:
        raise ValueError('EXACT_DOWNLOAD_FILES_REQUIRED')
    for name in names:
        p = downloaded/name
        if p.is_symlink() or not p.is_file() or p.stat().st_size > 256*1024*1024:
            raise ValueError('REGULAR_BOUNDED_FILES_REQUIRED')
    cipher = downloaded/'sarberki-recovery.zip.gpg'
    digest = hashlib.sha256(cipher.read_bytes()).hexdigest()
    sums = (digest+'  sarberki-recovery.zip.gpg\n').encode('ascii')
    if (downloaded/'sarberki-recovery.zip.gpg.sha256').read_bytes() != sums:
        raise ValueError('REMOTE_CHECKSUM_INVALID')
    if (original/'sarberki-recovery.zip.gpg.sha256').read_bytes() != sums:
        raise ValueError('UPLOAD_DOWNLOAD_HASH_MISMATCH')
    return digest


def crypt(data, phrase, decrypt=False):
    if not 32 <= len(phrase) <= 1024 or any(c in phrase for c in '\r\n'):
        raise ValueError('NEW_PROTECTED_PASSPHRASE_REQUIRED')
    spec = importlib.util.spec_from_file_location('cloud_crypto', Path(__file__).with_name('cloud-encrypted-backup.py'))
    cloud = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cloud)
    with tempfile.TemporaryDirectory(prefix='sarberki-envelope-keyring-') as keyring:
        env = {'PATH': os.environ.get('PATH', os.defpath), 'GNUPGHOME': keyring}
        args = ['--decrypt'] if decrypt else ['--symmetric', '--cipher-algo', 'AES256', '--force-mdc']
        return cloud.symmetric_command(args, env, phrase, data=data)


def seal(directory, phrase):
    source = directory/'sarberki-recovery.zip'
    target = directory/'sarberki-recovery.zip.gpg'
    if source.is_symlink() or not source.is_file() or source.stat().st_size > 256*1024*1024:
        raise ValueError('REGULAR_BOUNDED_FILES_REQUIRED')
    data = source.read_bytes()
    cipher = crypt(data, phrase)
    if crypt(cipher, phrase, decrypt=True) != data:
        raise ValueError('OUTER_ENCRYPTION_READBACK_FAILED')
    with target.open('xb') as out:
        out.write(cipher)
    target.chmod(0o600)
    digest = hashlib.sha256(cipher).hexdigest()
    with (directory/'sarberki-recovery.zip.gpg.sha256').open('x') as out:
        out.write(digest+'  sarberki-recovery.zip.gpg\n')


def main():
    if sys.argv[1:] == ['seal']:
        seal(Path('/tmp/sarberki-v2-delivery'), os.environ.get('SARBERKI_BACKUP_V2_PASSPHRASE', ''))
        print('Whole recovery package AES256 envelope and decryption readback: PASS')
        return
    if sys.argv[1:]:
        raise ValueError('INVALID_OPERATION')
    # Validate syntax before building any URL; no caller-controlled endpoint.
    artifact_id = os.environ.get('SARBERKI_STAGE_ARTIFACT_ID', '')
    if not re.fullmatch(r'[1-9][0-9]*', artifact_id):
        raise ValueError('ARTIFACT_ID_REQUIRED')
    token = os.environ.get('GITHUB_TOKEN', '')
    if not token:
        raise ValueError('EPHEMERAL_ACTIONS_TOKEN_REQUIRED')
    req = urllib.request.Request('https://api.github.com/repos/'+REPO+'/actions/artifacts/'+artifact_id,
        headers={'Authorization': 'Bearer '+token, 'Accept': 'application/vnd.github+json',
                 'X-GitHub-Api-Version': '2022-11-28'})
    with urllib.request.urlopen(req, timeout=45) as response:
        meta = json.loads(response.read(65536))
    expiry = validate_metadata(meta, os.environ, dt.datetime.now(dt.timezone.utc))
    original = Path('/tmp/sarberki-v2-delivery')
    downloaded = Path('/tmp/sarberki-v2-github-readback')
    digest = verify_files(original, downloaded)
    spec = importlib.util.spec_from_file_location('readback', Path(__file__).with_name('backup-v2-readback.py'))
    reader = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reader)
    # The complete ZIP is encrypted; plaintext exists only in bounded tmpfs during validation.
    data = crypt((downloaded/'sarberki-recovery.zip.gpg').read_bytes(),
                 os.environ.get('SARBERKI_BACKUP_V2_PASSPHRASE', ''), decrypt=True)
    if len(data) > reader.LIMIT:
        raise ValueError('PLAINTEXT_LIMIT_EXCEEDED')
    with tempfile.TemporaryDirectory(dir='/dev/shm') as ram:
        package = Path(ram)/'recovery.zip'
        package.write_bytes(data)
        package.chmod(0o600)
        reader.validate_archive(package, Path('/tmp/sarberki-v2-github-input'), os.environ)
    proof = {'provider': 'github-actions-artifact', 'artifact_id': int(artifact_id),
             'run_id': os.environ['GITHUB_RUN_ID'], 'source_commit': os.environ['GITHUB_SHA'],
             'sha256': digest, 'expires_at': expiry, 'archive_boundary': 'PASS',
             'input_source': 'exact_id_download', 'sql_restore': 'NOT_YET_RUN', 'whole_package_encryption': 'AES256_GPG',
             'independent_storage': 'NOT_YET_TRANSFERRED_TO_DRIVE'}
    (downloaded/'VALIDATED-INPUT.json').write_text(json.dumps(proof, indent=2))
    (original/'GITHUB-STAGING.json').write_text(json.dumps(proof, indent=2))
    print('Exact-ID GitHub download, actual retention, hashes and archive boundary: PASS; SQL restore required.')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('BLOCKED: GitHub staging readback validation failed; no complete backup claim.', file=sys.stderr)
        sys.exit(1)
