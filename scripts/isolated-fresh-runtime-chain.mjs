// Real GoTrue/PostgREST/SQL chain on an ephemeral restored database only.
import {randomBytes,createHmac} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createSupabaseTransport,createSupabaseAuthority,createSupabaseCaseRepository} from '../shared-core/supabase-case-repository.mjs';
import {createServerCaseService} from '../shared-core/server-case-service.mjs';
import {createServerBookingRuntime} from '../shared-core/server-booking-runtime.mjs';
const report={source_connection:'NEVER_OPENED',gmail_oauth_in_isolated_app:'NOT_RUN',live_previo:'NOT_RUN_SAFETY_GATE',full_ui_approval_transition:'NOT_RUN_BY_THIS_PROOF',network:'ephemeral Docker bridge; HTTP local transport adapter; source HTTPS transport unchanged'};
let stage='guard';
const step=(name,fn)=>{stage=name;return Promise.resolve().then(fn).then(value=>{report[name]='PASS';return value;});};
const sql=q=>execFileSync('psql',['-X','-w','-qAt','-v','ON_ERROR_STOP=1','-d','sc_restore','-c',q],{stdio:['ignore','pipe','pipe']});
try{
 if(process.env.PGHOST!=='postgres'||process.env.PGUSER!=='restore_admin')throw Error('guard');
 const secret=readFileSync('/tmp/runtime-jwt-secret','utf8');
 const jwt=role=>{const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),body=Buffer.from(JSON.stringify({role,aud:'authenticated',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return header+'.'+body+'.'+createHmac('sha256',secret).update(header+'.'+body).digest('base64url');};
 const admin=jwt('service_role'),anon=jwt('anon'),password=randomBytes(32).toString('base64url');
 async function ready(url,label){
  stage=label;
  for(let i=0;i<40;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(1500)});if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,1000));}
  throw Error('ISOLATED_SERVICE_NOT_READY');
 }
 await step('auth_service_ready',()=>ready('http://auth:9999/health','auth_service_ready'));
 await step('rest_service_ready',()=>ready('http://rest:3000/','rest_service_ready'));
 async function user(email){const r=await fetch('http://auth:9999/admin/users',{method:'POST',headers:{Authorization:'Bearer '+admin,'Content-Type':'application/json'},body:JSON.stringify({email,password,email_confirm:true})});if(!r.ok){report.provision_http_status=r.status;throw Error('provision');}const u=await r.json();assert.match(u.id,/^[a-f0-9-]{36}$/);return u.id;}
 const writer=await step('isolated_auth_user_provision',()=>user('restore-writer@synthetic.invalid'));
 const approver=await user('restore-approver@synthetic.invalid');
 const reader=await user('restore-reader@synthetic.invalid');
 sql(`insert into public.sc_memberships(tenant_id,user_id,can_read,can_write,can_approve) values ('sarberki-test','${writer}',true,true,false),('sarberki-test','${approver}',true,true,true),('sarberki-test','${reader}',true,false,false);`);
 async function login(email){const r=await fetch('http://auth:9999/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});if(!r.ok)throw Error('login');const b=await r.json();assert.ok(b.access_token);return b.access_token;}
 const token=await step('real_auth_password_login',()=>login('restore-writer@synthetic.invalid'));
 const isolatedFetch=(url,options)=>{
  const u=new URL(url);assert.equal(u.origin,'https://isolated-recovery.supabase.co');
  if(u.pathname.startsWith('/auth/v1/'))return fetch('http://auth:9999/'+u.pathname.slice(9)+u.search,options);
  if(u.pathname.startsWith('/rest/v1/'))return fetch('http://rest:3000/'+u.pathname.slice(9)+u.search,options);
  throw Error('isolated-route');
 };
 const client=t=>{const transport=createSupabaseTransport({url:'https://isolated-recovery.supabase.co',publishableKey:anon,token:t,fetchImpl:isolatedFetch});return createServerCaseService({repository:createSupabaseCaseRepository(transport),resolveAuthority:createSupabaseAuthority(transport)});};
 const service=client(token),now=new Date().toISOString();
 const runtime=createServerBookingRuntime({service,tenantId:'sarberki-test',requestContext:{},clock:()=>now,reviewProviders:{availability:async q=>({...q,source:'synthetic-fixture',checkedAt:now,availability:'available',availableUnits:1}),pricing:async q=>({...q,source:'synthetic-fixture',checkedAt:now,tenantId:'sarberki-test',unitId:q.cabin,capacity:6,nightly:100,basis:'per_unit',verified:true})}});
 // The recovery fixture must remain future-dated when replaying an older backup.
 const arrival=new Date(Date.parse(now)+30*86400000).toISOString().slice(0,10);
 const departure=new Date(Date.parse(now)+32*86400000).toISOString().slice(0,10);
 const envelope={sender:'restore-test@synthetic.invalid',text:`Please book one Deluxe cabin from ${arrival} to ${departure} for 2 adults and 2 children aged 7 and 11.`,mailbox_id:'isolated-recovery',message_id:'restore-runtime-'+Date.now(),received_at:now};
 const first=await step('parse_identify_authorized_api_sql_save',async()=>{
  const value=await runtime.ingest(envelope,undefined,{expectedRevision:0});
  assert.equal(value.record.data.state.values.adults,'2');assert.equal(value.record.data.state.values.children,'2');assert.equal(value.record.data.state.values.unit,'Deluxe');
  assert.equal(value.record.data.state.values.arrival,arrival);assert.equal(value.record.data.state.values.departure,departure);
  return value;
 });
 const reviewed=await step('synthetic_capacity_business_rules_and_draft_persist',async()=>{
  const value=await runtime.reviewAndDraft(first.record.caseId,1);
  report.draft_review_status=['internal_review_required','manual_review_required'].includes(value.review.status)?value.review.status:'OTHER';
  assert.equal(value.review.status,'internal_review_required');assert.equal(value.record.data.drafts.length,1);assert.equal(value.record.data.state.approval,'pending');
  return value;
 });
 const readerToken=await login('restore-reader@synthetic.invalid'),readerService=client(readerToken);
 await step('reader_list_and_saved_draft_preview',async()=>{
  const rows=await readerService.listCases({requestContext:{},tenantId:'sarberki-test'});
  assert.ok(rows.some(row=>row.caseId===first.record.caseId));
  const row=await readerService.getCase({requestContext:{},tenantId:'sarberki-test',caseId:first.record.caseId});
  assert.deepEqual(row.data.drafts,reviewed.record.data.drafts);
 });
 await step('reader_create_update_approve_denied',async()=>{
  const args={requestContext:{},tenantId:'sarberki-test',caseId:first.record.caseId,expectedRevision:2,bookingCase:reviewed.record.data};
  for(const call of [()=>readerService.createCase(args),()=>readerService.updateCase(args),()=>readerService.approveCase(args)])
   await assert.rejects(call,e=>e.code==='FORBIDDEN');
 });
 await step('reader_direct_database_rpc_write_denied',async()=>{
  const result=await fetch('http://rest:3000/rpc/sc_write_case',{method:'POST',headers:{Authorization:'Bearer '+readerToken,'Content-Type':'application/json'},body:JSON.stringify({p_tenant:'sarberki-test',p_case:first.record.caseId,p_expected:2,p_data:reviewed.record.data})});
  assert.equal(result.status,403);
  const row=await service.getCase({requestContext:{},tenantId:'sarberki-test',caseId:first.record.caseId});
  assert.equal(row.revision,2);assert.deepEqual(row.data,reviewed.record.data);
 });
 await step('writer_cannot_approve',()=>assert.rejects(service.requireApproval({requestContext:{},tenantId:'sarberki-test'}),e=>e.code==='FORBIDDEN'));
 const approverToken=await login('restore-approver@synthetic.invalid');await step('approver_permission_checked_by_auth_and_db',()=>client(approverToken).requireApproval({requestContext:{},tenantId:'sarberki-test'}));
 await step('cross_tenant_access_denied',()=>assert.rejects(service.listCases({requestContext:{},tenantId:'demo-test'}),e=>e.code==='FORBIDDEN'));
 await step('duplicate_message_keeps_single_case',async()=>{const duplicate=await runtime.ingest(envelope,undefined,{expectedRevision:0});assert.equal(duplicate.resolution.status,'duplicate');assert.equal(duplicate.record.caseId,first.record.caseId);});
 stage='restart';execFileSync('docker',['restart',process.env.ISOLATED_AUTH_CONTAINER,process.env.ISOLATED_REST_CONTAINER],{stdio:['ignore','pipe','pipe']});
 await ready('http://auth:9999/health','restart_auth_ready');await ready('http://rest:3000/','restart_rest_ready');
 const refreshed=await login('restore-writer@synthetic.invalid');
 await step('restart_new_login_case_and_draft_preserved',async()=>{const restarted=await client(refreshed).getCase({requestContext:{},tenantId:'sarberki-test',caseId:first.record.caseId});assert.equal(restarted.revision,2);assert.deepEqual(restarted.data,reviewed.record.data);});
 report.send_email='NEVER_CALLED';report.booking_creation='NEVER_CALLED';report.completed=true;
}catch{report.completed=false;report.failed_stage=stage;process.exitCode=1;}
finally{mkdirSync('/tmp/runtime-evidence',{recursive:true});writeFileSync('/tmp/runtime-evidence/RUNTIME-CHAIN.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
