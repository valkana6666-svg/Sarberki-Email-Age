"""Restore the pinned EXISTING encrypted snapshot into ephemeral PostgreSQL only.
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
def main():
    if os.environ.get('PGHOST') != 'postgres' or os.environ.get('PGUSER') != 'restore_admin':
        raise RuntimeError('DESTINATION_NOT_ISOLATED')
    expected = {'database.dump.gpg':'426322d99c0eb10fa07d38d3184df614d10e0696759e439abe2fe57e191df3e7',
                'manifest.json.gpg':'e01e54ec40de5fb38ec04d3bc56ab227ddc26af43cc1b60df372d238c115444e',
                'roles.sql.gpg':'2b77a4cd435d638d60d0f781191313fca72b9c79cee1ce5edfb615d27fe5ee1c'}
    encrypted = {k:(Path('/tmp/original-backup')/k).read_bytes() for k in expected}
    if any(hashlib.sha256(encrypted[k]).hexdigest()!=v for k,v in expected.items()):
        raise RuntimeError('SNAPSHOT_IDENTITY_FAILED')
    report['original_ciphertexts_sha256']='PASS'
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
        sql(plain['roles.sql.gpg'].decode())
        report['roles_restore']='PASS_NO_ROLE_PASSWORDS'
        result = run(['pg_restore','--exit-on-error','--dbname=sc_restore',str(dump)],required=False)
        report['full_restore']='PASS' if result.returncode==0 else 'FAILED'
        if result.returncode:
            # Supabase Vault extension is not installed in vanilla PostgreSQL.
            # Preserve exact failure category, never publish SQL/data/stderr.
            diag=result.stderr.lower()
            report['full_restore_failure']='MISSING_SUPABASE_VAULT_EXTENSION' if b'supabase_vault' in diag else 'OTHER_RESTORE_ERROR'
            os.environ['PGDATABASE']='postgres'; sql('DROP DATABASE sc_restore; CREATE DATABASE sc_restore;')
            os.environ['PGDATABASE']='sc_restore'
            omitted=[]; selected=[]
            for line in toc.splitlines():
                if line.startswith(';') or not line.strip(): selected.append(line); continue
                if re.search(r'\bvault\b|\bsupabase_vault\b',line): omitted.append(line.split(';',1)[1].strip())
                else: selected.append(line)
            listing=Path(ram)/'selected.list'; listing.write_text('\n'.join(selected)+'\n')
            report['excluded_toc_objects']=omitted
            result=run(['pg_restore','--exit-on-error','--use-list='+str(listing),'--dbname=sc_restore',str(dump)],required=False)
            report['restore_without_vault']='PASS' if not result.returncode else 'FAILED'
            if result.returncode: raise RuntimeError('SCOPED_RESTORE_FAILED')
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
        def copies(data):
            chunks={}
            for m in re.finditer(rb'(?m)^COPY ([^\n]+) FROM stdin;\n(.*?)^\\\.\n',data,re.S|re.M):
                chunks[m[1].decode()]=hashlib.sha256(b'\n'.join(sorted(m[2].splitlines()))).hexdigest()
            return chunks
        before,after=copies(original),copies(actual)
        matched={k:after.get(k)==v for k,v in before.items() if not k.startswith('vault.')}
        report['all_table_copy_payloads_equal']=bool(matched) and all(matched.values())
        report['tables_compared']=len(matched)
        report['table_payload_comparison']=matched
        # All roles must exist with identical attributes, as roles SQL restored
        # with ON_ERROR_STOP and without replacing source role passwords.
        report['role_passwords']='NOT_INCLUDED_MUST_REPROVISION'
        if report['case_manifest']!='PASS' or not report['all_table_copy_payloads_equal']:
            raise RuntimeError('RESTORED_CONTENT_MISMATCH')
        report['verified_scope']='actual SQL restore; table data; case schema/RLS definitions/grants/functions/audit hashes'
try:
    main()
except Exception:
    report['verification_completed']=False
    print('Restore verification incomplete; see sanitized report.')
else:
    report['verification_completed']=True
finally:
    out=Path('/tmp/restore-evidence'); out.mkdir(exist_ok=True)
    (out/'ISOLATED-RESTORE.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k in ('portable_decryption','full_restore','restore_without_vault','case_manifest','tables_compared','verification_completed','full_restore_failure')}))
    # Destination is the disposable job service, not the source project.
    if os.environ.get('PGHOST')=='postgres':
        os.environ['PGDATABASE']='postgres'
        run(['psql','-X','-w','-qAt','-c','DROP DATABASE IF EXISTS sc_restore WITH (FORCE);'],required=False)
