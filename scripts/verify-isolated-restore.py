"""Restore the pinned existing snapshot or verified current export into ephemeral PostgreSQL only.
No source credentials, no remote source connection, no plaintext artifact/logs.
"""
import hashlib, importlib.util, json, os, re, subprocess, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('cloud', ROOT / 'cloud-encrypted-backup.py')
cloud = importlib.util.module_from_spec(spec); spec.loader.exec_module(cloud)
report = {'snapshot_run':38127744637, 'source_connection':'NEVER_OPENED',
          'destination':'ephemeral PostgreSQL 17 service', 'full_restore':'NOT_RUN',
          'case_manifest':'NOT_RUN', 'auth_api_login':'NOT_RUN', 'rls_behavior':'NOT_RUN'}
def run(args, data=None, required=True):
    p = subprocess.run(args, input=data, capture_output=True)
    if required and p.returncode:
        diag=p.stderr.decode(errors='replace')
        # Only PostgreSQL ERROR headline, constrained to safe identifier text.
        for line in diag.splitlines():
            if 'ERROR:' in line:
                safe=line.split('ERROR:',1)[1].strip()
                if re.fullmatch(r'[A-Za-z0-9_ \"().:-]{1,220}',safe):
                    report['operation_error']=safe
                break
        raise RuntimeError('ISOLATED_OPERATION_FAILED')
    return p
def sql(text):
    return run(['psql','-X','-w','-qAt','-v','ON_ERROR_STOP=1'], text.encode()).stdout
def restore_diag(p):
    for line in p.stderr.decode(errors='replace').splitlines():
        if 'ERROR:' in line:
            safe=line.split('ERROR:',1)[1].strip()
            if re.fullmatch(r'[A-Za-z0-9_ \"().:/-]{1,250}',safe): report['restore_error']=safe
            break
CIPHERTEXT_NAMES = ('database.dump.gpg', 'manifest.json.gpg', 'roles.sql.gpg')
PINNED_HASHES = {'database.dump.gpg':'426322d99c0eb10fa07d38d3184df614d10e0696759e439abe2fe57e191df3e7',
                'manifest.json.gpg':'e01e54ec40de5fb38ec04d3bc56ab227ddc26af43cc1b60df372d238c115444e',
                'roles.sql.gpg':'2b77a4cd435d638d60d0f781191313fca72b9c79cee1ce5edfb615d27fe5ee1c'}
ARCHIVED_20261013_HASHES = {
    'database.dump.gpg': '94818939c994bb304fab79446d463701d2e49cee18b77b35250734d51b1a304e',
    'manifest.json.gpg': 'ec69c6b7bd173c728fddc3801ffcb548565640178d2844cfe5c5676127366368',
    'roles.sql.gpg': 'eebaf330e816e78c1027ef98b6e3288dc2b6cbe3d141c1ee301d5ae70b37ee35'}
FRESH_DIRECTORY = Path('/tmp/sarberki-cloud-backup')


def validate_destination(values):
    # PG_MAJOR/PG_VERSION/PGDATA are Docker server metadata, not libpq routing.
    # All other inherited PG* overrides remain rejected.
    # Never permit inherited libpq service, source credentials or routing overrides.
    if (values.get('PGHOST') != 'postgres' or values.get('PGUSER') != 'restore_admin'
            or values.get('PGDATABASE') != 'postgres'
            or values.get('PGPASSWORD') != 'ephemeral-isolated-test-only'
            or values.get('PGPORT', '5432') != '5432'
            or any(values.get(k) for k in values if k.startswith('PG')
                   and k not in {'PGHOST', 'PGUSER', 'PGDATABASE', 'PGPASSWORD', 'PGPORT',
                                 'PG_MAJOR', 'PG_VERSION', 'PGDATA'})
            or any(values.get(k) for k in values if k.startswith('SARBERKI_BACKUP_DB_'))):
        raise RuntimeError('DESTINATION_NOT_ISOLATED')


