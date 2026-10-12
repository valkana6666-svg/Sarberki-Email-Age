// Disposable Actions Compose verification. No platform/source credentials.
import {readFileSync,writeFileSync,mkdirSync,rmSync,chownSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomBytes,createHmac} from 'node:crypto';
import {prepareIsolatedDeployment} from '../deployment/isolated-approval/prepare.mjs';
const report={scope:'DISPOSABLE_COMPOSE_PACKAGE_ONLY',sourceConnected:false,productionConnected:false,emailSent:false,pushoverSent:false,bookingCreated:false,publicHttpsVerified:false,actualIPhoneVerified:false,checks:[]};
let stage='guard',directory;
const runId=process.env.GITHUB_RUN_ID;
if(!/^\d+$/.test(runId||'')||process.env.GITHUB_REF!=='refs/heads/gmail-test-subject-allowlist')throw Error('ISOLATED_ACTIONS_ONLY');
const project='sarberki-persistent-ci-'+runId;
const base='/tmp/'+project;
mkdirSync(base,{mode:0o700});directory=base+'/private';
prepareIsolatedDeployment({origin:'https://operator.isolated.test',outputDirectory:directory});
for(const name of ['operator-config.json','anon-jwt','runtime.json'])chownSync(directory+'/'+name,1000,1000);
chownSync(directory+'/bootstrap-roles.sql',999,999);
// Only CI's internal CA/Docker DNS differ from the reviewable deployment config.
const caddy=readFileSync('deployment/isolated-approval/Caddyfile','utf8').replace('{$ISOLATED_OPERATOR_HOSTNAME} {','operator.isolated.test {\n  tls internal');
writeFileSync(base+'/Caddyfile',caddy,{mode:0o600});
writeFileSync(base+'/override.json',JSON.stringify({services:{'isolated-https':{volumes:[base+'/Caddyfile:/etc/caddy/Caddyfile:ro'],networks:{isolated_proxy_link:{aliases:['operator.isolated.test']}}}}}),{mode:0o600});
const args=['compose','--env-file',directory+'/deployment.env','-f','deployment/isolated-approval/compose.yml','-f',base+'/override.json','--profile','approved-deployment','-p',project];
const compose=(extra,input)=>execFileSync('docker',[...args,...extra],{input,stdio:['pipe','pipe','pipe'],timeout:300000}).toString().trim();
const sql=input=>compose(['exec','-T','isolated-postgres','psql','-X','-U','isolated_owner','-d','sc_approval_test','-v','ON_ERROR_STOP=1','-qAt'],input);
const pause=()=>new Promise(r=>setTimeout(r,1000));
const wait=async check=>{for(let i=0;i<60;i++){try{if(check())return;}catch{}await pause();}throw Error('READINESS');};
const passed=name=>report.checks.push({name,result:'PASS'});
// Classify subprocess errors into a fixed vocabulary. Never publish stderr,
// command arguments, rendered Compose config or private environment values.
const errorCategory=error=>{
 const diagnostic=String(error?.stderr||'')+'\n'+String(error?.stdout||'');
 for(const [pattern,code]of [[/manifest unknown|manifest .*not found|no matching manifest/i,'IMAGE_MANIFEST_UNAVAILABLE'],[/toomanyrequests|pull rate limit|429 Too Many/i,'IMAGE_REGISTRY_RATE_LIMIT'],[/pull access denied|unauthorized|authentication required/i,'IMAGE_REGISTRY_ACCESS_DENIED'],[/address already in use|port is already allocated/i,'HOST_PORT_IN_USE'],[/pool overlaps|overlap.*address space/i,'NETWORK_SUBNET_OVERLAP'],[/requested IP.*not available|Address already in use/i,'NETWORK_IP_UNAVAILABLE'],[/invalid mount|not a directory|error mounting/i,'CONTAINER_MOUNT_REJECTED'],[/permission denied|operation not permitted/i,'CONTAINER_PERMISSION_DENIED'],[/dependency failed|unhealthy/i,'DEPENDENCY_UNHEALTHY'],[/network .*not found/i,'NETWORK_NOT_FOUND'],[/lookup .*no such host|dial tcp|i\/o timeout|TLS handshake timeout/i,'REGISTRY_OR_NETWORK_UNREACHABLE']])if(pattern.test(diagnostic))return code;
 return error?.code==='ETIMEDOUT'?'SUBPROCESS_TIMEOUT':error?.message==='READINESS'?'READINESS_TIMEOUT':'UNCLASSIFIED_FAILURE';
};
const mountTargets=new Set(['/etc/caddy/Caddyfile','/run/secrets/operator-config.json','/run/secrets/anon-jwt','/run/secrets/runtime.json','/run/secrets/database-owner-password','/docker-entrypoint-initdb.d/10-isolated-roles.sql','/tmp','/data','/config','/var/lib/postgresql/data']);
const fileKind=path=>{try{const s=statSync(path);return s.isFile()?'FILE':s.isDirectory()?'DIRECTORY':'OTHER';}catch{return 'MISSING';}};
function reportMountTypes(){
 // Rendered config includes private env values: keep it in memory only and
 // project exclusively whitelisted targets + file kinds into public evidence.
 const rendered=JSON.parse(compose(['config','--format','json']));
 report.mountSources=[];
 for(const [service,definition]of Object.entries(rendered.services)){
  if(!['isolated-postgres','isolated-auth','isolated-rest','isolated-app','isolated-https'].includes(service))continue;
  for(const volume of definition.volumes||[])if(volume.type==='bind'&&mountTargets.has(volume.target))report.mountSources.push({service,target:volume.target,sourceKind:fileKind(volume.source)});
  for(const secret of definition.secrets||[]){
   const target='/run/secrets/'+(secret.target||secret.source);
   if(mountTargets.has(target))report.mountSources.push({service,target,sourceKind:fileKind(rendered.secrets?.[secret.source]?.file)});
  }
 }
 // The Caddy image's destination is public configuration metadata, not a secret.
 const kind=execFileSync('docker',['run','--rm','--entrypoint','/bin/sh','caddy:2.10.2-alpine','-c','if test -f /etc/caddy/Caddyfile; then echo FILE; elif test -d /etc/caddy/Caddyfile; then echo DIRECTORY; else echo MISSING; fi'],{stdio:['pipe','pipe','pipe'],timeout:60000}).toString().trim();
 report.caddyImageTargetKind=['FILE','DIRECTORY','MISSING'].includes(kind)?kind:'OTHER';
}
function mountFailureEvidence(error){
 const text=String(error?.stderr||'');
 return {target:[...mountTargets].find(target=>text.includes(target))||'UNKNOWN',
  condition:/not a directory/i.test(text)?'SOURCE_OR_TARGET_NOT_DIRECTORY':/read-only file system/i.test(text)?'READ_ONLY_FILESYSTEM':/permission denied|operation not permitted/i.test(text)?'PERMISSION_DENIED':/no such file or directory/i.test(text)?'MISSING_MOUNT_PATH':'UNCLASSIFIED_MOUNT_FAILURE'};
}
let image;
function helper(network,code){return execFileSync('docker',['run','--rm','-i','--network',project+'_'+network,'--entrypoint','node',image,'--input-type=module'],{input:code,stdio:['pipe','pipe','pipe'],timeout:60000}).toString().trim();}
try{
 stage='compose-validate-build';compose(['config','--quiet']);compose(['build','isolated-app']);image=execFileSync('docker',['image','inspect',project+'-isolated-app','--format','{{.Id}}'],{stdio:['pipe','pipe','pipe']}).toString().trim();if(!/^sha256:[a-f0-9]{64}$/.test(image))throw Error('IMAGE');passed(stage);
 stage='empty-database-own-auth-bootstrap';compose(['up','-d','isolated-postgres','isolated-auth']);
 await wait(()=>sql("select count(*) from information_schema.tables where table_schema='auth' and table_name in ('users','sessions');")==='2');
 await wait(()=>helper('isolated_backend',"console.log((await fetch('http://isolated-auth:9999/health',{signal:AbortSignal.timeout(2000)})).status);")==='200');
 if(sql('select current_database();')!=='sc_approval_test')throw Error('DB');
 sql("create or replace function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant execute on function auth.uid() to authenticated,anon;");
 for(const path of ['supabase/migrations/202610090001_case_store.sql','recovery/sql/isolated-approval.sql','recovery/sql/isolated-persistent-identity.sql',directory+'/install-attestation.sql'])sql(readFileSync(path,'utf8'));
 sql("insert into sc_tenants values('sarberki-test','Synthetic CI',true),('demo-test','Synthetic foreign CI',true);");
 if(sql("select rolsuper::text||':'||rolbypassrls::text from pg_roles where rolname='isolated_authenticator';")!=='false:false')throw Error('REST_ROLE');passed(stage);
 stage='synthetic-auth-provision';
 const jwtSecret=readFileSync(directory+'/auth.env','utf8').match(/^GOTRUE_JWT_SECRET=(.+)$/m)[1],password=randomBytes(32).toString('base64url');
 const header=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),body=Buffer.from(JSON.stringify({role:'service_role',aud:'authenticated',iss:'supabase',exp:Math.floor(Date.now()/1000)+600})).toString('base64url');
 const admin=header+'.'+body+'.'+createHmac('sha256',jwtSecret).update(header+'.'+body).digest('base64url');
 const users=JSON.parse(helper('isolated_backend',`const result={};for(const name of ['operator','writer']){const r=await fetch('http://isolated-auth:9999/admin/users',{method:'POST',headers:{Authorization:'Bearer '+${JSON.stringify(admin)},'Content-Type':'application/json'},body:JSON.stringify({email:'approval-'+name+'@synthetic.invalid',password:${JSON.stringify(password)},email_confirm:true})});if(r.status!==200)throw Error('AUTH');result[name]=(await r.json()).id;}console.log(JSON.stringify(result));`));
 if(!Object.values(users).every(id=>/^[a-f0-9-]{36}$/.test(id)))throw Error('USERS');
 sql(`insert into sc_memberships values('sarberki-test','${users.operator}',true,true,true),('sarberki-test','${users.writer}',true,true,false);`);passed(stage);
 stage='runtime-rest-proxy-image-pull';compose(['pull','isolated-rest','isolated-https']);passed(stage);
 stage='runtime-mount-filetype-check';reportMountTypes();passed(stage);
 stage='fixed-isolated-runtime-caddy-start';compose(['up','-d','isolated-rest','isolated-app','isolated-https']);passed(stage);
 stage='caddy-internal-ca-readiness';
 let ca;await wait(()=>{ca=compose(['exec','-T','isolated-https','cat','/data/caddy/pki/authorities/local/root.crt']);return ca.includes('BEGIN CERTIFICATE');});
 const transport=`import {request} from 'node:https';const ca=${JSON.stringify(ca)};async function call(path,{method='GET',token,body}={}){return new Promise((resolve,reject)=>{const r=request({hostname:'operator.isolated.test',port:443,path,method,ca,headers:{Origin:'https://operator.isolated.test','Sec-Fetch-Site':'same-origin',...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})}},res=>{let raw='';res.on('data',c=>raw+=c);res.on('end',()=>{let data;try{data=JSON.parse(raw);}catch{}resolve({status:res.statusCode,data,raw});});});r.setTimeout(5000,()=>r.destroy(Error('TIMEOUT')));r.on('error',reject);r.end(body?JSON.stringify(body):undefined);});}function check(ok){if(!ok)throw Error('ASSERT');}`;
 passed(stage);stage='verified-runtime-through-https-proxy';
 await wait(()=>{const out=helper('isolated_proxy_link',transport+"console.log((await call('/isolated-config')).status);");return out==='200';});passed(stage);
 stage='https-own-auth-api-cas-audit';
 const proof=JSON.parse(helper('isolated_proxy_link',transport+`
 const shell=await call('/isolated-persistent.html');check(shell.status===200&&shell.raw.includes('isolated-persistent-session.mjs'));
 const bad=await call('/isolated-auth/login',{method:'POST',body:{email:'guest@example.org',password:'not-secret'}});check(bad.status===403);
 const login=async name=>{const r=await call('/isolated-auth/login',{method:'POST',body:{email:'approval-'+name+'@synthetic.invalid',password:${JSON.stringify(password)}}});check(r.status===200&&!('refresh_token' in r.data));return r.data.access_token;};
 const wt=await login('writer'),at=await login('operator');const api=async(token,input,status=200)=>{const r=await call('/.netlify/functions/booking-cases',{method:'POST',token,body:{tenantId:'sarberki-test',...input}});check(r.status===status);return r.data?.result;};
 const created=await api(wt,{action:'ingest',expectedRevision:0,envelope:{sender:'ci-guest@synthetic.invalid',text:'Please book one Deluxe cabin from 2026-11-13 to 2026-11-15 for 2 adults and no children.',mailbox_id:'compose-ci',message_id:'new-runtime-proof',received_at:new Date().toISOString()}});
 const id=created.record.caseId;const draft=await api(wt,{action:'review-draft',caseId:id,expectedRevision:1});check(draft.review.status==='internal_review_required');
 const {createHash}=await import('node:crypto');const hash=createHash('sha256').update(draft.record.data.drafts.at(-1).text).digest('hex');const approve={action:'approve',caseId:id,expectedRevision:2,reviewedDraftHash:hash};
 await api(wt,approve,403);await api(at,{...approve,expectedRevision:1},409);
 const approved=await api(at,approve);check(approved.revision===3&&approved.data.state.approval==='internally_approved');
 const audit=await call('/isolated-audit?caseId='+encodeURIComponent(id),{token:at});check(audit.status===200&&audit.data.length===1&&audit.data[0].actor===${JSON.stringify(users.operator)});
 console.log(JSON.stringify({caseId:id,revision:3,auditHash:audit.data[0].data_hash,operator:${JSON.stringify(users.operator)}}));`));
 if(proof.revision!==3||! /^[a-f0-9]{64}$/.test(proof.auditHash))throw Error('PROOF');passed(stage);
 stage='compose-service-restart-durable-readback';compose(['restart','isolated-postgres','isolated-auth','isolated-rest','isolated-app']);
 await wait(()=>helper('isolated_backend',"console.log((await fetch('http://isolated-auth:9999/health',{signal:AbortSignal.timeout(2000)})).status);")==='200');
 await wait(()=>helper('isolated_proxy_link',transport+"console.log((await call('/isolated-config')).status);")==='200');
 await wait(()=>{try{const value=helper('isolated_proxy_link',transport+`
 const auth=await call('/isolated-auth/login',{method:'POST',body:{email:'approval-operator@synthetic.invalid',password:${JSON.stringify(password)}}});check(auth.status===200);const token=auth.data.access_token;
 const record=await call('/.netlify/functions/booking-cases?tenantId=sarberki-test&caseId='+${JSON.stringify(proof.caseId)},{token});check(record.status===200&&record.data.result.revision===3&&record.data.result.data.state.approval==='internally_approved');
 const audit=await call('/isolated-audit?caseId='+${JSON.stringify(proof.caseId)},{token});check(audit.status===200&&audit.data.length===1&&audit.data[0].data_hash===${JSON.stringify(proof.auditHash)});console.log('PASS');`);return value==='PASS';}catch{return false;}});passed(stage);
 report.result='PASS';
}catch(error){report.result='FAIL';report.failedStage=stage;report.errorCategory=errorCategory(error);if(report.errorCategory==='CONTAINER_MOUNT_REJECTED')report.mountFailure=mountFailureEvidence(error);if(Number.isInteger(error?.status))report.subprocessExitCode=error.status;process.exitCode=1;}
finally{
 try{compose(['down','--volumes','--remove-orphans']);report.disposableStackRemoved=true;}catch{report.disposableStackRemoved=false;process.exitCode=1;}
 rmSync(base,{recursive:true,force:true});
 const output='/tmp/sarberki-persistent-package-proof';mkdirSync(output,{recursive:true});writeFileSync(output+'/PACKAGE-PROOF.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
