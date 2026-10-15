import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createExactGmailReceipt,readExactReceiptAudit} from '../shared-core/server-exact-gmail-receipt.mjs';
import {createServerBookingRuntime} from '../shared-core/server-booking-runtime.mjs';
import {createServerCaseService} from '../shared-core/server-case-service.mjs';
import {createSupabaseTransport,createSupabaseCaseRepository,createSupabaseAuthority} from '../shared-core/supabase-case-repository.mjs';
import {createCaseHandler} from '../netlify/functions/booking-cases.mjs';
import {syntheticPreviewState} from '../synthetic-server-preview.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const project='https://mojnqizbcaczstguikpv.supabase.co';
const source={provider:'gmail',mailbox_id:'sarberki_gmail_test',message_id:'fake-audit-message',thread_id:'fake-audit-thread',rfc_message_id:'<fake-audit@example.test>',in_reply_to:null,references:[],subject:'Fictional audit inquiry',to:'sarberkiprojecttest@gmail.com',from:'Fictional Sender <fictional@example.test>',from_email:'fictional@example.test',received_at:'2026-10-03T09:23:06.000Z'};
const envelope={sender:source.from_email,text:'Hello! Eight adults would like separate units from October 30 to November 1, 2026.\r\nFictional Guest',mailbox_id:source.mailbox_id,message_id:source.message_id,thread_id:source.thread_id,rfc_message_id:source.rfc_message_id,references:[],received_at:source.received_at};
const config={caseId:'44444444-4444-4444-8444-444444444444',source,envelope,bodySha256:createHash('sha256').update(envelope.text).digest('hex')};
const env={URL:'https://leafy-chimera-2403e5.netlify.app',SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_AUDIT_KEY_12345',CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',CASE_APPROVAL_ENABLED:'sarberki-test-synthetic-only',ISOLATED_APPROVAL_ATTESTATION_KEY:'ab'.repeat(32),CASE_EXACT_RECEIPT_ENABLED:'sarberki-test-one-receipt',CASE_EXACT_RECEIPT_PRIVATE_JSON:JSON.stringify(config)};
const actors={writer:'11111111-1111-4111-8111-111111111111',reader:'22222222-2222-4222-8222-222222222222',foreign:'33333333-3333-4333-8333-333333333333'};
const tokens=Object.fromEntries(Object.keys(actors).map(role=>[role,'synthetic_audit_token_'+role]));

