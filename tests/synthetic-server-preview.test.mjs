import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCaseStoreClient} from '../shared-core/case-store-client.mjs';
import {initSyntheticPreviewPanel,syntheticPreviewState} from '../synthetic-server-preview.mjs';

const ui=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('real test UI contains separate read-only preview and opt-in module',()=>{
 for(const id of ['server_preview_panel','server_preview_case_id','server_preview_revision','server_preview_action','server_preview_status','server_preview_text','server_preview_hu','server_preview_details','server_preview_capacity','server_preview_price','server_preview_revision_state','server_preview_approval','server_preview_audit','server_edit_text','server_edit_action','server_edit_status','service_link_controls','service_link_action','service_link_status','service_link_target','service_link_target_revision','service_link_reason','server_preview_service_link']) assert.match(ui,new RegExp('id="'+id+'"'));
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
 for(const id of ['server_preview_action','server_preview_status','server_preview_text','server_preview_generated_text','server_preview_generated_hu','server_preview_case_id','server_preview_revision','server_preview_hu','server_preview_details','server_preview_capacity','server_preview_price','server_preview_revision_state','server_preview_approval','server_preview_audit','server_edit_text','server_edit_action','server_edit_status','service_link_controls','service_link_action','service_link_status','service_link_target','service_link_target_revision','service_link_reason','server_preview_service_link']){
  const e={id,value:'',textContent:'',disabled:false,listeners:{},addEventListener(event,callback){this.listeners[event]=callback;},async click(){await this.listeners.click();}};
  data.set(id,e);
 }
 data.get('server_preview_case_id').value='case-1234';data.get('server_preview_revision').value='2';
 const listeners={};return {getElementById:id=>data.get(id),data,addEventListener:(event,callback)=>listeners[event]=callback,listeners};
}
test('opt-in operator saves edited synthetic draft as pending new server revision',async()=>{
 const documentRef=elements(),calls=[],original='Mentett szintetikus válasz';
 initSyntheticPreviewPanel({documentRef,sessionProvider:()=>({canEditDraft:true,getAccessToken:async()=> 'synthetic-token',request:async(url,options)=>{
  calls.push({url,options});
  if(options.method==='GET')return {ok:true,json:async()=>({result:{caseId:'case-1234',revision:2,
   persisted:false,approval:'pending',text:'Újragenerált előnézet',
   reviewState:{caseRevision:2,factsRevision:1,latestDraftRevision:1,latestDraftMessageCount:1,messageCount:1,storedApproval:'pending'},
   storedDraft:{text:original,caseRevision:2,edited:false,status:'pending'}}})};
  const body=JSON.parse(options.body);
  assert.equal(body.action,'edit-draft');assert.equal(body.expectedRevision,2);
  assert.equal(body.caseId,'case-1234');assert.equal(body.tenantId,'sarberki-test');
  return {ok:true,json:async()=>({result:{caseId:'case-1234',revision:3,data:{
   state:{approval:'pending'},drafts:[{text:original},
    {text:body.editedDraftText,edited:true,reviewStatus:'manual_edit_requires_review'}]}}})};
 }})});
 assert.equal(documentRef.data.get('server_edit_action').disabled,true);
 await documentRef.data.get('server_preview_action').click();
 assert.equal(documentRef.data.get('server_edit_text').value,original);
 assert.equal(documentRef.data.get('server_edit_action').disabled,false);
 documentRef.data.get('server_edit_text').value='Szerkesztett szintetikus válasz';
 await documentRef.data.get('server_edit_action').click();
 assert.deepEqual(calls.map(c=>c.options.method),['GET','POST']);
 assert.equal(documentRef.data.get('server_preview_revision').value,'3');
 assert.equal(documentRef.data.get('server_edit_action').disabled,true);
 assert.equal(documentRef.data.get('server_edit_text').value,'');
 assert.match(documentRef.data.get('server_edit_status').textContent,/mentve új ügyverzióba/);
 assert.match(documentRef.data.get('server_preview_status').textContent,/Nincs e-mail-küldés/);
});
test('reader or absent stored draft never unlocks synthetic editor',async()=>{
 for(const stored of [null,{text:'Mentett tervezet',caseRevision:2,edited:false,status:'pending'}]){
  const documentRef=elements(),calls=[];
  initSyntheticPreviewPanel({documentRef,sessionProvider:()=>({canEditDraft:false,getAccessToken:async()=> 'reader',request:async(_url,options)=>{
   calls.push(options.method);
   return {ok:true,json:async()=>({result:{caseId:'case-1234',revision:2,persisted:false,approval:'pending',text:'READONLY',
    reviewState:{caseRevision:2,factsRevision:1,latestDraftRevision:1,latestDraftMessageCount:1,messageCount:1,storedApproval:'pending'},storedDraft:stored}})};
  }})});
  await documentRef.data.get('server_preview_action').click();
  assert.equal(documentRef.data.get('server_edit_action').disabled,true);
  assert.equal(documentRef.data.get('server_edit_text').disabled,true);
  await documentRef.data.get('server_edit_action').click();
  assert.deepEqual(calls,['GET']);
 }
 const client=createCaseStoreClient({cookieReadOnly:true,getCsrfToken:async()=> 'csrf',request:()=>assert.fail('POST forbidden')});
 await assert.rejects(client.editDraft('sarberki-test','case-1234',2,'no write'),/READ_ONLY/);
});
test('edit CAS conflict clears stale draft and requires a fresh preview',async()=>{
 const documentRef=elements(),calls=[];
 initSyntheticPreviewPanel({documentRef,sessionProvider:()=>({canEditDraft:true,getAccessToken:async()=> 'writer',request:async(_url,options)=>{
  calls.push(options.method);
  if(options.method==='GET')return {ok:true,json:async()=>({result:{caseId:'case-1234',revision:2,persisted:false,approval:'pending',text:'PREVIEW',
   reviewState:{caseRevision:2,factsRevision:1,latestDraftRevision:1,latestDraftMessageCount:1,messageCount:1,storedApproval:'pending'},storedDraft:{text:'SAVED',caseRevision:2}}})};
  return {ok:false,json:async()=>({error:'CASE_CONFLICT'})};
 }})});
 await documentRef.data.get('server_preview_action').click();
 documentRef.data.get('server_edit_text').value='CHANGED';
 await documentRef.data.get('server_edit_action').click();
 assert.deepEqual(calls,['GET','POST']);
 assert.equal(documentRef.data.get('server_edit_action').disabled,true);
 assert.equal(documentRef.data.get('server_edit_text').value,'');
 assert.match(documentRef.data.get('server_edit_status').textContent,/CASE_CONFLICT/);
});
test('cookie reader can preview synthetic server case, never unlock editor or send POST',async()=>{
 const documentRef=elements(),calls=[],csrf='ab'.repeat(32);
 initSyntheticPreviewPanel({documentRef,sessionProvider:()=>({
  cookieReadOnly:true,canEditDraft:false,getCsrfToken:async()=>csrf,
  request:async(url,options)=>{
   calls.push({url,options});
   return {ok:true,json:async()=>({result:{caseId:'case-1234',revision:2,persisted:false,approval:'pending',text:'Szintetikus biztonságos előnézet',
    reviewState:{caseRevision:2,factsRevision:1,latestDraftRevision:1,latestDraftMessageCount:1,messageCount:1,storedApproval:'pending'},
    storedDraft:{text:'Korábbi szintetikus tervezet',caseRevision:2,edited:false}}})};
  }
 })});
 await documentRef.data.get('server_preview_action').click();
 assert.equal(documentRef.data.get('server_preview_text').value,'Korábbi szintetikus tervezet');
 assert.equal(documentRef.data.get('server_preview_generated_text').value,'Szintetikus biztonságos előnézet');
 assert.equal(calls.length,1);
 assert.equal(calls[0].options.method,'GET');
 assert.equal(calls[0].options.credentials,'same-origin');
 assert.equal(calls[0].options.headers['X-CSRF-Token'],csrf);
 assert.equal(calls[0].options.headers['X-Sarberki-Operator'],'1');
 assert.equal(calls[0].options.headers.Authorization,undefined);
 assert.equal(documentRef.data.get('server_edit_text').value,'Korábbi szintetikus tervezet');
 assert.equal(documentRef.data.get('server_edit_text').disabled,true);
 assert.equal(documentRef.data.get('server_edit_action').disabled,true);
 await documentRef.data.get('server_edit_action').click();
 assert.equal(calls.length,1);
});
test('cookie session refuses even a caller-provided edit toggle and suppresses old preview after logout',async()=>{
 const documentRef=elements(),calls=[];
 initSyntheticPreviewPanel({documentRef,sessionProvider:()=>({
  cookieReadOnly:true,canEditDraft:true,getCsrfToken:async()=> 'ab'.repeat(32),
  request:async(_url,options)=>{
   calls.push(options.method);
   return {ok:true,json:async()=>({result:{caseId:'case-1234',revision:2,persisted:false,approval:'pending',text:'Reader only',
    reviewState:{caseRevision:2,factsRevision:1,latestDraftRevision:1,latestDraftMessageCount:1,messageCount:1,storedApproval:'pending'},storedDraft:{text:'Old',caseRevision:2}}})};
  }
 })});
 await documentRef.data.get('server_preview_action').click();
 assert.equal(documentRef.data.get('server_edit_action').disabled,true);
 documentRef.listeners['sarberki:session-changed']();
 assert.equal(documentRef.data.get('server_preview_text').value,'');
 assert.equal(documentRef.data.get('server_edit_text').value,'');
 assert.equal(documentRef.data.get('server_edit_action').disabled,true);
 assert.deepEqual(calls,['GET']);
});
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
 assert.equal(documentRef.data.get('server_preview_text').value,'');
 assert.equal(documentRef.data.get('server_preview_generated_text').value,'SYNTHETIC - NO SEND');
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
 const data={revision:3,storedDraft:{caseRevision:3,text:'SAVED'},reviewState:{caseRevision:3,factsRevision:2,latestDraftRevision:2,latestDraftMessageCount:1,messageCount:2,storedApproval:'pending'}};
 assert.match(syntheticPreviewState(data).revision,/Új ellenőrzés/);
 data.reviewState.latestDraftMessageCount=2;assert.match(syntheticPreviewState(data).revision,/verziója egyezik/);
 data.reviewState.caseRevision=4;assert.match(syntheticPreviewState(data).revision,/NEM IGAZOLT/);
});
test('changing case or session suppresses late responses and clears prior output',async()=>{
 for(const mode of ['input','session','isolated-session']){
  const documentRef=elements();let finish;
  initSyntheticPreviewPanel({documentRef,sessionProvider:()=>({getAccessToken:async()=> 'fixture',request:()=>new Promise(resolve=>finish=resolve)})});
  const pending=documentRef.data.get('server_preview_action').click();await new Promise(resolve=>setImmediate(resolve));
  if(mode==='input'){documentRef.data.get('server_preview_case_id').value='case-other';documentRef.data.get('server_preview_case_id').listeners.input();}else documentRef.listeners[mode==='session'?'sarberki:session-changed':'isolated-approval-session-changed']();
  finish({ok:true,json:async()=>({result:{caseId:'case-1234',revision:2,persisted:false,approval:'pending',text:'LATE'}})});await pending;
  assert.equal(documentRef.data.get('server_preview_text').value,'');assert.match(documentRef.data.get('server_preview_status').textContent,/Új előnézet/);
 }
});
test('UUID test case from existing server runtime is accepted and token callback keeps session receiver',async()=>{
 const documentRef=elements(),id='d52ae811-9cf3-4cdb-8c74-022ef4b4d4f0';documentRef.data.get('server_preview_case_id').value=id;
 const session={token:'fixture',getAccessToken(){return this.token;},request:async()=>({ok:true,json:async()=>({result:{caseId:id,revision:2,persisted:false,approval:'pending',text:'UUID'}})})};
 initSyntheticPreviewPanel({documentRef,sessionProvider:()=>session});await documentRef.data.get('server_preview_action').click();assert.equal(documentRef.data.get('server_preview_text').value,'');assert.equal(documentRef.data.get('server_preview_generated_text').value,'UUID');
});

