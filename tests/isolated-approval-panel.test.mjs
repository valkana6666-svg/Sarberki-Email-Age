import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {initIsolatedApprovalPanel} from '../isolated-approval-panel.mjs';

const target='https://isolated-approval.supabase.co',text='Synthetic stored approval draft; no email';
const hash=createHash('sha256').update(text).digest('hex');
const record=()=>({tenantId:'sarberki-test',caseId:'case-operator',revision:2,data:{state:{approval:'pending'},drafts:[{text,synthetic:true,reviewStatus:'internal_review_required'}]}});
const approved=()=>({...record(),revision:3,data:{...record().data,state:{approval:'internally_approved'},serverApproval:{draftHash:hash,reviewedRevision:2}}});
function dom(){
 const ids=['isolated_approval_case_id','isolated_approval_load','isolated_approval_text','isolated_approval_revision','isolated_approval_confirm','isolated_approval_submit','isolated_approval_status'];
 const nodes=new Map(ids.map(id=>[id,{id,value:'',textContent:'',checked:false,disabled:false,readOnly:false,events:Object.create(null),addEventListener(e,fn){this.events[e]=fn;},async fire(e='click'){return this.events[e]?.();}}]));
 nodes.get('isolated_approval_case_id').value='case-operator';
 return {getElementById:id=>nodes.get(id),get:id=>nodes.get(id)};
}
function setup({enabled=true,session=true,getRecord=record,submitRecord=approved,requestOverride=null}={}){
 const ui=dom(),calls=[];
 const request=async(url,options)=>{
  calls.push({url,options});
  if(requestOverride)return requestOverride(url,options);
  return {ok:true,json:async()=>({result:options.method==='GET'?getRecord():submitRecord()})};
 };
 const init=initIsolatedApprovalPanel({documentRef:ui,enabled,
  approvalTarget:target,cryptoProvider:webcrypto,
  sessionProvider:()=>session?{getAccessToken:async()=> 'synthetic-token'}:null,request});
 return {ui,calls,init,load:()=>ui.get('isolated_approval_load').fire(),
  confirm:()=>{ui.get('isolated_approval_confirm').checked=true;return ui.get('isolated_approval_confirm').fire('change');},
  approve:()=>ui.get('isolated_approval_submit').fire()};
}
test('default production path stays completely disabled with no session lookup or transport',async()=>{
 let calls=0;
 const ui=dom(),init=initIsolatedApprovalPanel({documentRef:ui,sessionProvider:()=>{calls++;throw Error('forbidden');},request:()=>{calls++;throw Error('forbidden');}});
 assert.equal(init,false);assert.equal(ui.get('isolated_approval_load').disabled,true);
 assert.equal(ui.get('isolated_approval_submit').disabled,true);
 assert.equal(calls,0);
 const withoutFlag=setup({enabled:false});await withoutFlag.load();assert.equal(withoutFlag.calls.length,0);
});
test('missing authenticated operator session refuses all network calls',async()=>{
 const s=setup({session:false});await s.load();
 assert.equal(s.calls.length,0);assert.match(s.ui.get('isolated_approval_status').textContent,/AUTH_REQUIRED/);
 assert.equal(s.ui.get('isolated_approval_submit').disabled,true);
});
test('review reads persisted version, checks exact text and requires explicit consent',async()=>{
 const s=setup();await s.load();
 assert.equal(s.calls.length,1);assert.equal(s.calls[0].options.method,'GET');
 assert.equal(s.ui.get('isolated_approval_text').value,text);assert.equal(s.ui.get('isolated_approval_text').readOnly,true);
 assert.equal(s.ui.get('isolated_approval_revision').value,'2');
 assert.equal(s.ui.get('isolated_approval_submit').disabled,true);
 await s.confirm();assert.equal(s.ui.get('isolated_approval_submit').disabled,false);
 await s.approve();assert.equal(s.calls.length,2);assert.equal(s.calls[1].options.method,'POST');
 assert.deepEqual(JSON.parse(s.calls[1].options.body),{action:'approve',tenantId:'sarberki-test',caseId:'case-operator',expectedRevision:2,reviewedDraftHash:hash});
 assert.match(s.ui.get('isolated_approval_status').textContent,/jóváhagyás mentve/);
 assert.equal(s.ui.get('isolated_approval_submit').disabled,true);
 await s.approve();assert.equal(s.calls.length,2);
});
test('a preview, wrong tenant, non-synthetic draft and already approved draft cannot enable write',async()=>{
 for(const edit of [r=>delete r.data.drafts,r=>r.tenantId='demo-test',r=>r.data.drafts[0].synthetic=false,r=>r.data.state.approval='internally_approved']){
  const s=setup({getRecord:()=>{const r=record();edit(r);return r;}});
  await s.load();await s.confirm();await s.approve();
  assert.equal(s.calls.length,1);assert.equal(s.ui.get('isolated_approval_submit').disabled,true);
 }
});
test('tampered read-only text, case ID and revision must not reach POST',async()=>{
 for(const edited of [ui=>ui.get('isolated_approval_text').value+='x',
  ui=>ui.get('isolated_approval_case_id').value='case-other',
  ui=>ui.get('isolated_approval_revision').value='999']){
  const s=setup();await s.load();await s.confirm();edited(s.ui);await s.approve();
  assert.equal(s.calls.filter(v=>v.options.method==='POST').length,0);
  assert.equal(s.ui.get('isolated_approval_submit').disabled,true);
 }
});
test('changed case input cancels loaded proof without another read',async()=>{
 const s=setup();await s.load();await s.confirm();
 s.ui.get('isolated_approval_case_id').value='case-other';
 await s.ui.get('isolated_approval_case_id').fire('input');
 assert.equal(s.ui.get('isolated_approval_text').value,'');
 await s.approve();assert.equal(s.calls.length,1);
});
test('a server rejection clears approval instead of using a local fallback',async()=>{
 for(const error of ['FORBIDDEN','CASE_CONFLICT','REVIEW_NOT_READY','SERVICE_UNAVAILABLE']){
  const s=setup({requestOverride:async(_url,options)=>({ok:options.method==='GET',json:async()=>options.method==='GET'?{result:record()}:{error}})});
  await s.load();await s.confirm();await s.approve();
  assert.match(s.ui.get('isolated_approval_status').textContent,new RegExp(error));
  assert.equal(s.ui.get('isolated_approval_text').value,'');
  await s.approve();assert.equal(s.calls.filter(v=>v.options.method==='POST').length,1);
 }
});
test('concurrent clicks cannot double POST',async()=>{
 let release;
 const s=setup({requestOverride:(_url,options)=>options.method==='GET'
  ?Promise.resolve({ok:true,json:async()=>({result:record()})})
  :new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>({result:approved()})});})});
 await s.load();await s.confirm();
 const first=s.approve();await s.approve();
 assert.equal(s.calls.filter(x=>x.options.method==='POST').length,1);
 release();await first;
 assert.equal(s.calls.filter(x=>x.options.method==='POST').length,1);
});
test('invalid case id blocks network before attempting session',async()=>{
 const s=setup();s.ui.get('isolated_approval_case_id').value='someone@example.com';
 await s.load();assert.equal(s.calls.length,0);assert.equal(s.ui.get('isolated_approval_submit').disabled,true);
});
