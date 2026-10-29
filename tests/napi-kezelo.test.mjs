import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

class Element {
 constructor(){this.textContent='';this.value='';this.hidden=false;this.disabled=false;this.href='';this.dataset={};this.listeners={};this.children=[];this.attributes={};}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 setAttribute(key,value){this.attributes[key]=value;}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children.flatMap(x=>x.fragment?x.children:[x]);}
 async dispatch(type,event={}){for(const fn of this.listeners[type]||[])await fn({preventDefault(){},...event});}
}
function fakeDocument(){
 const ids=['read-email','email-status','email-list','email-detail','draft-editor','save-draft','approve-draft','approve-confirm','detail-messages','detail-facts','chat-form','chat-input','chat-output','chat-send','chat-reset','login','logout','email','password','session-status','load-cases','list-status','case-list','case-detail','detail-status','detail-summary','detail-capacity','detail-price','detail-draft','detail-link','section-heading','section-description'];
 const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
 const nav=['incoming','approval','progress','closed'].map(section=>{const e=new Element();e.dataset.section=section;return e;});
 const listeners={};
 return {elements,nav,visibilityState:'visible',getElementById:id=>elements[id],querySelectorAll:()=>nav,querySelector:()=>({content:'synthetic-client'}),
  createDocumentFragment(){const e=new Element();e.fragment=true;return e;},createElement:()=>new Element(),
  addEventListener(type,fn){(listeners[type]??=[]).push(fn);},async dispatch(type){for(const fn of listeners[type]||[])await fn();}};
}
const meta=()=>({authenticated:true,tenantId:'sarberki-test',csrfToken:'a'.repeat(64),expiresAt:new Date(Date.now()+3600000).toISOString()});
function response(result,status=200){return new Response(JSON.stringify(result),{status,headers:{'Content-Type':'application/json'}});}
const preview=()=>({caseId:'case-synthetic',revision:1,persisted:false,approval:'pending',text:'UNVERIFIED_DRAFT',
 decision:{facts:{dates:{arrival:'2026-11-20',departure:'2026-11-22'},adults:null,children:0,guests:null,child_ages:[],language:'hu'},
 missing:['adults'],contradictions:[],capacity:{verified:false,status:'UNKNOWN'},pricing:{verified:false},
 safety:{emailSent:false,bookingCreated:false,approval:'pending'}},
 readOnlyFreshness:{verified:true,syntheticOnly:true,source:'stored-synthetic-case',tenantId:'sarberki-test',caseId:'case-synthetic',revision:1,checkedAt:new Date().toISOString()}});

