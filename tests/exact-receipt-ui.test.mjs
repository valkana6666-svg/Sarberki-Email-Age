import test from 'node:test';
import assert from 'node:assert/strict';
import {initOperatorLoginPanel,gmailReceiptRequestFromRecord} from '../operator-login-ui.mjs';
// Fictional sender, header, IDs, and body only; no private config is imported.
const record=()=>({source:{provider:'gmail',message_id:'fake-message',thread_id:'fake-thread',rfc_message_id:'<fake@example.test>',in_reply_to:null,references:[],subject:'Fictional inquiry',from:'Fictional Sender <sender@example.test>',from_email:'sender@example.test',to:'sarberkiprojecttest@gmail.com',received_at:'2030-10-03T09:23:06.000Z'},original_message:'Fictional inquiry.\r\nSecond line.',normalized:{guests:999},reply_draft:'MUST NOT UPLOAD'});
const metadata=()=>({authenticated:true,tenantId:'sarberki-test',csrfToken:'ab'.repeat(32),expiresAt:new Date(Date.now()+3600000).toISOString()});
const result=status=>({result:{resolution:{status},record:{tenantId:'sarberki-test',caseId:'44444444-4444-4444-8444-444444444444',revision:1}}});
async function harness({restore=true,onPost=async()=>({ok:true,json:async()=>result('new')})}={}){
 const map=new Map(),calls=[];
 function element(id=''){
  const e={id,value:'',disabled:false,hidden:false,textContent:'',listeners:{},children:[],
   setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},
   appendChild(child){this.children.push(child);if(child.id)map.set(child.id,child);},
   replaceChildren(){this.children=[];},
   addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},
   dispatchEvent(ev){for(const fn of this.listeners[ev.type]||[])fn(ev);},
   async click(){for(const fn of this.listeners.click||[])await fn();}};
  if(id)map.set(id,e);return e;
 }
 for(const id of ['operator_login_form','operator_login_email','operator_login_password','operator_login_status','operator_restore','operator_logout','operator_login','operator_list_cases','operator_case_select','operator_open_case','operator_case_status','gmail_bridge','gmail_json','message','gmail_cloud_fixture_save','gmail_cloud_fixture_approval','server_preview_case_id','server_preview_revision'])element(id);
 const listeners={},globalListeners={};
 const documentRef={getElementById:id=>map.get(id),createElement:()=>element(),addEventListener(type,fn){(listeners[type]??=[]).push(fn);},dispatchEvent(ev){for(const fn of listeners[ev.type]||[])fn(ev);}};
 const globalRef={addEventListener(type,fn){globalListeners[type]=fn;}};
 const request=async(url,opt)=>{
  calls.push({url,opt});
  assert.ok(url==='/conflict'||url.startsWith('/.netlify/functions/'),'no provider request');
  if(url.endsWith('/operator-session'))return {ok:restore,json:async()=>restore?metadata():{error:'AUTH_REQUIRED'}};
  assert.equal(url,'/.netlify/functions/booking-cases');return onPost(url,opt);
 };
 initOperatorLoginPanel({documentRef,globalRef,request});
 for(let i=0;i<100&&map.get('operator_login').disabled;i++)await Promise.resolve();
 calls.length=0;
 const load=(r=record(),eventId=r.source.message_id)=>{
  map.get('gmail_json').value=JSON.stringify(r);map.get('message').value=r.original_message.replaceAll('\r\n','\n');
  documentRef.dispatchEvent({type:'sarberki:gmail-normalized',detail:{message_id:eventId}});
 };
 return {get:id=>map.get(id),globalRef,documentRef,globalListeners,calls,load,save:()=>map.get('gmail_exact_receipt_save').click()};
}
test('receipt builder preserves CRLF and raw from but excludes normalized facts/draft',()=>{
 assert.ok(record().original_message.includes(String.fromCharCode(13,10)));
 const r=record(),p=gmailReceiptRequestFromRecord(r,r.original_message.replaceAll('\r\n','\n'));
 assert.equal(p.envelope.text,r.original_message);assert.equal(p.envelope.sender,r.source.from_email);assert.equal(p.sourceReceipt.from,r.source.from);assert.equal(p.sourceReceipt.mailbox_id,'sarberki_gmail_test');assert.equal(p.envelope.message_id,r.source.message_id);
 assert.deepEqual(Object.keys(p).sort(),['action','envelope','expectedRevision','sourceReceipt','tenantId']);assert.equal(p.sourceReceipt.in_reply_to,null);assert.deepEqual(p.sourceReceipt.references,[]);
 for(const change of [{to:'other@example.test'},{in_reply_to:'<reply@example.test>'},{references:['<ref@example.test>']},{extra:true},{from:undefined}])assert.throws(()=>gmailReceiptRequestFromRecord({...r,source:{...r.source,...change}},r.original_message));
});
test('normalization never posts; explicit Writer save uses existing cookie transport and replay feedback',async()=>{
 let posts=0;const h=await harness({onPost:async()=>({ok:true,json:async()=>result(posts++?'duplicate':'new')})});
 h.load();assert.equal(h.calls.length,0);assert.equal(h.get('gmail_exact_receipt_save').disabled,false);
 await h.save();assert.equal(h.calls.length,1);const {url,opt}=h.calls[0];
 assert.equal(url,'/.netlify/functions/booking-cases');assert.equal(opt.method,'POST');assert.equal(opt.credentials,'same-origin');assert.equal(opt.redirect,'error');assert.equal(opt.headers['X-CSRF-Token'],metadata().csrfToken);assert.deepEqual(JSON.parse(opt.body),gmailReceiptRequestFromRecord(record(),record().original_message));
 assert.equal(h.get('server_preview_case_id').value,result('new').result.record.caseId);assert.equal(h.get('server_preview_revision').value,'1');assert.match(h.get('gmail_exact_receipt_status').textContent,/Mentett/);assert.match(h.get('gmail_exact_receipt_status').textContent,/Kapacitás és ár nem igazolt/);assert.equal(h.get('gmail_cloud_fixture_approval').hidden,true);
 await h.save();assert.equal(h.calls.length,2);assert.match(h.get('gmail_exact_receipt_status').textContent,/Meglévő/);
});
test('Reader or private receipt denial shows safe error and never claims save',async()=>{
 const h=await harness({onPost:async()=>({ok:false,json:async()=>({error:'FORBIDDEN',secret:'NEVER DISPLAY'})})});h.load();await h.save();assert.equal(h.calls.length,1);assert.match(h.get('gmail_exact_receipt_status').textContent,/FORBIDDEN/);assert.doesNotMatch(h.get('gmail_exact_receipt_status').textContent,/NEVER DISPLAY|Mentett/);assert.equal(h.get('server_preview_case_id').value,'');
});
test('missing, stale, mismatched event or inactive session cannot post',async()=>{
 const h=await harness();await h.save();assert.equal(h.calls.length,0);
 h.load(record(),'different-id');assert.equal(h.get('gmail_exact_receipt_save').disabled,true);await h.save();assert.equal(h.calls.length,0);
 h.load();h.get('message').value+=' edited';h.get('message').dispatchEvent(new Event('input'));assert.equal(h.get('gmail_exact_receipt_save').disabled,true);await h.save();assert.equal(h.calls.length,0);
 h.load();h.get('gmail_json').value='broken';await h.save();assert.equal(h.calls.length,0);
 const inactive=await harness({restore:false});inactive.load();assert.equal(inactive.get('gmail_exact_receipt_save').disabled,true);await inactive.save();assert.equal(inactive.calls.length,0);
});
test('awaited CSRF cannot post stale content or a replaced session',async()=>{
 for(const change of ['content','session']){
  const h=await harness();h.load();let release;
  h.globalRef.SarberkiCaseStoreSession={getCsrfToken:()=>new Promise(resolve=>{release=resolve;})};
  const pending=h.save();
  if(change==='content'){h.get('message').value+=' edited';h.get('message').dispatchEvent(new Event('input'));}
  else h.globalRef.SarberkiCaseStoreSession={getCsrfToken:async()=>metadata().csrfToken};
  release(metadata().csrfToken);await pending;assert.equal(h.calls.length,0);
 }
});
test('response after a new normalized record cannot overwrite selected Reader case',async()=>{
 let release;const h=await harness({onPost:()=>new Promise(resolve=>{release=resolve;})});h.load();const pending=h.save();for(let i=0;i<20&&!release;i++)await Promise.resolve();assert.ok(release);
 h.load({...record(),source:{...record().source,message_id:'another-id'}});release({ok:true,json:async()=>result('new')});await pending;assert.equal(h.get('server_preview_case_id').value,'');assert.doesNotMatch(h.get('gmail_exact_receipt_status').textContent,/Mentett/);
});
