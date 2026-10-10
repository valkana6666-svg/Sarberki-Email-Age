import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCaseStoreClient} from '../shared-core/case-store-client.mjs';
import {initSyntheticPreviewPanel} from '../synthetic-server-preview.mjs';

const ui=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('real test UI contains separate read-only preview and opt-in module',()=>{
 for(const id of ['server_preview_panel','server_preview_case_id','server_preview_revision','server_preview_action','server_preview_status','server_preview_text']) assert.match(ui,new RegExp('id="'+id+'"'));
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
 for(const id of ['server_preview_action','server_preview_status','server_preview_text','server_preview_case_id','server_preview_revision']){
  const e={id,value:'',textContent:'',disabled:false,listeners:{},addEventListener(event,callback){this.listeners[event]=callback;},async click(){await this.listeners.click();}};
  data.set(id,e);
 }
 data.get('server_preview_case_id').value='case-1234';data.get('server_preview_revision').value='2';
 return {getElementById:id=>data.get(id),data};
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
