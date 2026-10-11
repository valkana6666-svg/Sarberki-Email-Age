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


class BackupConfigurationError(ValueError):
    """Only fixed, non-secret diagnostic codes may reach the log."""


def parse_protected_uri(value):
    # Split userinfo before URL parsing: raw #/? in a substituted password
    # otherwise become URI delimiters. Pin the entire endpoint independently.
    value = value.strip()
    # Accept only the exact psql wrapper produced by the dashboard, never run it.
    if value.startswith('psql '):
        value = value[5:].strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('\"', "'"):
        value = value[1:-1]
    match = re.fullmatch(r'(postgresql|postgres)://([^:]+):(.+)@'
                         rf'(aws-\d+-eu-west-2\.pooler\.supabase\.com|db\.{owner.PROJECT}\.supabase\.co):5432/postgres'
                         r'(?:\?sslmode=(?:require|verify-full))?', value, re.DOTALL)
    if not match:
        if not value.startswith(('postgresql://', 'postgres://')):
            reason = 'SCHEME_MISSING_OR_INVALID'
        elif '@' not in value:
            reason = 'CREDENTIAL_OR_ENDPOINT_SEPARATOR_MISSING'
        else:
            endpoint = value.rsplit('@', 1)[1]
            if endpoint.startswith('db.'):
                reason = 'DIRECT_SOURCE_PROJECT_OR_PORT_INVALID'
            elif ':6543/' in endpoint:
                reason = 'TRANSACTION_POOLER_PORT_INSTEAD_OF_SESSION_PORT'
            elif '.pooler.supabase.com' in endpoint and '-eu-west-2.' not in endpoint:
                reason = 'POOLER_REGION_NOT_LONDON'
            elif not re.match(r'aws-\d+-eu-west-2\.pooler\.supabase\.com:', endpoint):
                reason = 'POOLER_HOST_FORMAT_INVALID'
            elif not re.match(r'aws-\d+-eu-west-2\.pooler\.supabase\.com:5432/', endpoint):
                reason = 'SESSION_PORT_MISSING_OR_INVALID'
            else:
                reason = 'DATABASE_PATH_OR_URI_SUFFIX_INVALID'
        raise BackupConfigurationError('CONNECTION_FORMAT_INVALID: ' + reason)

    username = unquote(match[2])
    expected_user = 'postgres' if match[4] == 'db.' + owner.PROJECT + '.supabase.co' else 'postgres.' + owner.PROJECT
    if username != expected_user:
        raise BackupConfigurationError('CONNECTION_PROJECT_INVALID: protected URI is not for the pinned test project.')
    password = unquote(match[3])
    if password == '[YOUR-PASSWORD]' or not password or any(c in password for c in ('\x00', '\n', '\r')):
        raise BackupConfigurationError('CONNECTION_PASSWORD_INVALID: missing, placeholder or multiline credential.')
    # Record only whether generic URL parsing misread the original. No values.
    try:
        original = urlsplit(value)
        delimiter_issue = original.port != 5432 or original.path != '/postgres'
    except ValueError:
        delimiter_issue = True
    if delimiter_issue:
        print('BACKUP_CONFIG: corrected reserved password delimiter parsing', flush=True)
    return match[4], password


def source_environment(values):
    values = dict(values)
    if values.get('SARBERKI_BACKUP_DB_URL'):
        print('BACKUP_STAGE: validate protected URI syntax', flush=True)
        host, password = parse_protected_uri(values['SARBERKI_BACKUP_DB_URL'])
        values['SARBERKI_BACKUP_HOST'] = host
        values['SARBERKI_BACKUP_DB_PASSWORD'] = password
    print('BACKUP_STAGE: validate pinned source endpoint', flush=True)
    host = values.get('SARBERKI_BACKUP_HOST', '')
    session_host = values.get('SARBERKI_BACKUP_SESSION_HOST', '')
    if host == 'db.' + owner.PROJECT + '.supabase.co' and session_host:
        # The workflow host was read from this project's Connect panel.
        # Reuse only the password in memory; never rewrite or reveal the secret.
        config = owner.connection(session_host, 'postgres.' + owner.PROJECT)
        print('BACKUP_CONFIG: pinned direct credentials routed through verified session pooler', flush=True)
    elif host == 'db.' + owner.PROJECT + '.supabase.co':
        config = {'PGHOST': host, 'PGPORT': '5432', 'PGUSER': 'postgres',
                  'PGDATABASE': 'postgres', 'PGSSLMODE': 'verify-full',
                  'PGSSLROOTCERT': 'system', 'PGCONNECT_TIMEOUT': '20'}
        print('BACKUP_CONFIG: pinned direct project endpoint', flush=True)
    else:
        config = owner.connection(host, 'postgres.' + owner.PROJECT)
    password = values.get('SARBERKI_BACKUP_DB_PASSWORD', '')
    if not password:
        raise BackupConfigurationError('CONNECTION_PASSWORD_MISSING: protected credential absent.')
    # Do not inherit a libpq service, alternate endpoint or TLS override.
    env = {k: v for k, v in values.items() if not k.startswith('PG') and not k.startswith('SARBERKI_')}
    env.update(config)
    certificate = Path(__file__).with_name('certs') / 'supabase-prod-ca-2021.crt'
    if (not certificate.is_file() or hashlib.sha256(certificate.read_bytes()).hexdigest() !=
            '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7'):
        raise BackupConfigurationError('SOURCE_CA_CERTIFICATE_MISSING_OR_CHANGED')
    env['PGSSLROOTCERT'] = str(certificate.resolve())
    env['PGPASSWORD'] = password
    env['PGOPTIONS'] = '-c default_transaction_read_only=on -c statement_timeout=600000'
    return env


