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
const valid=()=>({authenticated:true,tenantId:'sarberki-test',csrfToken:'ab'.repeat(32),expiresAt:new Date(Date.now()+3600000).toISOString()});
const settle=()=>new Promise(r=>setImmediate(r));
async function harness(request){
 const nodes=new Map(),listeners={},documentListeners={};
 const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,checked:false,addEventListener(e,f){this[e]=f;}});return nodes.get(id);};
 const document={visibilityState:'visible',getElementById:get,addEventListener(e,f){(documentListeners[e]??=[]).push(f);},dispatchEvent(e){for(const f of documentListeners[e.type]||[])f(e);}};
 const sandbox={document,location:{origin:'https://leafy-chimera-2403e5.netlify.app',search:'?caseId=case-fixture'},URLSearchParams,Event,
  addEventListener:(e,f)=>listeners[e]=f,createOperatorSession:()=>createOperatorSession({request}),
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
