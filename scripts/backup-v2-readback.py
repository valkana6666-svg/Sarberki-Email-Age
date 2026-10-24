"""Validate only exact-ID Drive response bytes before a second isolated SQL restore.

Never extract arbitrary archive paths, execute bundled code, or connect to a source DB.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import zipfile

FOLDER = '1EE2ioPs_8OwpnttT9hYHba_Y9_aWwcqz'
LIMIT = 256 * 1024 * 1024
DATABASE = {'database.dump.gpg', 'roles.sql.gpg', 'manifest.json.gpg',
            'SHA256SUMS.txt', 'STATUS.txt', 'PROVENANCE.json'}
MEMBERS = {'database/' + name for name in DATABASE} | {
    'evidence/ISOLATED-RESTORE.json', 'source.bundle',
    'RECOVERY-GAPS.json', 'DATABASE-SHA256SUMS.txt'}


def validate_and_extract(download, receipt, destination, values):
    if (values.get('GITHUB_REPOSITORY') != 'valkana6666-svg/Sarberki-Email-Age'
            or values.get('GITHUB_REF') != 'refs/heads/gmail-test-subject-allowlist'
            or not re.fullmatch(r'[0-9a-f]{40}', values.get('GITHUB_SHA', ''))
            or not re.fullmatch(r'\d+', values.get('GITHUB_RUN_ID', ''))
            or not re.fullmatch(r'\d+', values.get('GITHUB_RUN_ATTEMPT', ''))):
        raise ValueError('UNAPPROVED_EXECUTION_IDENTITY')
    if download.is_symlink() or receipt.is_symlink() or destination.exists() or destination.is_symlink():
        raise ValueError('FRESH_REGULAR_INPUT_REQUIRED')
    meta = json.loads(receipt.read_text())
    if meta.get('provider') != 'google-drive' or meta.get('folder_id') != FOLDER:
        raise ValueError('DRIVE_RECEIPT_INVALID')
    prefix = 'sarberki-' + values['GITHUB_RUN_ID'] + '-' + values['GITHUB_RUN_ATTEMPT'] + '-' + values['GITHUB_SHA']
    objects = meta.get('objects', [])
    if len(objects) != 2 or {o.get('name') for o in objects} != {prefix+'.zip', prefix+'.zip.sha256'}:
        raise ValueError('DRIVE_RECEIPT_INVALID')
    for obj in objects:
        if (obj.get('exact_id_readback') != 'PASS'
                or not re.fullmatch(r'[A-Za-z0-9_-]+', obj.get('file_id', ''))
                or not re.fullmatch(r'[0-9a-f]{64}', obj.get('sha256', ''))):
            raise ValueError('DRIVE_RECEIPT_INVALID')
    if objects[0]['file_id'] == objects[1]['file_id']:
        raise ValueError('DRIVE_RECEIPT_INVALID')
    item = next(o for o in objects if o['name'] == prefix+'.zip')
    checksum = next(o for o in objects if o['name'] == prefix+'.zip.sha256')
    sidecar = download.with_suffix('.zip.sha256')
    if sidecar.is_symlink() or not sidecar.is_file() or sidecar.stat().st_size > 1024:
        raise ValueError('REMOTE_CHECKSUM_INVALID')
    digest = hashlib.sha256(download.read_bytes()).hexdigest() if download.stat().st_size <= LIMIT else None
    if digest != item['sha256'] or download.stat().st_size != item.get('bytes'):
        raise ValueError('REMOTE_ZIP_HASH_MISMATCH')
    sums = sidecar.read_bytes()
    if (hashlib.sha256(sums).hexdigest() != checksum['sha256']
            or len(sums) != checksum.get('bytes')
            or sums != (digest+'  sarberki-recovery.zip\n').encode('ascii')):
        raise ValueError('REMOTE_CHECKSUM_INVALID')
    validate_archive(download, destination, values)
    return {'provider': 'google-drive', 'file_id': item['file_id'], 'sha256': digest,
            'input_source': 'exact_id_download', 'archive_boundary': 'PASS',
            'sql_restore': 'NOT_YET_RUN'}


def validate_archive(download, destination, values):
    """Shared untrusted archive boundary; callers verify provider identity and hashes."""
    if destination.exists() or destination.is_symlink() or download.is_symlink():
        raise ValueError('FRESH_REGULAR_INPUT_REQUIRED')
    with zipfile.ZipFile(download) as archive:
        entries = archive.infolist()
        if len(entries) != len(MEMBERS) or {e.filename for e in entries} != MEMBERS:
            raise ValueError('ARCHIVE_MEMBERS_INVALID')
        if sum(e.file_size for e in entries) > LIMIT or any(
                e.flag_bits & 1 or e.is_dir() or stat.S_ISLNK(e.external_attr >> 16) for e in entries):
            raise ValueError('ARCHIVE_BOUNDARY_INVALID')
        if archive.testzip() is not None:
            raise ValueError('ARCHIVE_CRC_INVALID')
        proof = json.loads(archive.read('evidence/ISOLATED-RESTORE.json'))
        if proof.get('full_restore') != 'PASS' or proof.get('verification_completed') is not True:
            raise ValueError('PREUPLOAD_RESTORE_PROOF_REQUIRED')
        data = {name: archive.read('database/'+name) for name in DATABASE}
        provenance = json.loads(data['PROVENANCE.json'])
        if (provenance.get('source_commit') != values['GITHUB_SHA']
                or str(provenance.get('run_id')) != values['GITHUB_RUN_ID']
                or provenance.get('project') != 'mojnqizbcaczstguikpv'
                or provenance.get('source_read_only') is not True):
            raise ValueError('REMOTE_PROVENANCE_INVALID')
        destination.mkdir(mode=0o700)
        for name, content in data.items():
            with (destination/name).open('xb') as out:
                out.write(content)
            (destination/name).chmod(0o600)

def main():
    directory = Path('/tmp/sarberki-v2-drive-readback')
    proof = validate_and_extract(directory/'sarberki-recovery.zip',
        Path('/tmp/sarberki-v2-delivery/DURABLE-STORAGE.json'),
        Path('/tmp/sarberki-v2-drive-input'), os.environ)
    (directory/'VALIDATED-INPUT.json').write_text(json.dumps(proof, indent=2))
    print('Exact-ID downloaded archive boundary and hashes: PASS; SQL restore still required.')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('BLOCKED: remote recovery archive validation failed; no restore claim.', file=sys.stderr)
        sys.exit(1)
