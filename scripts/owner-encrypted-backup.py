"""Owner-run PostgreSQL logical backup. Never restores or changes the source.
Run on the owner's encrypted Windows disk; PostgreSQL 17 + Gpg4win already installed.
Passwords are read locally without echo and never passed as command-line arguments.
Platform config, Storage objects, Vault keys and role passwords are NOT SQL backups.
"""
import argparse
import getpass
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone

PROJECT = 'mojnqizbcaczstguikpv'
REQUIRED = ('sc_tenants', 'sc_memberships', 'sc_cases', 'sc_message_keys', 'sc_audit')


def connection(host, username):
    if not re.fullmatch(r'aws-\d+-eu-west-2\.pooler\.supabase\.com', host):
        raise ValueError('A Connect panel London Session pooler hostja szükséges.')
    if username != 'postgres.' + PROJECT:
        raise ValueError('Kizárólag a kijelölt tesztprojekt felhasználója engedélyezett.')
    return {'PGHOST': host, 'PGPORT': '5432', 'PGUSER': username,
            'PGDATABASE': 'postgres', 'PGSSLMODE': 'verify-full', 'PGSSLROOTCERT': 'system', 'PGCONNECT_TIMEOUT': '20'}


def tool(name):
    found = shutil.which(name)
    if not found and os.name == 'nt':
        candidates = [Path(os.environ.get('ProgramFiles', 'C:/Program Files')) / 'PostgreSQL/17/bin' / (name + '.exe'),
                      Path(os.environ.get('ProgramFiles', 'C:/Program Files')) / 'GnuPG/bin' / (name + '.exe'),
                      Path(os.environ.get('ProgramFiles(x86)', 'C:/Program Files (x86)')) / 'GnuPG/bin' / (name + '.exe')]
        found = next((str(p) for p in candidates if p.is_file()), None)
    if not found:
        raise RuntimeError('Hiányzó helyi program: ' + name)
    return found


def checked(args, env=None, input_bytes=None):
    result = subprocess.run(args, env=env, input=input_bytes, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, check=False)
    if result.returncode:
        # Never echo upstream stderr, connection data, SQL or credentials.
        raise RuntimeError(Path(args[0]).stem + ': sikertelen művelet; nincs kész mentés.')
    return result.stdout


