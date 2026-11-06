import importlib.util, os, sys, tempfile, unittest
from unittest import mock
spec = importlib.util.spec_from_file_location('gate', os.path.join(os.path.dirname(__file__), 'test-db-install-gate.py'))
gate = importlib.util.module_from_spec(spec); spec.loader.exec_module(gate)
REF = 'mojnqizbcaczstguikpv'

class Gate(unittest.TestCase):
    def test_marker(self):
        self.assertEqual(gate.marker_file('x [test-db-install deployment/test-mailbox/send-ledger.sql] y'), 'deployment/test-mailbox/send-ledger.sql')
        for bad in ['none', '[test-db-install ../etc/passwd]', '[test-db-install deployment/x/../y.sql]',
                    '[test-db-install deployment/test-mailbox/send-ledger.verify.sql]', '[test-db-install deployment/test-mailbox/missing.sql]',
                    '[test-db-install deployment/test-mailbox/send-ledger.sql] [test-db-install deployment/test-mailbox/install.sql]']:
            with self.assertRaises(SystemExit, msg=bad): gate.marker_file(bad)
    def test_target(self):
        self.assertTrue(gate.target_ok(f'postgresql://postgres.{REF}:pw@aws-0-eu-west-2.pooler.supabase.com:5432/postgres'))
        self.assertTrue(gate.target_ok(f'postgresql://postgres:pw@db.{REF}.supabase.co:5432/postgres'))
        for bad in ['', 'postgresql://postgres.livexprojectxrefxabc:pw@x/postgres', f'postgresql://postgres.livexprojectxrefxabc:pw@db.{REF}.supabase.co/postgres']:
            self.assertFalse(gate.target_ok(bad), bad)
    def test_fresh_backup(self):
        now = 1_800_000_000
        iso = lambda t: __import__('datetime').datetime.fromtimestamp(t, __import__('datetime').timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        ok_steps = [{'name': n, 'conclusion': 'success'} for n in gate.REQUIRED_STEPS]
        def fake(runs, steps=ok_steps, digest='sha256:' + 'a' * 64):
            def api(path):
                if path.endswith('per_page=10'): return {'workflow_runs': runs}
                if path.endswith('/jobs'): return {'jobs': [{'name': 'export-restore', 'steps': steps}]}
                return {'artifacts': [{'digest': digest}]}
            return api
        with mock.patch.object(gate, 'api', fake([{'id': 7, 'updated_at': iso(now - 600)}])):
            self.assertEqual(gate.fresh_backup('o/r', now), (7, 'a' * 64))
        for runs, steps in [([{'id': 7, 'updated_at': iso(now - 4 * 3600)}], ok_steps),
                            ([{'id': 7, 'updated_at': iso(now - 600)}], [{'name': gate.REQUIRED_STEPS[0], 'conclusion': 'success'}, {'name': gate.REQUIRED_STEPS[1], 'conclusion': 'skipped'}]),
                            ([], ok_steps)]:
            with mock.patch.object(gate, 'api', fake(runs, steps)):
                with self.assertRaises(SystemExit): gate.fresh_backup('o/r', now)

if __name__ == '__main__':
    os.chdir(os.path.join(os.path.dirname(__file__), '..')); unittest.main()
