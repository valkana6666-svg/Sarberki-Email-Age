"""One-off read-only sarberki-test export; no private GPG key on the runner.

Plaintext is held in process memory, never published or written to a dump file.
Ciphertext readback/decryption and isolated restore must be verified separately.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import urlsplit, unquote

spec = importlib.util.spec_from_file_location('owner_backup', Path(__file__).with_name('owner-encrypted-backup.py'))
owner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(owner)
LIMIT = 256 * 1024 * 1024


def bounded(command, env, maximum=LIMIT):
    process = subprocess.Popen(command, env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    data = bytearray()
    try:
        while True:
            part = process.stdout.read(min(1024 * 1024, maximum + 1 - len(data)))
            if not part:
                break
            data.extend(part)
            if len(data) > maximum:
                raise RuntimeError('Export exceeds the in-memory limit.')
        if process.wait() != 0:
            raise RuntimeError('Export failed; upstream output withheld.')
        return bytes(data)
    finally:
        process.stdout.close()
        if process.poll() is None:
            process.kill()
            process.wait()


def source_environment(values):
    values = dict(values)
    if values.get('SARBERKI_BACKUP_DB_URL'):
        uri = urlsplit(values['SARBERKI_BACKUP_DB_URL'])
        if uri.scheme not in ('postgres', 'postgresql') or uri.port != 5432 or uri.path != '/postgres':
            raise ValueError('Expected session-pooler connection.')
        if unquote(uri.username or '') != 'postgres.' + owner.PROJECT:
            raise ValueError('Wrong source project.')
        values['SARBERKI_BACKUP_HOST'] = uri.hostname or ''
        values['SARBERKI_BACKUP_DB_PASSWORD'] = unquote(uri.password or '')
    config = owner.connection(values.get('SARBERKI_BACKUP_HOST', ''), 'postgres.' + owner.PROJECT)
    password = values.get('SARBERKI_BACKUP_DB_PASSWORD', '')
    if not password:
        raise ValueError('Missing protected database credential.')
    # Do not inherit a libpq service, alternate endpoint or TLS override.
    env = {k: v for k, v in values.items() if not k.startswith('PG') and not k.startswith('SARBERKI_')}
    env.update(config)
    env['PGPASSWORD'] = password
    env['PGOPTIONS'] = '-c default_transaction_read_only=on -c statement_timeout=600000'
    return env


def encrypt(data, target, env, fingerprint):
    partial = target.with_suffix(target.suffix + '.partial')
    try:
        owner.checked(['gpg', '--batch', '--yes', '--trust-model', 'always', '--encrypt',
                       '--recipient', fingerprint, '--output', str(partial)], env, data)
        if not partial.is_file() or not partial.stat().st_size:
            raise RuntimeError('Missing ciphertext.')
        partial.rename(target)
    finally:
        partial.unlink(missing_ok=True)


def symmetric_command(command, env, passphrase, data=None):
    read_fd, write_fd = os.pipe()
    try:
        os.write(write_fd, passphrase.encode() + b'\n')
        os.close(write_fd)
        write_fd = None
        result = subprocess.run(['gpg', '--batch', '--yes', '--pinentry-mode', 'loopback',
                                 '--no-symkey-cache', '--passphrase-fd', str(read_fd), *command],
                                env=env, input=data, pass_fds=(read_fd,), capture_output=True)
        if result.returncode:
            raise RuntimeError('Encryption or ciphertext readback failed.')
        return result.stdout
    finally:
        os.close(read_fd)
        if write_fd is not None:
            os.close(write_fd)


def export(output):
    values = dict(os.environ)
    env = source_environment(values)
    fingerprint = values.get('SARBERKI_BACKUP_GPG_FINGERPRINT', '').upper()
    public_key = values.get('SARBERKI_BACKUP_GPG_PUBLIC_KEY', '')
    passphrase = values.get('SARBERKI_BACKUP_ENCRYPTION_PASSPHRASE', '') or values.get('SARBERKI_BACKUP_PASSPHRASE', '')
    if passphrase and (len(passphrase) < 32 or len(passphrase) > 1024 or '\n' in passphrase or '\r' in passphrase
                       or passphrase == env['PGPASSWORD']):
        raise ValueError('Use a separate strong encryption passphrase of 32 to 1024 characters.')
    if not passphrase and not re.fullmatch(r'[A-F0-9]{40}|[A-F0-9]{64}', fingerprint):
        raise ValueError('Missing verified full public-key fingerprint.')
    if not passphrase and ('-----BEGIN PGP PUBLIC KEY BLOCK-----' not in public_key or 'PRIVATE KEY' in public_key):
        raise ValueError('An armored public key is required; private keys are forbidden.')
    if output.exists():
        raise ValueError('A fresh output directory is required.')
    if any((p / '.git').exists() for p in (output.resolve(), *output.resolve().parents)):
        raise ValueError('Backup cannot be placed inside a Git checkout.')
    for name in ('pg_dump', 'pg_dumpall', 'pg_restore', 'psql', 'gpg'):
        owner.tool(name)
    if not re.search(rb'\b17\.', owner.checked(['pg_dump', '--version'])):
        raise RuntimeError('PostgreSQL 17 client required.')
    psql = ['psql', '-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1']
    if owner.checked(psql + ['-c', 'show transaction_read_only'], env).strip() != b'on':
        raise RuntimeError('Source connection is not read-only.')
    version = owner.checked(psql + ['-c', 'show server_version_num'], env).strip()
    if not version.isdigit() or int(version) // 10000 != 17:
        raise RuntimeError('Unexpected source server version.')
    manifest_path = Path(__file__).with_name('case-store-recovery-manifest.sql')
    before = owner.checked(psql + ['-f', str(manifest_path)], env).strip()
    json.loads(before)
    dump = bounded(['pg_dump', '-w', '--format=custom'], env)
    toc = owner.checked(['pg_restore', '--list'], input_bytes=dump).decode()
    owner.validate_toc(toc)
    roles = bounded(['pg_dumpall', '-w', '--database=postgres', '--roles-only', '--no-role-passwords'], env)
    after = owner.checked(psql + ['-f', str(manifest_path)], env).strip()
    if before != after:
        raise RuntimeError('Case-store manifest changed during export.')
    # Ciphertext can live on disk; the GPG homedir holds only the public key.
    output.mkdir(mode=0o700, parents=True)
    with tempfile.TemporaryDirectory(prefix='sarberki-public-gpg-') as home:
        crypto_env = {k: v for k, v in env.items() if not k.startswith('PG')}
        crypto_env['GNUPGHOME'] = home
        if passphrase:
            for name, data in [('database.dump', dump), ('roles.sql', roles), ('manifest.json', before)]:
                target = output / (name + '.gpg')
                partial = target.with_suffix('.gpg.partial')
                try:
                    symmetric_command(['--symmetric', '--cipher-algo', 'AES256', '--output', str(partial)],
                                      crypto_env, passphrase, data)
                    if not partial.is_file() or not partial.stat().st_size:
                        raise RuntimeError('Missing ciphertext.')
                    decrypted = symmetric_command(['--decrypt', str(partial)], crypto_env, passphrase)
                    if hashlib.sha256(decrypted).digest() != hashlib.sha256(data).digest():
                        raise RuntimeError('Ciphertext readback mismatch.')
                    partial.rename(target)
                finally:
                    partial.unlink(missing_ok=True)
        else:
            public_key_export(dump, roles, before, output, crypto_env, public_key, fingerprint)
    hashes = []
    for path in sorted(output.glob('*.gpg')):
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        hashes.append(digest + '  ' + path.name)
    (output / 'SHA256SUMS.txt').write_text('\n'.join(hashes) + '\n', encoding='ascii')
    (output / 'STATUS.txt').write_text(
        'Encrypted database export, role definitions without passwords, and case manifest.\n'
        'Source: mojnqizbcaczstguikpv; source connection read-only.\n'
        'Database archive coverage and stable case manifest checked.\n'
        + ('Ciphertext decryption/readback: VERIFIED (AES256 symmetric).\n' if passphrase else
           'Ciphertext decryption/readback: NOT VERIFIED (owner public key).\n') +
        'Independent durable storage and readback: NOT VERIFIED.\n'
        'Isolated SQL/Auth/RLS/CAS restore: NOT VERIFIED.\n'
        'Platform settings/API keys/Storage files/Vault recovery are separate.\n'
        'CASE_STORE_ENABLED remains disabled.\n', encoding='utf-8')
    print(json.dumps({'project': owner.PROJECT, 'export': 'encrypted', 'restore': 'not_verified',
                      'files': {p.name: p.stat().st_size for p in output.iterdir()}}, sort_keys=True))


def public_key_export(dump, roles, before, output, crypto_env, public_key, fingerprint):
        owner.checked(['gpg', '--batch', '--import'], crypto_env, public_key.encode())
        listing = owner.checked(['gpg', '--batch', '--with-colons', '--fingerprint', '--list-keys'], crypto_env).decode()
        primary = []
        next_primary = False
        for line in listing.splitlines():
            fields = line.split(':')
            if fields[0] == 'pub':
                next_primary = True
            elif fields[0] == 'fpr' and next_primary:
                primary.append(fields[9])
                next_primary = False
        if primary != [fingerprint]:
            raise RuntimeError('Public key does not match the pinned owner fingerprint.')
        for name, data in [('database.dump', dump), ('roles.sql', roles), ('manifest.json', before)]:
            encrypt(data, output / (name + '.gpg'), crypto_env, fingerprint)


if __name__ == '__main__':
    import sys
    try:
        export(Path(os.environ.get('SARBERKI_BACKUP_OUTPUT', '/tmp/sarberki-cloud-backup')))
    except Exception:
        # No traceback or secrets; partial output must never be uploaded on failure.
        print('BLOCKED: no verified backup; prerequisite or export failed.', file=sys.stderr)
        sys.exit(1)