test('unverified AVAILABLE label never becomes positive central operator status',()=>{
 const view=syntheticPreviewState({decision:{...decision,missing:[],requiresHumanReview:false,capacity:{status:'AVAILABLE',verified:false}}});
 assert.match(view.details,/még nem igazolt/);assert.match(view.capacity,/NEM IGAZOLT/);
});

test('full panel renders server-bound current revision without touching the revision input',async()=>{
 const documentRef=elements();
 initSyntheticPreviewPanel({documentRef,sessionProvider:()=>({getAccessToken:async()=> 'fixture',request:async()=>({ok:true,json:async()=>({result:{caseId:'case-1234',revision:2,persisted:false,approval:'pending',text:'TEST',operatorReviewText:'Magyar szöveg',decision,reviewState:{caseRevision:2,factsRevision:1,latestDraftRevision:1,latestDraftMessageCount:1,messageCount:1}}})})})});
 await documentRef.data.get('server_preview_action').click();
 assert.equal(documentRef.data.get('server_preview_revision').value,'2');assert.match(documentRef.data.get('server_preview_revision_state').textContent,/Nincs aktuális/);
 assert.match(documentRef.data.get('server_preview_hu').value,/NEM IGAZOLT/);assert.equal(documentRef.data.get('server_preview_generated_hu').value,'Magyar szöveg');assert.match(documentRef.data.get('server_preview_capacity').textContent,/NEM IGAZOLT/);
});
test('reselecting unchanged case and revision preserves the Reader preview without false invalidation',async()=>{
 const documentRef=elements();
 initSyntheticPreviewPanel({documentRef,sessionProvider:()=>({cookieReadOnly:true,getCsrfToken:async()=> 'ab'.repeat(32),request:async()=>({ok:true,json:async()=>({result:{caseId:'case-1234',revision:2,persisted:false,approval:'pending',text:'SAVED READER PREVIEW'}})})})});
 await documentRef.data.get('server_preview_action').click();
 const status=documentRef.data.get('server_preview_status').textContent;
 for(const id of ['server_preview_case_id','server_preview_revision'])documentRef.data.get(id).listeners.input();
 assert.equal(documentRef.data.get('server_preview_text').value,'');assert.equal(documentRef.data.get('server_preview_generated_text').value,'SAVED READER PREVIEW');
 assert.equal(documentRef.data.get('server_preview_status').textContent,status);
 assert.doesNotMatch(status,/megváltozott/);
 documentRef.data.get('server_preview_revision').value='3';documentRef.data.get('server_preview_revision').listeners.input();
 assert.equal(documentRef.data.get('server_preview_text').value,'');
 assert.match(documentRef.data.get('server_preview_status').textContent,/megváltozott/);
});