def source_probe(command, env):
    result = subprocess.run(command, env=env, capture_output=True, check=False)
    if result.returncode:
        # Classify known failures locally; never print upstream stderr.
        diagnostic = result.stderr.lower()
        reason = 'SOURCE_CONNECTION_FAILED'
        for marker, code in [(b'network is unreachable', 'SOURCE_NETWORK_UNREACHABLE'),
                             (b'could not translate host name', 'SOURCE_DNS_FAILED'),
                             (b'password authentication failed', 'SOURCE_AUTHENTICATION_FAILED'),
                             (b'certificate verify failed', 'SOURCE_TLS_VERIFICATION_FAILED'),
                             (b'timeout expired', 'SOURCE_CONNECTION_TIMEOUT')]:
            if marker in diagnostic:
                reason = code
                break
        raise BackupConfigurationError(reason)
    return result.stdout


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
    print('BACKUP_STAGE: parse protected connection settings', flush=True)
    values = dict(os.environ)
    env = source_environment(values)
    print('BACKUP_STAGE: validate protected encryption configuration', flush=True)
    fingerprint = values.get('SARBERKI_BACKUP_GPG_FINGERPRINT', '').upper()
    public_key = values.get('SARBERKI_BACKUP_GPG_PUBLIC_KEY', '')
    passphrase = values.get('SARBERKI_BACKUP_ENCRYPTION_PASSPHRASE', '') or values.get('SARBERKI_BACKUP_PASSPHRASE', '')
    if passphrase and (len(passphrase) < 32 or len(passphrase) > 1024 or '\n' in passphrase or '\r' in passphrase
                       or passphrase == env['PGPASSWORD']):
        raise BackupConfigurationError('ENCRYPTION_PASSPHRASE_INVALID: separate 32 to 1024 character single-line passphrase required.')
    if not passphrase and not re.fullmatch(r'[A-F0-9]{40}|[A-F0-9]{64}', fingerprint):
        raise ValueError('Missing verified full public-key fingerprint.')
    if not passphrase and ('-----BEGIN PGP PUBLIC KEY BLOCK-----' not in public_key or 'PRIVATE KEY' in public_key):
        raise ValueError('An armored public key is required; private keys are forbidden.')
    print('BACKUP_STAGE: validate output location', flush=True)
    if output.exists():
        raise ValueError('A fresh output directory is required.')
    if any((p / '.git').exists() for p in (output.resolve(), *output.resolve().parents)):
        raise ValueError('Backup cannot be placed inside a Git checkout.')
    print('BACKUP_STAGE: check required PostgreSQL and encryption tools', flush=True)
    for name in ('pg_dump', 'pg_dumpall', 'pg_restore', 'psql', 'gpg'):
        owner.tool(name)
    if not re.search(rb'\b17\.', owner.checked(['pg_dump', '--version'])):
        raise RuntimeError('PostgreSQL 17 client required.')
    psql = ['psql', '-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1']
    print('BACKUP_STAGE: test read-only TLS database connection', flush=True)
    default_read_only = source_probe(psql + ['-c', 'show transaction_read_only'], env).strip()
    if default_read_only != b'on':
        print('BACKUP_CONFIG: pooler does not propagate startup read-only option; enforcing explicit read-only transactions', flush=True)
    if source_probe(psql + ['-c', 'begin transaction read only; show transaction_read_only; rollback;'], env).strip() != b'on':
        raise BackupConfigurationError('SOURCE_EXPLICIT_READ_ONLY_TRANSACTION_FAILED')
    version = source_probe(psql + ['-c', 'begin transaction read only; show server_version_num; rollback;'], env).strip()
    if not version.isdigit() or int(version) // 10000 != 17:
        raise RuntimeError('Unexpected source server version.')
    manifest_path = Path(__file__).with_name('case-store-recovery-manifest.sql')
    print('BACKUP_STAGE: read baseline manifest', flush=True)
    before = owner.checked(psql + ['-f', str(manifest_path)], env).strip()
    json.loads(before)
    print('BACKUP_STAGE: export PostgreSQL 17 database', flush=True)
    # PostgreSQL 17 pg_dump itself starts REPEATABLE READ, READ ONLY.
    # This is mandatory even when a pooler ignores startup PGOPTIONS.
    dump = bounded(['pg_dump', '-w', '--format=custom'], env)
    toc = owner.checked(['pg_restore', '--list'], input_bytes=dump).decode()
    owner.validate_toc(toc)
    print('BACKUP_STAGE: export role definitions without passwords', flush=True)
    roles = bounded(['pg_dumpall', '-w', '--database=postgres', '--roles-only', '--no-role-passwords'], env)
    print('BACKUP_STAGE: verify source manifest unchanged', flush=True)
    after = owner.checked(psql + ['-f', str(manifest_path)], env).strip()
    if before != after:
        raise RuntimeError('Case-store manifest changed during export.')
    # Ciphertext can live on disk; the GPG homedir holds only the public key.
    output.mkdir(mode=0o700, parents=True)
    print('BACKUP_STAGE: encrypt and verify ciphertext', flush=True)
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
    print('BACKUP_STAGE: write ciphertext integrity manifest', flush=True)
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
    except BackupConfigurationError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        # No traceback or secrets; partial output must never be uploaded on failure.
        print('BLOCKED: no verified backup; prerequisite or export failed.', file=sys.stderr)
        sys.exit(1)
