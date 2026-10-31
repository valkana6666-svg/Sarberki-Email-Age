import test,{before,after,mock} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createCaseHandler} from '../netlify/functions/booking-cases.mjs';
import {createWriterReaderFixtureHandler} from '../netlify/functions/writer-reader-fixture.mjs';
import {createOperatorSessionHandler} from '../netlify/functions/operator-session.mjs';
import {EDITABLE_FIXTURE_ID,editableFixtureRequest,matchesEditableFixture,preparePendingEditableFixture} from '../shared-core/server-pending-editable-fixture.mjs';
import {assertCloudSyntheticReviewCase} from '../shared-core/cloud-synthetic-approval.mjs';
before(()=>mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-26T22:00:00Z')}));
after(()=>mock.timers.reset());
const origin='https://leafy-chimera-2403e5.netlify.app',project='https://mojnqizbcaczstguikpv.supabase.co';
const actors={writer:'11111111-1111-4111-8111-111111111111',reader:'22222222-2222-4222-8222-222222222222',approver:'33333333-3333-4333-8333-333333333333'};
const sessions={writer:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',reader:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',approver:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'};
const env={URL:origin,SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_ACCEPTANCE_20261026',CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',CASE_APPROVAL_ENABLED:'sarberki-test-synthetic-only',ISOLATED_APPROVAL_ATTESTATION_KEY:'a1'.repeat(32),SARBERKI_OPERATOR_SESSION_KEY:'b2'.repeat(32)};
const hash=text=>createHash('sha256').update(text).digest('hex');
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('fixed future booking acceptance fixture never grants generic or multi-message review scope',()=>{
 const request=editableFixtureRequest(),record={tenantId:'sarberki-test',caseId:EDITABLE_FIXTURE_ID,data:{id:EDITABLE_FIXTURE_ID,tenantId:'sarberki-test',sender:request.envelope.sender,messages:[request.envelope],state:{values:{arrival:'2026-11-26',departure:'2026-11-28',adults:'2',children:'0',guests:'2',unit:'Deluxe'}}}};
 assert.equal(matchesEditableFixture(record),true);assert.doesNotThrow(()=>assertCloudSyntheticReviewCase(record));
 for(const change of [r=>r.tenantId='demo-test',r=>r.caseId='case-arbitrary',r=>r.data.messages.push({...request.envelope}),r=>r.data.messages[0].text+=' altered',r=>r.data.state.values.adults='3',r=>r.data.caseKind='service_link_review']){
  const changed=structuredClone(record);change(changed);assert.equal(matchesEditableFixture(changed),false);assert.throws(()=>assertCloudSyntheticReviewCase(changed),/FORBIDDEN/);
 }
});
test('real PostgreSQL: fixed Writer preparation -> exact saved edit -> Reader reload -> independent approval -> durable audit',async t=>{
 const db=new PGlite(),tokens=new Map(),cookies=new Map(),csrf=new Map();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  await db.exec("insert into sc_tenants values('sarberki-test','Synthetic',true),('demo-test','Other',true)");
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false),set_config('sarberki.approval_backup_sha256',$2,false)",['mojnqizbcaczstguikpv','b'.repeat(64)]);
  await db.exec(await read('deployment/cloud-approval/install.sql'));
  await db.exec(await read('deployment/cloud-approval/separate-approver-permission.sql'));
  await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[env.ISOLATED_APPROVAL_ATTESTATION_KEY]);
  for(const [role,id] of Object.entries(actors)){
   await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions[role],id]);
   await db.query("insert into sc_memberships values('sarberki-test',$1,true,$2,$3)",[id,role==='writer',role!=='reader']);
  }
  const fetchImpl=async(raw,options={})=>{
   const url=new URL(raw);assert.equal(url.origin,project,'all Auth/REST is synthetic');
   if(url.pathname==='/auth/v1/token'){
    const body=JSON.parse(options.body),role=url.searchParams.get('grant_type')==='password'?body.email.split('@')[0]:body.refresh_token.replace('synthetic_refresh_','');
    assert.ok(actors[role]);
    const claims={sub:actors[role],role:'authenticated',iss:project+'/auth/v1',exp:Math.floor(Date.now()/1000)+3600,session_id:sessions[role]};
    const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.synthetic_signature';tokens.set(token,{role,claims});
    return {ok:true,json:async()=>({access_token:token,refresh_token:'synthetic_refresh_'+role,user:{id:actors[role]}})};
   }
   const {role,claims}=tokens.get(options.headers.Authorization?.slice(7))||{};assert.ok(role);
   if(url.pathname==='/auth/v1/user')return {ok:true,json:async()=>({id:actors[role]})};
   await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);
   try{
    let result;const body=options.body?JSON.parse(options.body):null;
    if(url.pathname.endsWith('/sc_memberships'))result=(await db.query('select * from sc_memberships where user_id=$1',[actors[role]])).rows;
    else if(url.pathname.endsWith('/sc_write_case'))result=(await db.query('select sc_write_case($1,$2,$3,$4) result',[body.p_tenant,body.p_case,body.p_expected,JSON.stringify(body.p_data)])).rows[0].result;
    else if(url.pathname.endsWith('/sc_approve_case'))result=(await db.query('select sc_approve_case($1,$2,$3,$4,$5) result',[body.p_tenant,body.p_case,body.p_expected,body.p_draft_hash,JSON.stringify(body.p_evidence)])).rows[0].result;
    else if(url.pathname.endsWith('/sc_audit'))result=(await db.query('select revision,actor,at,kind,data_hash from sc_audit where tenant_id=$1 and case_id=$2 and kind=$3 order by revision',['sarberki-test',url.searchParams.get('case_id').slice(3),url.searchParams.get('kind').slice(3)])).rows;
    else{assert.equal(url.pathname,'/rest/v1/sc_cases');const id=url.searchParams.get('case_id')?.slice(3),tenant=url.searchParams.get('tenant_id').slice(3);result=(await db.query('select * from sc_cases where tenant_id=$1'+(id?' and case_id=$2':''),id?[tenant,id]:[tenant])).rows;}
    return {ok:true,json:async()=>result};
   }catch(error){return {ok:false,status:error.code==='42501'?403:400};}finally{await db.exec('reset role');}
  };
  const call=async(role,handler,input={},{method='POST',status=200,headers={}}={})=>{
   const event={httpMethod:method,headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','x-sarberki-operator':'1','Content-Type':'application/json',...(cookies.has(role)?{cookie:cookies.get(role)}:{}),...(csrf.has(role)?{'x-csrf-token':csrf.get(role)}:{}),...headers},body:method==='GET'?'':JSON.stringify(input),queryStringParameters:method==='GET'?input:{}};
   const response=await handler(event);if(response.headers['Set-Cookie'])cookies.set(role,response.headers['Set-Cookie'].split(';')[0]);
   assert.equal(response.statusCode,status,response.body);return JSON.parse(response.body);
  };
  const api=()=>createCaseHandler({env,fetchImpl});
  const prepare=createWriterReaderFixtureHandler({env,fetchImpl});
  for(const role of Object.keys(actors)){const login=await call(role,createOperatorSessionHandler({env,fetchImpl}),{action:'login',email:role+'@synthetic.invalid',password:'SYNTHETIC_TEST_PASSWORD'});csrf.set(role,login.csrfToken);}
  const input={action:'prepare-editable-fixture'},readRecord=role=>call(role,api(),{tenantId:'sarberki-test',caseId:EDITABLE_FIXTURE_ID,action:'review-record'},{method:'GET'});
  // Daily list and detailed review must show the same stored case, revision and draft to every role.
  const assertViews=async(revision,category,text,flags)=>{
   for(const role of Object.keys(actors)){
    const listed=(await call(role,api(),{tenantId:'sarberki-test',action:'daily-list'},{method:'GET'})).result,record=(await readRecord(role)).result;
    assert.deepEqual(listed,[{tenantId:'sarberki-test',caseId:EDITABLE_FIXTURE_ID,revision,category}],role);
    assert.equal(record.caseId,listed[0].caseId,role);assert.equal(record.revision,listed[0].revision,role);assert.equal(record.data.drafts.at(-1).text,text,role);
    assert.deepEqual([record.canEditDraft,record.canApproveDraft],flags[role],role);
   }
  };
  const snapshot=async()=>({cases:(await db.query('select case_id,revision,data from sc_cases order by case_id')).rows,audit:(await db.query('select * from sc_audit order by event_id')).rows,daily:(await call('reader',api(),{tenantId:'sarberki-test',action:'daily-list'},{method:'GET'})).result});
  await call('reader',prepare,input,{status:403});
  await call('writer',prepare,{...input,envelope:editableFixtureRequest().envelope},{status:400});
  const first=(await call('writer',prepare,input)).result;assert.equal(first.caseId,EDITABLE_FIXTURE_ID);assert.equal(first.revision,2);assert.equal(first.duplicate,false);
  const again=(await call('writer',prepare,input)).result;assert.deepEqual(again,{...first,duplicate:true});
  assert.equal((await db.query('select count(*)::int n from sc_cases')).rows[0].n,1);
  const opened=(await readRecord('writer')).result;assert.equal(opened.canEditDraft,true);assert.equal(opened.data.state.approval,'pending');assert.equal(opened.data.messages.length,1);
  await t.test('daily categories and permissions use the same protected PostgreSQL records',async()=>{
   const listed=(await call('reader',api(),{tenantId:'sarberki-test',action:'daily-list'},{method:'GET'})).result;
   assert.deepEqual(listed,[{tenantId:'sarberki-test',caseId:first.caseId,revision:2,category:'approval'}]);
   assert.equal(opened.canApproveDraft,false);
   assert.equal((await readRecord('reader')).result.canApproveDraft,false);
   assert.equal((await readRecord('approver')).result.canApproveDraft,true);
   await call('reader',api(),{tenantId:'demo-test',action:'daily-list'},{method:'GET',status:403});
   await call('reader',api(),{tenantId:'sarberki-test',caseId:first.caseId,action:'daily-list'},{method:'GET',status:403});
   await call('reader',api(),{tenantId:'sarberki-test',action:'daily-list'},{method:'GET',headers:{'x-csrf-token':''},status:403});
  });
  const original=opened.data.drafts.at(-1).text,edited=original+'\nSynthetic human clarification.  ';
  await assertViews(2,'approval',original,{writer:[true,false],reader:[false,false],approver:[false,true]});
  const beforeRejectedEdits=await snapshot();
  const edit={tenantId:'sarberki-test',caseId:first.caseId,action:'edit-draft',expectedRevision:2,expectedDraftHash:hash(original),editedDraftText:edited};
  await t.test('Reader, other tenant, missing CSRF, stale revision and wrong hash cannot edit',async()=>{
   await call('reader',api(),edit,{status:403});await call('writer',api(),{...edit,tenantId:'demo-test'},{status:403});
   await call('writer',api(),edit,{headers:{'x-csrf-token':''},status:403});await call('writer',api(),{...edit,expectedRevision:1},{status:409});await call('writer',api(),{...edit,expectedDraftHash:'0'.repeat(64)},{status:400});
   assert.deepEqual(await snapshot(),beforeRejectedEdits);
  });
  const saved=(await call('writer',api(),edit)).result;assert.equal(saved.revision,3);assert.equal(saved.data.drafts.at(-1).text,edited);
  const afterEditAudit=(await db.query('select count(*)::int n from sc_audit')).rows[0].n;
  const resumed=(await call('writer',prepare,input)).result;assert.equal(resumed.caseId,first.caseId);assert.equal(resumed.revision,3);assert.equal(resumed.duplicate,true);
  assert.equal((await db.query('select count(*)::int n from sc_audit')).rows[0].n,afterEditAudit);
  const readback=(await readRecord('reader')).result;assert.equal(readback.canEditDraft,false);assert.equal(readback.revision,3);assert.equal(readback.data.drafts.at(-1).text,edited);
  await assertViews(3,'approval',edited,{writer:[true,false],reader:[false,false],approver:[false,true]});
  const approve={tenantId:'sarberki-test',caseId:first.caseId,action:'approve',expectedRevision:3,reviewedDraftHash:hash(edited)};
  const beforeRejectedApprovals=await snapshot();
  await t.test('same editor even with approve permission, Reader, stale revision and foreign tenant cannot approve',async()=>{
   await call('writer',api(),approve,{status:403});await call('reader',api(),approve,{status:403});await call('approver',api(),{...approve,expectedRevision:2},{status:409});await call('approver',api(),{...approve,tenantId:'demo-test'},{status:403});
   assert.deepEqual(await snapshot(),beforeRejectedApprovals);
  });
  const approved=(await call('approver',api(),approve)).result;assert.equal(approved.revision,4);assert.equal(approved.data.state.approval,'internally_approved');
  const dailyApproved=(await call('reader',api(),{tenantId:'sarberki-test',action:'daily-list'},{method:'GET'})).result;
  assert.equal(dailyApproved[0].revision,4);assert.equal(dailyApproved[0].category,'progress');
  assert.equal((await readRecord('approver')).result.canApproveDraft,false);
  await assertViews(4,'progress',edited,{writer:[false,false],reader:[false,false],approver:[false,false]});
  const durable=(await call('reader',api(),{tenantId:'sarberki-test',caseId:first.caseId,action:'approval-state'},{method:'GET'})).result;
  assert.equal(durable.storedDraft.text,edited);assert.equal(durable.serverApproval.actor,actors.approver);assert.equal(durable.serverApproval.reviewedRevision,3);assert.equal(durable.serverApproval.draftHash,hash(edited));assert.equal(durable.audit.length,1);assert.equal(durable.audit[0].actor,actors.approver);assert.equal(durable.audit[0].revision,4);
  const auditCount=(await db.query('select count(*)::int n from sc_audit')).rows[0].n;
  await call('approver',api(),approve,{status:409});
  await call('writer',prepare,input,{status:409});await call('writer',api(),{...edit,expectedRevision:4,expectedDraftHash:hash(edited),editedDraftText:'Attempted approved reopening'},{status:400});
  assert.equal((await db.query('select count(*)::int n from sc_audit')).rows[0].n,auditCount);
 }finally{await db.close();}
});

test('expired fixed acceptance window cannot create a new record',async()=>{
 let writes=0;
 const service={requireWrite:async()=>{},listCases:async()=>[]};
 const runtime={ingest:async()=>{writes++;throw Error('must not write');}};
 await assert.rejects(preparePendingEditableFixture({service,runtime,isReviewCase:assertCloudSyntheticReviewCase,now:()=>Date.parse('2026-11-26T12:00:00Z')}),e=>e.code==='SYNTHETIC_FIXTURE_EXPIRED');
 assert.equal(writes,0);
});