def encrypt_command(command, target, gpg, recipient, env):
    """Pipe directly to encryption. No plaintext database dump is saved on disk."""
    partial = target.with_suffix(target.suffix + '.partial')
    source = subprocess.Popen(command, env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        encrypted = subprocess.run([gpg, '--batch', '--encrypt', '--recipient', recipient,
                                    '--output', str(partial)], stdin=source.stdout,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
        source.stdout.close()
        source.wait()
        if encrypted.returncode or source.returncode or not partial.is_file() or not partial.stat().st_size:
            raise RuntimeError('Az export vagy titkosítás hibás; a részleges fájl nem mentés.')
        partial.rename(target)
    finally:
        if source.poll() is None:
            source.kill()
            source.wait()
        if partial.exists():
            partial.unlink()


def validate_toc(toc):
    # All five data tables AND actual Auth records must be in this database archive.
    for name in REQUIRED:
        for kind in ('TABLE', 'TABLE DATA'):
            if not re.search(r'\b' + kind + r' public ' + name + r'\s', toc):
                raise RuntimeError('Hiányos archívum: ' + name)
    for name in ('users', 'identities'):
        if not re.search(r'\bTABLE DATA auth ' + name + r'\s', toc):
            raise RuntimeError('Hiányos Auth-adatmentés.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, help='GitHubon kívüli tulajdonosi mentési könyvtár')
    parser.add_argument('--recipient', required=True, help='Tulajdonos ellenőrzött GPG ujjlenyomata; nem titkos kulcs')
    parser.add_argument('--ca-file', help='Supabase tanúsítványellenőrzéshez használt helyi CA PEM; alapérték: rendszer CA-k')
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Fa-f0-9]{40}|[A-Fa-f0-9]{64}', args.recipient):
        raise ValueError('Teljes, ellenőrzött GPG kulcsujjlenyomat szükséges.')
    root = Path(args.output).expanduser().resolve()
    if any((p / '.git').exists() for p in (root, *root.parents)):
        raise ValueError('Mentés nem kerülhet Git repositoryba.')
    binaries = {name: tool(name) for name in ('pg_dump', 'pg_dumpall', 'pg_restore', 'psql', 'gpg')}
    version = checked([binaries['pg_dump'], '--version']).decode()
    if not re.search(r'\b17\.', version):
        raise RuntimeError('A telepített PostgreSQL 17 kliens szükséges.')
    # Verify recipient before requesting a database password. Do not import/trust keys automatically.
    checked([binaries['gpg'], '--batch', '--list-keys', args.recipient])
    if not checked([binaries['gpg'], '--batch', '--with-colons', '--list-secret-keys', args.recipient]):
        raise RuntimeError('A tulajdonosi visszaolvasáshoz szükséges helyi titkos GPG kulcs hiányzik.')
    if input('Saját titkosított lemez, nincs aktív ügyírás; írd be: MENTES: ').strip() != 'MENTES':
        return
    config = connection(input('Session pooler host (csak hostnév): ').strip(),
                        input('DB felhasználó (postgres.projektazonosító): ').strip())
    env = os.environ.copy()
    env.update(config)
    if args.ca_file:
        ca = Path(args.ca_file).expanduser().resolve()
        if not ca.is_file():
            raise ValueError('Hiányzó CA tanúsítványfájl.')
        env['PGSSLROOTCERT'] = str(ca)
    env['PGPASSWORD'] = getpass.getpass('Adatbázis-jelszó (nem látható): ')
    if not env['PGPASSWORD']:
        raise ValueError('Üres jelszó.')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    destination = root / ('sarberki-' + stamp)
    destination.mkdir(parents=True, mode=0o700, exist_ok=False)
    if os.name == 'nt':
        account = os.environ.get('USERDOMAIN', '') + '\\' + os.environ.get('USERNAME', '')
        checked(['icacls', str(destination), '/inheritance:r', '/grant:r', account + ':(OI)(CI)F'])
    try:
        server = checked([binaries['psql'], '-X', '-w', '-At', '-v', 'ON_ERROR_STOP=1',
                          '-c', 'show server_version_num'], env).decode().strip()
        if not server.isdigit() or int(server) // 10000 != 17:
            raise RuntimeError('Nem PostgreSQL 17 forrás; nincs mentés.')
        database = destination / 'database.dump.gpg'
        encrypt_command([binaries['pg_dump'], '-w', '--format=custom'], database,
                        binaries['gpg'], args.recipient, env)
        # This pipeline verifies decryption and archive contents; it is NOT a restore.
        decrypt = subprocess.Popen([binaries['gpg'], '--decrypt', str(database)],
                                   stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        try:
            listed = subprocess.run([binaries['pg_restore'], '--list'], stdin=decrypt.stdout,
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
            decrypt.stdout.close()
            if listed.returncode:
                raise RuntimeError('Az archívum tartalomjegyzéke nem ellenőrizhető.')
            toc = listed.stdout.decode()
            decrypt.wait()
            if decrypt.returncode:
                raise RuntimeError('A titkosított mentés visszaolvasása sikertelen.')
            validate_toc(toc)
        finally:
            if decrypt.poll() is None:
                decrypt.kill()
                decrypt.wait()
        encrypt_command([binaries['pg_dumpall'], '-w', '--database=postgres', '--roles-only', '--no-role-passwords'],
                        destination / 'roles.sql.gpg', binaries['gpg'], args.recipient, env)
        manifest = Path(__file__).with_name('case-store-recovery-manifest.sql')
        encrypt_command([binaries['psql'], '-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-f', str(manifest)],
                        destination / 'manifest.json.gpg', binaries['gpg'], args.recipient, env)
        hashes = []
        for path in sorted(destination.glob('*.gpg')):
            with path.open('rb') as ciphertext:
                digest = hashlib.file_digest(ciphertext, 'sha256').hexdigest()
            hashes.append(digest + '  ' + path.name)
        (destination / 'SHA256SUMS.txt').write_text('\n'.join(hashes) + '\n', encoding='ascii')
        (destination / 'STATUS.txt').write_text('Encrypted logical database export + roles (no role passwords).\n'
            'Auth data included. Local ciphertext readback and archive coverage checked.\n'
            'Independent storage readback, isolated SQL restore and Auth/RLS/CAS tests: NOT VERIFIED.\n'
            'Platform settings, API keys, Storage binaries and Vault keys require separate owner inventory.\n', encoding='utf-8')
        print('ELKÉSZÜLT: titkosított logikai export:', destination)
        print('MÉG NEM KÉSZ: független tárolás és izolált restore. API marad disabled.')
    finally:
        env.pop('PGPASSWORD', None)


if __name__ == '__main__':
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print('Megszakítva. Nincs igazolt teljes mentés.')
        sys.exit(1)
    except (ValueError, RuntimeError, OSError):
        print('BLOKKOLVA: a mentési előfeltétel vagy egy művelet nem teljesült. Nincs igazolt teljes mentés.')
        sys.exit(1)