test('Reader cannot expose link controls; approver explicit decision uses bound cookie/CSRF and invalidates selection',async()=>{
 for(const allowed of [false,true]){
  const documentRef=elements(),calls=[];
  const session={cookieReadOnly:true,getCsrfToken:async()=> 'synthetic-csrf',request:async(url,options)=>{
   calls.push(options);return {ok:true,json:async()=>({result:options.method==='GET'?{caseId:'case-1234',revision:2,persisted:false,approval:'pending',text:'SYNTHETIC',canResolveServiceLink:allowed,serviceLinkReview:{reason:'service_thread_conflict'}}:{caseId:'case-1234',revision:3}})};
  }};
  initSyntheticPreviewPanel({documentRef,sessionProvider:()=>session});
  assert.equal(documentRef.data.get('service_link_controls').hidden,true);
  await documentRef.data.get('server_preview_action').click();
  assert.equal(documentRef.data.get('service_link_controls').hidden,!allowed);
  assert.match(documentRef.data.get('server_preview_service_link').textContent,/levélszál eltér/u);
  documentRef.data.get('service_link_target').value='case-5678';documentRef.data.get('service_link_target_revision').value='4';documentRef.data.get('service_link_reason').value='Szintetikus azonosítás ellenőrizve';
  await documentRef.data.get('service_link_action').click();
  assert.equal(calls.filter(x=>x.method==='POST').length,allowed?1:0);
  if(allowed){assert.equal(calls[1].headers['X-CSRF-Token'],'synthetic-csrf');assert.equal(JSON.parse(calls[1].body).expectedRevision,2);assert.equal(documentRef.data.get('server_preview_revision').value,'3');assert.equal(documentRef.data.get('service_link_controls').hidden,true);}
 }
});
test('late link submit after selection or session change performs no POST',async()=>{
 for(const change of ['selection','session']){
  const documentRef=elements();let release,calls=0;
  const initial={cookieReadOnly:true,getCsrfToken:async()=>new Promise(resolve=>release=resolve),request:async(_url,options)=>{if(options.method==='POST')calls++;return {ok:true,json:async()=>({result:{caseId:'case-1234',revision:2,persisted:false,approval:'pending',text:'SYNTHETIC',canResolveServiceLink:true,serviceLinkReview:{reason:'service_link_unverified'}}})};}};
  // First GET must not wait on the submit-only delayed CSRF.
  initial.getCsrfToken=async()=> 'csrf';let session=initial;
  initSyntheticPreviewPanel({documentRef,sessionProvider:()=>session});await documentRef.data.get('server_preview_action').click();
  initial.getCsrfToken=async()=>new Promise(resolve=>release=resolve);
  documentRef.data.get('service_link_target').value='case-5678';documentRef.data.get('service_link_target_revision').value='4';documentRef.data.get('service_link_reason').value='Szintetikus ellenőrzés';
  const pending=documentRef.data.get('service_link_action').click();await Promise.resolve();
  if(change==='selection')documentRef.data.get('server_preview_case_id').value='case-other';else session={...initial};
  release('csrf');await pending;assert.equal(calls,0);
 }
});