def fresh_identity(directory, values):
    # This is only the immediately preceding export in this protected Actions job.
    # There is no caller-supplied path, unchecked checksum bypass or remote source.
    if directory != FRESH_DIRECTORY or directory.is_symlink():
        raise RuntimeError('FRESH_DIRECTORY_INVALID')
    allowed = set(CIPHERTEXT_NAMES) | {'SHA256SUMS.txt', 'STATUS.txt', 'PROVENANCE.json'}
    if set(p.name for p in directory.iterdir()) != allowed:
        raise RuntimeError('FRESH_FILES_INVALID')
    if any(not (directory / name).is_file() or (directory / name).is_symlink() for name in allowed):
        raise RuntimeError('FRESH_FILES_INVALID')
    provenance = json.loads((directory / 'PROVENANCE.json').read_text())
    if (set(provenance) != {'project', 'source_read_only', 'source_commit', 'run_id'}
            or provenance['project'] != cloud.owner.PROJECT
            or provenance['source_read_only'] is not True
            or not re.fullmatch(r'[0-9a-f]{40}', str(provenance['source_commit']))
            or provenance['source_commit'] != values.get('GITHUB_SHA')
            or not re.fullmatch(r'[0-9]+', str(provenance['run_id']))
            or str(provenance['run_id']) != values.get('GITHUB_RUN_ID')
            or values.get('GITHUB_REF') != 'refs/heads/gmail-test-subject-allowlist'
            or values.get('GITHUB_REPOSITORY') != 'valkana6666-svg/Sarberki-Email-Age'):
        raise RuntimeError('FRESH_PROVENANCE_INVALID')
    status = (directory / 'STATUS.txt').read_text()
    if ('Source: ' + cloud.owner.PROJECT + '; source connection read-only.\n' not in status
            or 'Ciphertext decryption/readback: VERIFIED (AES256 symmetric).\n' not in status):
        raise RuntimeError('FRESH_EXPORT_STATUS_INVALID')
    expected = {}
    for line in (directory / 'SHA256SUMS.txt').read_text(encoding='ascii').splitlines():
        match = re.fullmatch(r'([0-9a-f]{64})  (database.dump.gpg|manifest.json.gpg|roles.sql.gpg)', line)
        if not match or match[2] in expected:
            raise RuntimeError('FRESH_CHECKSUM_MANIFEST_INVALID')
        expected[match[2]] = match[1]
    if set(expected) != set(CIPHERTEXT_NAMES):
        raise RuntimeError('FRESH_CHECKSUM_MANIFEST_INVALID')
    return expected, provenance


def read_ciphertexts(directory, expected):
    encrypted = {k:(directory/k).read_bytes() for k in expected}
    if any(not encrypted[k] or hashlib.sha256(encrypted[k]).hexdigest()!=v for k,v in expected.items()):
        raise RuntimeError('SNAPSHOT_IDENTITY_FAILED')
    return encrypted


