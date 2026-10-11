// New approval chain only, against a fresh disposable DB. No backup/source/cloud credentials.
import {createHash,createHmac,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createCaseHandler} from '../netlify/functions/booking-cases.mjs';
const report={scope:'NEW_ISOLATED_AUTH_APPROVAL_ONLY',source_connection:'NEVER_OPENED',production:'NEVER_CONNECTED',email:'NEVER_SENT_OR_MODIFIED',booking:'NEVER_CREATED_OR_MODIFIED',prior_successful_suites_repeated:false};
let stage='guard';const step=async(name,fn)=>{stage=name;const result=await fn();report[name]='PASS';return result;};
const container=process.env.ISOLATED_APPROVAL_POSTGRES;
const sql=q=>execFileSync('docker',['exec','-i',container,'psql','-X','-U','restore_admin','-d','sc_approval_test','-v','ON_ERROR_STOP=1','-qAt'],{input:q,stdio:['pipe','pipe','pipe']}).toString().trim();
try{
 if(!/^sarberki-approval-pg-\d+$/.test(container||''))throw Error('isolated container required');
 assert.equal(sql('select current_database();'),'sc_approval_test');
 const secret=readFileSync('/tmp/approval-jwt-secret','utf8');
 const sign=claims=>{const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),body=Buffer.from(JSON.stringify(claims)).toString('base64url');return head+'.'+body+'.'+createHmac('sha256',secret).update(head+'.'+body).digest('base64url');};
 const jwt=role=>sign({role,aud:'authenticated',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600});
 const admin=jwt('service_role'),anon=jwt('anon'),password=randomBytes(32).toString('base64url');
 const auth='http://127.0.0.1:18999',rest='http://127.0.0.1:18300';
 async function ready(url){for(let i=0;i<45;i++){try{if((await fetch(url,{signal:AbortSignal.timeout(1000)})).ok)return;}catch{}await new Promise(r=>setTimeout(r,1000));}throw Error('isolated readiness');}
 stage='prepare-new-services';await ready(auth+'/health');
 // GoTrue's initial migration creates auth.uid() as the Auth schema owner.
 // Install the PostgREST v14 claims adapter only AFTER that migration has completed.
 sql("create or replace function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant execute on function auth.uid() to authenticated,anon;");
 sql(readFileSync('supabase/migrations/202610090001_case_store.sql','utf8'));
 sql(readFileSync('recovery/sql/isolated-approval.sql','utf8'));
 sql("insert into sc_tenants values('sarberki-test','Synthetic rehearsal',true),('demo-test','Synthetic foreign',true);");
 sql("notify pgrst,'reload schema';");
 await ready(rest+'/');
 async function provision(email){const r=await fetch(auth+'/admin/users',{method:'POST',headers:{Authorization:'Bearer '+admin,'Content-Type':'application/json'},body:JSON.stringify({email,password,email_confirm:true})});assert.equal(r.status,200);return (await r.json()).id;}
 const writer=await provision('approval-writer@synthetic.invalid'),approver=await provision('approval-operator@synthetic.invalid'),foreign=await provision('approval-foreign@synthetic.invalid');
 for(const id of [writer,approver,foreign])assert.match(id,/^[a-f0-9-]{36}$/);
 sql(`insert into sc_memberships values('sarberki-test','${writer}',true,true,false),('sarberki-test','${approver}',true,true,true),('demo-test','${foreign}',true,true,true);`);
 async function login(email){const r=await fetch(auth+'/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(r.status,200);return (await r.json()).access_token;}
 const wt=await login('approval-writer@synthetic.invalid'),at=await login('approval-operator@synthetic.invalid'),ft=await login('approval-foreign@synthetic.invalid');
 const isolatedFetch=(url,options)=>{const u=new URL(url);assert.equal(u.origin,'https://isolated-approval.supabase.co');if(u.pathname.startsWith('/auth/v1/'))return fetch(auth+'/'+u.pathname.slice(9)+u.search,options);if(u.pathname.startsWith('/rest/v1/'))return fetch(rest+'/'+u.pathname.slice(9)+u.search,options);throw Error('unexpected external route');};
 const env={CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',URL:'https://leafy-chimera-2403e5.netlify.app',SUPABASE_URL:'https://isolated-approval.supabase.co',SUPABASE_PUBLISHABLE_KEY:anon};
 let capacity='available';
 const reviewProviders={availability:async q=>({...q,source:'synthetic-fixture',checkedAt:new Date().toISOString(),availability:capacity,availableUnits:capacity==='available'?1:0}),pricing:async q=>({...q,source:'synthetic-fixture',checkedAt:new Date().toISOString(),tenantId:'sarberki-test',unitId:q.cabin,capacity:6,nightly:100,basis:'per_unit',verified:true})};
 const handler=createCaseHandler({env,fetchImpl:isolatedFetch,isolatedApproval:true,reviewProviders});
 const call=async(token,input,expected=200)=>{const r=await handler({httpMethod:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify({tenantId:'sarberki-test',...input})});assert.equal(r.statusCode,expected,r.body);return JSON.parse(r.body).result;};
 stage='prepare-synthetic-case-and-reviewed-draft';
 const first=await call(wt,{action:'ingest',expectedRevision:0,envelope:{sender:'approval-guest@synthetic.invalid',text:'Please book one Deluxe cabin from 2026-10-23 to 2026-10-25 for 4 adults and no children.',mailbox_id:'new-approval',message_id:'approval-one',received_at:new Date().toISOString()}});
 const drafted=await call(wt,{action:'review-draft',caseId:first.record.caseId,expectedRevision:1});assert.equal(drafted.review.status,'internal_review_required');
 const id=first.record.caseId,hash=createHash('sha256').update(drafted.record.data.drafts.at(-1).text).digest('hex');
 const input={action:'approve',caseId:id,expectedRevision:2,reviewedDraftHash:hash};
 const unchanged=()=>{assert.equal(sql(`select revision from sc_cases where case_id='${id}';`),'2');assert.equal(sql("select count(*) from sc_audit where kind='approve_isolated_synthetic';"),'0');};
 await step('real_auth_writer_and_cross_tenant_denied',async()=>{await call(wt,input,403);await call(ft,input,403);unchanged();});
 await step('real_auth_expired_and_tampered_jwt_denied',async()=>{
  const claims=JSON.parse(Buffer.from(at.split('.')[1],'base64url'));await call(sign({...claims,exp:Math.floor(Date.now()/1000)-10}),input,403);
  const parts=at.split('.');const corrupt=parts[0]+'.'+Buffer.from(JSON.stringify({...claims,sub:writer})).toString('base64url')+'.'+parts[2];await call(corrupt,input,403);unchanged();
 });
 await step('exact_revision_and_reviewed_draft_binding',async()=>{await call(at,{...input,expectedRevision:1},409);await call(at,{...input,reviewedDraftHash:'0'.repeat(64)},400);unchanged();});
 await step('fresh_unknown_capacity_blocks_server_approval',async()=>{capacity='unknown';await call(at,input,422);capacity='available';unchanged();});
 await step('revoked_session_checked_in_database',async()=>{sql(`update auth.sessions set not_after=now()-interval '1 second' where user_id='${approver}';`);await call(at,input,403);unchanged();sql(`update auth.sessions set not_after=null where user_id='${approver}';`);});
 await step('approval_and_audit_rollback_together',async()=>{
  sql("create function block_approval_audit() returns trigger language plpgsql as $$begin if new.kind='approve_isolated_synthetic' then raise exception 'synthetic audit failure';end if;return new;end$$;create trigger block_audit before insert on sc_audit for each row execute function block_approval_audit();");
  await call(at,input,503);unchanged();sql('drop trigger block_audit on sc_audit;drop function block_approval_audit();');
 });
 let approved;
 await step('real_operator_atomic_sql_approval_and_audit',async()=>{
  const request=()=>handler({httpMethod:'POST',headers:{authorization:'Bearer '+at},body:JSON.stringify({tenantId:'sarberki-test',...input})});
  const responses=await Promise.all([request(),request()]);assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,409]);
  approved=JSON.parse(responses.find(r=>r.statusCode===200).body).result;assert.equal(approved.revision,3);assert.equal(approved.updatedBy,approver);assert.equal(approved.data.serverApproval.draftHash,hash);
  assert.equal(sql("select count(*) from sc_audit where kind='approve_isolated_synthetic';"),'1');
  assert.equal(sql(`select count(*) from sc_audit a join sc_cases c using(tenant_id,case_id,revision) where a.kind='approve_isolated_synthetic' and a.actor='${approver}' and a.data_hash=encode(sha256(convert_to(c.data::text,'UTF8')),'hex');`),'1');
 });
 await step('ordinary_write_cannot_forge_approval_and_audit_is_immutable_to_operator',async()=>{
  const get=(path,options={})=>fetch(rest+path,{...options,headers:{Authorization:'Bearer '+at,'Content-Type':'application/json'}});
  const a=await get('/sc_audit?tenant_id=eq.sarberki-test&kind=eq.approve_isolated_synthetic');assert.equal(a.status,200);assert.equal((await a.json()).length,1);
  assert.equal((await get('/sc_audit',{method:'DELETE'})).status,403);
  const denied=await get('/rpc/sc_write_case',{method:'POST',body:JSON.stringify({p_tenant:'sarberki-test',p_case:id,p_expected:3,p_data:approved.data})});assert.equal(denied.status,403);
 });
 await step('database_auth_rest_restart_preserves_approval_and_audit',async()=>{
  execFileSync('docker',['restart',container,process.env.ISOLATED_APPROVAL_AUTH,process.env.ISOLATED_APPROVAL_REST],{stdio:['ignore','pipe','pipe']});await ready(auth+'/health');await ready(rest+'/');
  const newToken=await login('approval-operator@synthetic.invalid');const r=await handler({httpMethod:'GET',headers:{authorization:'Bearer '+newToken},queryStringParameters:{tenantId:'sarberki-test',caseId:id}});assert.equal(r.statusCode,200);const restored=JSON.parse(r.body).result;assert.equal(restored.revision,3);assert.deepEqual(restored.data,approved.data);assert.equal(sql("select count(*) from sc_audit where kind='approve_isolated_synthetic';"),'1');
 });
 report.approval_scope='ISOLATED_SYNTHETIC_REVIEW_NOT_LIVE_GUEST_OFFER';report.completed=true;
}catch(error){
 report.completed=false;report.failed_stage=stage;report.failure_class=error.name;
 const redact=s=>String(s).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[redacted-db-url]').replace(/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,'[redacted-jwt]').replace(/[a-f0-9]{64}/g,'[redacted-key]');
 if(error.stderr)report.sql_diagnostic=redact(error.stderr).slice(0,1000);
 if(stage==='prepare-new-services'){
  try{const captured=spawnSync('docker',['logs','--tail','30',process.env.ISOLATED_APPROVAL_AUTH],{encoding:'utf8'});const logs=(captured.stdout||'')+(captured.stderr||'');report.auth_start_diagnostic=logs.split('\n').filter(x=>/fatal|error|panic/i.test(x)).map(x=>redact(x).slice(-1000)).slice(-4);}catch{}
 }
 process.exitCode=1;
}
finally{mkdirSync('/tmp/approval-evidence',{recursive:true});writeFileSync('/tmp/approval-evidence/SERVER-APPROVAL.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
