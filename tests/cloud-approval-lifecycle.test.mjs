import {initClarificationPanel} from '../clarification-panel.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {createOperatorSession} from '../sarberki-chatbot-project/operator-session.mjs';
import {initIsolatedApprovalPanel} from '../isolated-approval-panel.mjs';
import {createEpochRequestQueue} from '../shared-core/epoch-request-queue.mjs';
import {createCloudCaseRequest} from '../shared-core/cloud-case-request.mjs';
import {formatCloudApprovalFailure} from '../shared-core/cloud-approval-errors.mjs';
import {isIsolatedReviewCaseId} from '../shared-core/isolated-review-case-id.mjs';
const source=readFileSync(new URL('../cloud-approval-session.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
// Login POST and confirmation GET represent the same server session. A new
// Date per response makes confirmation randomly fail across millisecond boundaries.
const sessionExpiresAt=new Date(Date.now()+3600000).toISOString();
const valid=()=>({authenticated:true,tenantId:'sarberki-test',csrfToken:'ab'.repeat(32),expiresAt:sessionExpiresAt});
const settle=()=>new Promise(r=>setImmediate(r));
async function harness(request){
 const nodes=new Map(),listeners={},documentListeners={};
 const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,checked:false,addEventListener(e,f){this[e]=f;}});return nodes.get(id);};
 const document={visibilityState:'visible',getElementById:get,addEventListener(e,f){(documentListeners[e]??=[]).push(f);},dispatchEvent(e){for(const f of documentListeners[e.type]||[])f(e);}};
 const sandbox={document,location:{origin:'https://leafy-chimera-2403e5.netlify.app',search:'?caseId=case-fixture'},URLSearchParams,Event,
  addEventListener:(e,f)=>listeners[e]=f,createOperatorSession:()=>createOperatorSession({request}),
  initClarificationPanel:args=>initClarificationPanel({...args,documentRef:document,cryptoProvider:webcrypto}),
  initIsolatedApprovalPanel:args=>initIsolatedApprovalPanel({...args,documentRef:document,cryptoProvider:webcrypto}),createEpochRequestQueue,
  createCloudCaseRequest:()=>createCloudCaseRequest({request}),formatCloudApprovalFailure,isIsolatedReviewCaseId};
 vm.runInNewContext(source,sandbox);await settle();return {get,listeners,document,async visibility(state){document.visibilityState=state;await Promise.all((documentListeners.visibilitychange||[]).map(f=>f()));}};
}
test('approval page clears reviewed text and consent on hide; bfcache return revalidates once',async()=>{
 const calls=[],h=await harness(async(_url,options)=>{calls.push(options);return {ok:true,json:async()=>valid()};});
 assert.equal(calls.length,1);assert.equal(h.get('workspace').disabled,false);
 h.get('isolated_approval_text').value='SYNTHETIC REVIEW';h.get('isolated_approval_confirm').checked=true;
 h.listeners.pagehide();assert.equal(h.get('workspace').disabled,true);assert.equal(h.get('isolated_approval_text').value,'');assert.equal(h.get('isolated_approval_confirm').checked,false);
 await h.listeners.pageshow({persisted:false});assert.equal(calls.length,1);
 await h.listeners.pageshow({persisted:true});assert.equal(calls.length,2);assert.equal(h.get('workspace').disabled,false);
 assert.ok(calls.every(c=>c.method==='GET'));
});
test('late restore after background is discarded and visible return serially retries with fresh session',async()=>{
 let calls=0,release;
 const h=await harness(async()=>{calls++;if(calls===2)return new Promise(r=>release=r);return {ok:true,json:async()=>valid()};});
 const pending=h.listeners.pageshow({persisted:true});await settle();assert.equal(calls,2);
 await h.visibility('hidden');const resumed=h.visibility('visible');
 assert.equal(h.get('workspace').disabled,true);assert.equal(calls,2);
 release({ok:true,json:async()=>valid()});await Promise.all([pending,resumed]);await settle();
 assert.equal(calls,3);assert.equal(h.get('workspace').disabled,false);
 assert.equal(h.get('isolated_approval_submit').disabled,true,'resume never restores old consent');
});
test('revoked approval session remains locked after foreground return',async()=>{
 let calls=0;const h=await harness(async()=>++calls===1?{ok:true,json:async()=>valid()}:{ok:false,status:401,json:async()=>({error:'AUTH_REQUIRED'})});
 await h.visibility('hidden');await h.visibility('visible');
 assert.equal(calls,2);assert.equal(h.get('workspace').disabled,true);assert.match(h.get('auth_status').textContent,/Bejelentkezés szükséges/);
});
test('readback with revoked session clears review, consent and active login status without writing',async()=>{
 const calls=[];let revoked=false;
 const h=await harness(async(url,options)=>{
  calls.push({url,method:options.method});
  return revoked?{ok:false,status:401,json:async()=>({error:'AUTH_REQUIRED'})}:{ok:true,json:async()=>valid()};
 });
 h.get('isolated_approval_text').value='old review';h.get('isolated_approval_confirm').checked=true;
 revoked=true;await h.get('readback').click();
 assert.equal(h.get('workspace').disabled,true);
 assert.equal(h.get('isolated_approval_text').value,'');
 assert.equal(h.get('isolated_approval_confirm').checked,false);
 assert.match(h.get('auth_status').textContent,/Bejelentkezés szükséges/);
 assert.ok(calls.every(c=>c.method==='GET'));assert.equal(calls.length,2);
});
test('case API authentication rejection locks page but ordinary role denial does not revoke session',async()=>{
 for(const code of ['AUTH_REQUIRED','FORBIDDEN']){
  const calls=[];
  const h=await harness(async(url,options)=>{
   calls.push({url,method:options.method});
   return url.includes('operator-session')?{ok:true,json:async()=>valid()}:
    {ok:false,status:code==='AUTH_REQUIRED'?401:403,json:async()=>({error:code})};
  });
  await h.get('readback').click();
  assert.equal(h.get('workspace').disabled,code==='AUTH_REQUIRED');
  assert.equal(h.get('isolated_approval_submit').disabled,true);
  assert.ok(calls.every(c=>c.method==='GET'));assert.equal(calls.length,3);
  if(code==='FORBIDDEN')assert.match(h.get('readback_status').textContent,/FORBIDDEN/);
 }
});
test('late authentication failure from old session cannot clear a new login',async()=>{
 let release,calls=0;
 const h=await harness(async()=>{
  calls++;if(calls===2)return new Promise(r=>release=r);
  return {ok:true,json:async()=>valid()};
 });
 const pending=h.get('readback').click();await settle();
 h.get('email').value='synthetic@example.invalid';h.get('password').value='synthetic-only';
 const login=h.get('login').submit({preventDefault(){}});
 release({ok:false,status:401,json:async()=>({error:'AUTH_REQUIRED'})});
 await Promise.all([pending,login]);
 assert.equal(h.get('workspace').disabled,false);
 assert.match(h.get('auth_status').textContent,/Hitelesített/);
 assert.equal(h.get('isolated_approval_submit').disabled,true);
});