test('exact receipt preview verifies PostgreSQL write audit through ordinary role-isolated GETs only',async t=>{
 const db=new PGlite(),calls=[];let mode='normal',writes=0,auditReads=0;
 const asRole=async(role,fn)=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actors[role]})]);try{return await fn();}finally{await db.exec('reset role');}};
 const fetchImpl=async(raw,options)=>{
  const url=new URL(raw);assert.equal(url.origin,project,'no provider network allowed');
  const role=Object.keys(tokens).find(role=>options.headers.Authorization==='Bearer '+tokens[role]);assert.ok(role);
  calls.push({path:url.pathname,method:options.method,select:url.searchParams.get('select')});
  if(url.pathname==='/auth/v1/user')return {ok:true,json:async()=>({id:actors[role]})};
  try{
   const result=await asRole(role,async()=>{
    if(url.pathname.endsWith('/sc_memberships'))return (await db.query('select * from sc_memberships where user_id=$1',[actors[role]])).rows;
    if(url.pathname.endsWith('/sc_write_case')){writes++;const b=JSON.parse(options.body);return (await db.query('select sc_write_case($1,$2,$3,$4) result',[b.p_tenant,b.p_case,b.p_expected,JSON.stringify(b.p_data)])).rows[0].result;}
    assert.equal(options.method,'GET','audit/preview must never mutate');
    const tenant=url.searchParams.get('tenant_id')?.slice(3),id=url.searchParams.get('case_id')?.slice(3),revision=url.searchParams.get('revision')?.slice(3);
    assert.equal(tenant,'sarberki-test');
    if(url.pathname.endsWith('/sc_audit')){
     auditReads++;assert.equal(id,config.caseId);assert.equal(revision,'1');assert.equal(url.searchParams.get('limit'),'2');
     assert.equal(url.searchParams.get('select'),'tenant_id,case_id,revision,actor,kind,data_hash');
     if(mode==='unavailable')throw Error('fake unavailable');
     const rows=(await db.query('select tenant_id,case_id,revision,actor,kind,data_hash from sc_audit where tenant_id=$1 and case_id=$2 and revision=$3',[tenant,id,Number(revision)])).rows;
     if(mode==='missing')return [];
     if(mode==='duplicate')return [...rows,...rows];
     if(['actor','revision','case_id','tenant_id','kind','data_hash'].includes(mode))return rows.map(r=>({...r,[mode]:mode==='revision'?2:mode==='data_hash'?'0'.repeat(64):'changed'}));
     return rows;
    }
    assert.ok(url.pathname.endsWith('/sc_cases'),'no new RPC or provider path');
    if(url.searchParams.get('select')?.includes('data::text')){
     assert.equal(id,config.caseId);assert.equal(revision,'1');assert.equal(url.searchParams.get('select'),'tenant_id,case_id,revision,updated_by,data::text');
     const rows=(await db.query('select tenant_id,case_id,revision,updated_by,data::text as data from sc_cases where tenant_id=$1 and case_id=$2 and revision=$3',[tenant,id,Number(revision)])).rows;
     if(mode==='snapshot_missing')return [];
     if(mode==='snapshot_object')return rows.map(r=>({...r,data:JSON.parse(r.data)}));
     if(mode==='snapshot_changed')return rows.map(r=>({...r,data:JSON.stringify({...JSON.parse(r.data),unexpected:true})}));
     return rows;
    }
    return (await db.query('select * from sc_cases where tenant_id=$1'+(id?' and case_id=$2':''),id?[tenant,id]:[tenant])).rows;
   });return {ok:true,json:async()=>result};
  }catch(error){return {ok:false,status:error.code==='42501'?403:503};}
 };
 const handler=createCaseHandler({env,fetchImpl});
 const api=async(role,input,method='GET')=>{
  const r=await handler({httpMethod:method,headers:{authorization:'Bearer '+tokens[role]},queryStringParameters:method==='GET'?input:{},body:method==='POST'?JSON.stringify(input):''});return {status:r.statusCode,body:JSON.parse(r.body)};
 };
 const query={tenantId:'sarberki-test',caseId:config.caseId,expectedRevision:'1',action:'preview-draft'};
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  await db.exec("insert into sc_tenants values('sarberki-test','Fictional',true),('demo-test','Foreign fictional',true)");
  for(const [role,id] of Object.entries(actors)){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into sc_memberships values($1,$2,true,$3,false)',[role==='foreign'?'demo-test':'sarberki-test',id,role==='writer']);}
  await db.query("select set_config('sarberki.receipt_install_project_ref',$1,false),set_config('sarberki.receipt_backup_sha256',$2,false)",['mojnqizbcaczstguikpv','b'.repeat(64)]);
  await db.exec(await read('deployment/exact-receipt/install.sql'));
  await db.query("insert into sc_private_exact_receipt(enabled,tenant_id,case_id,expected_source,expected_message,body_sha256) values(true,'sarberki-test',$1,$2,$3,$4)",[config.caseId,JSON.stringify(source),JSON.stringify(envelope),config.bodySha256]);
  const tr=createSupabaseTransport({url:project,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,token:tokens.writer,fetchImpl});
  const service=createServerCaseService({repository:createSupabaseCaseRepository(tr),resolveAuthority:createSupabaseAuthority(tr)});
  const runtime=createServerBookingRuntime({service,tenantId:'sarberki-test',exactReceipt:createExactGmailReceipt(env)});
  const saved=await runtime.ingest(envelope,undefined,{expectedRevision:0,persistDraft:true,sourceReceipt:source});
  const before=await db.query('select data,revision from sc_cases');
  const hash=(await db.query("select encode(sha256(convert_to(data::text,'UTF8')),'hex') hash from sc_cases")).rows[0].hash;
  await t.test('Writer and Reader get only consistent actor/revision/hash write proof, never approval',async()=>{
   for(const role of ['writer','reader']){
    const r=await api(role,query);assert.equal(r.status,200);const p=r.body.result;
    assert.equal(p.reviewState.auditStatus,'verified');assert.deepEqual(p.auditProof,{verified:true,scope:'stored-case-write',tenantId:'sarberki-test',caseId:config.caseId,revision:1,actor:actors.writer,kind:'insert',dataHash:hash});
    assert.equal(p.approval,'pending');assert.equal(p.persisted,false);const view=syntheticPreviewState(p);
    assert.match(view.audit,/Audit visszaolvasva/);assert.ok(view.audit.includes(hash));assert.match(view.audit,/Ez nem jóváhagyás/);assert.match(view.capacity,/NEM IGAZOLT/);assert.match(view.price,/NEM IGAZOLT/);assert.match(view.approval,/függőben/);
   }
  });
  await t.test('foreign membership cannot read this audit and Reader cannot write or approve',async()=>{
   const beforeReads=auditReads;assert.equal((await api('foreign',query)).status,403);assert.equal(auditReads,beforeReads);
   assert.deepEqual(await asRole('foreign',async()=>(await db.query("select * from sc_audit where tenant_id='sarberki-test'")).rows),[]);
   assert.equal((await api('reader',{...query,action:'draft',expectedRevision:1},'POST')).status,403);
   assert.equal((await api('reader',{...query,action:'approve',expectedRevision:1,reviewedDraftHash:'0'.repeat(64)},'POST')).status,403);
  });
  await t.test('missing, inconsistent, tampered or unavailable audit/snapshot remains unverified',async()=>{
   for(const bad of ['missing','duplicate','actor','revision','case_id','tenant_id','kind','data_hash','unavailable','snapshot_missing','snapshot_object','snapshot_changed']){
    mode=bad;const r=await api('reader',query);assert.equal(r.status,200,bad);assert.equal(r.body.result.reviewState.auditStatus,'not_verified',bad);assert.equal(r.body.result.auditProof,undefined,bad);assert.match(syntheticPreviewState(r.body.result).audit,/NEM IGAZOLT/,bad);
   }
   mode='normal';
   let read=false;
   assert.equal(await readExactReceiptAudit({record:{...saved.record,data:{...saved.record.data,messages:[{...envelope,text:'changed'}]}},exactReceipt:createExactGmailReceipt(env),transport:async()=>{read=true;}}),null);assert.equal(read,false,'nonmatching private receipt must not read audit');
  });
  await t.test('preview does not mutate case/audit or call providers, and UI rejects unbound proof',async()=>{
   assert.deepEqual((await db.query('select data,revision from sc_cases')).rows,before.rows);assert.equal((await db.query('select count(*)::int n from sc_audit')).rows[0].n,1);assert.equal(writes,1,'only the initial fixture insert');
   assert.equal(calls.some(c=>c.method!=='GET'&&!c.path.endsWith('/sc_write_case')),false);
   const p=(await api('reader',query)).body.result;
   for(const tamper of [{caseId:'case-other'},{revision:2},{scope:'approval'},{dataHash:'bad'},{actor:'bad'},{kind:'approve_isolated_synthetic'}])assert.match(syntheticPreviewState({...p,auditProof:{...p.auditProof,...tamper}}).audit,/NEM IGAZOLT/);
   assert.match(syntheticPreviewState({...p,reviewState:{...p.reviewState,storedApproval:'internally_approved'}}).audit,/NEM IGAZOLT/);
  });
 }finally{await db.close();}
});
