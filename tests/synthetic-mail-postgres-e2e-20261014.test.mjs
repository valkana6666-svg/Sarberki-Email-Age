import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import * as core from '../sarberki-core.mjs';
import {BUSINESS} from '../business-config.mjs';
import * as fishing from '../fishing-rules.mjs';
import * as policy from '../gmail-policy.mjs';
import * as splitUnits from '../split-units.mjs';
import {createServerCaseService} from '../shared-core/server-case-service.mjs';
import {createServerBookingRuntime} from '../shared-core/server-booking-runtime.mjs';
import {createSupabaseTransport,createSupabaseAuthority,createSupabaseCaseRepository} from '../shared-core/supabase-case-repository.mjs';
import {createIsolatedApprovalAttestor} from '../shared-core/isolated-approval-attestation.mjs';
import {serverInquiryOptions} from '../shared-core/server-inquiry-options.mjs';
import {extractServerMessage} from '../shared-core/server-message-extraction.mjs';
import {normalizeInquiryInput} from '../intake-normalize.mjs';
import {buildEmailInquiryDraft,buildChatInquiryReply} from '../shared-core/inquiry-channel-adapters.mjs';

// Entirely fictional MIME messages and provider evidence. Gmail/Auth HTTP are
// simulated; the existing SQL/RLS/CAS/audit run on a real PGlite PostgreSQL engine.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const project='https://mojnqizbcaczstguikpv.supabase.co';
const writer='11111111-1111-4111-8111-111111111111',reader='22222222-2222-4222-8222-222222222222',approver='33333333-3333-4333-8333-333333333333';
const session='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const key='a1'.repeat(32); // Public test material, never a deployed signing key.
test('server projection preserves a supplied normalized phone and leaves absent phone unset',()=>{
 const text='Hello! One Deluxe cabin from 2030-11-01 to 2030-11-03 for 2 adults and 0 children. My phone is +36 30 123 4567.';
 const normalized=normalizeInquiryInput({sourceChannel:'gmail',rawText:text,now:new Date('2030-10-01')}).normalized;
 assert.ok(normalized.phone);
 assert.equal(extractServerMessage({text,received_at:'2030-10-01T10:00:00Z'}).phone,normalized.phone);
 assert.equal(extractServerMessage({text:'Deluxe',received_at:'2030-10-01T10:00:00Z'}).phone,undefined);
});
async function gmailTransform(){
 const source=(await read('gmail-readonly.js')).replace(/await import\('\.\/([^']+)'\)/gu,(_,name)=>'modules['+JSON.stringify(name.split('?')[0])+']');
 const window={},element={disabled:false,textContent:'',addEventListener(){},insertAdjacentElement(){}};
 const context=vm.createContext({modules:{'sarberki-core.mjs':core,'business-config.mjs':{BUSINESS},'fishing-rules.mjs':fishing,'gmail-policy.mjs':policy,'split-units.mjs':splitUnits},window,document:{getElementById:()=>element,querySelector:()=>({content:'synthetic-client'})},console,URL,Date,Number,Intl,TextDecoder,Uint8Array,atob});
 await vm.runInContext(source,context);return window.sarberkiGmailTransform;
}
test('four-language synthetic MIME -> PostgreSQL draft -> Reader -> separate approval -> durable audit',async t=>{
 let db=new PGlite(),mode='available';const providerCalls=[],ids=[];
 const transform=await gmailTransform(),at=Date.now(),arrival=new Date(at+15*86400000).toISOString().slice(0,10),departure=new Date(at+17*86400000).toISOString().slice(0,10);
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  await db.exec("insert into sc_tenants values('sarberki-test','Synthetic',true),('demo-test','Foreign',true)");
  await db.query("select set_config('sarberki.approval_install_project_ref',$1,false),set_config('sarberki.approval_backup_sha256',$2,false)",['mojnqizbcaczstguikpv','b'.repeat(64)]);
  await db.exec(await read('deployment/cloud-approval/install.sql'));
  await db.exec(await read('deployment/cloud-approval/separate-approver-permission.sql'));
  await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[key]);
  await db.query('insert into auth.users values($1),($2),($3)',[writer,reader,approver]);
  await db.query('insert into auth.sessions values($1,$2,null)',[session,approver]);
  await db.query("insert into sc_memberships values('sarberki-test',$1,true,true,false),('sarberki-test',$2,true,false,false),('sarberki-test',$3,true,false,true)",[writer,reader,approver]);
  const asActor=async(actor,job)=>{
   await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actor,iss:project+'/auth/v1',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,session_id:session})]);
   try{return await job();}finally{await db.exec('reset role');}
  };
  const fetchImpl=async(raw,options)=>{
   const url=new URL(raw);assert.equal(url.origin,project);const actor=options.headers.Authorization.slice(7);
   assert.ok([writer,reader,approver].includes(actor));
   if(url.pathname==='/auth/v1/user')return {ok:true,json:async()=>({id:actor})};
   try{
    const result=await asActor(actor,async()=>{
     if(url.pathname.endsWith('/sc_memberships'))return (await db.query('select * from sc_memberships where user_id=$1',[actor])).rows;
     if(url.pathname.endsWith('/sc_write_case')){const b=JSON.parse(options.body);return (await db.query('select sc_write_case($1,$2,$3,$4) result',[b.p_tenant,b.p_case,b.p_expected,JSON.stringify(b.p_data)])).rows[0].result;}
     if(url.pathname.endsWith('/sc_approve_case')){const b=JSON.parse(options.body);return (await db.query('select sc_approve_case($1,$2,$3,$4,$5) result',[b.p_tenant,b.p_case,b.p_expected,b.p_draft_hash,JSON.stringify(b.p_evidence)])).rows[0].result;}
     const tenant=url.searchParams.get('tenant_id').slice(3),id=url.searchParams.get('case_id')?.slice(3);
     return (await db.query('select * from sc_cases where tenant_id=$1'+(id?' and case_id=$2':''),id?[tenant,id]:[tenant])).rows;
    });return {ok:true,json:async()=>result};
   }catch(error){return {ok:false,status:error.code==='42501'?403:400};}
  };
  const providers={availability:async q=>{providerCalls.push('capacity');return {...q,source:'synthetic-fixture',checkedAt:new Date().toISOString(),availability:mode==='capacity_unknown'?'unknown':'available',availableUnits:mode==='capacity_unknown'?0:1};},pricing:async q=>{providerCalls.push('price');if(mode==='price_unknown')throw Error('fictional outage');return {...q,tenantId:'sarberki-test',unitId:q.cabin,source:'synthetic-fixture',checkedAt:new Date().toISOString(),capacity:6,nightly:100,basis:'per_unit',verified:true};}};
  const make=actor=>{
   const transport=createSupabaseTransport({url:project,publishableKey:'synthetic-public-key',token:actor,fetchImpl});
   const service=createServerCaseService({repository:createSupabaseCaseRepository(transport,{approvalAttestor:createIsolatedApprovalAttestor(key)}),resolveAuthority:createSupabaseAuthority(transport)});
   return {service,runtime:createServerBookingRuntime({service,tenantId:'sarberki-test',isolatedApproval:true,reviewProviders:providers})};
  };
  const write=make(writer),readOnly=make(reader),approve=make(approver);
  const messages={hu:`Jó napot! Deluxe faház ${arrival} és ${departure} között 2 felnőtt, 0 gyermek.`,de:`Guten Tag! Deluxe Ferienhaus ${arrival} bis ${departure}, 2 Erwachsene, 0 Kinder.`,si:`Pozdravljeni! Deluxe hiška ${arrival} do ${departure}, 2 odrasli, 0 otroci.`,en:`Hello! One Deluxe cabin from ${arrival} to ${departure} for 2 adults and 0 children.`};
  for(const [language,rawText] of Object.entries(messages))await t.test(language+' complete joined synthetic path and safety gates',async()=>{
   const text=rawText+' Phone: +36 30 123 4567.';
   const mime={id:'fictional-'+language,threadId:'fictional-thread-'+language,internalDate:String(at),labelIds:['INBOX'],payload:{mimeType:'text/plain',body:{data:Buffer.from(text).toString('base64url')},headers:[{name:'From',value:'Synthetic Guest <'+language+'@e2e.invalid>'},{name:'Subject',value:'Synthetic E2E '+language}]}};
   const parsed=transform(mime);assert.equal(parsed.original_message,text);assert.equal(parsed.normalized.language,language);
   const envelope={sender:parsed.source.from_email,text:parsed.original_message,message_id:parsed.source.message_id,thread_id:parsed.source.thread_id,received_at:parsed.source.received_at,mailbox_id:'synthetic-e2e'};
   const created=await write.runtime.ingest(envelope,undefined,{expectedRevision:0,persistDraft:true}),id=created.record.caseId;ids.push(id);
   assert.ok(parsed.normalized.phone);assert.equal(created.record.data.state.values.phone,parsed.normalized.phone);
   assert.equal(created.record.revision,1);assert.equal(created.record.data.state.values.language,language);assert.equal(created.record.data.state.values.adults,'2');assert.equal(created.record.data.state.values.children,'0');assert.equal(created.record.data.state.values.arrival,arrival);
   assert.equal((await write.runtime.ingest(envelope,undefined,{expectedRevision:0,persistDraft:true})).record.revision,1);
   await assert.rejects(write.runtime.ingest({...envelope,text:text+' changed'},undefined,{expectedRevision:0,persistDraft:true}),e=>e.code==='CASE_CONFLICT');
   const options=serverInquiryOptions(created.record),email=buildEmailInquiryDraft(options),chat=buildChatInquiryReply(options);
   assert.deepEqual(email.decision,chat.decision);assert.equal(created.record.data.drafts[0].text,email.text);
   // Both the initial and reviewed drafts receive the stored known phone.
   assert.doesNotMatch(email.text,/phone number|telefonszám|Telefonnummer|telefonsko številko/iu);
   // Presentation mismatch is explicitly recorded, never silently called exact
   // whole-response parity: the email contains a letter plus the chat status.
   assert.ok(email.text.endsWith(chat.text));assert.notEqual(email.text,chat.text);
   providerCalls.length=0;const reviewed=await write.runtime.reviewAndDraft(id,1);
   assert.equal(reviewed.review.status,'internal_review_required');assert.equal(reviewed.review.quote.total,200);assert.equal(reviewed.review.evidence.availableUnits,1);assert.deepEqual(providerCalls,['capacity','price']);
   assert.equal(reviewed.record.data.state.values.phone,parsed.normalized.phone);
   assert.doesNotMatch(reviewed.record.data.drafts.at(-1).text,/phone number|telefonszám|Telefonnummer|telefonsko številko/iu);
   assert.equal(reviewed.record.revision,2);const preview=await readOnly.runtime.previewDraft(id,2);
   assert.equal(preview.persisted,false);assert.equal(preview.storedDraft.text,reviewed.record.data.drafts.at(-1).text);
   assert.ok((await readOnly.service.listCases({tenantId:'sarberki-test'})).some(row=>row.caseId===id));
   const hash=createHash('sha256').update(preview.storedDraft.text).digest('hex');
   await assert.rejects(readOnly.runtime.editDraft(id,2,'forbidden'),e=>e.code==='FORBIDDEN');
   await assert.rejects(readOnly.runtime.approve(id,2,hash),e=>e.code==='FORBIDDEN');
   await assert.rejects(write.runtime.approve(id,2,hash),e=>e.code==='FORBIDDEN');
   await assert.rejects(approve.runtime.reviewAndDraft(id,2),e=>e.code==='FORBIDDEN');
   await assert.rejects(approve.runtime.approve(id,1,hash),e=>e.code==='CASE_CONFLICT');
   for(const unknown of ['capacity_unknown','price_unknown']){
    mode=unknown;await assert.rejects(approve.runtime.approve(id,2,hash),e=>e.code==='REVIEW_NOT_READY');
    assert.equal((await readOnly.service.getCase({tenantId:'sarberki-test',caseId:id})).revision,2);
    assert.equal((await db.query("select count(*)::int n from sc_audit where case_id=$1 and kind='approve_isolated_synthetic'",[id])).rows[0].n,0);
   }mode='available';
   const approved=await approve.runtime.approve(id,2,hash);assert.equal(approved.revision,3);assert.equal(approved.data.state.approval,'internally_approved');assert.equal(approved.data.serverApproval.actor,approver);assert.equal(approved.data.serverApproval.draftHash,hash);
   await assert.rejects(approve.runtime.approve(id,2,hash),e=>e.code==='CASE_CONFLICT');
   const audits=(await asActor(reader,()=>db.query("select * from sc_audit where case_id=$1 and kind='approve_isolated_synthetic'",[id]))).rows;
   assert.equal(audits.length,1);assert.equal(audits[0].actor,approver);assert.equal(audits[0].revision,3);
   assert.equal(audits[0].data_hash,(await db.query("select encode(sha256(convert_to(data::text,'UTF8')),'hex') h from sc_cases where case_id=$1",[id])).rows[0].h);
  });
  await t.test('invalid sender and incomplete inquiry cannot create an approved case',async()=>{
   const envelope={sender:'not-synthetic@example.com',text:'Deluxe',message_id:'invalid',mailbox_id:'synthetic-e2e',received_at:new Date().toISOString()};
   await assert.rejects(write.runtime.ingest(envelope,undefined,{expectedRevision:0,persistDraft:true}),e=>e.code==='INVALID_INPUT');
   const incomplete=await write.runtime.ingest({...envelope,sender:'incomplete@e2e.invalid',message_id:'incomplete'},undefined,{expectedRevision:0,persistDraft:true});
   providerCalls.length=0;const reviewed=await write.runtime.reviewAndDraft(incomplete.record.caseId,1);
   assert.equal(reviewed.review.status,'missing_data');assert.deepEqual(providerCalls,[]);
   await assert.rejects(approve.runtime.approve(incomplete.record.caseId,2,createHash('sha256').update(reviewed.record.data.drafts.at(-1).text).digest('hex')),e=>e.code==='INVALID_DRAFT');
  });
  await t.test('follow-up without phone retains previously stored normalized phone',async()=>{
   const envelope={sender:'followup@e2e.invalid',text:'Phone: +36 30 123 4567.',message_id:'phone-first',thread_id:'phone-followup-thread',mailbox_id:'synthetic-e2e',received_at:new Date().toISOString()};
   const first=await write.runtime.ingest(envelope,undefined,{expectedRevision:0});
   assert.ok(first.record.data.state.values.phone);
   const next=await write.runtime.ingest({...envelope,message_id:'phone-second',text:'OK.'},undefined,{expectedRevision:1});
   assert.equal(next.record.caseId,first.record.caseId);assert.equal(next.record.revision,2);
   assert.equal(next.record.data.state.values.phone,first.record.data.state.values.phone);
  });
  await t.test('fresh PostgreSQL instance preserves four approvals and Reader-protected audit',async()=>{
   const snapshot=await db.dumpDataDir();await db.close();db=new PGlite({loadDataDir:snapshot});
   for(const id of ids){const row=await readOnly.service.getCase({tenantId:'sarberki-test',caseId:id});assert.equal(row.revision,3);assert.equal(row.data.state.approval,'internally_approved');}
   const rows=(await asActor(reader,()=>db.query("select * from sc_audit where kind='approve_isolated_synthetic'"))).rows;assert.equal(rows.length,4);
   assert.equal((await asActor(reader,()=>db.query("select * from sc_cases where tenant_id='demo-test'"))).rows.length,0);
  });
 }finally{await db.close();}
});