def main():
    validate_destination(os.environ)
    report['destination_identity_verified'] = True
    fresh_mode = os.environ.get('SARBERKI_RESTORE_INPUT')
    if fresh_mode:
        if fresh_mode not in {'current-export-v1', 'archived-export-38414863596'} or os.environ.get('SARBERKI_RESTORE_SETUP_ONLY'):
            raise RuntimeError('RESTORE_INPUT_INVALID')
        identity_values = os.environ
        if fresh_mode == 'archived-export-38414863596':
            identity_values = dict(os.environ, GITHUB_SHA='ad3aad6688416e223a18fe002101521bd5f467ff',
                                   GITHUB_RUN_ID='38414863596')
        expected, provenance = fresh_identity(FRESH_DIRECTORY, identity_values)
        if fresh_mode == 'archived-export-38414863596' and expected != ARCHIVED_20261013_HASHES:
            raise RuntimeError('ARCHIVED_SNAPSHOT_IDENTITY_FAILED')
        encrypted = read_ciphertexts(FRESH_DIRECTORY, expected)
        report.update(snapshot_run=int(provenance['run_id']), snapshot_commit=provenance['source_commit'],
                      source_project=provenance['project'], input_mode='pinned_archived_export' if fresh_mode == 'archived-export-38414863596' else 'verified_current_export',
                      verification_run=os.environ.get('GITHUB_RUN_ID'),
                      verification_commit=os.environ.get('GITHUB_SHA'),
                      ciphertexts_sha256=expected)
    else:
        encrypted = read_ciphertexts(Path('/tmp/original-backup'), PINNED_HASHES)
    report['ciphertexts_identity_sha256' if fresh_mode else 'original_ciphertexts_sha256']='PASS'
    phrase = os.environ.pop('SARBERKI_BACKUP_PASSPHRASE')
    with tempfile.TemporaryDirectory(prefix='restore-gpg-') as gh, tempfile.TemporaryDirectory(dir='/dev/shm') as ram:
        crypto = dict(os.environ, GNUPGHOME=gh)
        plain = {k:cloud.symmetric_command(['--decrypt'],crypto,phrase,data=v) for k,v in encrypted.items()}
        phrase = None
        if not plain['database.dump.gpg'].startswith(b'PGDMP'): raise RuntimeError('NOT_POSTGRES_ARCHIVE')
        report['portable_decryption']='PASS_ON_NEW_LINUX_RUNNER_NO_DPAPI'
        baseline = json.loads(plain['manifest.json.gpg'])
        dump = Path(ram)/'snapshot.dump'; dump.write_bytes(plain['database.dump.gpg']); dump.chmod(0o600)
        toc = run(['pg_restore','--list',str(dump)]).stdout.decode()
        cloud.owner.validate_toc(toc)
        report['required_archive_coverage']='PASS'
        sql('CREATE DATABASE sc_restore;')
        os.environ['PGDATABASE']='sc_restore'
        if ' SCHEMA - public ' in toc: sql('DROP SCHEMA public;')
        roles=plain['roles.sql.gpg'].decode()
        grantors=sorted(set(re.findall(r'GRANTED BY ([a-z_][a-z0-9_]*)',roles)))
        if grantors:
            # PG17 rejects hosted explicit grantors in a fresh stock cluster.
            # Apply the same membership/ADMIN/INHERIT/SET permissions using
            # the isolated bootstrap grantor; record metadata difference.
            roles=re.sub(r' GRANTED BY [a-z_][a-z0-9_]*','',roles)
            report['role_bootstrap_adaptation']='membership grantor changed to restore_admin; role attributes and membership options preserved'
            report['original_membership_grantor_identity']='NOT_REPRODUCED_ON_STOCK_POSTGRESQL'
        sql(roles)
        report['roles_restore']='PASS_NO_ROLE_PASSWORDS'
        event_owners=sorted(set(re.findall(r'(?m)^.* EVENT TRIGGER - \S+ ([a-z_][a-z0-9_]*)$',toc)))
        for role in event_owners: sql('ALTER ROLE '+role+' SUPERUSER;')
        if event_owners:
            report['event_trigger_bootstrap']='temporary superuser for event trigger owners; restore original attributes after pg_restore'
        result = run(['pg_restore','--exit-on-error','--dbname=sc_restore',str(dump)],required=False)
        report['full_restore']='PASS' if result.returncode==0 else 'FAILED'
        if result.returncode:
            restore_diag(result)
            if fresh_mode:
                raise RuntimeError('CURRENT_EXPORT_REQUIRES_COMPLETE_RESTORE')
            # Supabase Vault extension is not installed in vanilla PostgreSQL.
            # Preserve exact failure category, never publish SQL/data/stderr.
            diag=result.stderr.lower()
            report['full_restore_failure']='MISSING_SUPABASE_VAULT_EXTENSION' if b'supabase_vault' in diag else 'OTHER_RESTORE_ERROR'
            os.environ['PGDATABASE']='postgres'; sql('DROP DATABASE sc_restore; CREATE DATABASE sc_restore;')
            os.environ['PGDATABASE']='sc_restore'
            if ' SCHEMA - public ' in toc: sql('DROP SCHEMA public;')
            omitted=[]; selected=[]
            for line in toc.splitlines():
                if line.startswith(';') or not line.strip(): selected.append(line); continue
                if re.search(r'\bvault\b|\bsupabase_vault\b',line): omitted.append(line.split(';',1)[1].strip())
                else: selected.append(line)
            listing=Path(ram)/'selected.list'; listing.write_text('\n'.join(selected)+'\n')
            report['excluded_toc_objects']=omitted
            result=run(['pg_restore','--exit-on-error','--use-list='+str(listing),'--dbname=sc_restore',str(dump)],required=False)
            report['restore_without_vault']='PASS' if not result.returncode else 'FAILED'
            if result.returncode:
                restore_diag(result)
                raise RuntimeError('SCOPED_RESTORE_FAILED')
        for role in event_owners:
            attrs=re.findall(r'(?m)^ALTER ROLE '+re.escape(role)+r' WITH [^\n]+;',plain['roles.sql.gpg'].decode())
            if len(attrs)!=1: raise RuntimeError('OWNER_ATTRIBUTES_MISSING')
            sql(attrs[0])
        report['event_owner_original_attributes_reapplied']='PASS'
        if os.environ.get('SARBERKI_RESTORE_SETUP_ONLY') == 'runtime-resume-20261011':
            if report['full_restore'] != 'PASS':
                raise RuntimeError('RUNTIME_REQUIRES_COMPLETE_RESTORE')
            # Required disposable environment setup, not a repeat of the
            # successful 43-table/RLS/CAS verification in run 38129512850.
            report['verified_scope']='setup only; earlier full verification not repeated'
            report['prior_verified_restore_run']=38129512850
            report['successful_tests_repeated']=False
            return
        restored=json.loads(sql((ROOT/'case-store-recovery-manifest.sql').read_text()))
        comparisons={k:restored.get(k)==v for k,v in baseline.items()}
        report['case_manifest_fields']=comparisons
        report['case_manifest']='PASS' if all(comparisons.values()) else 'FAILED'
        report['case_counts']=restored['counts']
        report['auth_counts']=json.loads(sql("select json_build_object('users',(select count(*) from auth.users),'identities',(select count(*) from auth.identities));"))
        # COPY payloads are rendered from both original archive and restored DB,
        # canonicalized in memory; no tokens/password hashes reach output.
        original=run(['pg_restore','--data-only','--file=-',str(dump)]).stdout
        actual=run(['pg_dump','--data-only','--format=plain','--dbname=sc_restore']).stdout
        report['restored_server_version']=sql('show server_version;').decode().strip()
        report['extensions']=json.loads(sql("select json_agg(x order by extname) from (select extname,extversion from pg_extension) x;"))
        def sequences(data):
            return sorted(re.findall(rb'(?m)^SELECT pg_catalog.setval\([^\n]+;',data))
        report['sequence_values_equal']=sequences(original)==sequences(actual)
        current_roles=run(['pg_dumpall','--roles-only','--no-role-passwords']).stdout.decode()
        source_attrs=re.findall(r'(?m)^ALTER ROLE \S+ WITH [^\n]+;',plain['roles.sql.gpg'].decode())
        report['all_source_role_attributes_equal']=all(line in current_roles.splitlines() for line in source_attrs)
        def copies(data):
            chunks={}
            for m in re.finditer(rb'(?m)^COPY ([^\n]+) FROM stdin;\n(.*?)^\\\.\n',data,re.S|re.M):
                chunks[m[1].decode()]=hashlib.sha256(b'\n'.join(sorted(m[2].splitlines()))).hexdigest()
            return chunks
        before,after=copies(original),copies(actual)
        matched={k:after.get(k)==v for k,v in before.items() if report['full_restore']=='PASS' or not k.startswith('vault.')}
        report['all_archive_tables_compared']=set(before)==set(after)
        report['all_table_copy_payloads_equal']=bool(matched) and all(matched.values())
        report['tables_compared']=len(matched)
        report['vault_counts']=json.loads(sql("select json_build_object('secrets',(select count(*) from vault.secrets));")) if report['full_restore']=='PASS' else 'NOT_RESTORED'
        report['table_payload_comparison']=matched
        policy=ROOT.parent/'reports/supabase-connection-verification-2026-10-09/CLOUD-POLICY-TEST.sql'
        sql(policy.read_text())
        report['rls_behavior']='PASS_RESTORED_DB_SIMULATED_JWT_CLAIMS'
        report['cas_history_uniqueness_audit']='PASS_RESTORED_DB_ROLLBACK_FIXTURE'
        report['manifest_after_rollback_equal']=json.loads(sql((ROOT/'case-store-recovery-manifest.sql').read_text()))==restored
        # All roles must exist with identical attributes, as roles SQL restored
        # with ON_ERROR_STOP and without replacing source role passwords.
        report['role_passwords']='NOT_INCLUDED_MUST_REPROVISION'
        if (fresh_mode and not report['all_archive_tables_compared']) or report['case_manifest']!='PASS' or not report['all_table_copy_payloads_equal'] or not report['sequence_values_equal'] or not report['all_source_role_attributes_equal'] or not report['manifest_after_rollback_equal']:
            raise RuntimeError('RESTORED_CONTENT_MISMATCH')
        report['verified_scope']='actual SQL restore; table data; case schema/RLS definitions/grants/functions/audit hashes'
def entrypoint():
    try:
        main()
    except Exception as exc:
        # Emit only known constant error codes; never exception values or SQL.
        code = str(exc)
        if isinstance(exc, RuntimeError) and re.fullmatch(r'[A-Z_]{3,80}', code):
            report['failure_code'] = code
        report['verification_completed']=False
        print('Restore verification incomplete; see sanitized report.')
    else:
        report['verification_completed']=True
    finally:
        out=Path('/tmp/restore-evidence'); out.mkdir(exist_ok=True)
        (out/'ISOLATED-RESTORE.json').write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps({k:v for k,v in report.items() if k in ('portable_decryption','full_restore','restore_without_vault','case_manifest','tables_compared','verification_completed','full_restore_failure')}))
        # Destination is the disposable job service, not the source project.
        if report.get('destination_identity_verified') and not (report.get('verification_completed') and os.environ.get('SARBERKI_KEEP_ISOLATED_DB')=='runtime-test'):
            os.environ['PGDATABASE']='postgres'
            run(['psql','-X','-w','-qAt','-c','DROP DATABASE IF EXISTS sc_restore WITH (FORCE);'],required=False)
    if not report.get('verification_completed'):
        raise SystemExit(1)


if __name__ == '__main__':
    entrypoint()
