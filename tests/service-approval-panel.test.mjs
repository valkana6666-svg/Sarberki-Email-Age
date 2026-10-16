import test from 'node:test';
import assert from 'node:assert/strict';
import {initServiceApprovalPanel} from '../service-approval-panel.mjs';
const hash='ab'.repeat(32);
function fixture(){
 const names=['service_approval_read','service_approval_action','service_approval_status','service_approval_preview','server_preview_case_id','server_preview_revision'],nodes=new Map(),listeners={};
 for(const id of names)nodes.set(id,{value:'',textContent:'',hidden:false,disabled:false,listeners:{},addEventListener(e,cb){this.listeners[e]=cb;},click(){return this.listeners.click();}});
 nodes.get('server_preview_case_id').value='case-synthetic';nodes.get('server_preview_revision').value='3';
 const calls=[],state={allowed:true,result:null,csrf:async()=> 'synthetic-csrf'},session={cookieReadOnly:true,getCsrfToken:()=>state.csrf(),request:async(_url,options)=>{
  calls.push(options);return {ok:true,json:async()=>({result:options.method==='GET'?{status:'unapproved',canApproveService:state.allowed,preview:state.allowed?{hash,houseNumber:1,resourceId:'tub-one',start:'2026-11-14T18:00:00+01:00',end:'2026-11-15T18:00:00+01:00',timezone:'Europe/Budapest',sourceId:'synthetic',evidenceReference:'proof',version:'v1',bindingReference:'binding',bindingVersion:'v1'}:null}:state.result??{approval_id:1,case_id:'case-synthetic',payload:{caseRevision:3,previewHash:hash}}})};
 }};
 state.session=session;
 const documentRef={getElementById:id=>nodes.get(id),addEventListener:(e,cb)=>listeners[e]=cb};
 assert.equal(initServiceApprovalPanel({documentRef,sessionProvider:()=>state.session}),true);
 return {get:id=>nodes.get(id),listeners,calls,state};
}
test('Reader state is explicit GET only; approver submits exactly the human-reviewed hash with cookie/CSRF',async()=>{
 for(const allowed of [false,true]){
  const f=fixture();f.state.allowed=allowed;assert.equal(f.calls.length,0);assert.equal(f.get('service_approval_action').hidden,true);
  await f.get('service_approval_read').click();assert.equal(f.get('service_approval_action').hidden,!allowed);
  await f.get('service_approval_action').click();assert.equal(f.calls.length,allowed?2:1);
  if(allowed){const c=f.calls[1];assert.equal(c.credentials,'same-origin');assert.equal(c.headers['X-CSRF-Token'],'synthetic-csrf');assert.deepEqual(JSON.parse(c.body),{tenantId:'sarberki-test',action:'approve-service',caseId:'case-synthetic',expectedRevision:3,servicePreviewHash:hash});assert.match(f.get('service_approval_status').textContent,/rögzítve/);}
 }
});
test('both session events immediately hide stale approval controls',async()=>{
 for(const event of ['sarberki:session-changed','isolated-approval-session-changed']){
  const f=fixture();await f.get('service_approval_read').click();f.listeners[event]();assert.equal(f.get('service_approval_action').hidden,true);await f.get('service_approval_action').click();assert.equal(f.calls.length,1);
 }
});
test('pending CSRF session/selection changes cancel submit and double-click does not duplicate POST',async()=>{
 for(const change of ['selection','session','none']){
  const f=fixture();await f.get('service_approval_read').click();let release;f.state.csrf=()=>new Promise(r=>release=r);
  const pending=f.get('service_approval_action').click();await Promise.resolve();await f.get('service_approval_action').click();
  if(change==='selection')f.get('server_preview_revision').value='4';if(change==='session')f.state.session={...f.state.session};release('csrf');await pending;
  assert.equal(f.calls.filter(c=>c.method==='POST').length,change==='none'?1:0);
 }
});
test('malformed/wrong-case/wrong-hash success responses never report approval',async()=>{
 for(const result of [{},{approval_id:1,case_id:'wrong',payload:{caseRevision:3,previewHash:hash}},{approval_id:1,case_id:'case-synthetic',payload:{caseRevision:4,previewHash:hash}},{approval_id:1,case_id:'case-synthetic',payload:{caseRevision:3,previewHash:'cd'.repeat(32)}}]){
  const f=fixture();f.state.result=result;await f.get('service_approval_read').click();await f.get('service_approval_action').click();assert.match(f.get('service_approval_status').textContent,/nem igazolt/);assert.equal(f.get('service_approval_action').hidden,true);
 }
});
