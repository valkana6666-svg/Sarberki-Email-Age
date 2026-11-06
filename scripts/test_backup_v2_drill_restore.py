import importlib.util, os, unittest
spec = importlib.util.spec_from_file_location('drill', os.path.join(os.path.dirname(__file__), 'backup-v2-drill-restore.py'))
drill = importlib.util.module_from_spec(spec); spec.loader.exec_module(drill)

class Target(unittest.TestCase):
    def test_only_a_single_non_test_project(self):
        self.assertEqual(drill.target_ref('postgresql://postgres.drillxprojectxrefxab:pw@aws-0-eu-west-2.pooler.supabase.com:5432/postgres'), 'drillxprojectxrefxab')
        for bad in ['', 'postgresql://postgres.mojnqizbcaczstguikpv:pw@aws-0-eu-west-2.pooler.supabase.com/postgres',
                    'postgresql://postgres.drillxprojectxrefxab:pw@db.mojnqizbcaczstguikpv.supabase.co/postgres']:
            with self.assertRaises(SystemExit, msg=bad): drill.target_ref(bad)

if __name__ == '__main__':
    unittest.main()
