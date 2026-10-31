import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

class Element {
 constructor(){this.textContent='';this.value='';this.hidden=false;this.disabled=false;this.href='';this.dataset={};this.listeners={};this.children=[];this.attributes={};}
 focus(){this.focused=true;}
 scrollIntoView(options){this.scrollOptions=options;}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 setAttribute(key,value){this.attributes[key]=value;}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children.flatMap(x=>x.fragment?x.children:[x]);}
 async dispatch(type,event={}){for(const fn of this.listeners[type]||[])await fn({preventDefault(){},...event});}
}
function fakeDocument(){
 const ids=['count-incoming','count-approval','count-progress','count-closed','cases-panel','cases-title','email-picker','email-picker-wrap','email-previous','email-next','read-email','email-status','email-list','email-detail','email-draft-request','email-draft-status','email-draft-text','email-draft-review','email-draft-checks','draft-editor','save-draft','approve-draft','approve-confirm','detail-messages','detail-facts','chat-form','chat-input','chat-output','chat-send','chat-reset','login','logout','email','password','session-status','load-cases','list-status','case-list','case-detail','detail-status','detail-summary','detail-capacity','detail-price','detail-draft','detail-link','section-heading','section-description'];
 const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
 const nav=['incoming','approval','progress','closed'].map(section=>{const e=new Element();e.dataset.section=section;return e;});
 const listeners={};
 const classes=new Set(),body={classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c)}};
 return {elements,nav,body,visibilityState:'visible',getElementById:id=>elements[id],querySelectorAll:()=>nav,querySelector:()=>({content:'synthetic-client'}),
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
 const doc=fakeDocument(),timers=new Map(),events={},calls=[],sessionMeta=meta();let loggedIn=false,clock=0,delayed=false,release,chatStatus=200,reviewable=false;
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
   // Answer only the real server actions, so a rewired list or review read fails visibly.
   const action=u.searchParams.get('action');
   if(action==='review-record'){
    if(delayed)await new Promise(resolve=>{release=resolve;});
    const drafts=reviewable?[{text:'Kitalált, tárolt válasz.',operatorReviewText:'Kitalált ellenőrző összefoglaló',synthetic:true,reviewStatus:'internal_review_required',revision:0,basedOnMessageCount:1}]:[];
    return response({result:{tenantId:'sarberki-test',caseId:'case-synthetic',revision:1,canEditDraft:reviewable,canApproveDraft:false,data:{state:{approval:'pending',revision:0,values:{arrival:'2026-11-20',departure:'2026-11-22',guests:2,unit:'Deluxe'}},messages:[{text:'Kitalált vendég eredeti üzenete'}],drafts}}});
   }
   if(action==='daily-list')return response({result:[{tenantId:'sarberki-test',caseId:'case-synthetic',revision:1,category:'incoming'}]});
   return response({error:'INVALID_INPUT'},400);
  }
  throw Error('unexpected endpoint');
 };
 try{
  await import(pathToFileURL(resolve('napi-kezelo/napi.mjs')).href+'?synthetic=1');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(doc.elements['load-cases'].disabled,true);
  assert.match(doc.elements['session-status'].textContent,/bejelentkezés/iu);
  await doc.nav[1].dispatch('click');assert.equal(doc.elements['section-heading'].textContent,'Jóváhagyásra vár');
  assert.equal(doc.elements['cases-title'].focused,true);assert.equal(doc.elements['cases-panel'].scrollOptions.block,'start');
  assert.match(doc.elements['list-status'].textContent,/jelentkezzen be/);assert.equal(doc.elements['count-approval'].textContent,'Nincs betöltve');
  doc.elements.email.value='reader@synthetic.invalid';doc.elements.password.value='SYNTHETIC_ONLY';
  await doc.elements.login.dispatch('submit');assert.equal(doc.elements.password.value,'');assert.equal(doc.elements['load-cases'].disabled,false);
  assert.equal(doc.elements['chat-send'].disabled,false);
  assert.equal(doc.elements['case-list'].children.length,1);
  assert.equal(doc.elements['count-incoming'].textContent,'1 ügy');assert.equal(doc.elements['count-closed'].textContent,'0 ügy');
  await doc.nav[3].dispatch('click');assert.equal(doc.elements['case-list'].children.length,0);
  assert.match(doc.elements['list-status'].textContent,/nincs elérhető tárolt tesztügy/);
  assert.match(doc.elements['cases-title'].textContent,/Lezárt ügyek/);
  assert.match(doc.elements['section-description'].textContent,/még nincs bekötve/);await doc.nav[0].dispatch('click');
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
  assert.equal(typeof release,'function');doc.visibilityState='hidden';await doc.dispatch('visibilitychange');
  // App switch conceals the view but keeps the in-memory state; nothing is cleared or re-read.
  assert.equal(doc.body.classList.contains('concealed'),true);release();await pending;
  assert.equal(doc.elements['case-list'].children.length,1);assert.equal(doc.elements['load-cases'].disabled,false);
  assert.equal(doc.elements['chat-output'].textContent,'Szintetikus szerverválasz');
  const listsBefore=calls.filter(x=>new URLSearchParams(x.query).get('action')==='daily-list').length;
  delayed=false;doc.visibilityState='visible';await doc.dispatch('visibilitychange');
  for(let i=0;i<10&&doc.body.classList.contains('concealed');i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(doc.body.classList.contains('concealed'),false);
  assert.equal(calls.filter(x=>new URLSearchParams(x.query).get('action')==='daily-list').length,listsBefore);
  assert.equal(doc.elements['case-list'].children.length,1);
  assert.equal(doc.elements['case-detail'].hidden,false);assert.match(doc.elements['detail-facts'].textContent,/2026-11-20/);
  // A current reviewable draft opens the editor only through a second review-record read.
  reviewable=true;const before=calls.length;await doc.elements['case-list'].children[0].children[1].dispatch('click');
  for(let i=0;i<10&&doc.elements['draft-editor'].disabled;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(doc.elements['draft-editor'].disabled,false);assert.equal(doc.elements['draft-editor'].value,'Kitalált, tárolt válasz.');
  assert.deepEqual(calls.slice(before).filter(x=>x.path.endsWith('/booking-cases')).map(x=>new URLSearchParams(x.query).get('action')),['review-record','review-record']);
  assert.ok(calls.filter(x=>x.path.endsWith('/booking-cases')).every(x=>x.method==='GET'));
  assert.ok(calls.some(x=>new URLSearchParams(x.query).get('action')==='daily-list'));
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

test('iPhone app switch keeps session, open case and unsaved edit; idle-expired server session locks and clears; activity is throttled',async()=>{
 const previous={document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch,addEventListener:globalThis.addEventListener,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,now:Date.now};
 const doc=fakeDocument(),events={},calls=[],sessionMeta=meta();let loggedIn=false,idleExpired=false,clock=Date.now();
 globalThis.document=doc;globalThis.location={origin:'https://leafy-chimera-2403e5.netlify.app'};
 globalThis.addEventListener=(type,fn)=>(events[type]??=[]).push(fn);globalThis.setTimeout=()=>0;globalThis.clearTimeout=()=>{};Date.now=()=>clock;
 const fire=async(type,event={})=>{for(const fn of events[type]||[])await fn(event);};
 const settle=async()=>{for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));};
 const count=pred=>calls.filter(pred).length,restores=()=>count(x=>x.path.endsWith('/operator-session')&&x.method==='GET');
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url,'https://leafy-chimera-2403e5.netlify.app'),method=options.method||'GET';calls.push({path:u.pathname,method,query:u.search});
  if(u.pathname.endsWith('/operator-session')){
   if(method==='POST'){const payload=JSON.parse(options.body);if(payload.action==='login'){loggedIn=true;idleExpired=false;}if(payload.action==='logout')loggedIn=false;}
   return loggedIn&&!idleExpired?response({...sessionMeta,expiresAt:new Date(clock+3600000).toISOString()}):response({error:'AUTH_REQUIRED'},401);
  }
  if(u.pathname.endsWith('/booking-cases')){
   if(!loggedIn||idleExpired)return response({error:'AUTH_REQUIRED'},401);
   const action=u.searchParams.get('action');
   if(action==='daily-list')return response({result:[{tenantId:'sarberki-test',caseId:'case-synthetic',revision:1,category:'incoming'}]});
   if(action==='review-record')return response({result:{tenantId:'sarberki-test',caseId:'case-synthetic',revision:1,canEditDraft:true,canApproveDraft:false,data:{state:{approval:'pending',revision:0,values:{arrival:'2026-11-20',departure:'2026-11-22',guests:2,unit:'Deluxe'}},messages:[{text:'Kitalált vendég eredeti üzenete'}],drafts:[{text:'Kitalált, tárolt válasz.',operatorReviewText:'Kitalált ellenőrző összefoglaló',synthetic:true,reviewStatus:'internal_review_required',revision:0,basedOnMessageCount:1}]}}});
   return response({error:'INVALID_INPUT'},400);
  }
  throw Error('unexpected endpoint');
 };
 try{
  await import(pathToFileURL(resolve('napi-kezelo/napi.mjs')).href+'?synthetic=app-switch');await settle();
  doc.elements.email.value='writer@synthetic.invalid';doc.elements.password.value='SYNTHETIC_ONLY';await doc.elements.login.dispatch('submit');await settle();
  await doc.elements['case-list'].children[0].children[1].dispatch('click');await settle();
  assert.equal(doc.elements['draft-editor'].disabled,false);
  doc.elements['draft-editor'].value='Kezelő félkész, nem mentett szerkesztése';await doc.elements['draft-editor'].dispatch('input');
  for(const minutes of [1,5,15,29]){
   const before=restores(),lists=count(x=>new URLSearchParams(x.query).get('action')==='daily-list');
   doc.visibilityState='hidden';await doc.dispatch('visibilitychange');assert.equal(doc.body.classList.contains('concealed'),true);
   assert.equal(restores(),before,'hiding makes no request');
   clock+=minutes*60000;doc.visibilityState='visible';await doc.dispatch('visibilitychange');await settle();
   assert.equal(restores(),before+1,'return verifies the server session once');
   assert.equal(doc.body.classList.contains('concealed'),false);assert.equal(doc.elements.logout.hidden,false);
   assert.equal(doc.elements['draft-editor'].value,'Kezelő félkész, nem mentett szerkesztése',String(minutes));
   assert.equal(doc.elements['case-detail'].hidden,false);assert.equal(doc.elements['case-list'].children.length,1);
   assert.equal(count(x=>new URLSearchParams(x.query).get('action')==='daily-list'),lists,'no forced reload');
  }
  // Back/forward cache: pagehide/pageshow(persisted) behaves the same.
  await fire('pagehide',{persisted:true});assert.equal(doc.body.classList.contains('concealed'),true);
  await fire('pageshow',{persisted:true});await settle();assert.equal(doc.body.classList.contains('concealed'),false);
  assert.equal(doc.elements['draft-editor'].value,'Kezelő félkész, nem mentett szerkesztése');
  // Activity keeps the server idle deadline sliding, at most once per 5 minutes.
  let before=restores();await doc.dispatch('pointerdown');await doc.dispatch('keydown');await settle();assert.equal(restores(),before);
  clock+=5*60000+1;await doc.dispatch('pointerdown');await settle();assert.equal(restores(),before+1);
  await doc.dispatch('keydown');await settle();assert.equal(restores(),before+1);
  doc.visibilityState='hidden';await doc.dispatch('pointerdown');await settle();assert.equal(restores(),before+1,'no ping while hidden');doc.visibilityState='visible';
  // 30 minutes of real inactivity: the server rejects; the view locks and clears protected state.
  doc.visibilityState='hidden';await doc.dispatch('visibilitychange');clock+=30*60000;idleExpired=true;
  doc.visibilityState='visible';await doc.dispatch('visibilitychange');await settle();
  assert.equal(doc.body.classList.contains('concealed'),false);assert.equal(doc.elements.login.hidden,false);assert.equal(doc.elements.logout.hidden,true);
  assert.match(doc.elements['session-status'].textContent,/lejárt/);
  assert.equal(doc.elements['draft-editor'].value,'');assert.equal(doc.elements['case-detail'].hidden,true);assert.equal(doc.elements['case-list'].children.length,0);
  assert.equal(doc.elements['load-cases'].disabled,true);
  // Login again, then explicit logout clears protected local state.
  doc.elements.email.value='writer@synthetic.invalid';doc.elements.password.value='SYNTHETIC_ONLY';await doc.elements.login.dispatch('submit');await settle();
assert.equal(doc.elements['case-list'].children.length,1);
  await doc.elements.logout.dispatch('click');await settle();
  assert.equal(doc.elements['case-list'].children.length,0);assert.equal(doc.elements['draft-editor'].value,'');assert.equal(doc.elements.login.hidden,false);
  // Unauthenticated hide/show never reveals data or skips login.
  doc.visibilityState='hidden';await doc.dispatch('visibilitychange');doc.visibilityState='visible';await doc.dispatch('visibilitychange');await settle();
  assert.equal(doc.elements.login.hidden,false);assert.equal(doc.elements['case-list'].children.length,0);
 }finally{Object.assign(globalThis,{document:previous.document,location:previous.location,fetch:previous.fetch,addEventListener:previous.addEventListener,setTimeout:previous.setTimeout,clearTimeout:previous.clearTimeout});Date.now=previous.now;}
});
