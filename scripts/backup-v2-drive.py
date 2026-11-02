"""Private append-only Drive snapshots. OAuth secret is never logged or in argv."""
import hashlib,json,os,re,secrets,sys,urllib.error,urllib.request,urllib.parse
from pathlib import Path
SCOPE='https://www.googleapis.com/auth/drive.file'
FOLDER_ID='1EE2ioPs_8OwpnttT9hYHba_Y9_aWwcqz'
OWNER='valkana6666@gmail.com'
MAX=256*1024*1024
# Diagnostic stage only; never a secret, token, response body or exception text.
STAGE='start'
def failure_code(error):
    if isinstance(error,urllib.error.HTTPError):return 'HTTP_'+str(int(error.code))
    if type(error) is ValueError and re.fullmatch(r'[A-Z_]{3,64}',str(error)):return str(error)
    return 'UNEXPECTED_'+re.sub(r'[^A-Za-z]','',type(error).__name__)[:40]
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
def secret_shape(secret):
    # Structure only, never content: length, line count, and whether it is framed as a JSON object.
    text=secret if isinstance(secret,str) else ''
    kind=lambda c:'none' if not c else '{' if c=='{' else '}' if c=='}' else 'quote' if c in '"\'' else 'space' if c.isspace() else 'bom' if c=='\ufeff' else 'letter' if c.isalpha() else 'digit' if c.isdigit() else 'other'
    return 'len='+str(len(text))+',lines='+str(text.count('\n')+1 if text else 0)+',first='+kind(text[:1])+',last='+kind(text[-1:])
def access_token(secret):
    global STAGE
    STAGE='oauth_config('+secret_shape(secret)+')'
    config=json.loads(secret)
    STAGE='oauth_token'
    if set(config)!={'client_id','client_secret','refresh_token'} or any(not isinstance(v,str) or not v for v in config.values()):
        raise ValueError('DRIVE_OAUTH_CONFIGURATION_REQUIRED')
    body=urllib.parse.urlencode(dict(config,grant_type='refresh_token')).encode()
    result=json.loads(request('https://oauth2.googleapis.com/token',data=body,content_type='application/x-www-form-urlencoded'))
    scopes=set(result.get('scope','').split())
    if scopes != {SCOPE}:
        raise ValueError('NARROW_DRIVE_FILE_SCOPE_REQUIRED')
    token = result.get('access_token')
    if not isinstance(token, str) or not token.strip():
        raise ValueError('DRIVE_ACCESS_TOKEN_REQUIRED')
    return token
def validate_folder(meta,folder_id):
    if folder_id!=FOLDER_ID:raise ValueError('UNAPPROVED_FOLDER')
    validate_owner_only_folder(meta,folder_id)
def validate_owner_only_folder(meta,folder_id):
    if meta.get('id')!=folder_id or meta.get('mimeType')!='application/vnd.google-apps.folder':
        raise ValueError('UNAPPROVED_FOLDER')
    permissions=meta.get('permissions',[])
    if not permissions or any(p.get('type')!='user' or p.get('role')!='owner' or p.get('emailAddress','').lower()!=OWNER for p in permissions):
        raise ValueError('OWNER_ONLY_FOLDER_REQUIRED')
    if meta.get('trashed'):raise ValueError('FOLDER_TRASHED')
APP_FOLDER_NAME='Sarberki V2 mentes'
FOLDER_FIELDS='id,mimeType,trashed,permissions(type,role,emailAddress)'
def ensure_app_folder(token):
    # drive.file only reaches folders this OAuth app created. One-time and idempotent: reuse the single
    # existing app folder, never create a second one, never touch or list other Drive content.
    global STAGE
    STAGE='folder_lookup'
    q="mimeType='application/vnd.google-apps.folder' and name='"+APP_FOLDER_NAME+"' and 'root' in parents and trashed=false"
    found=json.loads(request('https://www.googleapis.com/drive/v3/files?'+urllib.parse.urlencode({'q':q,'fields':'files(id)','spaces':'drive'}),token)).get('files',[])
    if len(found)>1:raise ValueError('MULTIPLE_APP_FOLDERS')
    if found:folder_id=found[0].get('id','')
    else:
        STAGE='folder_create'
        body=json.dumps({'name':APP_FOLDER_NAME,'mimeType':'application/vnd.google-apps.folder','parents':['root']}).encode()
        folder_id=json.loads(request('https://www.googleapis.com/drive/v3/files?fields=id',token,body,'application/json; charset=UTF-8')).get('id','')
    if not isinstance(folder_id,str) or not re.fullmatch(r'[A-Za-z0-9_-]{10,128}',folder_id):raise ValueError('INVALID_FOLDER_ID')
    STAGE='folder_acl'
    validate_owner_only_folder(json.loads(request('https://www.googleapis.com/drive/v3/files/'+folder_id+'?'+urllib.parse.urlencode({'fields':FOLDER_FIELDS}),token)),folder_id)
    return folder_id,('reused' if found else 'created')