test('explicit logout stays locked on bfcache and visibility return even if server still offers a session',async()=>{
 const calls=[];
 const h=await harness(async(_url,options)=>{calls.push(options);return {ok:true,json:async()=>valid()};});
 await h.get('logout').click();
 const afterLogout=calls.length;
 await h.listeners.pageshow({persisted:true});
 await h.visibility('hidden');await h.visibility('visible');
 assert.equal(h.get('workspace').disabled,true);
 assert.equal(calls.length,afterLogout,'explicit logout must not silently restore');
 await h.get('readback').click();
 assert.equal(calls.length,afterLogout,'locked readback must not send protected requests');
 h.get('email').value='synthetic@example.invalid';h.get('password').value='synthetic-only';
 await h.get('login').submit({preventDefault(){}});
 assert.equal(h.get('workspace').disabled,false,'explicit login can unlock again');
});

const storedReadback=()=>({caseId:'case-fixture',revision:4,approval:'pending',serverApproval:null,readOnly:true,auditScope:'approval-history',
 storedDraft:{text:'Actual stored reply\r\nSecond line',operatorReviewText:'Tárolt magyar szöveg',factsRevision:1,basedOnMessageCount:1,current:false},
 audit:[{revision:3,kind:'approve_isolated_synthetic',actor:'synthetic-actor',data_hash:'a'.repeat(64)}]});
test('readback renders historical stored content separately and never enables approval or writes',async()=>{
 const calls=[],h=await harness(async(url,options)=>{calls.push({url,method:options.method});return {ok:true,json:async()=>url.includes('operator-session')?valid():{result:storedReadback()}};});
 h.get('isolated_approval_confirm').checked=true;
 await h.get('readback').click();
 assert.equal(h.get('stored_readback_text').value,storedReadback().storedDraft.text);
 assert.equal(h.get('stored_readback_hu').value,storedReadback().storedDraft.operatorReviewText);
 assert.match(h.get('stored_readback_status').textContent,/korábbi állapothoz/);
 assert.match(h.get('readback_status').textContent,/approval-history/);
 assert.doesNotMatch(h.get('readback_status').textContent,/Actual stored reply/);
 assert.equal(h.get('isolated_approval_confirm').checked,false);assert.equal(h.get('isolated_approval_submit').disabled,true);
 assert.ok(calls.every(c=>c.method==='GET'));
 h.listeners.pagehide();assert.equal(h.get('stored_readback_text').value,'');assert.equal(h.get('stored_readback_hu').value,'');
});
test('late stored readback cannot render after case selection changes',async()=>{
 let release;const h=await harness(async(url)=>url.includes('operator-session')?{ok:true,json:async()=>valid()}:new Promise(resolve=>{release=resolve;}));
 const pending=h.get('readback').click();await settle();assert.ok(release);
 h.get('isolated_approval_case_id').value='case-other';h.get('isolated_approval_case_id').input();
 release({ok:true,json:async()=>({result:storedReadback()})});await pending;
 assert.equal(h.get('stored_readback_text').value,'');assert.equal(h.get('readback_status').textContent,'');
});
test('stored readback rejects wrong case response and clears previous content',async()=>{
 const h=await harness(async(url)=>({ok:true,json:async()=>url.includes('operator-session')?valid():{result:{...storedReadback(),caseId:'case-other'}}}));
 h.get('stored_readback_text').value='old stored content';await h.get('readback').click();
 assert.equal(h.get('stored_readback_text').value,'');assert.equal(h.get('isolated_approval_submit').disabled,true);
});
test('stored readback fields are readonly in hosted HTML',()=>{
 const html=readFileSync(new URL('../cloud-approval.html',import.meta.url),'utf8');
 for(const id of ['stored_readback_text','stored_readback_hu'])assert.match(html,new RegExp('<textarea[^>]*id="'+id+'"[^>]*readonly'));
});
