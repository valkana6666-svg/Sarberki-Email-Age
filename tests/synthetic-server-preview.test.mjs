import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCaseStoreClient} from '../shared-core/case-store-client.mjs';
import {initSyntheticPreviewPanel,syntheticPreviewState} from '../synthetic-server-preview.mjs';

const ui=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('real test UI contains separate read-only preview and opt-in module',()=>{
 for(const id of ['server_preview_panel','server_preview_case_id','server_preview_revision','server_preview_action','server_preview_status','server_preview_text','server_preview_hu','server_preview_details','server_preview_capacity','server_preview_price','server_preview_revision_state','server_preview_approval','server_preview_audit']) assert.match(ui,new RegExp('id="'+id+'"'));
 assert.match(ui,/synthetic-server-preview\.mjs/);
 assert.match(ui,/id="server_preview_text" readonly/);
});
test('client read-only preview sends bearer-protected GET without POST or body',async()=>{
 const calls=[];
 const client=createCaseStoreClient({getAccessToken:async()=> 'synthetic-session',request:async(url,options)=>{
  calls.push({url,options});return {ok:true,json:async()=>({result:{caseId:'case-1234',revision:2,approval:'pending',persisted:false,text:'SYNTHETIC'}})};
 }});
 const result=await client.previewDraft('sarberki-test','case-1234',2);
 assert.equal(result.text,'SYNTHETIC');assert.equal(calls.length,1);
 assert.equal(calls[0].options.method,'GET');
 assert.equal(calls[0].options.headers.Authorization,'Bearer synthetic-session');
 assert.equal(calls[0].options.body,undefined);
 assert.match(calls[0].url,/action=preview-draft/);
 assert.match(calls[0].url,/tenantId=sarberki-test/);
});
function elements(){
 const data=new Map();
 for(const id of ['server_preview_action','server_preview_status','server_preview_text','server_preview_case_id','server_preview_revision','server_preview_hu','server_preview_details','server_preview_capacity','server_preview_price','server_preview_revision_state','server_preview_approval','server_preview_audit']){
  const e={id,value:'',textContent:'',disabled:false,listeners:{},addEventListener(event,callback){this.listeners[event]=callback;},async click(){await this.listeners.click();}};
  data.set(id,e);
 }
 data.get('server_preview_case_id').value='case-1234';data.get('server_preview_revision').value='2';
 const listeners={};return {getElementById:id=>data.get(id),data,addEventListener:(event,callback)=>listeners[event]=callback,listeners};
}
test('UI refuses invalid case ID and missing trusted login without fetching',async()=>{
 const documentRef=elements();initSyntheticPreviewPanel({documentRef,sessionProvider:()=>null});
 documentRef.data.get('server_preview_case_id').value='real-person-mail';
 await documentRef.data.get('server_preview_action').click();
 assert.match(documentRef.data.get('server_preview_status').textContent,/szintetikus/);
 documentRef.data.get('server_preview_case_id').value='case-1234';
 await documentRef.data.get('server_preview_action').click();
 assert.match(documentRef.data.get('server_preview_status').textContent,/bejelentkezés/);
 assert.equal(documentRef.data.get('server_preview_text').value,'');
});
test('UI displays verified read-only synthetic preview and never sends email or saves',async()=>{
 const documentRef=elements(),calls=[];
 initSyntheticPreviewPanel({documentRef,sessionProvider:()=>({getAccessToken:async()=> 'fixture-token',request:async(url,options)=>{
  calls.push({url,options});return {ok:true,json:async()=>({result:{caseId:'case-1234',revision:2,approval:'pending',persisted:false,text:'SYNTHETIC - NO SEND'}})};
 }})});
 await documentRef.data.get('server_preview_action').click();
 assert.equal(documentRef.data.get('server_preview_text').value,'SYNTHETIC - NO SEND');
 assert.equal(calls.length,1);assert.equal(calls[0].options.method,'GET');
});
test('UI rejects malformed API response and clears previous preview',async()=>{
 const documentRef=elements();
 initSyntheticPreviewPanel({documentRef,sessionProvider:()=>({getAccessToken:async()=> 'fixture',request:async()=>({ok:true,json:async()=>({result:{caseId:'case-1234',revision:2,approval:'approved',persisted:true,text:'FALSE'}})})})});
 await documentRef.data.get('server_preview_action').click();
 assert.equal(documentRef.data.get('server_preview_text').value,'');
 assert.match(documentRef.data.get('server_preview_status').textContent,/nem kérhető/);
});

