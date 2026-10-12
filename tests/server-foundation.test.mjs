import test from 'node:test';import assert from 'node:assert/strict';
import {createServerCaseService} from '../shared-core/server-case-service.mjs';
import {createSupabaseAuthority,createSupabaseCaseRepository,createSupabaseTransport} from '../shared-core/supabase-case-repository.mjs';
import {createServerBookingRuntime} from '../shared-core/server-booking-runtime.mjs';
import {createCaseHandler} from '../netlify/functions/booking-cases.mjs';
import {createCaseStoreClient} from '../shared-core/case-store-client.mjs';
import {exportCaseSnapshot,previewCaseSnapshot} from '../shared-core/case-migration-preview.mjs';
const envelope=(message_id='m1',extras={})=>({sender:'guest@example.invalid',text:'Foglalást kérek',mailbox_id:'test-inbox',message_id,thread_id:'t1',received_at:'2026-10-09T08:00:00Z',...extras});
const values={arrival:'2026-11-01',departure:'2026-11-03',adults:'2',children:'0',guests:'2',unit:'Deluxe'};
function fixture(){
 const rows=new Map();const repository={
  get:async(t,c)=>structuredClone(rows.get(t+':'+c)||null),list:async t=>structuredClone([...rows.values()].filter(r=>r.tenantId===t)),
  insert:async(t,c,r)=>{if(rows.has(t+':'+c))return false;rows.set(t+':'+c,structuredClone(r));return true;},
  compareAndSwap:async(t,c,v,r)=>{if(rows.get(t+':'+c)?.revision!==v)return false;rows.set(t+':'+c,structuredClone(r));return true;}
 };
 const service=createServerCaseService({repository,resolveAuthority:async ctx=>ctx});
 const auth={subject:'operator-one',tenants:{'sarberki-test':['read','write']}};
 let i=0;
 const runtime=createServerBookingRuntime({service,tenantId:'sarberki-test',requestContext:auth,id:()=>`case-${++i}000`});
 return {service,auth,repository,rows,runtime};
}
test('existing engine persists synthetic case and mailbox-scoped duplicate without extra revision',async()=>{
 const {runtime,rows}=fixture();const first=await runtime.ingest(envelope(),values,{expectedRevision:0});
 const duplicate=await runtime.ingest(envelope(),values,{expectedRevision:0});
 assert.equal(duplicate.resolution.status,'duplicate');assert.equal(rows.size,1);assert.equal(duplicate.record.revision,1);
 assert.equal(first.record.data.messages[0].message_id,'m1');
});
test('duplicate synthetic provider ID never returns an unrelated sender or modified message',async()=>{
 const f=fixture(),original=envelope('same-mail-id',{text:'Please book a Deluxe cabin for two adults.'});
 const first=await f.runtime.ingest(original,undefined,{expectedRevision:0,persistDraft:true});
 const savedVersion=structuredClone(first.record);
 for(const conflict of [
  {...original,sender:'different@example.invalid'},
  {...original,text:'Please book a VIP cabin for eight adults.'}
 ]){
  await assert.rejects(f.runtime.ingest(conflict,undefined,{expectedRevision:0,persistDraft:true}),
   e=>e.code==='CASE_CONFLICT');
 }
 const stored=await f.service.getCase({requestContext:f.auth,tenantId:'sarberki-test',caseId:first.record.caseId});
 assert.deepEqual(stored,savedVersion);
 assert.equal(f.rows.size,1);
 const duplicate=await f.runtime.ingest({...original,sender:'GUEST@EXAMPLE.INVALID'},undefined,{expectedRevision:0,persistDraft:true});
 assert.equal(duplicate.resolution.status,'duplicate');
 assert.equal(duplicate.record.revision,first.record.revision);
 assert.equal(duplicate.record.data.drafts.length,1);
});
test('two operators observe shared state and competing writes cannot lose data',async()=>{
 const {runtime,service,auth}=fixture();const first=await runtime.ingest(envelope(),values,{expectedRevision:0});
 const secondCtx={...auth,subject:'operator-two'};
 assert.equal((await service.getCase({requestContext:secondCtx,tenantId:'sarberki-test',caseId:first.record.caseId})).revision,1);
 const runtime2=createServerBookingRuntime({service,tenantId:'sarberki-test',requestContext:secondCtx});
 const results=await Promise.allSettled([runtime.ingest(envelope('m2'),{adults:'3',guests:'3'},{expectedRevision:1}),runtime2.ingest(envelope('m3'),{adults:'4',guests:'4'},{expectedRevision:1})]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.find(x=>x.status==='rejected').reason.code,'CASE_CONFLICT');
 const current=await service.getCase({requestContext:secondCtx,tenantId:'sarberki-test',caseId:first.record.caseId});assert.equal(current.revision,2);assert.equal(current.data.messages.length,2);
});
test('same sender without reference does not automatically join a case',async()=>{
 const {runtime,rows}=fixture();await runtime.ingest(envelope(),values,{expectedRevision:0});
 const next=await runtime.ingest(envelope('m2',{thread_id:'different'}),values,{expectedRevision:0});
 assert.equal(next.resolution.status,'ambiguous');assert.equal(rows.size,2);
});
test('older message remains in history without overwriting newer facts',async()=>{
 const {runtime}=fixture();await runtime.ingest(envelope(),values,{expectedRevision:0});
 const next=await runtime.ingest(envelope('m-old',{received_at:'2026-10-08T08:00:00Z'}),{guests:'9'},{expectedRevision:1});
 assert.equal(next.resolution.status,'historical');assert.equal(next.record.data.state.values.guests,'2');assert.equal(next.record.data.messages.at(-1).historical,true);
});
test('existing engine invalidates quote and capacity after changed stay',async()=>{
 const {runtime,rows}=fixture();const first=await runtime.ingest(envelope(),values,{expectedRevision:0});
 const data=rows.get('sarberki-test:'+first.record.caseId).data;data.state.quote={total:100,approved:true};data.state.availability={verified:true};
 const next=await runtime.ingest(envelope('m2'),{arrival:'2026-11-04',departure:'2026-11-06'},{expectedRevision:1});
 assert.equal(next.record.data.state.quote,null);assert.equal(next.record.data.state.availability,null);
});
test('same provider message ID in another mailbox is not treated as duplicate',async()=>{
 const {runtime}=fixture();await runtime.ingest(envelope(),values,{expectedRevision:0});
 const next=await runtime.ingest(envelope('m1',{mailbox_id:'other-inbox'}),{guests:'3'},{expectedRevision:0});assert.equal(next.record.data.messages.length,1);assert.equal(next.resolution.status,'ambiguous');
});
for(const bad of [null,{...envelope(),sender:'real@example.com'},{...envelope(),mailbox_id:''},{...envelope(),received_at:'unknown'},{...envelope(),role:'admin'}])test('rejects invalid or non-synthetic input '+JSON.stringify(bad),async()=>{
 const {runtime,rows}=fixture();await assert.rejects(runtime.ingest(bad,values,{expectedRevision:0}));assert.equal(rows.size,0);
});
test('server authority uses remote identity and DB membership, ignores caller claims',async()=>{
 const paths=[];const resolve=createSupabaseAuthority(async p=>{paths.push(p);return p.startsWith('/auth/')?{id:'verified-user'}:[{tenant_id:'sarberki-test',user_id:'verified-user',can_read:true,can_write:false}];});
 assert.deepEqual((await resolve({role:'admin',userId:'attacker'})).tenants['sarberki-test'],['read']);assert.equal(paths.length,2);
});
test('authority fails closed on another user membership or anonymous Auth',async()=>{
 await assert.rejects(createSupabaseAuthority(async p=>p.startsWith('/auth/')?{id:'user'}:[{tenant_id:'sarberki-test',user_id:'other'}])());
 await assert.rejects(createSupabaseAuthority(async()=>({id:'user',is_anonymous:true}))());
});
test('transport refuses untrusted hosts and handles expired session/DB failure',async()=>{
 assert.throws(()=>createSupabaseTransport({url:'https://attacker.invalid',publishableKey:'public',token:'token'}));
 const make=fetchImpl=>createSupabaseTransport({url:'https://synthetic.supabase.co',publishableKey:'public',token:'token',fetchImpl});
 await assert.rejects(make(async()=>({ok:false,status:401}))('/auth/v1/user'),e=>e.code==='FORBIDDEN');
 await assert.rejects(make(async()=>{throw Error('secret details');})('/rest/v1/sc_cases'),e=>e.code==='STORAGE_FAILURE'&&!e.message.includes('secret'));
});
test('repository rejects malformed RPC/read responses',async()=>{
 const r=createSupabaseCaseRepository(async()=>({ok:true}));await assert.rejects(r.list('sarberki-test'));await assert.rejects(r.insert('sarberki-test','case-1234',{data:{}}));
 const bad=createSupabaseCaseRepository(async()=>[{revision:1}]);await assert.rejects(bad.get('sarberki-test','case-1234'));
});
test('API disabled by default and production host denied without network',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;};
 assert.equal((await createCaseHandler({env:{},fetchImpl})({httpMethod:'GET'})).statusCode,503);
 assert.equal((await createCaseHandler({env:{CASE_STORE_ENABLED:'synthetic-only',URL:'https://production.invalid',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test'},fetchImpl})({httpMethod:'GET'})).statusCode,503);assert.equal(calls,0);
});
const env={CASE_STORE_ENABLED:'synthetic-only',URL:'https://leafy-chimera-2403e5.netlify.app',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public'};
test('API rejects anonymous and unapproved tenant before database access',async()=>{
 let calls=0;const handler=createCaseHandler({env,fetchImpl:async()=>{calls++;}});
 assert.equal((await handler({httpMethod:'GET'})).statusCode,401);
 assert.equal((await handler({httpMethod:'GET',headers:{authorization:'Bearer '+'x'.repeat(40)},queryStringParameters:{tenantId:'production'}})).statusCode,403);assert.equal(calls,0);
});
test('expired session cannot access cases; API does not leak upstream secrets',async()=>{
 const handler=createCaseHandler({env,fetchImpl:async()=>({ok:false,status:401})});
 const result=await handler({httpMethod:'GET',headers:{authorization:'Bearer '+'x'.repeat(40)},queryStringParameters:{tenantId:'sarberki-test'}});assert.equal(result.statusCode,403);
 const broken=createCaseHandler({env,fetchImpl:async()=>{throw Error('database secret');}});
 const failure=await broken({httpMethod:'GET',headers:{authorization:'Bearer '+'x'.repeat(40)},queryStringParameters:{tenantId:'sarberki-test'}});assert.equal(failure.statusCode,503);assert.ok(!failure.body.includes('secret'));
});
test('migration is a local preview with duplicate/tenant validation and no implicit upload',async()=>{
 const {runtime}=fixture();const {record}=await runtime.ingest(envelope(),values,{expectedRevision:0});
 const snapshot=exportCaseSnapshot([record.data],'sarberki-test');const preview=previewCaseSnapshot(snapshot,'sarberki-test',[record.caseId]);assert.equal(preview.uploadAllowed,false);assert.equal(preview.rows[0].duplicate,true);
 assert.throws(()=>previewCaseSnapshot(snapshot,'demo-test'));assert.throws(()=>previewCaseSnapshot({...snapshot,cases:[record.data,record.data]},'sarberki-test'));assert.equal(record.data.messages.length,1);
});
test('synthetic-only ingest-and-draft persists message, facts and pending draft in one insertion',async()=>{
 const f=fixture();
 const first=await f.runtime.ingest(envelope('new-synthetic',{text:'Deluxe cabin for 2 adults between 2026-11-01 and 2026-11-03.'}),undefined,{expectedRevision:0,persistDraft:true});
 assert.equal(first.record.revision,1);
 assert.equal(first.record.data.messages.length,1);
 assert.equal(first.record.data.drafts.length,1);
 assert.equal(first.record.data.drafts[0].revision,first.record.data.state.revision);
 assert.equal(first.record.data.drafts[0].basedOnMessageCount,1);
 assert.equal(first.record.data.drafts[0].synthetic,true);
 assert.equal(first.record.data.drafts[0].reviewStatus,'manual_review_required');
 assert.ok(first.record.data.drafts[0].text.length>20);
 assert.equal(first.record.data.state.approval,'pending');
 assert.equal(first.record.data.state.quote,null);
 assert.equal(first.record.data.state.availability,null);
 const persisted=await f.service.getCase({requestContext:f.auth,tenantId:'sarberki-test',caseId:first.record.caseId});
 assert.deepEqual(persisted,first.record);
 assert.equal(f.rows.size,1);
 const again=await f.runtime.ingest(envelope('new-synthetic',{text:'Deluxe cabin for 2 adults between 2026-11-01 and 2026-11-03.'}),undefined,{expectedRevision:0,persistDraft:true});
 assert.equal(again.resolution.status,'duplicate');
 assert.equal(again.record.revision,1);
 assert.deepEqual(again.record.data.drafts,first.record.data.drafts);
 assert.equal(f.rows.size,1);
});
test('synthetic follow-up updates shared case and draft in a single CAS, without stale prices',async()=>{
 const f=fixture();
 const first=await f.runtime.ingest(envelope('first',{text:'Please book one Deluxe cabin from 2026-11-01 to 2026-11-03 for 2 adults and no children.'}),
  {arrival:'1999-01-01',adults:'999',unit:'VIP'},{expectedRevision:0,persistDraft:true});
 assert.equal(first.record.data.state.values.arrival,'2026-11-01');
 assert.equal(first.record.data.state.values.adults,'2');
 assert.equal(first.record.data.state.values.unit,'Deluxe');
 const second=await f.runtime.ingest(envelope('followup',{text:'Please book one Deluxe cabin from 2026-11-04 to 2026-11-06 for 2 adults and no children.'}),
   {arrival:'2030-12-31',departure:'2031-01-01'},{expectedRevision:1,persistDraft:true});
 assert.equal(second.resolution.status,'linked');
 assert.equal(second.record.caseId,first.record.caseId);
 assert.equal(second.record.revision,2);
 assert.equal(second.record.data.messages.length,2);
 assert.equal(second.record.data.drafts.length,2);
 assert.deepEqual(second.record.data.drafts[0],first.record.data.drafts[0]);
 assert.equal(second.record.data.drafts[1].basedOnMessageCount,2);
 assert.equal(second.record.data.drafts[1].revision,second.record.data.state.revision);
 assert.equal(second.record.data.state.values.arrival,'2026-11-04');
 assert.equal(second.record.data.state.quote,null);
 assert.equal(second.record.data.state.availability,null);
 await assert.rejects(f.runtime.ingest(envelope('race',{text:'Latest changed arrival.'}),{arrival:'2026-11-07'},
   {expectedRevision:1,persistDraft:true}),e=>e.code==='CASE_CONFLICT');
 assert.equal((await f.service.getCase({requestContext:f.auth,tenantId:'sarberki-test',caseId:first.record.caseId})).revision,2);
});
test('atomic synthetic mail ignores forged browser facts, even with an apparently valid sender',async()=>{
 const f=fixture();
 const message=envelope('spoofed-facts',{text:'Please book one Deluxe cabin from 2026-11-01 to 2026-11-03 for 2 adults and no children.'});
 const callerFacts={arrival:'2038-01-01',departure:'2038-01-08',adults:'100',children:'20',guests:'120',unit:'VIP',language:'de',phone:'ATTACKER'};
 const result=await f.runtime.ingest(message,callerFacts,{expectedRevision:0,persistDraft:true});
 const stored=result.record.data.state.values;
 assert.equal(stored.arrival,'2026-11-01');
 assert.equal(stored.departure,'2026-11-03');
 assert.equal(stored.adults,'2');
 assert.equal(stored.children,'0');
 assert.equal(stored.guests,'2');
 assert.equal(stored.unit,'Deluxe');
 assert.equal(stored.language,'en');
 assert.ok(!stored.phone,'A böngészőből hamisított telefonszám nem kerülhet az ügyadatok közé.');
 assert.equal(result.record.data.state.quote,null);
 assert.equal(result.record.data.state.availability,null);
 assert.equal(result.record.data.state.approval,'pending');
});
test('synthetic ingest-and-draft rejects real sender, forced link, other tenant, and read-only caller',async()=>{
 const f=fixture();
 const badReal={...envelope('real'),sender:'visitor@example.com'};
 await assert.rejects(f.runtime.ingest(badReal,values,{expectedRevision:0,persistDraft:true}),e=>e.code==='INVALID_INPUT');
 await assert.rejects(f.runtime.ingest({...envelope('forced'),case_id:'case-9000'},values,{expectedRevision:0,persistDraft:true}),e=>e.code==='FORBIDDEN');
 await assert.rejects(f.runtime.ingest(envelope('manual'),values,{expectedRevision:0,persistDraft:true,approvedCaseId:'case-9000'}),e=>e.code==='FORBIDDEN');
 const other=createServerBookingRuntime({service:f.service,tenantId:'demo-test',requestContext:{subject:'writer',tenants:{'demo-test':['read','write']}}});
 await assert.rejects(other.ingest(envelope('other'),values,{expectedRevision:0,persistDraft:true}),e=>e.code==='FORBIDDEN');
 const readonly=createServerBookingRuntime({service:f.service,tenantId:'sarberki-test',requestContext:{subject:'reader',tenants:{'sarberki-test':['read']}}});
 await assert.rejects(readonly.ingest(envelope('reader'),values,{expectedRevision:0,persistDraft:true}),e=>e.code==='FORBIDDEN');
 assert.equal(f.rows.size,0);
});
test('opt-in synthetic client calls only protected case POST and overwrites attacker-supplied action',async()=>{
 const calls=[];
 const client=createCaseStoreClient({getAccessToken:async()=> 'synthetic-test-session-token',request:async(url,options)=>{
  calls.push({url,options});
  return {ok:true,json:async()=>({result:{resolution:{status:'new'},record:{caseId:'case-1000',revision:1}}})};
 }});
 const result=await client.ingestAndDraft({action:'approve',tenantId:'sarberki-test',envelope:envelope('client-fixture'),expectedRevision:0});
 assert.equal(result.record.revision,1);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'/.netlify/functions/booking-cases');
 assert.equal(calls[0].options.method,'POST');
 assert.equal(calls[0].options.headers.Authorization,'Bearer synthetic-test-session-token');
 const body=JSON.parse(calls[0].options.body);
 assert.equal(body.action,'ingest-and-draft');
 assert.equal(body.envelope.sender,'guest@example.invalid');
 assert.equal(body.expectedRevision,0);
 assert.ok(!('approvedCaseId' in body));
});
test('default-disabled API refuses synthetic ingest-and-draft before reading or writing',async()=>{
 let requests=0;
 const handler=createCaseHandler({env:{},fetchImpl:async()=>{requests++;throw Error('External request forbidden');}});
 const response=await handler({httpMethod:'POST',headers:{authorization:'Bearer '+'x'.repeat(40)},body:JSON.stringify({
  action:'ingest-and-draft',tenantId:'sarberki-test',envelope:envelope('api-synthetic'),expectedRevision:0
 })});
 assert.equal(response.statusCode,503);
 assert.match(response.body,/CASE_STORE_DISABLED/u);
 assert.equal(requests,0);
});
test('server draft is versioned, internal and carries no invented price/capacity',async()=>{
 const {runtime}=fixture();const first=await runtime.ingest(envelope(),values,{expectedRevision:0});
 const draft=await runtime.draft(first.record.caseId,1);assert.equal(draft.revision,2);assert.equal(draft.data.drafts.length,1);assert.equal(draft.data.state.quote,null);assert.equal(draft.data.state.availability,null);assert.equal(draft.data.state.approval,'pending');assert.ok(draft.data.drafts[0].text.length>20);
 await assert.rejects(runtime.draft(first.record.caseId,1),e=>e.code==='CASE_CONFLICT');
});
test('synthetic email draft edits append immutable pending revisions without implying approval',async()=>{
 const f=fixture(),first=await f.runtime.ingest(envelope(),values,{expectedRevision:0});
 const created=await f.runtime.draft(first.record.caseId,1),original=created.data.drafts[0].text;
 const edited=await f.runtime.editDraft(first.record.caseId,2,'Kezelő által szerkesztett TESZT válasz – nincs elküldve.');
 assert.equal(edited.revision,3);
 assert.equal(edited.data.drafts.length,2);
 assert.equal(edited.data.drafts[0].text,original);
 assert.equal(edited.data.drafts[1].text,'Kezelő által szerkesztett TESZT válasz – nincs elküldve.');
 assert.equal(edited.data.drafts[1].edited,true);
 assert.equal(edited.data.drafts[1].reviewStatus,'manual_edit_requires_review');
 assert.equal(edited.data.drafts[1].synthetic,undefined);
 assert.equal(edited.data.state.approval,'pending');
 assert.equal(edited.data.state.quote,null);
 assert.equal(edited.data.state.availability,null);
 assert.equal(edited.data.messages.length,1);
 const persisted=await f.service.getCase({requestContext:f.auth,tenantId:'sarberki-test',caseId:first.record.caseId});
 assert.deepEqual(persisted,edited);
 await assert.rejects(f.runtime.editDraft(first.record.caseId,2,'Elavult szerkesztés'),e=>e.code==='CASE_CONFLICT');
 await assert.rejects(f.runtime.editDraft(first.record.caseId,3,edited.data.drafts.at(-1).text),e=>e.code==='INVALID_DRAFT');
});
test('synthetic edit blocks empty, huge, untrusted roles and stale facts or messages',async()=>{
 const f=fixture(),first=await f.runtime.ingest(envelope(),values,{expectedRevision:0});
 await f.runtime.draft(first.record.caseId,1);
 const caseId=first.record.caseId;
 for(const value of ['', '   ',null,42,'x'.repeat(20001)]){
  await assert.rejects(f.runtime.editDraft(caseId,2,value),e=>e.code==='INVALID_DRAFT');
 }
 const reader=createServerBookingRuntime({service:f.service,tenantId:'sarberki-test',requestContext:{subject:'reader',tenants:{'sarberki-test':['read']}}});
 await assert.rejects(reader.editDraft(caseId,2,'Reader edits'),e=>e.code==='FORBIDDEN');
 const other=createServerBookingRuntime({service:f.service,tenantId:'demo-test',requestContext:{subject:'operator',tenants:{'demo-test':['read','write']}}});
 await assert.rejects(other.editDraft(caseId,2,'Wrong tenant'),e=>e.code==='FORBIDDEN');
 const saved=f.rows.get('sarberki-test:'+caseId);
 assert.equal(saved.data.drafts.length,1);
 saved.data.messages.push(envelope('unreviewed'));
 await assert.rejects(f.runtime.editDraft(caseId,2,'Outdated message review'),e=>e.code==='INVALID_DRAFT');
 saved.data.messages.pop();saved.data.state.revision++;
 await assert.rejects(f.runtime.editDraft(caseId,2,'Outdated facts'),e=>e.code==='INVALID_DRAFT');
 saved.data.state.revision--;saved.data.state.approval='internally_approved';
 await assert.rejects(f.runtime.editDraft(caseId,2,'Already approved'),e=>e.code==='INVALID_DRAFT');
 assert.equal(f.rows.get('sarberki-test:'+caseId).revision,2);
 assert.equal(f.rows.get('sarberki-test:'+caseId).data.drafts.length,1);
});
test('default closed server case handler rejects draft edit without network or send',async()=>{
 let network=0;
 const disabled=createCaseHandler({env:{},fetchImpl:async()=>{network++;throw Error('Unexpected external call')}});
 const result=await disabled({httpMethod:'POST',headers:{authorization:'Bearer '+'x'.repeat(40)},body:JSON.stringify({
  tenantId:'sarberki-test',action:'edit-draft',caseId:'case-1000',expectedRevision:2,editedDraftText:'Szintetikus módosítás'
 })});
 assert.equal(result.statusCode,503);assert.match(result.body,/CASE_STORE_DISABLED/u);assert.equal(network,0);
});
test('manual case linking requires separate approve permission',async()=>{
 const {runtime}=fixture();const first=await runtime.ingest(envelope(),values,{expectedRevision:0});
 await assert.rejects(runtime.ingest(envelope('m2',{thread_id:'separate'}),values,{expectedRevision:1,approvedCaseId:first.record.caseId}),e=>e.code==='FORBIDDEN');
});
test('RFC reply references cannot automatically link different mailboxes',async()=>{
 const {runtime}=fixture();
 const first=await runtime.ingest(envelope('m1',{rfc_message_id:'<original@example.invalid>'}),values,{expectedRevision:0});
 const other=await runtime.ingest(envelope('m2',{mailbox_id:'other-inbox',thread_id:'other',in_reply_to:'<original@example.invalid>',references:['<original@example.invalid>']}),values,{expectedRevision:0});
 assert.equal(other.resolution.status,'ambiguous');assert.notEqual(other.record.caseId,first.record.caseId);
 assert.deepEqual(other.record.data.messages[0].references,['<original@example.invalid>']);
 const reply=await runtime.ingest(envelope('m3',{thread_id:'new-provider-thread',in_reply_to:'<original@example.invalid>'}),{phone:'123'},{expectedRevision:1});
 assert.equal(reply.resolution.status,'linked');assert.equal(reply.record.caseId,first.record.caseId);
 assert.equal(reply.record.data.messages[0].rfc_message_id,'<original@example.invalid>');
});
test('a supplied case ID cannot bypass separate human linking permission',async()=>{
 const {runtime}=fixture();const first=await runtime.ingest(envelope(),values,{expectedRevision:0});
 await assert.rejects(runtime.ingest(envelope('m2',{case_id:first.record.caseId,mailbox_id:'other-inbox'}),values,{expectedRevision:1}),e=>e.code==='FORBIDDEN');
});
for(const key of ['sb_secret_fixture', 'x.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.x'])test('application transport refuses privileged key before network',()=>{
 assert.throws(()=>createSupabaseTransport({url:'https://synthetic.supabase.co',publishableKey:key,token:'fixture',fetchImpl:()=>assert.fail('network')}),e=>e.code==='SETUP_REQUIRED');
});
test('server synthetic review connects confirmed extraction, capacity, unit price and pending draft without persisting evidence',async()=>{
 const {service,auth}=fixture();const calls=[];const at='2026-10-10T08:00:00Z';
 const runtime=createServerBookingRuntime({service,tenantId:'sarberki-test',requestContext:auth,clock:()=>at,reviewProviders:{
  availability:async q=>{calls.push('capacity');return {...q,source:'synthetic-fixture',checkedAt:at,availability:'available',availableUnits:1};},
  pricing:async q=>{calls.push('price');return {...q,checkedAt:at,tenantId:'sarberki-test',unitId:q.cabin,capacity:4,nightly:100,basis:'per_unit',verified:true,source:'synthetic-fixture'};}
 }});
 const first=await runtime.ingest(envelope('parsed',{text:'Please book one Deluxe cabin from 2026-11-01 to 2026-11-03 for 2 adults and no children.'}),undefined,{expectedRevision:0});
 const preview=await runtime.previewReview(first.record.caseId,1);assert.deepEqual(calls,['capacity','price']);assert.equal(preview.quote.total,200);assert.equal(preview.approval,'pending');
 assert.equal((await service.getCase({requestContext:auth,tenantId:'sarberki-test',caseId:first.record.caseId})).revision,1);
 const draft=await runtime.draft(first.record.caseId,1);assert.equal(draft.data.state.approval,'pending');assert.equal(draft.data.state.quote,null);assert.equal(draft.data.drafts.length,1);
 await assert.rejects(runtime.previewReview(first.record.caseId,1),e=>e.code==='CASE_CONFLICT');
});
function reviewFixture(f,overrides={}){const at='2026-10-10T08:00:00Z';return createServerBookingRuntime({service:f.service,tenantId:'sarberki-test',requestContext:f.auth,clock:()=>at,reviewProviders:{availability:async q=>({...q,source:'synthetic-fixture',checkedAt:at,availability:'available',availableUnits:1}),pricing:async q=>({...q,checkedAt:at,tenantId:'sarberki-test',unitId:q.cabin,capacity:4,nightly:100,basis:'per_unit',verified:true,source:'synthetic-fixture'})},...overrides});}
test('review and pending draft persist together with append-only versions and no approved evidence',async()=>{const f=fixture(),first=await f.runtime.ingest(envelope(),values,{expectedRevision:0}),r=reviewFixture(f);const one=await r.reviewAndDraft(first.record.caseId,1),two=await r.reviewAndDraft(first.record.caseId,2);assert.equal(one.review.quote.total,200);assert.equal(two.record.revision,3);assert.deepEqual(two.record.data.drafts[0],one.record.data.drafts[0]);assert.equal(two.record.data.drafts[1].reviewStatus,'internal_review_required');assert.equal(two.record.data.state.approval,'pending');assert.equal(two.record.data.state.quote,null);assert.equal(two.record.data.state.availability,null);assert.deepEqual(two.record.data.messages,first.record.data.messages);});
test('reader cannot trigger review providers or create a draft',async()=>{const f=fixture(),first=await f.runtime.ingest(envelope(),values,{expectedRevision:0});const r=reviewFixture(f,{requestContext:{subject:'reader',tenants:{'sarberki-test':['read']}},reviewProviders:{availability:()=>assert.fail('reader provider call'),pricing:()=>assert.fail('reader price call')}});await assert.rejects(r.reviewAndDraft(first.record.caseId,1),e=>e.code==='FORBIDDEN');assert.equal(f.rows.get('sarberki-test:'+first.record.caseId).revision,1);});
test('two concurrent reviewed drafts produce one CAS success',async()=>{const f=fixture(),first=await f.runtime.ingest(envelope(),values,{expectedRevision:0});const outcomes=await Promise.allSettled([reviewFixture(f).reviewAndDraft(first.record.caseId,1),reviewFixture(f,{requestContext:{...f.auth,subject:'operator-two'}}).reviewAndDraft(first.record.caseId,1)]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.find(r=>r.status==='rejected').reason.code,'CASE_CONFLICT');assert.equal(f.rows.get('sarberki-test:'+first.record.caseId).data.drafts.length,1);});
test('membership revoked during review prevents persistence',async()=>{const f=fixture(),first=await f.runtime.ingest(envelope(),values,{expectedRevision:0});const r=reviewFixture(f,{reviewProviders:{availability:async q=>{f.auth.tenants['sarberki-test']=['read'];return {...q,source:'synthetic-fixture',checkedAt:'2026-10-10T08:00:00Z',availability:'available',availableUnits:1};},pricing:async()=>{throw Error('offline');}}});await assert.rejects(r.reviewAndDraft(first.record.caseId,1),e=>e.code==='FORBIDDEN');assert.equal(f.rows.get('sarberki-test:'+first.record.caseId).data.drafts.length,0);});


test('read-only reply preview returns same central draft without changing revision or draft history',async()=>{
 const f=fixture();
 const first=await f.runtime.ingest(envelope('preview'),values,{expectedRevision:0});
 const reader=createServerBookingRuntime({service:f.service,tenantId:'sarberki-test',
  requestContext:{subject:'read-only',tenants:{'sarberki-test':['read']}}});
 const preview=await reader.previewDraft(first.record.caseId,1);
 assert.equal(preview.caseId,first.record.caseId);
 assert.equal(preview.revision,1);
 assert.equal(preview.persisted,false);
 assert.equal(preview.approval,'pending');
 assert.ok(preview.text.length>20);
 const unchanged=await f.service.getCase({requestContext:f.auth,tenantId:'sarberki-test',caseId:first.record.caseId});
 assert.equal(unchanged.revision,1);
 assert.equal(unchanged.data.drafts.length,0);
 const saved=await f.runtime.draft(first.record.caseId,1);
 assert.equal(saved.revision,2);
 assert.equal(saved.data.drafts[0].text,preview.text);
 await assert.rejects(reader.draft(first.record.caseId,2),e=>e.code==='FORBIDDEN');
 await assert.rejects(reader.previewDraft(first.record.caseId,1),e=>e.code==='CASE_CONFLICT');
});
test('draft preview never borrows Sárberki reply rules for a second tenant',async()=>{
 const f=fixture();const first=await f.runtime.ingest(envelope('preview2'),values,{expectedRevision:0});
 const foreign=createServerBookingRuntime({service:f.service,tenantId:'demo-test',
  requestContext:{subject:'demo-reader',tenants:{'demo-test':['read']}}});
 await assert.rejects(foreign.previewDraft(first.record.caseId,1),e=>e.code==='FORBIDDEN');
});
test('preview API remains disabled by default and rejects unapproved tenants without any requests',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error('no network');};
 const disabled=createCaseHandler({env:{},fetchImpl});
 assert.equal((await disabled({httpMethod:'GET',queryStringParameters:{tenantId:'sarberki-test',caseId:'case-1234',expectedRevision:'1',action:'preview-draft'}})).statusCode,503);
 const guarded=createCaseHandler({env,fetchImpl});
 const unauthorized=await guarded({httpMethod:'GET',queryStringParameters:{tenantId:'sarberki-test',caseId:'case-1234',expectedRevision:'1',action:'preview-draft'}});
 assert.equal(unauthorized.statusCode,401);
 const other=await guarded({httpMethod:'GET',headers:{authorization:'Bearer '+'x'.repeat(40)},queryStringParameters:{tenantId:'production',action:'preview-draft'}});
 assert.equal(other.statusCode,403);assert.equal(calls,0);
});
