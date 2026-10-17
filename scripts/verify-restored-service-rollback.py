"""Run only against sc_restore in the disposable workflow service; never source."""
import importlib.util
import json
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('restore', ROOT / 'verify-isolated-restore.py')
restore = importlib.util.module_from_spec(spec)
spec.loader.exec_module(restore)
report = {'source_connection': 'NEVER_OPENED', 'claims': 'SIMULATED_NOT_AUTH_LOGIN',
          'service_rpc_rollback': 'NOT_RUN', 'manifest_unchanged': False}
try:
    if os.environ.get('PGDATABASE') != 'sc_restore':
        raise RuntimeError('DESTINATION_NOT_ISOLATED')
    restore.validate_destination(dict(os.environ, PGDATABASE='postgres'))
    manifest = (ROOT / 'case-store-recovery-manifest.sql').read_text()
    before = json.loads(restore.sql(manifest))
    result = restore.sql((ROOT / 'restored-service-rollback.sql').read_text())
    if not result.rstrip().endswith(b'RESTORED_SERVICE_ROLLBACK_PASS'):
        raise RuntimeError('SERVICE_FIXTURE_INCOMPLETE')
    report['manifest_unchanged'] = json.loads(restore.sql(manifest)) == before
    if not report['manifest_unchanged']:
        raise RuntimeError('SERVICE_FIXTURE_NOT_ROLLED_BACK')
    report['service_rpc_rollback'] = 'PASS'
    report['scope'] = 'actual restored SQL RPC success, read/approve separate from write, audit, bad MAC/replay, Reader/Writer/anon/tenant boundaries; fixture records rolled back'
    report['completed'] = True
except Exception:
    report['completed'] = False
finally:
    directory = Path('/tmp/runtime-evidence')
    directory.mkdir(exist_ok=True)
    (directory / 'SERVICE-ROLLBACK.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report))
if not report['completed']:
    raise SystemExit(1)