test('service-only preview does not ask for a new accommodation stay or change safety evidence',()=>{
 const serviceRequest={requested:true,startDate:'2026-10-24',startTime:'18:00',durationHours:24};
 const input={decision:structuredClone(decision),serviceOnly:true,serviceRequest,serviceLink:{status:'resolved'}};
 const before=JSON.stringify(input);
 const view=syntheticPreviewState(input),normal=syntheticPreviewState({decision});
 assert.match(view.details,/dátuma, kezdése és időtartama rögzítve/);
 assert.match(view.details,/ügykapcsolás emberileg rendezett/);
 assert.doesNotMatch(view.details,/érkezési|távozási|felnőtt|gyermek/);
 assert.match(view.details,/nem visszaigazolás/);
 for(const field of ['capacity','price','approval','audit'])assert.equal(view[field],normal[field]);
 assert.equal(JSON.stringify(input),before);
});
test('service-only missing schedule and unresolved association remain explicit',()=>{
 const view=syntheticPreviewState({decision,serviceOnly:true,serviceRequest:{requested:true}});
 for(const text of ['kért dátuma','kezdési időpontja','időtartama','foglalási ügy külön ellenőrzendő'])assert.ok(view.details.includes(text));
 assert.doesNotMatch(view.details,/érkezési|távozási|felnőtt|gyermek/);
 assert.match(view.capacity,/NEM IGAZOLT/);
 assert.match(view.approval,/függőben/);
});
test('mixed and legacy previews keep accommodation clarification despite a tub request',()=>{
 const normal=syntheticPreviewState({decision}).details;
 for(const serviceOnly of [false,undefined,'true']){
  const view=syntheticPreviewState({decision,serviceOnly,serviceRequest:{requested:true}});
  assert.equal(view.details,normal);
  assert.match(view.details,/érkezési/);
 }
 assert.equal(syntheticPreviewState({decision,serviceOnly:true}).details,normal);
});
test('withdrawal and contradictions remain visible in service-only details',()=>{
 const input={decision:{...decision,contradictions:[{code:'synthetic_schedule_conflict'}]},serviceOnly:true,serviceRequest:{requested:false}};
 const view=syntheticPreviewState(input);
 assert.match(view.details,/visszavonása emberi ellenőrzést/);
 assert.match(view.details,/synthetic_schedule_conflict/);
 assert.doesNotMatch(view.details,/Pontosítandó:/);
});

