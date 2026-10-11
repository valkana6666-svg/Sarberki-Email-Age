"""Offline safety and real GnuPG tests; no Supabase credentials or connections."""
import importlib.util
import os
from pathlib import Path
import subprocess
import socket
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('cloud_backup', Path(__file__).with_name('cloud-encrypted-backup.py'))
cloud = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cloud)


class CloudBackupSafety(unittest.TestCase):
    def test_read_only_and_inherited_connection_overrides(self):
        values = {'PATH': os.environ['PATH'], 'SARBERKI_BACKUP_HOST': 'aws-0-eu-west-2.pooler.supabase.com',
                  'SARBERKI_BACKUP_DB_PASSWORD': 'synthetic-fixture', 'PGSERVICE': 'unrelated',
                  'PGSSLMODE': 'disable', 'PGOPTIONS': '-c default_transaction_read_only=off'}
        env = cloud.source_environment(values)
        self.assertNotIn('PGSERVICE', env)
        self.assertEqual(env['PGSSLMODE'], 'verify-full')
        self.assertIn('default_transaction_read_only=on', env['PGOPTIONS'])
        self.assertEqual(env['PGUSER'], 'postgres.mojnqizbcaczstguikpv')
        self.assertFalse(any(k.startswith('SARBERKI_') for k in env))
        values['SARBERKI_BACKUP_HOST'] = 'attacker.invalid'
        with self.assertRaises(ValueError):
            cloud.source_environment(values)

    def test_existing_uri_secret_is_parsed_without_connection_arguments(self):
        env = cloud.source_environment({'SARBERKI_BACKUP_DB_URL':
            'postgresql://postgres.mojnqizbcaczstguikpv:fixture%40password@aws-0-eu-west-2.pooler.supabase.com:5432/postgres'})
        self.assertEqual(env['PGPASSWORD'], 'fixture@password')
        self.assertNotIn('SARBERKI_BACKUP_DB_URL', env)
        for uri in ['postgresql://postgres.other:fixture@aws-0-eu-west-2.pooler.supabase.com:5432/postgres',
                    'postgresql://postgres.mojnqizbcaczstguikpv:fixture@aws-0-eu-west-2.pooler.supabase.com:6543/postgres']:
            with self.assertRaises(ValueError):
                cloud.source_environment({'SARBERKI_BACKUP_DB_URL': uri})

    def test_reserved_password_delimiters_and_endpoint_pinning(self):
        from urllib.parse import quote
        base = 'postgresql://postgres.mojnqizbcaczstguikpv:'
        endpoint = '@aws-0-eu-west-2.pooler.supabase.com:5432/postgres'
        for password in ['fixture#password', 'fixture?password', 'fixture/password',
                         'fixture@password', 'fixture:password', 'fixture[password]', 'fixture password']:
            for supplied in [password, quote(password, safe='')]:
                self.assertEqual(cloud.source_environment({'SARBERKI_BACKUP_DB_URL':
                    base + supplied + endpoint})['PGPASSWORD'], password)
        for supplied in [base + 'fixture@attacker.invalid:5432/postgres',
                         base + 'fixture' + endpoint + '?host=attacker.invalid',
                         base + '[YOUR-PASSWORD]' + endpoint,
                         base + 'fixture' + endpoint.replace(':5432/', ':6543/'),
                         base + 'fixture' + endpoint.replace('eu-west-2', 'eu-west-1'),
                         base + 'fixture' + endpoint + '#fragment']:
            with self.assertRaises(cloud.BackupConfigurationError) as caught:
                cloud.source_environment({'SARBERKI_BACKUP_DB_URL': supplied})
            self.assertNotIn('fixture', str(caught.exception))
            self.assertNotIn(supplied, str(caught.exception))

    def test_failed_and_oversized_export_rejected(self):
        with self.assertRaises(RuntimeError):
            cloud.bounded([sys.executable, '-c', "print('partial');raise SystemExit(1)"], dict(os.environ))
        with self.assertRaises(RuntimeError):
            cloud.bounded([sys.executable, '-c', "print('too large')"], dict(os.environ), maximum=3)

    def test_real_encryption_roundtrip_and_damaged_ciphertext(self):
        # Some Work containers prohibit Unix sockets required by gpg-agent.
        try:
            with tempfile.TemporaryDirectory(prefix='gpg-socket-', dir='/tmp') as probe:
                with socket.socket(socket.AF_UNIX) as sock:
                    sock.bind(str(Path(probe) / 'agent'))
        except PermissionError:
            self.skipTest('This environment forbids the Unix socket required by gpg-agent.')
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            home = root / 'keyring'
            home.mkdir(mode=0o700)
            env = dict(os.environ, GNUPGHOME=str(home))
            symmetric_target = root / 'symmetric.gpg'
            passphrase = 'synthetic fixture encryption passphrase only'
            plaintext = b'synthetic archive content only\x00\xff\n'
            cloud.symmetric_command(['--symmetric', '--cipher-algo', 'AES256', '--output', str(symmetric_target)],
                                    env, passphrase, plaintext)
            self.assertEqual(cloud.symmetric_command(['--decrypt', str(symmetric_target)], env, passphrase), plaintext)
            with self.assertRaises(RuntimeError):
                cloud.symmetric_command(['--decrypt', str(symmetric_target)], env, 'wrong fixture passphrase')
            cloud.owner.checked(['gpg', '--batch', '--pinentry-mode', 'loopback', '--passphrase', '',
                                 '--quick-generate-key', 'Offline synthetic fixture', 'rsa2048', 'encr', '0'], env)
            listing = cloud.owner.checked(['gpg', '--with-colons', '--fingerprint', '--list-keys'], env).decode()
            fingerprint = next(line.split(':')[9] for line in listing.splitlines() if line.startswith('fpr:'))
            plaintext = b'synthetic archive content only\x00\xff\n'
            target = root / 'fixture.gpg'
            cloud.encrypt(plaintext, target, env, fingerprint)
            self.assertNotIn(plaintext, target.read_bytes())
            self.assertEqual(cloud.owner.checked(['gpg', '--batch', '--decrypt', str(target)], env), plaintext)
            target.write_bytes(target.read_bytes()[:-30])
            result = subprocess.run(['gpg', '--batch', '--decrypt', str(target)], env=env, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(target.with_suffix('.gpg.partial').exists())


if __name__ == '__main__':
    unittest.main()
