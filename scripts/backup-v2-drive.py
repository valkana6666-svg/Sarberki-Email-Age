"""Private append-only Drive snapshots. OAuth secret is never logged or in argv."""
import hashlib,json,os,re,secrets,sys,urllib.request,urllib.parse
from pathlib import Path
SCOPE='https://www.googleapis.com/auth/drive.file'
FOLDER_ID='1EE2ioPs_8OwpnttT9hYHba_Y9_aWwcqz'
OWNER='valkana6666@gmail.com'
MAX=256*1024*1024
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None
def request(url,token=None,data=None,content_type=None,method=None,extra_headers=None,with_headers=False):
    if not url.startswith(('https://www.googleapis.com/','https://oauth2.googleapis.com/')):
        raise ValueError('UNAPPROVED_ENDPOINT')
    headers={}
    if token:headers['Authorization']='Bearer '+token
    if content_type:headers['Content-Type']=content_type
    headers.update(extra_headers or {})
    req=urllib.request.Request(url,data=data,headers=headers,method=method)
    with urllib.request.build_opener(NoRedirect).open(req,timeout=120) as r:
        body=r.read(MAX+1)
        if len(body)>MAX:raise ValueError('RESPONSE_TOO_LARGE')
        return (body,dict(r.headers)) if with_headers else body
def access_token(secret):
    config=json.loads(secret)
    if set(config)!={'client_id','client_secret','refresh_token'} or any(not isinstance(v,str) or not v for v in config.values()):
        raise ValueError('DRIVE_OAUTH_CONFIGURATION_REQUIRED')
    body=urllib.parse.urlencode(dict(config,grant_type='refresh_token')).encode()
    result=json.loads(request('https://oauth2.googleapis.com/token',data=body,content_type='application/x-www-form-urlencoded'))
    scopes=set(result.get('scope','').split())
    if SCOPE not in scopes or 'https://www.googleapis.com/auth/drive' in scopes:
        raise ValueError('NARROW_DRIVE_FILE_SCOPE_REQUIRED')
    return result['access_token']
def validate_folder(meta,folder_id):
    if folder_id!=FOLDER_ID or meta.get('id')!=folder_id or meta.get('mimeType')!='application/vnd.google-apps.folder':
        raise ValueError('UNAPPROVED_FOLDER')
    permissions=meta.get('permissions',[])
    if not permissions or any(p.get('type')!='user' or p.get('role')!='owner' or p.get('emailAddress','').lower()!=OWNER for p in permissions):
        raise ValueError('OWNER_ONLY_FOLDER_REQUIRED')
    if meta.get('trashed'):raise ValueError('FOLDER_TRASHED')
def validate_quota(quota,needed):
    try: limit=int(quota['limit']);used=int(quota['usage'])
    except (KeyError,ValueError,TypeError):raise ValueError('STORAGE_QUOTA_NOT_VERIFIED')
    if limit<=0 or used<0 or needed<0 or limit-used<needed+20*1024*1024:
        raise ValueError('INSUFFICIENT_STORAGE_NO_UPGRADE_ATTEMPTED')
def upload(token,folder_id,name,data):
    boundary='sarberki-'+secrets.token_hex(24)
    metadata=json.dumps({'name':name,'parents':[folder_id],'appProperties':{
        'purpose':'sarberki-encrypted-backup','sha256':hashlib.sha256(data).hexdigest()}}).encode()
    body=(('--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n').encode()+metadata+
        ('\r\n--'+boundary+'\r\nContent-Type: application/octet-stream\r\n\r\n').encode()+data+
        ('\r\n--'+boundary+'--\r\n').encode())
    if len(data)<=5*1024*1024:
        result=json.loads(request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,webViewLink',
            token,body,'multipart/related; boundary='+boundary))
    else:
        _,headers=request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,webViewLink',
            token,metadata,'application/json',extra_headers={'X-Upload-Content-Length':str(len(data)),
            'X-Upload-Content-Type':'application/octet-stream'},with_headers=True)
        session=next((v for k,v in headers.items() if k.lower()=='location'),'')
        u=urllib.parse.urlsplit(session)
        if u.scheme!='https' or u.netloc!='www.googleapis.com' or not u.path.startswith('/upload/drive/v3/files'):
            raise ValueError('UNAPPROVED_UPLOAD_SESSION')
        result=json.loads(request(session,token,data,'application/octet-stream',method='PUT'))
    fid=result['id']
    if not re.fullmatch(r'[A-Za-z0-9_-]+',fid):raise ValueError('INVALID_FILE_ID')
    # The exact returned ID, never a latest-by-name lookup.
    plain=request('https://www.googleapis.com/drive/v3/files/'+fid+'?alt=media',token)
    if hashlib.sha256(plain).digest()!=hashlib.sha256(data).digest():raise ValueError('DRIVE_READBACK_MISMATCH')
    return {'file_id':fid,'name':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
        'exact_id_readback':'PASS','url':result.get('webViewLink'),'version_model':'distinct_file_per_run_attempt'}
def main():
    folder=os.environ.get('SARBERKI_V2_DRIVE_FOLDER_ID','')
    if folder!=FOLDER_ID:raise ValueError('UNAPPROVED_FOLDER')
    token=access_token(os.environ.get('SARBERKI_V2_DRIVE_OAUTH_JSON',''))
    query=urllib.parse.urlencode({'fields':'id,mimeType,trashed,permissions(type,role,emailAddress)'})
    validate_folder(json.loads(request('https://www.googleapis.com/drive/v3/files/'+folder+'?'+query,token)),folder)
    directory=Path('/tmp/sarberki-v2-delivery')
    files=[directory/'sarberki-recovery.zip',directory/'sarberki-recovery.zip.sha256']
    about=json.loads(request('https://www.googleapis.com/drive/v3/about?fields=storageQuota',token))
    validate_quota(about.get('storageQuota',{}),sum(p.stat().st_size for p in files))
    run=os.environ['GITHUB_RUN_ID'];attempt=os.environ['GITHUB_RUN_ATTEMPT'];sha=os.environ['GITHUB_SHA']
    if not re.fullmatch(r'\d+',run) or not re.fullmatch(r'\d+',attempt) or not re.fullmatch(r'[0-9a-f]{40}',sha):
        raise ValueError('RUN_IDENTITY_INVALID')
    prefix='sarberki-'+run+'-'+attempt+'-'+sha
    receipt=[]
    for p in files:
        name=prefix+('.zip' if p.suffix=='.zip' else '.zip.sha256')
        receipt.append(upload(token,folder,name,p.read_bytes()))
    (directory/'DURABLE-STORAGE.json').write_text(json.dumps({'provider':'google-drive','folder_id':folder,
        'objects':receipt,'retention':'append-only; no old-file deletion; quota checked before upload',
        'immutability':'application-level distinct IDs; not WORM/ObjectLock'},indent=2))
if __name__=='__main__':
    try:main()
    except Exception:
        print('BLOCKED: Drive access, privacy, quota or exact-file readback failed. No complete backup claim.',file=sys.stderr)
        sys.exit(1)