function savedPreview(revision=2){
 return {caseId:'13c8ecb7-f836-4e2c-9833-d58ee96f2dda',revision,persisted:false,approval:'pending',
  text:'FICTIONAL regenerated original',operatorReviewText:'Újragenerált magyar eredeti',
  reviewState:{caseRevision:revision,factsRevision:1,latestDraftRevision:1,latestDraftMessageCount:1,messageCount:1,storedApproval:'pending'},
  storedDraft:{caseRevision:revision,text:revision===1?'FICTIONAL saved v1':'FICTIONAL edited v2.  \n',edited:revision===2,operatorReviewText:revision===1?'Tárolt magyar v1':'Régi magyar – nem a szerkesztés fordítása'}};
}
async function loadSaved(result){
 const documentRef=elements();documentRef.data.get('server_preview_case_id').value=result.caseId;documentRef.data.get('server_preview_revision').value=String(result.revision);
 initSyntheticPreviewPanel({documentRef,sessionProvider:()=>({cookieReadOnly:true,getCsrfToken:async()=> 'fictional-csrf',request:async()=>({ok:true,json:async()=>({result})})})});
 await documentRef.data.get('server_preview_action').click();return documentRef;
}
test('exact Gmail v1 -> edited stored v2 -> fresh Reader uses exact saved text and never old Hungarian translation',async()=>{
 for(const revision of [1,2,2]){ // third load is a fresh page/Reader, not cached text
  const result=savedPreview(revision),d=await loadSaved(result);
  assert.equal(d.data.get('server_preview_text').value,result.storedDraft.text);
  assert.equal(d.data.get('server_preview_generated_text').value,result.text);
  assert.equal(d.data.get('server_preview_generated_hu').value,result.operatorReviewText);
  assert.equal(d.data.get('server_edit_text').value,result.storedDraft.text);
  assert.equal(d.data.get('server_edit_action').disabled,true);
  assert.match(d.data.get('server_preview_revision_state').textContent,/verziója egyezik/);
  if(revision===1)assert.equal(d.data.get('server_preview_hu').value,'Tárolt magyar v1');
  else{assert.match(d.data.get('server_preview_hu').value,/NEM IGAZOLT/);assert.doesNotMatch(d.data.get('server_preview_hu').value,/Régi magyar/);}
 }
});
test('missing, stale or inconsistent saved snapshots never claim or display current saved text',async()=>{
 for(const mutate of [r=>r.storedDraft=null,r=>delete r.storedDraft,r=>r.storedDraft.caseRevision=1,r=>r.reviewState.caseRevision=1,r=>r.reviewState.latestDraftRevision=0,r=>r.reviewState.latestDraftMessageCount=0,r=>r.reviewState.messageCount=2,r=>r.reviewState.storedApproval='internally_approved',r=>r.storedDraft.text='',r=>delete r.reviewState]){
  const r=savedPreview();mutate(r);const d=await loadSaved(r);
  assert.equal(d.data.get('server_preview_text').value,'');assert.equal(d.data.get('server_edit_text').value,'');
  assert.equal(d.data.get('server_preview_generated_text').value,r.text);
  assert.doesNotMatch(d.data.get('server_preview_revision_state').textContent,/verziója egyezik/);
  assert.match(d.data.get('server_preview_hu').value,/NEM IGAZOLT/);
  assert.equal(d.data.get('server_edit_action').disabled,true);
 }
});
test('case/revision and either session event clear saved/generated texts and suppress late saved snapshots',async()=>{
 for(const event of ['case','revision','sarberki:session-changed','isolated-approval-session-changed']){
  const d=await loadSaved(savedPreview());
  if(event==='case'||event==='revision'){
   const n=d.data.get(event==='case'?'server_preview_case_id':'server_preview_revision');n.value=event==='case'?'case-other':'3';n.listeners.input();
  }else d.listeners[event]();
  for(const id of ['server_preview_text','server_preview_hu','server_preview_generated_text','server_preview_generated_hu','server_edit_text'])assert.equal(d.data.get(id).value,'');
 }
 const d=elements(),r=savedPreview();let release;
 d.data.get('server_preview_case_id').value=r.caseId;
 initSyntheticPreviewPanel({documentRef:d,sessionProvider:()=>({getAccessToken:async()=> 'fictional',request:()=>new Promise(resolve=>release=resolve)})});
 const pending=d.data.get('server_preview_action').click();await new Promise(resolve=>setImmediate(resolve));
 d.listeners['sarberki:session-changed']();release({ok:true,json:async()=>({result:r})});await pending;
 for(const id of ['server_preview_text','server_preview_hu','server_preview_generated_text','server_preview_generated_hu','server_edit_text'])assert.equal(d.data.get(id).value,'');
});
