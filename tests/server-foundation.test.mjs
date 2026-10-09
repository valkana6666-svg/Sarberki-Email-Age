import test from 'node:test';import assert from 'node:assert/strict';
import {createServerCaseService} from '../shared-core/server-case-service.mjs';
import {createSupabaseAuthority,createSupabaseCaseRepository,createSupabaseTransport} from '../shared-core/supabase-case-repository.mjs';
import {createServerBookingRuntime} from '../shared-core/server-booking-runtime.mjs';
import {createCaseHandler} from '../netlify/functions/booking-cases.mjs';
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
test('server draft is versioned, internal and carries no invented price/capacity',async()=>{
 const {runtime}=fixture();const first=await runtime.ingest(envelope(),values,{expectedRevision:0});
 const draft=await runtime.draft(first.record.caseId,1);assert.equal(draft.revision,2);assert.equal(draft.data.drafts.length,1);assert.equal(draft.data.state.quote,null);assert.equal(draft.data.state.availability,null);assert.equal(draft.data.state.approval,'pending');assert.ok(draft.data.drafts[0].text.length>20);
 await assert.rejects(runtime.draft(first.record.caseId,1),e=>e.code==='CASE_CONFLICT');
});
test('manual case linking requires separate approve permission',async()=>{
 const {runtime}=fixture();const first=await runtime.ingest(envelope(),values,{expectedRevision:0});
 await assert.rejects(runtime.ingest(envelope('m2',{thread_id:'separate'}),values,{expectedRevision:1,approvedCaseId:first.record.caseId}),e=>e.code==='FORBIDDEN');
});
