"""Ciphertext-only upload to an existing owner-approved versioned private S3 bucket."""
import hashlib,json,os,re,subprocess,sys,tempfile
from pathlib import Path
def aws(args):
    p=subprocess.run(['aws','s3api',*args],capture_output=True,timeout=180)
    if p.returncode:raise RuntimeError('DURABLE_STORAGE_OPERATION_FAILED')
    return json.loads(p.stdout or b'{}')
def validate_bucket(bucket):
    if not re.fullmatch(r'[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]',bucket):raise ValueError('BUCKET_NAME_INVALID')
    if aws(['get-bucket-versioning','--bucket',bucket]).get('Status')!='Enabled':raise ValueError('BUCKET_VERSIONING_REQUIRED')
    config=aws(['get-public-access-block','--bucket',bucket]).get('PublicAccessBlockConfiguration',{})
    if not all(config.get(k) is True for k in ('BlockPublicAcls','IgnorePublicAcls','BlockPublicPolicy','RestrictPublicBuckets')):
        raise ValueError('PRIVATE_BUCKET_REQUIRED')
def main():
    bucket=os.environ['SARBERKI_V2_BUCKET'];validate_bucket(bucket)
    run=os.environ['GITHUB_RUN_ID'];attempt=os.environ['GITHUB_RUN_ATTEMPT'];sha=os.environ['GITHUB_SHA']
    if not re.fullmatch(r'\d+',run) or not re.fullmatch(r'\d+',attempt) or not re.fullmatch(r'[0-9a-f]{40}',sha):
        raise ValueError('INVALID_RUN_IDENTITY')
    directory=Path('/tmp/sarberki-v2-delivery');rows=[]
    for name in ('sarberki-recovery.zip','sarberki-recovery.zip.sha256'):
        source=directory/name
        key='sarberki-v2/'+run+'/'+attempt+'/'+sha+'/'+name
        result=aws(['put-object','--bucket',bucket,'--key',key,'--body',str(source),
                    '--server-side-encryption','AES256'])
        version=result.get('VersionId')
        if not version or version=='null':raise ValueError('VERSION_ID_REQUIRED')
        with tempfile.TemporaryDirectory(prefix='ciphertext-readback-') as t:
            target=Path(t)/name
            aws(['get-object','--bucket',bucket,'--key',key,'--version-id',version,str(target)])
            digest=hashlib.sha256(source.read_bytes()).hexdigest()
            if hashlib.sha256(target.read_bytes()).hexdigest()!=digest:raise ValueError('REMOTE_READBACK_MISMATCH')
        rows.append({'key':key,'version_id':version,'sha256':digest,'readback':'PASS'})
    (directory/'DURABLE-STORAGE.json').write_text(json.dumps({'bucket':bucket,'objects':rows,'retention_policy':'OWNER_CONFIGURED_NOT_VERIFIED'},indent=2))
if __name__=='__main__':
    try:main()
    except Exception:
        print('BLOCKED: durable storage not verified; no complete backup claim.',file=sys.stderr);sys.exit(1)