def validate_quota(quota,needed):
    try: limit=int(quota['limit']);used=int(quota['usage'])
    except (KeyError,ValueError,TypeError):raise ValueError('STORAGE_QUOTA_NOT_VERIFIED')
    if limit<=0 or used<0 or needed<0 or limit-used<needed+20*1024*1024:
        raise ValueError('INSUFFICIENT_STORAGE_NO_UPGRADE_ATTEMPTED')
def upload(token,folder_id,name,data,verified_copy=None):
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
    if verified_copy is not None:
        # Save the remote response bytes, never the local upload input.
        with verified_copy.open('xb') as copy:
            copy.write(plain)
        verified_copy.chmod(0o600)
    return {'file_id':fid,'name':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
        'exact_id_readback':'PASS','url':result.get('webViewLink'),'version_model':'distinct_file_per_run_attempt'}
def main():
    if sys.argv[1:] not in ([],['preflight'],['create-folder']):raise ValueError('INVALID_OPERATION')
    global STAGE
    if sys.argv[1:]==['create-folder']:
        STAGE='oauth_token'
        folder_id,how=ensure_app_folder(access_token(os.environ.get('SARBERKI_V2_DRIVE_OAUTH_JSON','')))
        print('Drive app folder '+how+', owner-only ACL: PASS; folder_id='+folder_id)
        return
    folder=os.environ.get('SARBERKI_V2_DRIVE_FOLDER_ID','')
    if folder!=FOLDER_ID:raise ValueError('UNAPPROVED_FOLDER')
    STAGE='oauth_token'
    token=access_token(os.environ.get('SARBERKI_V2_DRIVE_OAUTH_JSON',''))
    STAGE='folder'
    query=urllib.parse.urlencode({'fields':'id,mimeType,trashed,permissions(type,role,emailAddress)'})
    validate_folder(json.loads(request('https://www.googleapis.com/drive/v3/files/'+folder+'?'+query,token)),folder)
    STAGE='quota'
    if sys.argv[1:]==['preflight']:
        about=json.loads(request('https://www.googleapis.com/drive/v3/about?fields=storageQuota',token))
        validate_quota(about.get('storageQuota',{}),0)
        print('Drive OAuth, owner-only folder and available quota preflight: PASS')
        return
    directory=Path('/tmp/sarberki-v2-delivery')
    files=[directory/'sarberki-recovery.zip',directory/'sarberki-recovery.zip.sha256']
    about=json.loads(request('https://www.googleapis.com/drive/v3/about?fields=storageQuota',token))
    validate_quota(about.get('storageQuota',{}),sum(p.stat().st_size for p in files))
    run=os.environ['GITHUB_RUN_ID'];attempt=os.environ['GITHUB_RUN_ATTEMPT'];sha=os.environ['GITHUB_SHA']
    if not re.fullmatch(r'\d+',run) or not re.fullmatch(r'\d+',attempt) or not re.fullmatch(r'[0-9a-f]{40}',sha):
        raise ValueError('RUN_IDENTITY_INVALID')
    prefix='sarberki-'+run+'-'+attempt+'-'+sha
    readback=Path('/tmp/sarberki-v2-drive-readback')
    readback.mkdir(mode=0o700,exist_ok=False)
    STAGE='upload_readback'
    receipt=[]
    for p in files:
        name=prefix+('.zip' if p.suffix=='.zip' else '.zip.sha256')
        receipt.append(upload(token,folder,name,p.read_bytes(),readback/p.name))
    (directory/'DURABLE-STORAGE.json').write_text(json.dumps({'provider':'google-drive','folder_id':folder,
        'objects':receipt,'retention':'append-only; no old-file deletion; quota checked before upload',
        'immutability':'application-level distinct IDs; not WORM/ObjectLock'},indent=2))
if __name__=='__main__':
    try:main()
    except Exception as error:
        print('BLOCKED (stage='+STAGE+', code='+failure_code(error)+'): Drive access, privacy, quota or exact-file readback failed. No complete backup claim.',file=sys.stderr)
        sys.exit(1)