const decision={facts:{language:'en',guests:2},missing:['dates'],contradictions:[],requiresHumanReview:true,capacity:{status:'UNKNOWN',verified:false},pricing:{verified:false}};
test('common decision states are Hungarian and cannot claim unknown capacity or price successful',()=>{
 const view=syntheticPreviewState({decision});
 assert.match(view.details,/érkezési/);assert.match(view.capacity,/NEM IGAZOLT/);assert.match(view.price,/NEM IGAZOLT/);
 assert.match(view.revision,/NEM IGAZOLT/);assert.match(view.audit,/NEM IGAZOLT/);assert.match(view.approval,/függőben/);
});
test('stored revision requires matching facts and message count; does not create approval or audit',()=>{
 const data={revision:3,reviewState:{caseRevision:3,factsRevision:2,latestDraftRevision:2,latestDraftMessageCount:1,messageCount:2}};
 assert.match(syntheticPreviewState(data).revision,/Új ellenőrzés/);
 data.reviewState.latestDraftMessageCount=2;assert.match(syntheticPreviewState(data).revision,/verziója egyezik/);
 data.reviewState.caseRevision=4;assert.match(syntheticPreviewState(data).revision,/NEM IGAZOLT/);
});
test('changing case or session suppresses late responses and clears prior output',async()=>{
 for(const mode of ['input','session','isolated-session']){
  const documentRef=elements();let finish;
  initSyntheticPreviewPanel({documentRef,sessionProvider:()=>({getAccessToken:async()=> 'fixture',request:()=>new Promise(resolve=>finish=resolve)})});
  const pending=documentRef.data.get('server_preview_action').click();await new Promise(resolve=>setImmediate(resolve));
  if(mode==='input')documentRef.data.get('server_preview_case_id').listeners.input();else documentRef.listeners[mode==='session'?'sarberki:session-changed':'isolated-approval-session-changed']();
  finish({ok:true,json:async()=>({result:{caseId:'case-1234',revision:2,persisted:false,approval:'pending',text:'LATE'}})});await pending;
  assert.equal(documentRef.data.get('server_preview_text').value,'');assert.match(documentRef.data.get('server_preview_status').textContent,/Új előnézet/);
 }
});
test('UUID test case from existing server runtime is accepted and token callback keeps session receiver',async()=>{
 const documentRef=elements(),id='d52ae811-9cf3-4cdb-8c74-022ef4b4d4f0';documentRef.data.get('server_preview_case_id').value=id;
 const session={token:'fixture',getAccessToken(){return this.token;},request:async()=>({ok:true,json:async()=>({result:{caseId:id,revision:2,persisted:false,approval:'pending',text:'UUID'}})})};
 initSyntheticPreviewPanel({documentRef,sessionProvider:()=>session});await documentRef.data.get('server_preview_action').click();assert.equal(documentRef.data.get('server_preview_text').value,'UUID');
});

test('unverified AVAILABLE label never becomes positive central operator status',()=>{
 const view=syntheticPreviewState({decision:{...decision,missing:[],requiresHumanReview:false,capacity:{status:'AVAILABLE',verified:false}}});
 assert.match(view.details,/még nem igazolt/);assert.match(view.capacity,/NEM IGAZOLT/);
});

test('full panel renders server-bound current revision without touching the revision input',async()=>{
 const documentRef=elements();
 initSyntheticPreviewPanel({documentRef,sessionProvider:()=>({getAccessToken:async()=> 'fixture',request:async()=>({ok:true,json:async()=>({result:{caseId:'case-1234',revision:2,persisted:false,approval:'pending',text:'TEST',operatorReviewText:'Magyar szöveg',decision,reviewState:{caseRevision:2,factsRevision:1,latestDraftRevision:1,latestDraftMessageCount:1,messageCount:1}}})})})});
 await documentRef.data.get('server_preview_action').click();
 assert.equal(documentRef.data.get('server_preview_revision').value,'2');assert.match(documentRef.data.get('server_preview_revision_state').textContent,/verziója egyezik/);
 assert.equal(documentRef.data.get('server_preview_hu').value,'Magyar szöveg');assert.match(documentRef.data.get('server_preview_capacity').textContent,/NEM IGAZOLT/);
});
