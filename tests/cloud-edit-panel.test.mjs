import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {initIsolatedApprovalPanel} from '../isolated-approval-panel.mjs';
const text='Synthetic guest draft',hash=createHash('sha256').update(text).digest('hex');
const original=()=>({tenantId:'sarberki-test',caseId:'case-edit',canEditDraft:true,revision:2,data:{state:{approval:'pending'},drafts:[{text,synthetic:true,reviewStatus:'internal_review_required'}]}});
function setup({edit=null,get=null}={}){
 const nodes=new Map(),listeners=new Map(),calls=[];
 const documentRef={getElementById(id){if(!nodes.has(id))nodes.set(id,{value:'',checked:false,disabled:false,readOnly:false,textContent:'',events:{},addEventListener(e,fn){this.events[e]=fn;}});return nodes.get(id);},addEventListener(e,fn){listeners.set(e,fn);}};
 const node=id=>documentRef.getElementById(id),fire=(id,e='click')=>node(id).events[e]?.();
 node('isolated_approval_case_id').value='case-edit';
 initIsolatedApprovalPanel({documentRef,enabled:true,cloudSyntheticApproval:true,approvalTarget:'https://mojnqizbcaczstguikpv.supabase.co',cryptoProvider:webcrypto,
 cloudClient:{get:get||(async()=>original()),approve:async()=>{throw Error('unexpected approval');},edit:async(...args)=>{calls.push(args);if(edit)return edit(...args);return {...original(),revision:3,data:{state:{approval:'pending'},drafts:[{text:args[4],edited:true}]}};}}});
 const type=async()=>{node('cloud_edit_text').value=text+'\nHuman edit.  ';await fire('cloud_edit_text','input');};
 return {node,fire,calls,type,session:()=>listeners.get('isolated-approval-session-changed')()};
}
test('cloud edit consumes saved revision/hash, preserves exact guest text and requires a fresh independent review',async()=>{
 const s=setup();await s.fire('isolated_approval_load');
 s.node('isolated_approval_confirm').checked=true;await s.fire('isolated_approval_confirm','change');
 await s.type();assert.equal(s.node('isolated_approval_submit').disabled,true);
 const edited=s.node('cloud_edit_text').value;await s.fire('cloud_edit_save');
 assert.deepEqual(s.calls,[['sarberki-test','case-edit',2,hash,edited]]);
 assert.equal(s.node('isolated_approval_submit').disabled,true);assert.equal(s.node('cloud_edit_save').disabled,true);
 assert.match(s.node('isolated_approval_status').textContent,/Módosítás mentve/);
});
test('failed or malformed saves remove the base and all old consent',async()=>{
 for(const edit of [async()=>{throw Error('CASE_CONFLICT');},async()=>original(),async()=>{throw Error('FORBIDDEN');}]){
  const s=setup({edit});await s.fire('isolated_approval_load');await s.type();await s.fire('cloud_edit_save');
  assert.equal(s.node('isolated_approval_submit').disabled,true);assert.equal(s.node('cloud_edit_save').disabled,true);
  await s.fire('cloud_edit_save');assert.equal(s.calls.length,1);
 }
});
test('case switch and logout discard edited text and save tokens',async()=>{
 for(const clear of [s=>s.session(),s=>{s.node('isolated_approval_case_id').value='case-other';return s.fire('isolated_approval_case_id','input');}]){
  const s=setup();await s.fire('isolated_approval_load');await s.type();await clear(s);
  assert.equal(s.node('cloud_edit_text').value,'');await s.fire('cloud_edit_save');assert.equal(s.calls.length,0);
 }
});
test('parallel save clicks produce one write; late response cannot unlock another case',async()=>{
 let release;const s=setup({edit:()=>new Promise(resolve=>{release=resolve;})});
 await s.fire('isolated_approval_load');await s.type();const first=s.fire('cloud_edit_save');await s.fire('cloud_edit_save');
 s.node('isolated_approval_case_id').value='case-other';await s.fire('isolated_approval_case_id','input');
 release({...original(),revision:3,data:{state:{approval:'pending'},drafts:[{text:text+'\nHuman edit.  ',edited:true}]}});await first;
 assert.equal(s.calls.length,1);assert.equal(s.node('isolated_approval_submit').disabled,true);assert.equal(s.node('cloud_edit_save').disabled,true);
 assert.doesNotMatch(s.node('isolated_approval_status').textContent,/Módosítás mentve/);
});
test('case changes during load reject the late review and edit base',async()=>{
 let release;const s=setup({get:()=>new Promise(resolve=>{release=resolve;})});
 const loading=s.fire('isolated_approval_load');s.node('isolated_approval_case_id').value='case-other';await s.fire('isolated_approval_case_id','input');
 release(original());await loading;assert.equal(s.node('cloud_edit_text').value,'');assert.equal(s.node('cloud_edit_save').disabled,true);
});

test('Reader record has no editor capability and cannot initiate a save',async()=>{
 const s=setup({get:async()=>({...original(),canEditDraft:false})});await s.fire('isolated_approval_load');
 assert.equal(s.node('cloud_edit_text').disabled,true);assert.equal(s.node('cloud_edit_save').disabled,true);
 await s.fire('cloud_edit_save');assert.equal(s.calls.length,0);
});
