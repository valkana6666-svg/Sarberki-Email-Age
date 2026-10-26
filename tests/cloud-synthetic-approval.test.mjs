import test, {before,after,mock} from 'node:test';
// Freeze the fictional stay, evidence, JWTs and embedded PostgreSQL together.
// This clock exists only in this isolated test file; application guards stay real-time.
before(()=>mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-17T12:00:00Z')}));
after(()=>mock.timers.reset());
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createCaseHandler} from '../netlify/functions/booking-cases.mjs';
import {cloudSyntheticApprovalEnabled,assertCloudSyntheticReviewCase} from '../shared-core/cloud-synthetic-approval.mjs';
import {syntheticMailLanguages,syntheticMailEnvelope} from '../shared-core/synthetic-mail-fixtures.mjs';
import {syntheticReaderFixtureRequest} from '../shared-core/synthetic-reader-fixture.mjs';
import {buildCloudSyntheticApprovalSql} from '../scripts/build-cloud-synthetic-approval-sql.mjs';

const project='https://mojnqizbcaczstguikpv.supabase.co';
const user='11111111-1111-4111-8111-111111111111',reader='22222222-2222-4222-8222-222222222222',approver='33333333-3333-4333-8333-333333333333',approvalSession='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',session='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const env={URL:'https://leafy-chimera-2403e5.netlify.app',SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:'synthetic-public-key',CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',CASE_APPROVAL_ENABLED:'sarberki-test-synthetic-only',ISOLATED_APPROVAL_ATTESTATION_KEY:'a1'.repeat(32)};
test('cloud approval target and fixed synthetic record fail closed',()=>{
 assert.equal(cloudSyntheticApprovalEnabled(env),true);
 for(const override of [{SUPABASE_URL:'https://other.supabase.co'},{URL:'https://production.example'},{CASE_APPROVAL_ENABLED:''},{ISOLATED_APPROVAL_ATTESTATION_KEY:''}])assert.equal(cloudSyntheticApprovalEnabled({...env,...override}),false);
 assert.throws(()=>assertCloudSyntheticReviewCase({tenantId:'sarberki-test',data:{tenantId:'sarberki-test',sender:'any@synthetic.invalid',messages:[]}}),/FORBIDDEN/);
});
test('generated managed binding reuses existing approval SQL and real PostgreSQL auth/CAS/audit',async t=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610090001_case_store.sql',import.meta.url),'utf8'));
  await db.exec("insert into sc_tenants values('sarberki-test','Synthetic',true),('demo-test','Other',true)");
  const source=await readFile(new URL('../recovery/sql/isolated-approval.sql',import.meta.url),'utf8'),sql=buildCloudSyntheticApprovalSql(source);
  assert.equal(sql,await readFile(new URL('../deployment/cloud-approval/install.sql',import.meta.url),'utf8'));
  await assert.rejects(db.exec(sql),/verified test project and fresh backup/);await db.exec('rollback');
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false)",['other']);
  await db.query("select set_config('sarberki.approval_backup_sha256',$1,false)",['b'.repeat(64)]);
  await assert.rejects(db.exec(sql),/verified test project and fresh backup/);await db.exec('rollback');
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false)",['mojnqizbcaczstguikpv']);await db.exec(sql);
  await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[env.ISOLATED_APPROVAL_ATTESTATION_KEY]);
  await db.query('insert into auth.users values($1),($2),($3)',[user,reader,approver]);await db.query('insert into auth.sessions values($1,$2,null),($3,$4,null)',[session,user,approvalSession,approver]);
  await db.query("insert into sc_memberships values('sarberki-test',$1,true,true,false),('sarberki-test',$2,true,false,false)",[user,reader]);
  await t.test('legacy approval constraint reproduces managed read-only approver failure',async()=>{
   await assert.rejects(db.query("insert into sc_memberships values('sarberki-test',$1,true,false,true)",[approver]),/sc_memberships_check1/);
  });
  const permissionSql=await readFile(new URL('../deployment/cloud-approval/separate-approver-permission.sql',import.meta.url),'utf8');
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false)",['other']);
  await assert.rejects(db.exec(permissionSql),/verified test project and fresh backup/);await db.exec('rollback');
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false)",['mojnqizbcaczstguikpv']);
  await db.exec(permissionSql);
  await t.test('approve requires read but is independent of write; existing memberships unchanged',async()=>{
   await assert.rejects(db.query("insert into sc_memberships values('sarberki-test',$1,false,false,true)",[approver]),/sc_memberships_approve_requires_read/);
   await assert.rejects(db.query("insert into sc_memberships values('sarberki-test',$1,false,true,false)",[approver]),/sc_memberships_check/);
   await db.query("insert into sc_memberships values('sarberki-test',$1,true,false,true)",[approver]);
   const rows=(await db.query('select * from sc_memberships where user_id in ($1,$2) order by user_id',[user,reader])).rows;
   assert.deepEqual(rows.map(({can_read,can_write,can_approve})=>({can_read,can_write,can_approve})),[{can_read:true,can_write:true,can_approve:false},{can_read:true,can_write:false,can_approve:false}]);
  });
  let issuer=project+'/auth/v1';
  const fetchImpl=async(raw,options)=>{
   const url=new URL(raw);assert.equal(url.origin,project);
   const actor=options.headers.Authorization.endsWith('synthetic-reader-token-0002')?reader:options.headers.Authorization.endsWith('synthetic-approver-token-0003')?approver:user;
   if(url.pathname==='/auth/v1/user')return {ok:true,json:async()=>({id:actor})};
   await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actor,iss:issuer,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,session_id:actor===approver?approvalSession:session})]);
   try{
    let result;
    if(url.pathname.endsWith('/sc_memberships'))result=(await db.query('select * from sc_memberships where user_id=$1',[actor])).rows;
    else if(url.pathname.endsWith('/sc_write_case')){const b=JSON.parse(options.body);result=(await db.query('select sc_write_case($1,$2,$3,$4) result',[b.p_tenant,b.p_case,b.p_expected,JSON.stringify(b.p_data)])).rows[0].result;}
    else if(url.pathname.endsWith('/sc_approve_case')){const b=JSON.parse(options.body);result=(await db.query('select sc_approve_case($1,$2,$3,$4,$5) result',[b.p_tenant,b.p_case,b.p_expected,b.p_draft_hash,JSON.stringify(b.p_evidence)])).rows[0].result;}
    else if(url.pathname.endsWith('/sc_audit'))result=(await db.query("select revision,actor,kind,data_hash from sc_audit where tenant_id='sarberki-test' and case_id=$1 and kind='approve_isolated_synthetic'",[url.searchParams.get('case_id').slice(3)])).rows;
    else {const id=url.searchParams.get('case_id')?.slice(3);result=(await db.query('select * from sc_cases where tenant_id=$1'+(id?' and case_id=$2':''),id?['sarberki-test',id]:['sarberki-test'])).rows;}
    return {ok:true,json:async()=>result};
   }catch(error){return {ok:false,status:error.code==='42501'?403:400};}finally{await db.exec('reset role');}
  };
  const handler=createCaseHandler({env,fetchImpl});
  const call=async(input,token='synthetic-writer-token-0001',status=200)=>{
   const r=await handler({httpMethod:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify({tenantId:'sarberki-test',...input})});assert.equal(r.statusCode,status,r.body);return JSON.parse(r.body).result;
  };
  const created=await call(syntheticReaderFixtureRequest()),caseId=created.record.caseId;
  const reviewed=await call({action:'review-draft',caseId,expectedRevision:1});assert.equal(reviewed.review.status,'internal_review_required');
  const readResponse=await handler({httpMethod:'GET',headers:{authorization:'Bearer synthetic-reader-token-0002'},queryStringParameters:{tenantId:'sarberki-test',caseId,action:'review-record'}});
  assert.equal(readResponse.statusCode,200,readResponse.body);assert.equal(JSON.parse(readResponse.body).result.revision,2);
  assert.equal((await db.query('select revision from sc_cases where case_id=$1',[caseId])).rows[0].revision,2);

  const reviewedDraftHash=createHash('sha256').update(reviewed.record.data.drafts.at(-1).text).digest('hex'),input={action:'approve',caseId,expectedRevision:2,reviewedDraftHash};
  await t.test('Reader write and approve permissions remain denied',async()=>{await call({action:'review-draft',caseId,expectedRevision:2},'synthetic-reader-token-0002',403);await call(input,'synthetic-reader-token-0002',403);});
  await t.test('separate approver cannot write and Writer cannot approve',async()=>{await call({action:'review-draft',caseId,expectedRevision:2},'synthetic-approver-token-0003',403);await call(input,undefined,403);});
  await t.test('wrong signed project issuer is denied',async()=>{issuer='https://other.supabase.co/auth/v1';await call(input,'synthetic-approver-token-0003',403);issuer=project+'/auth/v1';});
  await t.test('CAS and reviewed hash bind exact saved version',async()=>{await call({...input,expectedRevision:1},'synthetic-approver-token-0003',409);await call({...input,reviewedDraftHash:'0'.repeat(64)},'synthetic-approver-token-0003',400);});
  await t.test('approved state and audit read back with original authority',async()=>{const approved=await call(input,'synthetic-approver-token-0003');assert.equal(approved.revision,3);assert.equal(approved.data.state.approval,'internally_approved');assert.equal(approved.data.serverApproval.draftHash,reviewedDraftHash);const audit=(await db.query("select * from sc_audit where kind='approve_isolated_synthetic'")).rows;assert.equal(audit.length,1);assert.equal(audit[0].actor,approver);await call(input,'synthetic-approver-token-0003',409);
   const r=await handler({httpMethod:'GET',headers:{authorization:'Bearer synthetic-writer-token-0001'},queryStringParameters:{tenantId:'sarberki-test',caseId,action:'approval-state'}});
   assert.equal(r.statusCode,200,r.body);const back=JSON.parse(r.body).result;assert.equal(back.approval,'internally_approved');assert.equal(back.audit[0].actor,approver);assert.equal(back.serverApproval.draftHash,reviewedDraftHash);assert.equal(back.serverApproval.evidence,undefined);
  });
  await t.test('exact four-language mail registry reuses existing SQL/runtime without touching original approved case',async()=>{
   for(const language of syntheticMailLanguages){
    const created=await call({action:'ingest-and-draft',envelope:syntheticMailEnvelope(language),expectedRevision:0});
    assert.equal(created.record.data.state.values.language,language);assert.ok(created.record.data.state.values.phone);
    const same=await call({action:'ingest-and-draft',envelope:syntheticMailEnvelope(language),expectedRevision:0});assert.equal(same.record.revision,1);
    const review=await call({action:'review-draft',caseId:created.record.caseId,expectedRevision:1});assert.equal(review.review.status,'internal_review_required');
    let hash=createHash('sha256').update(review.record.data.drafts.at(-1).text).digest('hex'),revision=2;
    if(language==='en'){
     const edit={action:'edit-draft',caseId:created.record.caseId,expectedRevision:2,expectedDraftHash:hash,editedDraftText:review.record.data.drafts.at(-1).text+'\nHuman synthetic clarification.  '};
     await t.test('Reader, stale revision, wrong base hash and arbitrary edit fields cannot mutate PostgreSQL',async()=>{
      await call(edit,'synthetic-reader-token-0002',403);
      await call({...edit,expectedRevision:1},undefined,409);
      await call({...edit,expectedDraftHash:'0'.repeat(64)},undefined,400);
      await call({...edit,actor:approver},undefined,400);
      assert.equal((await db.query('select revision from sc_cases where case_id=$1',[edit.caseId])).rows[0].revision,2);
     });
     const saved=await call(edit);revision=3;
     hash=createHash('sha256').update(edit.editedDraftText).digest('hex');
     assert.equal(saved.revision,3);assert.equal(saved.data.drafts.at(-1).text,edit.editedDraftText);
     assert.equal(saved.data.drafts.at(-1).draftHash,hash);assert.equal(saved.data.drafts.at(-1).editedBy,user);
     assert.equal(saved.data.drafts.at(-1).operatorReviewText,'');assert.equal(saved.data.serverApproval,undefined);
     await call(edit,undefined,409);
     const read=await handler({httpMethod:'GET',headers:{authorization:'Bearer synthetic-reader-token-0002'},queryStringParameters:{tenantId:'sarberki-test',caseId:edit.caseId,action:'review-record'}});
     assert.equal(read.statusCode,200);assert.equal(JSON.parse(read.body).result.data.drafts.at(-1).text,edit.editedDraftText);
     const updateAudit=(await db.query("select * from sc_audit where case_id=$1 and revision=3 and kind='update'",[edit.caseId])).rows;
     assert.equal(updateAudit.length,1);assert.equal(updateAudit[0].actor,user);
     await t.test('same editor with both roles cannot approve edited text; old hash also fails',async()=>{
      await db.query("update sc_memberships set can_approve=true where user_id=$1",[user]);
      try{await call({action:'approve',caseId:edit.caseId,expectedRevision:3,reviewedDraftHash:hash},undefined,403);}
      finally{await db.query("update sc_memberships set can_approve=false where user_id=$1",[user]);}
      await call({action:'approve',caseId:edit.caseId,expectedRevision:3,reviewedDraftHash:edit.expectedDraftHash},'synthetic-approver-token-0003',400);
     });
    }
    const approved=await call({action:'approve',caseId:created.record.caseId,expectedRevision:revision,reviewedDraftHash:hash},'synthetic-approver-token-0003');
    assert.equal(approved.revision,revision+1);assert.equal(approved.data.state.approval,'internally_approved');
    if(language==='en')await call({action:'edit-draft',caseId:created.record.caseId,expectedRevision:approved.revision,expectedDraftHash:hash,editedDraftText:'forbidden approved edit'},undefined,400);
   }
   const old=(await db.query('select * from sc_cases where case_id=$1',[caseId])).rows[0];assert.equal(old.revision,3);assert.equal(old.data.serverApproval.draftHash,reviewedDraftHash);
   assert.equal((await db.query("select count(*)::int n from sc_audit where kind='approve_isolated_synthetic'")).rows[0].n,5);
  });
 }finally{await db.close();}
});
