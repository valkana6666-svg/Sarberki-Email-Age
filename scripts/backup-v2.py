"""Issue #6: isolated orchestration; existing export/restore algorithms retained."""
import hashlib,importlib.util,json,os,re,subprocess,sys,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent
BRANCH='refs/heads/gmail-test-subject-allowlist'
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
SAFE_FAILURE_CODES = frozenset({'UNAPPROVED_EXECUTION_IDENTITY', 'V2_NOT_ENABLED',
    'NEW_PROTECTED_PASSPHRASE_REQUIRED', 'PROTECTED_DATABASE_ACCESS_REQUIRED',
    'APPROVED_DRIVE_FOLDER_REQUIRED', 'APPROVED_DURABLE_BUCKET_REQUIRED',
    'UNAPPROVED_STORAGE_PROVIDER', 'UNEXPECTED_EXPORT_FILES', 'FULL_SQL_RESTORE_REQUIRED',
    'ZIP_CRC_ERROR', 'INVALID_OPERATION'})
def safe_failure(exc):
    code = str(exc)
    return code if isinstance(exc, ValueError) and code in SAFE_FAILURE_CODES else 'UPSTREAM_OPERATION_FAILED'
def validate(values):
    if values.get('GITHUB_REPOSITORY')!='valkana6666-svg/Sarberki-Email-Age' or values.get('GITHUB_REF')!=BRANCH:
        raise ValueError('UNAPPROVED_EXECUTION_IDENTITY')
    if values.get('SARBERKI_V2_ENABLED')!='yes':raise ValueError('V2_NOT_ENABLED')
    phrase=values.get('SARBERKI_V2_PASSPHRASE','')
    if not 32<=len(phrase)<=1024 or any(c in phrase for c in '\n\r'):raise ValueError('NEW_PROTECTED_PASSPHRASE_REQUIRED')
    if not values.get('SARBERKI_BACKUP_DB_URL'):raise ValueError('PROTECTED_DATABASE_ACCESS_REQUIRED')
    provider=values.get('SARBERKI_V2_STORAGE_PROVIDER','s3')
    if provider=='drive':
        if values.get('SARBERKI_V2_DRIVE_FOLDER_ID')!='1EE2ioPs_8OwpnttT9hYHba_Y9_aWwcqz':raise ValueError('APPROVED_DRIVE_FOLDER_REQUIRED')
    elif provider=='github-bridge':
        pass  # Encrypted staging artifact; independent Drive transfer remains required.
    elif provider=='s3':
        if not values.get('SARBERKI_V2_BUCKET'):raise ValueError('APPROVED_DURABLE_BUCKET_REQUIRED')
    else:raise ValueError('UNAPPROVED_STORAGE_PROVIDER')
    return phrase
def package(directory,evidence,destination):
    required={'database.dump.gpg','roles.sql.gpg','manifest.json.gpg','SHA256SUMS.txt','STATUS.txt','PROVENANCE.json'}
    if set(p.name for p in directory.iterdir())!=required:raise ValueError('UNEXPECTED_EXPORT_FILES')
    result=json.loads(evidence.read_text())
    if result.get('full_restore')!='PASS' or result.get('verification_completed') is not True:
        raise ValueError('FULL_SQL_RESTORE_REQUIRED')
    sums=[]
    with zipfile.ZipFile(destination,'x',zipfile.ZIP_DEFLATED) as z:
        for p in sorted(directory.iterdir()):
            z.write(p,'database/'+p.name)
            sums.append(hashlib.sha256(p.read_bytes()).hexdigest()+'  database/'+p.name)
        z.write(evidence,'evidence/ISOLATED-RESTORE.json')
        # Archive checked-out commit and all its reachable history without push.
        bundle=destination.parent/'source.bundle'
        subprocess.run(['git','bundle','create',str(bundle),'HEAD','refs/backup-v2/application'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        z.write(bundle,'source.bundle')
        subprocess.run(['git','bundle','verify',str(bundle)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        inventory={**json.loads(Path('/tmp/sarberki-v2-application.json').read_text()),'backup_logic_commit':os.environ['GITHUB_SHA'],'run_id':os.environ['GITHUB_RUN_ID'],
            'full_sql_restore':'PASS','platform_restore':'NOT_VERIFIED','daily_schedule':'NOT_VERIFIED',
            'gaps':['hosted Auth/OAuth/SMTP/JWT configuration','Storage object binaries','Vault external keys',
                'Netlify account/site/context secret values','Gmail/OpenAI/Pushover reconnection','HTTPS service E2E','owner independent key readback']}
        z.writestr('RECOVERY-GAPS.json',json.dumps(inventory,indent=2))
        z.writestr('DATABASE-SHA256SUMS.txt','\n'.join(sums)+'\n')
    with zipfile.ZipFile(destination) as z:
        if z.testzip() is not None:raise ValueError('ZIP_CRC_ERROR')
    digest=hashlib.sha256(destination.read_bytes()).hexdigest()
    destination.with_suffix('.zip.sha256').write_text(digest+'  '+destination.name+'\n')
    return digest
def main():
    mode=sys.argv[1]
    if mode=='export':
        phrase=validate(os.environ)
        # Capture the current application branch without checkout, push or mutation.
        subprocess.run(['git','fetch','--no-tags','https://github.com/valkana6666-svg/Sarberki-Email-Age.git',
            'refs/heads/gmail-test-subject-allowlist:refs/backup-v2/application'],
            check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        application=subprocess.run(['git','rev-parse','refs/backup-v2/application'],
            check=True,capture_output=True).stdout.decode().strip()
        Path('/tmp/sarberki-v2-application.json').write_text(json.dumps({'application_commit':application}))
        cloud=module('cloud_v2',ROOT/'cloud-encrypted-backup.py')
        os.environ['SARBERKI_BACKUP_ENCRYPTION_PASSPHRASE']=phrase
        directory=Path('/tmp/sarberki-cloud-backup')
        cloud.export(directory)
        (directory/'PROVENANCE.json').write_text(json.dumps({'project':'mojnqizbcaczstguikpv',
            'source_read_only':True,'source_commit':os.environ['GITHUB_SHA'],'run_id':os.environ['GITHUB_RUN_ID']}))
    elif mode=='package':
        target=Path('/tmp/sarberki-v2-delivery');target.mkdir(exist_ok=False)
        digest=package(Path('/tmp/sarberki-cloud-backup'),Path('/tmp/restore-evidence/ISOLATED-RESTORE.json'),target/'sarberki-recovery.zip')
        print('Verified encrypted SQL recovery package SHA256: '+digest)
    else:raise ValueError('INVALID_OPERATION')
if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('BLOCKED: '+safe_failure(exc)+'; secret values and upstream diagnostics withheld.',file=sys.stderr);sys.exit(1)
