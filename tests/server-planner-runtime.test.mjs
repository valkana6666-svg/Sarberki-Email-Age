import test from 'node:test';import assert from 'node:assert/strict';
import {createServerBookingRuntime} from '../shared-core/server-booking-runtime.mjs';
import {createServerCaseService} from '../shared-core/server-case-service.mjs';
import {extractServerMessage} from '../shared-core/server-message-extraction.mjs';
import {serverInquiryOptions} from '../shared-core/server-inquiry-options.mjs';
const clock=()=> '2026-10-11T12:00:00Z';
const envelope=(id,text)=>({sender:'guest@synthetic.invalid',mailbox_id:'gmail-synthetic',message_id:id,thread_id:'thread-one',received_at:clock(),text});
function fixture(){
 const rows=new Map(),repository={get:async(t,id)=>structuredClone(rows.get(t+':'+id)||null),list:async t=>structuredClone([...rows.values()].filter(r=>r.tenantId===t)),insert:async(t,id,r)=>{rows.set(t+':'+id,structuredClone(r));return true;},compareAndSwap:async(t,id,rev,r)=>{if(rows.get(t+':'+id)?.revision!==rev)return false;rows.set(t+':'+id,structuredClone(r));return true;}};
 const identity={subject:'operator',tenants:{'sarberki-test':['read','write','approve']}};
 const service=createServerCaseService({repository,resolveAuthority:async()=>identity,clock});
 const runtime=createServerBookingRuntime({service,tenantId:'sarberki-test',clock,id:()=> 'case-planner',isolatedApproval:true,reviewProviders:{availability:()=>assert.fail('unexpected provider'),pricing:()=>assert.fail('unexpected price')}});
 return {rows,identity,service,runtime};
}
test('Gmail thread follow-up keeps stay and ages; preview uses common decision and Hungarian operator text',async()=>{
 const f=fixture();const first=await f.runtime.ingest(envelope('first','Please book one Deluxe cabin from 2026-11-01 to 2026-11-03 for 2 adults and 2 children.'),undefined,{expectedRevision:0});
 const follow=await f.runtime.ingest(envelope('second','The children are 7 and 10 years old.'),undefined,{expectedRevision:1});
 assert.equal(follow.record.caseId,first.record.caseId);assert.equal(f.rows.size,1);
 const p=await f.runtime.previewDraft(first.record.caseId,2);
 assert.equal(p.decision.facts.dates.arrival,'2026-11-01');assert.deepEqual(p.decision.facts.child_ages,[7,10]);assert.equal(p.decision.facts.guests,4);
 assert.equal(p.decision.capacity.status,'UNKNOWN');assert.equal(p.persisted,false);assert.match(p.operatorReviewText,/Kedves|Köszönjük/);
 assert.equal(follow.record.data.drafts.length,0);
 assert.deepEqual(p.reviewState,{caseRevision:2,factsRevision:follow.record.data.state.revision,
  latestDraftRevision:null,latestDraftMessageCount:null,messageCount:2,storedApproval:'pending',auditStatus:'not_verified'});
});
test('split requests keep explicit placement constraints in persisted server facts',()=>{
 const v=extractServerMessage(envelope('split','Osztott A+C egymás mellett, 6 felnőtt és 0 gyermek 2026.11.13-15 között'));
 assert.match(v.split_request_text,/A\+C/);assert.match(v.split_request_text,/egymás mellett/);
});
test('changed state or newer message prevents approval of the older stored draft before provider calls',async()=>{
 for(const change of ['revision','message']){
 const f=fixture();await f.runtime.ingest(envelope('first','Deluxe'),{unit:'Deluxe',arrival:'2026-11-01',departure:'2026-11-03',adults:'2',children:'0',guests:'2'},{expectedRevision:0});
 const record=f.rows.get('sarberki-test:case-planner');record.data.drafts.push({text:'synthetic',synthetic:true,reviewStatus:'internal_review_required',revision:record.data.state.revision,basedOnMessageCount:record.data.messages.length});
 if(change==='revision')record.data.state.revision++;
 else record.data.messages.push(envelope('second','OK'));
 await assert.rejects(f.runtime.approve('case-planner',1,'0'.repeat(64)),e=>e.code==='INVALID_DRAFT');
 assert.equal(record.data.state.approval,'pending');assert.equal(record.revision,1);
 }
});
test('no default source or other tenant can borrow the test case or approval privileges',async()=>{
 const f=fixture();await f.runtime.ingest(envelope('first','Deluxe'),{unit:'Deluxe'},{expectedRevision:0});
 f.identity.tenants={'demo-test':['read','write','approve']};
 await assert.rejects(f.runtime.previewDraft('case-planner',1),e=>e.code==='FORBIDDEN');
 await assert.rejects(f.runtime.approve('case-planner',1,'0'.repeat(64)),e=>e.code==='FORBIDDEN');
 assert.equal(f.rows.get('sarberki-test:case-planner').revision,1);
});
test('persisted projection keeps case tenant, zero children and incomplete party without inventing evidence',()=>{
 const options=serverInquiryOptions({tenantId:'sarberki-test',data:{state:{values:{adults:'2',children:'0',guests:'2',unit:'Deluxe'},original:'message'}}},new Date(clock()));
 assert.equal(options.tenantId,'sarberki-test');assert.equal(options.facts.children,0);assert.equal(options.facts.dates,null);assert.equal(options.capacity,undefined);
});
