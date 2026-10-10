"""Offline tests only: no cloud or owner credentials used."""
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('owner-encrypted-backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)

class BackupSafety(unittest.TestCase):
    def test_project_and_session_only(self):
        self.assertEqual(backup.connection('aws-0-eu-west-2.pooler.supabase.com', 'postgres.' + backup.PROJECT)['PGPORT'], '5432')
        self.assertEqual(backup.connection('aws-0-eu-west-2.pooler.supabase.com', 'postgres.' + backup.PROJECT)['PGSSLMODE'], 'verify-full')
        for host, user in [('attacker.invalid', 'postgres.' + backup.PROJECT), ('aws-0-eu-west-2.pooler.supabase.com', 'postgres.other')]:
            with self.assertRaises(ValueError):
                backup.connection(host, user)

    def test_archive_requires_schema_auth_and_data(self):
        toc = '\n'.join('1; 0 0 '+kind+' public '+name+' postgres' for name in backup.REQUIRED for kind in ('TABLE', 'TABLE DATA'))
        toc += '\n1; 0 0 TABLE DATA auth users postgres\n1; 0 0 TABLE DATA auth identities postgres'
        backup.validate_toc(toc)
        for line in toc.splitlines():
            with self.assertRaises(RuntimeError):
                backup.validate_toc(toc.replace(line, ''))

    def test_stream_transport_and_failed_export_cleanup(self):
        # Simulated encryptor tests publication/cleanup only, NOT cryptography.
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            fake = root / 'encryptor.py'
            fake.write_text("import pathlib,sys,zlib; pathlib.Path(sys.argv[sys.argv.index('--output')+1]).write_bytes(zlib.compress(sys.stdin.buffer.read()))")
            original_run = subprocess.run
            def run(args, **kwargs):
                return original_run([sys.executable, str(fake), *args[1:]], **kwargs)
            target = root / 'fixture.gpg'
            with patch.object(backup.subprocess, 'run', side_effect=run):
                backup.encrypt_command([sys.executable, '-c', "print('synthetic fixture archive')"], target, 'simulated-gpg', 'fixture', None)
                import zlib
                self.assertEqual(zlib.decompress(target.read_bytes()), b'synthetic fixture archive\n')
                failed = root / 'failed.gpg'
                with self.assertRaises(RuntimeError):
                    backup.encrypt_command([sys.executable, '-c', "print('partial');raise SystemExit(1)"], failed, 'simulated-gpg', 'fixture', None)
                self.assertFalse(failed.exists())
                self.assertFalse(failed.with_suffix('.gpg.partial').exists())

if __name__ == '__main__':
    unittest.main()
