import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {initClarificationPanel} from '../clarification-panel.mjs';
import {CLARIFICATION_TEXT,CLARIFICATION_TEMPLATE,clarificationHash,assertClarificationScope,assertClarificationDraft} from '../shared-core/server-clarification-review.mjs';
const caseId='13c8ecb7-f836-4e2c-9833-d58ee96f2dda';
const record=()=>({tenantId:'sarberki-test',caseId,revision:3,data:{id:caseId,tenantId:'sarberki-test',sender:'fictional@example.test',messages:[{text:'Hello, we are 8 adults.',received_at:'2026-10-26T12:00:00Z'}],state:{approval:'pending',revision:1,values:{language:'en'}},drafts:[{text:CLARIFICATION_TEXT,revision:1,basedOnMessageCount:1,reviewStatus:'clarification_review_required',clarification:{templateId:CLARIFICATION_TEMPLATE,factsRevision:1,preparedBy:'writer'}}]},updatedBy:'writer'});
function setup(overrides={}){
 const nodes=new Map(),listeners=new Map(),calls=[];
 const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,disabled:false,textContent:'',events:{},addEventListener(e,f){(this.events[e]??=[]).push(f);}});return nodes.get(id);};
 const fire=async(id,event='click')=>{for(const fn of get(id).events[event]||[])await fn();};
 const dispatchEvent=e=>{for(const fn of listeners.get(e.type)||[])fn(e);};
 const documentRef={getElementById:get,addEventListener(e,f){if(!listeners.has(e))listeners.set(e,[]);listeners.get(e).push(f);},dispatchEvent};
 get('isolated_approval_case_id').value=caseId;
 const client={get:async()=>record(),prepare:async()=>({...record(),revision:4}),approve:async(id,revision,hash)=>({...record(),revision:revision+1,data:{...record().data,clarificationApproval:{scope:'clarification-only-v1',reviewedRevision:revision,draftHash:hash}}}),...overrides};
 for(const key of ['get','prepare','approve']){const fn=client[key];client[key]=async(...args)=>{calls.push([key,...args]);return fn(...args);};}
 initClarificationPanel({documentRef,client,cryptoProvider:webcrypto});
 return {get,fire,calls,dispatch:event=>dispatchEvent(new Event(event))};
}
test('separate clarification load/confirm/approve binds stored revision and exact hash, never accommodation approval',async()=>{
 const s=setup();await s.fire('clarification_load');assert.equal(s.get('clarification_text').value,CLARIFICATION_TEXT);assert.equal(s.get('clarification_text').readOnly,true);
 assert.equal(s.get('clarification_approve').disabled,true);s.get('clarification_confirm').checked=true;await s.fire('clarification_confirm','change');
 await s.fire('clarification_approve');assert.deepEqual(s.calls[1],['approve',caseId,3,clarificationHash(CLARIFICATION_TEXT)]);
 assert.match(s.get('clarification_status').textContent,/szállásajánlat pending/);assert.equal(s.get('clarification_approve').disabled,true);
 await s.fire('clarification_approve');assert.equal(s.calls.length,2);
});
test('Writer preparation is a distinct CAS operation with no approval',async()=>{
 const s=setup();await s.fire('clarification_prepare');assert.deepEqual(s.calls,[['get',caseId],['prepare',caseId,3]]);assert.equal(s.get('clarification_text').value,'');assert.equal(s.get('clarification_approve').disabled,true);assert.match(s.get('clarification_status').textContent,/külön Approver/);
});
test('arbitrary claims, edited drafts and absent classification cannot load an approvable question',async()=>{
 for(const change of [r=>r.data.drafts[0].text='Price: 100 HUF',r=>r.data.drafts[0].text='Available now',r=>r.data.drafts[0].text='Booking confirmed',r=>r.data.drafts[0].edited=true,r=>delete r.data.drafts[0].clarification,r=>r.data.drafts[0].revision=2,r=>r.tenantId='demo-test']){
  const s=setup({get:async()=>{const r=record();change(r);return r;}});await s.fire('clarification_load');assert.equal(s.get('clarification_text').value,'');assert.equal(s.get('clarification_approve').disabled,true);await s.fire('clarification_approve');assert.equal(s.calls.length,1);
 }
});
test('changing displayed text, selection or session cannot retain approval consent',async()=>{
 for(const mode of ['text','case','isolated-approval-session-changed','sarberki:session-changed','cloud-draft-edited']){
  const s=setup();await s.fire('clarification_load');s.get('clarification_confirm').checked=true;
  if(mode==='text')s.get('clarification_text').value+='arbitrary';else if(mode==='case'){s.get('isolated_approval_case_id').value='case-other';await s.fire('isolated_approval_case_id','input');}else s.dispatch(mode);
  await s.fire('clarification_approve');assert.equal(s.calls.length,1);
 }
});
test('denied/uncertain approval clears consent and cannot retry; existing approval loads readonly',async()=>{
 const s=setup({approve:async()=>{throw Error('FORBIDDEN');}});await s.fire('clarification_load');s.get('clarification_confirm').checked=true;await s.fire('clarification_approve');await s.fire('clarification_approve');assert.equal(s.calls.length,2);assert.equal(s.get('clarification_text').value,'');assert.match(s.get('clarification_status').textContent,/FORBIDDEN/);
 const a=setup({get:async()=>{const r=record();r.data.clarificationApproval={scope:'clarification-only-v1'};return r;}});await a.fire('clarification_load');assert.equal(a.get('clarification_approve').disabled,true);
});
test('late load cannot restore an earlier case or session; simultaneous approval clicks write once',async()=>{
 let release;const s=setup({get:()=>new Promise(r=>release=r)});const pending=s.fire('clarification_load');await Promise.resolve();s.dispatch('isolated-approval-session-changed');release(record());await pending;assert.equal(s.get('clarification_text').value,'');
 let finish;const a=setup({approve:()=>new Promise(r=>finish=r)});await a.fire('clarification_load');a.get('clarification_confirm').checked=true;const first=a.fire('clarification_approve');await a.fire('clarification_approve');assert.equal(a.calls.length,2);a.dispatch('cloud-draft-edited');finish({...record(),revision:4});await first;assert.equal(a.get('clarification_text').value,'');
});
test('server classification requires exact origin and genuinely missing phone; closed template equality is complete',()=>{
 const receipt={caseId,matchesRecord:r=>r.caseId===caseId&&r.data.messages.length===1},r=record();assert.doesNotThrow(()=>assertClarificationDraft(r,receipt));
 for(const change of [r=>r.caseId='other-case',r=>r.data.id='other-case',r=>r.data.state.values.phone='+36 00 000 0000',r=>r.data.messages[0].text+=' Phone: +36 20 123 4567',r=>r.data.state.values.language='hu',r=>r.data.drafts[0].text+=' Price 100 HUF',r=>r.data.drafts[0].clarification.factsRevision=2]){
  const changed=structuredClone(r);change(changed);assert.throws(()=>assertClarificationDraft(changed,receipt));
 }
 assert.throws(()=>assertClarificationScope(r,null));assert.throws(()=>assertClarificationScope(r,{caseId,matchesRecord:()=>false}));
 const html=readFileSync(new URL('../cloud-approval.html',import.meta.url),'utf8');assert.match(html,/id="clarification_text" readonly/);assert.match(html,/Csak a pontosító válasz belső jóváhagyása/);
});
