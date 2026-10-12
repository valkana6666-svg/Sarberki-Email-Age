import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initOperatorLoginPanel} from '../operator-login-ui.mjs';
const ui=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const names=['operator_login_form','operator_login_email','operator_login_password','operator_login','operator_restore','operator_logout','operator_login_status','operator_list_cases','operator_case_select','operator_open_case','operator_case_status'];
const valid=()=>({authenticated:true,tenantId:'sarberki-test',csrfToken:'ab'.repeat(32),expiresAt:new Date(Date.now()+3600_000).toISOString()});
function harness(request){
 const map=new Map(),events=[];
 for(const name of names){
  const element={id:name,value:'',disabled:false,textContent:'',children:[],listeners:{},
   replaceChildren(...children){this.children=children;this.value='';},
   appendChild(child){this.children.push(child);},
   dispatchEvent(event){return this.listeners[event.type]?.(event);},
   addEventListener(type,fn){this.listeners[type]=fn;},
   async click(){return this.listeners.click?.();},
   async submit(){return this.listeners.submit?.({preventDefault(){}});}};
  map.set(name,element);
 }
 const documentRef={getElementById:id=>map.get(id),createElement:tag=>({tag,value:'',textContent:''}),dispatchEvent:event=>events.push(event.type)};
 const globalRef={};
 assert.equal(initOperatorLoginPanel({documentRef,globalRef,request}),true);
 return {map,get:id=>map.get(id),globalRef,events};
}
test('test booking manager has an operator login form with no stored credentials',()=>{
 for(const id of names)assert.match(ui,new RegExp('id="'+id+'"'));
 assert.match(ui,/operator-login-ui\.mjs/);
 assert.match(ui,/id="operator_login_password" type="password"/);
 assert.match(ui,/szintetikus ügyek olvasása/u);
 assert.doesNotMatch(ui,/localStorage\.setItem\([^\n]*password/u);
});
test('login uses same-origin POST and only exposes read-only cookie-mode case client',async()=>{
 const requests=[],h=harness(async(url,options)=>{
  requests.push({url,options});
  return {ok:true,json:async()=>valid()};
 });
 h.get('operator_login_email').value='reader@synthetic.invalid';
 h.get('operator_login_password').value='SYNTHETIC_PASSWORD_NOT_A_REAL_SECRET';
 await h.get('operator_login_form').submit();
 assert.equal(h.get('operator_login_password').value,'');
 assert.equal(requests.length,1);
 const {url,options}=requests[0];
 assert.equal(url,'/.netlify/functions/operator-session');
 assert.equal(options.method,'POST');
 assert.equal(options.credentials,'same-origin');
 assert.equal(options.cache,'no-store');
 assert.equal(options.headers['X-Sarberki-Operator'],'1');
 assert.deepEqual(JSON.parse(options.body),{action:'login',email:'reader@synthetic.invalid',password:'SYNTHETIC_PASSWORD_NOT_A_REAL_SECRET'});
 assert.ok(h.globalRef.SarberkiCaseStoreSession);
 assert.equal(h.globalRef.SarberkiCaseStoreSession.cookieReadOnly,true);
 assert.equal(h.globalRef.SarberkiCaseStoreSession.canEditDraft,false);
 assert.equal(typeof h.globalRef.SarberkiCaseStoreSession.getAccessToken,'undefined');
 assert.equal(await h.globalRef.SarberkiCaseStoreSession.getCsrfToken(),'ab'.repeat(32));
 assert.match(h.get('operator_login_status').textContent,/olvasás aktív/u);
 assert.equal(h.get('operator_logout').disabled,false);
 assert.ok(h.events.includes('sarberki:session-changed'));
});
test('reader can restore session explicitly and logout with CSRF; no auto requests',async()=>{
 const requests=[],h=harness(async(url,options)=>{
  requests.push({url,options});
  return {ok:true,json:async()=>options.method==='GET'?valid():{authenticated:false}};
 });
 assert.equal(requests.length,0);
 await h.get('operator_restore').click();
 assert.equal(requests[0].options.method,'GET');
 assert.equal(requests[0].options.credentials,'same-origin');
 assert.equal(h.globalRef.SarberkiCaseStoreSession.cookieReadOnly,true);
 await h.get('operator_logout').click();
 assert.equal(requests[1].options.method,'POST');
 assert.deepEqual(JSON.parse(requests[1].options.body),{action:'logout'});
 assert.equal(requests[1].options.headers['X-CSRF-Token'],'ab'.repeat(32));
 assert.equal(h.globalRef.SarberkiCaseStoreSession,null);
 assert.equal(h.get('operator_logout').disabled,true);
 assert.match(h.get('operator_login_status').textContent,/kijelentkeztetve/u);
});
test('bad credentials, disabled setup and malformed session cannot expose a case store',async()=>{
 for(const failure of [
  {ok:false,json:async()=>({error:'AUTH_REQUIRED'})},
  {ok:false,json:async()=>({error:'SESSION_SETUP_REQUIRED'})},
  {ok:true,json:async()=>({...valid(),csrfToken:'wrong'})},
  {ok:true,json:async()=>({...valid(),tenantId:'demo-test'})}
 ]){
  const h=harness(async()=>failure);
  h.get('operator_login_email').value='reader@synthetic.invalid';
  h.get('operator_login_password').value='NOT_REAL_PASSWORD';
  await h.get('operator_login_form').submit();
  assert.equal(h.get('operator_login_password').value,'');
  assert.equal(h.globalRef.SarberkiCaseStoreSession,null);
  assert.equal(h.get('operator_logout').disabled,true);
  assert.doesNotMatch(h.get('operator_login_status').textContent,/olvasás aktív/u);
 }
});
test('failed logout locally drops the session and does not claim remote revocation',async()=>{
 const h=harness(async(_url,opt)=>opt.method==='GET'?{ok:true,json:async()=>valid()}:{ok:false,json:async()=>({error:'SESSION_SERVICE_UNAVAILABLE'})});
 await h.get('operator_restore').click();
 await h.get('operator_logout').click();
 assert.equal(h.globalRef.SarberkiCaseStoreSession,null);
 assert.match(h.get('operator_login_status').textContent,/nem igazolt/u);
});

test('authorized synthetic cases appear as IDs and revisions only; fake guest data is never shown',async()=>{
 const requests=[],fixtureRows=[
  {tenantId:'sarberki-test',caseId:'case-synth-one',revision:3,data:{sender:'guest@synthetic.invalid',original:'PRIVATE SYNTHETIC MESSAGE'}},
  {tenantId:'sarberki-test',caseId:'case-real',revision:4,data:{sender:'real@example.com',original:'NOT FOR UI'}},
  {tenantId:'demo-test',caseId:'case-other',revision:1,data:{sender:'other@synthetic.invalid'}},
  {tenantId:'sarberki-test',caseId:'bad-case',revision:2,data:{sender:'guest@synthetic.invalid'}}
 ];
 const h=harness(async(url,opt)=>{
  requests.push({url,opt});
  if(url.endsWith('/operator-session'))return {ok:true,json:async()=>valid()};
  return {ok:true,json:async()=>({result:fixtureRows})};
 });
 await h.get('operator_restore').click();
 await h.get('operator_list_cases').click();
 assert.equal(requests.length,2);
 assert.equal(requests[1].opt.method,'GET');
 assert.equal(requests[1].opt.credentials,'same-origin');
 assert.equal(requests[1].opt.headers.Authorization,undefined);
 assert.equal(requests[1].opt.headers['X-CSRF-Token'],'ab'.repeat(32));
 assert.equal(h.get('operator_case_select').children.length,2);
 assert.match(h.get('operator_case_select').children[1].textContent,/case-synth-one · v3/);
 assert.doesNotMatch(JSON.stringify(h.get('operator_case_select').children),/PRIVATE SYNTHETIC MESSAGE|NOT FOR UI/);
 assert.equal(h.get('operator_case_select').disabled,false);
 assert.equal(h.get('operator_open_case').disabled,false);
 const id={value:'',listeners:{},dispatchEvent(evt){this.listeners[evt.type]?.();}},
 revision={value:'',listeners:{},dispatchEvent(evt){this.listeners[evt.type]?.();}};
 // The selection is applied only to the test preview's form, not an external API.
 h.get('operator_case_select').value='case-synth-one';
 assert.equal(h.get('operator_case_select').children[1].value,'case-synth-one');
 assert.match(h.get('operator_case_status').textContent,/1 ellenőrzött tesztügy/u);
 await h.get('operator_logout').click();
 assert.equal(h.get('operator_case_select').children.length,0);
 assert.equal(h.get('operator_case_select').disabled,true);
 assert.equal(h.get('operator_open_case').disabled,true);
});
test('case-list errors clear choices without changing a real booking',async()=>{
 const h=harness(async(url,opt)=>url.endsWith('/operator-session')?{ok:true,json:async()=>valid()}:
  {ok:false,json:async()=>({error:'CASE_STORE_DISABLED'})});
 await h.get('operator_restore').click();
 await h.get('operator_list_cases').click();
 assert.match(h.get('operator_case_status').textContent,/CASE_STORE_DISABLED/);
 assert.equal(h.get('operator_case_select').disabled,true);
 assert.equal(h.get('operator_open_case').disabled,true);
});
