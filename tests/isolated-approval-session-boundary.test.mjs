import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {initIsolatedApprovalPanel} from '../isolated-approval-panel.mjs';
function dom(){
 const nodes=new Map(['case_id','load','text','revision','confirm','submit','status'].map(x=>['isolated_approval_'+x,{value:'',textContent:'',checked:false,disabled:false,listeners:{},addEventListener(event,cb){this.listeners[event]=cb;},async fire(event){await this.listeners[event]?.();}}]));
 return {nodes,listeners:{},getElementById:id=>nodes.get(id),addEventListener(event,cb){this.listeners[event]=cb;},fire(event){this.listeners[event]?.();}};
}
const record={tenantId:'sarberki-test',caseId:'case-fixture',revision:2,data:{state:{approval:'pending'},drafts:[{synthetic:true,reviewStatus:'internal_review_required',text:'Synthetic persisted review'}]}};
function setup(request){const documentRef=dom();initIsolatedApprovalPanel({documentRef,enabled:true,approvalTarget:'https://isolated-approval.supabase.co',sessionProvider:()=>({getAccessToken:async()=> 'fixture-only'}),request,cryptoProvider:webcrypto});return documentRef;}
const node=(d,x)=>d.nodes.get('isolated_approval_'+x);
async function load(d){node(d,'case_id').value='case-fixture';await node(d,'load').fire('click');}
test('default approval panel cannot fetch or write',()=>{const d=dom();assert.equal(initIsolatedApprovalPanel({documentRef:d,request:()=>{throw Error('network prohibited');}}),false);assert.equal(node(d,'load').disabled,true);});
test('reviewed panel sends exact persisted CAS and consumes review once',async()=>{
 const calls=[];const d=setup(async(url,options)=>{calls.push(options);if(options.method==='GET')return {ok:true,json:async()=>({result:record})};const input=JSON.parse(options.body);return {ok:true,json:async()=>({result:{...record,revision:3,data:{state:{approval:'internally_approved'},serverApproval:{reviewedRevision:2,draftHash:input.reviewedDraftHash}}}})};});
 await load(d);assert.equal(node(d,'submit').disabled,true);node(d,'confirm').checked=true;await node(d,'confirm').fire('change');await node(d,'submit').fire('click');assert.match(node(d,'status').textContent,/jóváhagyás mentve/);assert.equal(calls.length,2);assert.equal(JSON.parse(calls[1].body).expectedRevision,2);await node(d,'submit').fire('click');assert.equal(calls.length,2);
});
test('session replacement invalidates loaded review without approval',async()=>{
 const calls=[];const d=setup(async(url,options)=>{calls.push(options);return {ok:true,json:async()=>({result:record})};});await load(d);node(d,'confirm').checked=true;d.fire('isolated-approval-session-changed');await node(d,'submit').fire('click');assert.equal(node(d,'text').value,'');assert.equal(calls.length,1);
});
test('failed server approval does not claim success and requires reload',async()=>{
 const d=setup(async(url,options)=>options.method==='GET'?{ok:true,json:async()=>({result:record})}:{ok:false,json:async()=>({error:'CASE_CONFLICT'})});await load(d);node(d,'confirm').checked=true;await node(d,'submit').fire('click');assert.match(node(d,'status').textContent,/Nincs igazolt jóváhagyás: CASE_CONFLICT/);assert.equal(node(d,'submit').disabled,true);
});