test('daily view reuses protected cookie reader, keeps reading open, auto-loads after login and rejects late responses',async()=>{
 const previous={document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch,addEventListener:globalThis.addEventListener,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 const doc=fakeDocument(),timers=new Map(),events={},calls=[],sessionMeta=meta();let loggedIn=false,clock=0,delayed=false,release,chatStatus=200;
 const chats=[];
 globalThis.document=doc;globalThis.location={origin:'https://leafy-chimera-2403e5.netlify.app'};
 globalThis.addEventListener=(type,fn)=>(events[type]??=[]).push(fn);
 globalThis.setTimeout=(fn,ms)=>{const id=++clock;timers.set(id,{fn,ms});return id;};globalThis.clearTimeout=id=>timers.delete(id);
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url,'https://leafy-chimera-2403e5.netlify.app'),method=options.method||'GET';calls.push({path:u.pathname,method,query:u.search});
  if(u.pathname==='/api/server-chat-preview'){
   chats.push(JSON.parse(options.body));assert.equal(options.headers['X-CSRF-Token'],sessionMeta.csrfToken);
   return response(chatStatus===200?{synthetic:true,text:'Szintetikus szerverválasz',language:'hu'}:{error:'UNAVAILABLE'},chatStatus);
  }
  if(u.pathname.endsWith('/operator-session')){
   if(method==='POST'){const payload=JSON.parse(options.body);if(payload.action==='login')loggedIn=true;if(payload.action==='logout')loggedIn=false;}
   return loggedIn?response(sessionMeta):response({error:'AUTH_REQUIRED'},401);
  }
  if(u.pathname.endsWith('/booking-cases')){
   if(!loggedIn)return response({error:'AUTH_REQUIRED'},401);
   if(u.searchParams.get('action')==='review-record'){
    if(delayed)await new Promise(resolve=>{release=resolve;});
    return response({result:{tenantId:'sarberki-test',caseId:'case-synthetic',revision:1,canEditDraft:false,canApproveDraft:false,data:{state:{approval:'pending',revision:0,values:{arrival:'2026-11-20',departure:'2026-11-22',guests:2,unit:'Deluxe'}},messages:[{text:'Kitalált vendég eredeti üzenete'}],drafts:[]}}});
   }
   return response({result:[{tenantId:'sarberki-test',caseId:'case-synthetic',revision:1,category:'incoming'}]});
  }
  throw Error('unexpected endpoint');
 };
 try{
  await import(pathToFileURL(resolve('napi-kezelo/napi.mjs')).href+'?synthetic=1');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(doc.elements['load-cases'].disabled,true);
  assert.match(doc.elements['session-status'].textContent,/bejelentkezés/iu);
  await doc.nav[1].dispatch('click');assert.equal(doc.elements['section-heading'].textContent,'Jóváhagyásra vár');
  doc.elements.email.value='reader@synthetic.invalid';doc.elements.password.value='SYNTHETIC_ONLY';
  await doc.elements.login.dispatch('submit');assert.equal(doc.elements.password.value,'');assert.equal(doc.elements['load-cases'].disabled,false);
  assert.equal(doc.elements['chat-send'].disabled,false);
  assert.equal(doc.elements['case-list'].children.length,1);
  assert.doesNotMatch(doc.elements['list-status'].textContent,/jelentkezzen be/iu);
  doc.elements['chat-input'].value='Kitalált első üzenet';await doc.elements['chat-form'].dispatch('submit');
  assert.equal(doc.elements['chat-output'].textContent,'Szintetikus szerverválasz');
  doc.elements['chat-input'].value='Kitalált második üzenet';chatStatus=429;await doc.elements['chat-form'].dispatch('submit');
  assert.match(doc.elements['chat-output'].textContent,/Várjon egy percet/);
  chatStatus=200;await doc.elements['chat-form'].dispatch('submit');
  assert.deepEqual(chats[2].messages,['Kitalált első üzenet','Kitalált második üzenet']);
  await doc.elements['chat-reset'].dispatch('click');assert.equal(doc.elements['chat-output'].textContent,'');
  doc.elements['chat-input'].value='Új szintetikus kérés';await doc.elements['chat-form'].dispatch('submit');
  assert.deepEqual(chats[3].messages,['Új szintetikus kérés']);
  await doc.nav[0].dispatch('click');await doc.elements['load-cases'].dispatch('click');assert.equal(doc.elements['case-list'].children.length,1);
  assert.match(doc.elements['list-status'].textContent,/kategória/);
  const row=doc.elements['case-list'].children[0];await row.children[1].dispatch('click');
  assert.equal(doc.elements['case-detail'].hidden,false);
  assert.match(doc.elements['detail-facts'].textContent,/2026-11-20/);
  assert.equal(doc.elements['detail-messages'].children[0].textContent,'Kitalált vendég eredeti üzenete');
  assert.match(doc.elements['detail-capacity'].textContent,/nem igazolt/);
  assert.doesNotMatch(doc.elements['detail-draft'].textContent,/UNVERIFIED_DRAFT/);
  assert.match(doc.elements['detail-link'].href,/cloud-approval\.html\?caseId=case-synthetic/);
  assert.equal([...timers.values()].some(t=>t.ms===30000),false);
  for(const timer of [...timers.values()])timer.fn();
  assert.equal(doc.elements['case-detail'].hidden,false);assert.equal(doc.elements['case-list'].children.length,1);
  await doc.elements['load-cases'].dispatch('click');const btn=doc.elements['case-list'].children[0].children[1];
  delayed=true;const pending=btn.dispatch('click');
  for(let i=0;i<10&&!release;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(typeof release,'function');doc.visibilityState='hidden';await doc.dispatch('visibilitychange');release();await pending;
  assert.equal(doc.elements['case-detail'].hidden,true);assert.equal(doc.elements['detail-summary'].textContent,'');
  assert.equal(doc.elements['case-list'].children.length,0);assert.equal(doc.elements['load-cases'].disabled,true);
  assert.equal(doc.elements['chat-output'].textContent,'');assert.equal(doc.elements['chat-send'].disabled,true);
  delayed=false;doc.visibilityState='visible';await doc.dispatch('visibilitychange');
  for(let i=0;i<10&&!doc.elements['case-list'].children.length;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(doc.elements['case-list'].children.length,1);
  assert.equal(doc.elements['case-detail'].hidden,true);
  assert.ok(calls.filter(x=>x.path.endsWith('/booking-cases')).every(x=>x.method==='GET'));
  assert.ok(calls.filter(x=>x.path.endsWith('/booking-cases')).every(x=>new URLSearchParams(x.query).get('tenantId')==='sarberki-test'));
 }finally{Object.assign(globalThis,previous);}
});

test('distinct daily PWA route retains original test app and never invents statuses or active write buttons',()=>{
 const html=fs.readFileSync('napi-kezelo/index.html','utf8'),manifest=JSON.parse(fs.readFileSync('napi-kezelo/manifest.webmanifest','utf8'));
 for(const text of ['Beérkezett','Jóváhagyásra','Folyamatban','Lezárt','Válasz szerkesztése','Elutasítás'])assert.ok(html.includes(text));
 assert.equal(manifest.id,'/napi-kezelo/');assert.equal(manifest.scope,'/napi-kezelo/');assert.equal(manifest.start_url,'/napi-kezelo/');
 assert.match(html,/közös ügytár tárolt állapotát/iu);
 assert.match(html,/<textarea id="draft-editor"[^>]+disabled>/u);
 assert.match(html,/<button id="approve-draft"[^>]+disabled>/u);
 assert.match(html,/<button type="button" disabled>Elutasítás<\/button>/u);
 assert.ok(fs.existsSync('index.html'));assert.ok(fs.existsSync('cloud-approval.html'));
});
