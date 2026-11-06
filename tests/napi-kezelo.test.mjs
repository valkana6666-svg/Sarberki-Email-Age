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
 const ids=['count-incoming','count-followup','count-approval','count-progress','count-closed','cases-panel','cases-title','email-picker','email-picker-wrap','email-previous','email-next','read-email','email-status','email-list','email-detail','email-draft-request','email-draft-status','email-draft-text','email-draft-review','email-draft-checks','draft-editor','save-draft','approve-draft','approve-confirm','return-draft','reject-draft','decision-reason','email-save-case','email-save-status','detail-messages','detail-facts','chat-form','chat-input','chat-output','chat-send','chat-reset','login','logout','email','password','session-status','load-cases','list-status','case-list','case-detail','detail-status','detail-summary','detail-capacity','detail-price','detail-draft','copy-approved','send-approved','price-panel','price-cabin','price-calc','price-result','price-available','price-insert','unavailable-confirm','unavailable-insert','unavailable-result','detail-link','section-heading','section-description'];
 const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
 const nav=['incoming','followup','approval','progress','closed'].map(section=>{const e=new Element();e.dataset.section=section;return e;});
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
  await doc.nav[2].dispatch('click');assert.equal(doc.elements['section-heading'].textContent,'Jóváhagyásra vár');
  assert.equal(doc.elements['cases-title'].focused,true);assert.equal(doc.elements['cases-panel'].scrollOptions.block,'start');
  assert.match(doc.elements['list-status'].textContent,/jelentkezzen be/);assert.equal(doc.elements['count-approval'].textContent,'Nincs betöltve');
  doc.elements.email.value='reader@synthetic.invalid';doc.elements.password.value='SYNTHETIC_ONLY';
  await doc.elements.login.dispatch('submit');assert.equal(doc.elements.password.value,'');assert.equal(doc.elements['load-cases'].disabled,false);
  assert.equal(doc.elements['chat-send'].disabled,false);
  assert.equal(doc.elements['case-list'].children.length,1);
  assert.equal(doc.elements['count-incoming'].textContent,'1 foglalás');assert.equal(doc.elements['count-closed'].textContent,'0 foglalás');
  await doc.nav[4].dispatch('click');assert.equal(doc.elements['case-list'].children.length,0);
  assert.match(doc.elements['list-status'].textContent,/nincs elérhető tárolt tesztfoglalás/);
  assert.match(doc.elements['cases-title'].textContent,/Lezárt foglalások/);
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
 assert.match(html,/közös foglalástár tárolt állapotát/iu);
 assert.match(html,/<textarea id="draft-editor"[^>]+disabled>/u);
 assert.match(html,/<button id="approve-draft"[^>]+disabled>/u);
 assert.match(html,/<button id="reject-draft" type="button" disabled>Elutasítás<\/button>/u);assert.match(html,/<button id="return-draft" type="button" disabled>/u);
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

test('iPhone return with a transient session-check failure must not wipe mail/case state; a later tap retries; reload is detected without storing data',async()=>{
 const previous={document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch,addEventListener:globalThis.addEventListener,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,localStorage:globalThis.localStorage,now:Date.now};
 const doc=fakeDocument(),events={},calls=[],sessionMeta=meta(),stored=new Map();let loggedIn=false,networkDown=false,clock=Date.now();
 const storage={getItem:k=>stored.has(k)?stored.get(k):null,setItem:(k,v)=>stored.set(k,String(v)),removeItem:k=>stored.delete(k)};
 globalThis.document=doc;globalThis.location={origin:'https://leafy-chimera-2403e5.netlify.app'};globalThis.localStorage=storage;
 globalThis.addEventListener=(type,fn)=>(events[type]??=[]).push(fn);globalThis.setTimeout=()=>0;globalThis.clearTimeout=()=>{};Date.now=()=>clock;
 const settle=async()=>{for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));};
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url,'https://leafy-chimera-2403e5.netlify.app'),method=options.method||'GET';calls.push({path:u.pathname,method,query:u.search});
  if(networkDown)throw new TypeError('Load failed');
  if(u.pathname.endsWith('/operator-session')){
   if(method==='POST'){const payload=JSON.parse(options.body);if(payload.action==='login')loggedIn=true;if(payload.action==='logout')loggedIn=false;}
   return loggedIn?response({...sessionMeta,expiresAt:new Date(clock+3600000).toISOString()}):response({error:'AUTH_REQUIRED'},401);
  }
  if(u.pathname.endsWith('/booking-cases')){
   const action=u.searchParams.get('action');
   if(action==='daily-list')return response({result:[{tenantId:'sarberki-test',caseId:'case-synthetic',revision:1,category:'incoming'}]});
   if(action==='review-record')return response({result:{tenantId:'sarberki-test',caseId:'case-synthetic',revision:1,canEditDraft:true,canApproveDraft:false,data:{state:{approval:'pending',revision:0,values:{arrival:'2026-11-20',departure:'2026-11-22',guests:2,unit:'Deluxe'}},messages:[{text:'Kitalált vendég eredeti üzenete'}],drafts:[{text:'Kitalált, tárolt válasz.',operatorReviewText:'Kitalált ellenőrző összefoglaló',synthetic:true,reviewStatus:'internal_review_required',revision:0,basedOnMessageCount:1}]}}});
   return response({error:'INVALID_INPUT'},400);
  }
  throw Error('unexpected endpoint');
 };
 try{
  await import(pathToFileURL(resolve('napi-kezelo/napi.mjs')).href+'?synthetic=transient-return');await settle();
  doc.elements.email.value='writer@synthetic.invalid';doc.elements.password.value='SYNTHETIC_ONLY';await doc.elements.login.dispatch('submit');await settle();
  await doc.elements['case-list'].children[0].children[1].dispatch('click');await settle();
  doc.elements['draft-editor'].value='Proba123';await doc.elements['draft-editor'].dispatch('input');
  const mailStatus=doc.elements['email-status'].textContent;
  // App switch; on return the first session check fails transiently (iOS network not yet up).
  doc.visibilityState='hidden';await doc.dispatch('visibilitychange');
  assert.deepEqual([...stored.keys()],['sarberki-napi-concealed-at'],'marker must outlive an iOS relaunch (localStorage)');
  assert.match(stored.get('sarberki-napi-concealed-at'),/^\d+$/,'only a non-sensitive timestamp may be stored');
  networkDown=true;clock+=60000;doc.visibilityState='visible';await doc.dispatch('visibilitychange');await settle();
  assert.equal(doc.body.classList.contains('concealed'),true,'stays concealed, not wiped');
  assert.equal(doc.elements['draft-editor'].value,'Proba123');assert.equal(doc.elements['case-list'].children.length,1);
  assert.equal(doc.elements['email-status'].textContent,mailStatus,'mail reader not cleared');assert.equal(doc.elements.logout.hidden,false);
  // Repeated visibility while still offline must not silently relogin into an empty view either.
  await doc.dispatch('visibilitychange');await settle();assert.equal(doc.elements['draft-editor'].value,'Proba123');
  // A tap retries once the network is back; state is intact.
  networkDown=false;await doc.dispatch('pointerdown');await settle();
  assert.equal(doc.body.classList.contains('concealed'),false);assert.equal(doc.elements['draft-editor'].value,'Proba123');
  assert.equal(doc.elements['case-detail'].hidden,false);assert.equal(stored.size,0,'marker removed after a normal return');
  // Transient failure of the background activity refresh never wipes state.
  clock+=6*60000;networkDown=true;await doc.dispatch('pointerdown');await settle();networkDown=false;
  assert.equal(doc.elements['draft-editor'].value,'Proba123');assert.equal(doc.elements.logout.hidden,false);
  // A real authorization failure on return still locks and clears.
  doc.visibilityState='hidden';await doc.dispatch('visibilitychange');loggedIn=false;doc.visibilityState='visible';await doc.dispatch('visibilitychange');await settle();
  assert.equal(doc.elements['draft-editor'].value,'');assert.equal(doc.elements.login.hidden,false);assert.equal(stored.size,0);
 }finally{Object.assign(globalThis,{document:previous.document,location:previous.location,fetch:previous.fetch,addEventListener:previous.addEventListener,setTimeout:previous.setTimeout,clearTimeout:previous.clearTimeout,localStorage:previous.localStorage});Date.now=previous.now;}
});

test('a page reload after an app switch (iOS discarded the tab) is reported honestly; nothing sensitive is restored',async()=>{
 const previous={document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch,addEventListener:globalThis.addEventListener,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,localStorage:globalThis.localStorage};
 const doc=fakeDocument(),stored=new Map([['sarberki-napi-concealed-at',String(Date.now()-120000)]]);
 globalThis.document=doc;globalThis.location={origin:'https://leafy-chimera-2403e5.netlify.app'};
 globalThis.localStorage={getItem:k=>stored.has(k)?stored.get(k):null,setItem:(k,v)=>stored.set(k,String(v)),removeItem:k=>stored.delete(k)};
 globalThis.addEventListener=()=>{};globalThis.setTimeout=()=>0;globalThis.clearTimeout=()=>{};
 globalThis.fetch=async url=>{const u=new URL(url,'https://leafy-chimera-2403e5.netlify.app');
  if(u.pathname.endsWith('/operator-session'))return response({...meta()});
  if(u.pathname.endsWith('/booking-cases'))return response({result:[]});throw Error('unexpected');};
 try{
  await import(pathToFileURL(resolve('napi-kezelo/napi.mjs')).href+'?synthetic=reloaded');for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));
  assert.equal(doc.elements.logout.hidden,false);
  assert.match(doc.elements['email-status'].textContent,/újratöltötte/);assert.match(doc.elements['email-status'].textContent,/nem tárol/);
  assert.equal(stored.size,0);assert.equal(doc.elements['email-list'].children.length,0);
 }finally{Object.assign(globalThis,previous);}
});

// Shared harness for the full daily page with a synthetic Google token client and Gmail API.
async function dailyPage(tag,{storage=new Map(),stateKey='5'.repeat(64),loggedIn=true}={}){
 const doc=fakeDocument(),events={},calls=[],sessionMeta={...meta(),stateKey};const server={loggedIn};
 const mailIds=['58f2a0b1c2d3e4f0','58f2a0b1c2d3e4f1','58f2a0b1c2d3e4f2'];
 const mail=id=>({id,threadId:id,labelIds:['INBOX'],internalDate:String(Date.parse('2026-10-30T12:00:00Z')-mailIds.indexOf(id)*60000),
  payload:{mimeType:'text/plain',headers:[{name:'Subject',value:'Sárberki élő teszt – AI előnézet '+mailIds.indexOf(id)},{name:'From',value:'Teszt <sarberkito@gmail.com>'}],
   body:{data:Buffer.from('Jó napot! Deluxe faházat szeretnénk foglalni 2027-05-14 és 2027-05-16 között 2 felnőtt, 0 gyermek számára.').toString('base64url')}}});
 const env={document:doc,location:{origin:'https://leafy-chimera-2403e5.netlify.app',search:''},localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
  google:{accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:()=>options.callback({access_token:'SYNTHETIC_TOKEN'})})}}},
  addEventListener:(type,fn)=>(events[type]??=[]).push(fn),setTimeout:()=>0,clearTimeout:()=>{}};
 env.fetch=async(url,options={})=>{
  const u=new URL(url,'https://leafy-chimera-2403e5.netlify.app'),method=options.method||'GET';calls.push({path:u.pathname,method,host:u.host,query:u.search});
  if(u.host==='gmail.googleapis.com'){
   if(u.pathname.endsWith('/profile'))return response({emailAddress:'sarberkiprojecttest@gmail.com'});
   if(u.pathname.endsWith('/messages'))return response({messages:mailIds.map(id=>({id}))});
   return response(mail(u.pathname.split('/').at(-1)));
  }
  if(u.pathname==='/build-info.mjs')return new Response('export const deployedCommit = "'+'a'.repeat(40)+'";\n');
  if(u.pathname.endsWith('/operator-session')){
   if(method==='POST'){const payload=JSON.parse(options.body);if(payload.action==='logout')server.loggedIn=false;if(payload.action==='login')server.loggedIn=true;}
   return server.loggedIn?response({...sessionMeta,expiresAt:new Date(Date.now()+3600000).toISOString()}):response({error:'AUTH_REQUIRED'},401);
  }
  if(u.pathname.endsWith('/booking-cases'))return response({result:Array.from({length:6},(_,i)=>({tenantId:'sarberki-test',caseId:'case-synthetic-'+i,revision:1,category:'incoming'}))});
  throw Error('unexpected endpoint '+u.href);
 };
 const keys=Object.keys(env),previous=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));Object.assign(globalThis,env);
 // WebCrypto completes on the libuv thread pool, so wait on real time rather than a fixed tick count.
 const settle=async(ms=60)=>{const end=performance.now()+ms;do await new Promise(resolve=>setImmediate(resolve));while(performance.now()<end);};
 await import(pathToFileURL(resolve('napi-kezelo/napi.mjs')).href+'?synthetic='+tag);await settle();
 return {doc,events,calls,server,storage,settle,restore(){Object.assign(globalThis,previous);}};
}

test('observed iPhone flow: 38-mail style read, AI preview, edit, app switch and return keeps mails, selection and edit (no re-read)',async()=>{
 const p=await dailyPage('observed-flow');
 try{
  const e=p.doc.elements;assert.equal(e.logout.hidden,false);assert.equal(e['case-list'].children.length,6);
  await e['read-email'].dispatch('click');await p.settle();
  assert.equal(e['email-list'].children.length,3);
  e['email-picker'].value='1';await e['email-picker'].dispatch('change');await e['email-draft-request'].dispatch('click');await p.settle();
  assert.match(e['email-draft-text'].value,/Kedves Vendégünk/);e['email-draft-text'].value='Proba123';
  const gmailReads=p.calls.filter(x=>x.host==='gmail.googleapis.com').length;
  p.doc.visibilityState='hidden';await p.doc.dispatch('visibilitychange');p.doc.visibilityState='visible';await p.doc.dispatch('visibilitychange');await p.settle();
  assert.equal(p.doc.body.classList.contains('concealed'),false);assert.equal(e.logout.hidden,false);
  assert.equal(e['email-list'].children.length,3,'mails kept');assert.equal(e['email-picker'].value,'1','selection kept');
  assert.equal(e['email-draft-text'].value,'Proba123','edited AI reply kept');assert.equal(e['case-list'].children.length,6);
  assert.equal(p.calls.filter(x=>x.host==='gmail.googleapis.com').length,gmailReads,'no Gmail re-read');
  for(const value of p.storage.values())for(const plain of ['Proba123','Jó napot','Sárberki élő teszt'])assert.equal(value.includes(plain),false,'stored only encrypted: '+plain);
 }finally{p.restore();}
});

test('iOS relaunch (new JS context, sessionStorage gone) is detected through a timestamp-only marker and reported',async()=>{
 const storage=new Map([['sarberki-napi-concealed-at',String(Date.now()-90000)]]);
 const p=await dailyPage('relaunch',{storage});
 try{
  assert.equal(p.doc.elements.logout.hidden,false);assert.equal(p.doc.elements['case-list'].children.length,6);
  assert.match(p.doc.elements['email-status'].textContent,/újratöltötte/);assert.equal(storage.size,0);
 }finally{p.restore();}
 // An old marker (beyond the 30 minute idle window) is ignored.
 const old=new Map([['sarberki-napi-concealed-at',String(Date.now()-31*60000)]]);
 const q=await dailyPage('relaunch-old',{storage:old});
 try{assert.doesNotMatch(q.doc.elements['email-status'].textContent,/újratöltötte/);assert.equal(old.size,0);}finally{q.restore();}
});

test('daily page shows the running build and flags a stale running version (existing version-status module)',async()=>{
 const html=fs.readFileSync('napi-kezelo/index.html','utf8');
 assert.match(html,/id="deployed_version"/);assert.match(html,/id="reload_version"/);
 assert.match(html,/<script type="module" src="\.\.\/sarberki-chatbot-project\/version-status\.mjs"><\/script>/);
});

// iPhone relaunch: encrypted, session-bound, 30 minute local snapshot restores list, selection and edited reply.
async function readPreviewEditHide(p,text='Proba123'){
 const e=p.doc.elements;await e['read-email'].dispatch('click');await p.settle();
 e['email-picker'].value='1';await e['email-picker'].dispatch('change');await e['email-draft-request'].dispatch('click');await p.settle();
 e['email-draft-text'].value=text;await e['email-draft-text'].dispatch('input');
 p.doc.visibilityState='hidden';await p.doc.dispatch('visibilitychange');await p.settle();
}
test('relaunch restores mails, selection and edited AI reply from an encrypted snapshot without re-reading Gmail',async()=>{
 const storage=new Map(),first=await dailyPage('snapshot-save',{storage});
 try{await readPreviewEditHide(first);}finally{first.restore();}
 assert.deepEqual([...storage.keys()].sort(),['sarberki-napi-concealed-at','sarberki-napi-state']);
 const raw=storage.get('sarberki-napi-state');
 for(const plain of ['Proba123','Jó napot','Sárberki élő teszt','sarberkito@gmail.com','Kedves'])assert.equal(raw.includes(plain),false,'no plaintext: '+plain);
 const second=await dailyPage('snapshot-restore',{storage});
 try{
  const e=second.doc.elements;
  assert.equal(second.calls.filter(x=>x.host==='gmail.googleapis.com').length,0,'no Gmail re-read');
  assert.equal(e['email-list'].children.length,3);assert.equal(e['email-picker'].value,'1');
  assert.equal(e['email-draft-text'].value,'Proba123');assert.equal(e['email-draft-text'].disabled,false);
  assert.match(e['email-draft-checks'].children.map(x=>x.textContent).join('\n'),/Kapacitás: nem igazolt/);
  assert.match(e['email-status'].textContent,/visszaállítva/);assert.doesNotMatch(e['email-status'].textContent,/újratöltötte/);
  // The restored preview is still gated: another eligible mail can be previewed, nothing is stored unencrypted.
  assert.equal([...storage.values()].some(v=>v.includes('Proba123')),false);
  await e.logout.dispatch('click');await second.settle();
  assert.equal(storage.has('sarberki-napi-state'),false,'logout deletes the snapshot');assert.equal(e['email-list'].children.length,0);
 }finally{second.restore();}
});
test('snapshot is not restored with another login key, after 30 minutes, when tampered, or after an authorization failure',async()=>{
 const make=async tag=>{const storage=new Map(),p=await dailyPage(tag,{storage});try{await readPreviewEditHide(p);}finally{p.restore();}return storage;};
 // Different login (new key): unreadable, deleted, honest reload notice.
 let storage=await make('k1');let p=await dailyPage('k1b',{storage,stateKey:'6'.repeat(64)});
 try{assert.equal(p.doc.elements['email-list'].children.length,0);assert.equal(storage.has('sarberki-napi-state'),false);assert.match(p.doc.elements['email-status'].textContent,/újratöltötte/);}finally{p.restore();}
 // Older than 30 minutes.
 storage=await make('t1');const realNow=Date.now;Date.now=()=>realNow()+31*60000;
 try{p=await dailyPage('t1b',{storage});try{assert.equal(p.doc.elements['email-list'].children.length,0);assert.equal(storage.has('sarberki-napi-state'),false);}finally{p.restore();}}finally{Date.now=realNow;}
 // Tampered ciphertext.
 storage=await make('x1');const snap=JSON.parse(storage.get('sarberki-napi-state'));snap.data=snap.data.slice(0,-4)+(snap.data.endsWith('AAAA')?'BBBB':'AAAA');storage.set('sarberki-napi-state',JSON.stringify(snap));
 p=await dailyPage('x1b',{storage});try{assert.equal(p.doc.elements['email-list'].children.length,0);assert.equal(storage.has('sarberki-napi-state'),false);}finally{p.restore();}
 // Server rejects the session (logged out or idle): nothing restored, snapshot deleted.
 storage=await make('a1');p=await dailyPage('a1b',{storage,loggedIn:false});
 try{assert.equal(p.doc.elements.login.hidden,false);assert.equal(p.doc.elements['email-list'].children.length,0);assert.equal(storage.has('sarberki-napi-state'),false);}finally{p.restore();}
});

test('test-mailbox case: list and open, Writer redraft, independent Approver return/reject/approve with revision+hash, no send/booking',async()=>{
 const previous={document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch,addEventListener:globalThis.addEventListener,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 const doc=fakeDocument(),posts=[],sessionMeta=meta(),caseId='tm-'+'ab'.repeat(8);let loggedIn=false,role='writer',failNext=null,skew=0;
 const hash=text=>[...text].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,7).toString(16).padStart(8,'0').repeat(8);
 const state={revision:1,approval:'pending',text:'Kitalált első tervezet.',decisions:[]};
 let guestValues={adults:'4',children:'0'},listPrefix=[];
 const settle=async()=>{for(let i=0;i<30;i++)await new Promise(resolve=>setImmediate(resolve));};
 globalThis.document=doc;globalThis.location={origin:'https://leafy-chimera-2403e5.netlify.app'};
 globalThis.addEventListener=()=>{};globalThis.setTimeout=()=>0;globalThis.clearTimeout=()=>{};
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url,'https://leafy-chimera-2403e5.netlify.app'),method=options.method||'GET';
  if(u.pathname.endsWith('/operator-session')){
   if(method==='POST'&&JSON.parse(options.body).action==='login')loggedIn=true;
   return loggedIn?response(sessionMeta):response({error:'AUTH_REQUIRED'},401);
  }
  if(!u.pathname.endsWith('/booking-cases'))throw Error('unexpected endpoint');
  if(!loggedIn)return response({error:'AUTH_REQUIRED'},401);
  if(method==='GET'){
   const action=u.searchParams.get('action');
   if(action==='daily-list')return response({result:[...listPrefix,{tenantId:'sarberki-test',caseId,revision:state.revision,category:state.approval==='pending'?'approval':'progress',kind:'test-mailbox'}]});
   if(action==='test-mailbox-record'){
    assert.equal(u.searchParams.get('caseId'),caseId);
    return response({result:{caseId,revision:state.revision,approval:state.approval,messages:[{text:'Kitalált tesztlevél',received_at:'2026-11-01T06:00:00Z'}],
     values:{arrival:'2026-11-20',departure:'2026-11-22',...guestValues,unit:'C'},draft:{text:state.text,operatorReviewText:'Kitalált ellenőrzés',hash:hash(state.text)},
     decisions:state.decisions,internalApproval:null,
     canEditDraft:role==='writer'&&['pending','returned_for_edit','rejected'].includes(state.approval),canDecide:role==='approver'&&state.approval==='pending'}});
   }
   return response({error:'INVALID_INPUT'},400);
  }
  const body=JSON.parse(options.body);posts.push(body);
  if(failNext){const error=failNext;failNext=null;return response({error},error==='FORBIDDEN'?403:409);}
  assert.equal(body.expectedRevision,state.revision);
  if(body.action==='test-mailbox-redraft'){state.text=body.draftText;state.approval='pending';}
  else if(body.action==='test-mailbox-unavailable'){assert.equal(body.unavailableConfirmed,true);state.text='Kitalált nincs-szabad válasz.';state.approval='pending';}
  else if(body.action==='test-mailbox-decide'){
   assert.equal(body.reviewedDraftHash,hash(state.text));
   state.approval={approve:'approved_internal',return:'returned_for_edit',reject:'rejected'}[body.decision];
   state.decisions.push({decision:body.decision,at:'2026-11-01T06:10:00Z',reason:body.reason??null,reviewedRevision:state.revision});
  }else return response({error:'INVALID_INPUT'},400);
  state.revision++;return response({result:{caseId,revision:state.revision+skew,approval:state.approval}});
 };
 const e=doc.elements,open=async()=>{await e['load-cases'].dispatch('click');await settle();await doc.nav[state.approval==='pending'?2:3].dispatch('click');await e['case-list'].children[0].children[1].dispatch('click');await settle();};
 try{
  await import(pathToFileURL(resolve('napi-kezelo/napi.mjs')).href+'?test-mailbox=1');await settle();
  e.email.value='writer@synthetic.invalid';e.password.value='SYNTHETIC_ONLY';await e.login.dispatch('submit');await settle();
  assert.equal(e['count-approval'].textContent,'1 foglalás');
  await open();
  // A newly inserted case must not rename an existing mailbox case (observed iPhone confusion).
  const originalLabel=e['case-list'].children[0].children[0].textContent;
  listPrefix=[{tenantId:'sarberki-test',caseId:'tm-'+'cd'.repeat(8),revision:1,category:'incoming',kind:'test-mailbox'}];
  await open();
  assert.equal(e['case-list'].children[0].children[0].textContent,originalLabel);
  assert.ok(originalLabel.includes(caseId),'visible label carries the stable case identity');
  assert.equal(e['case-list'].children[0].children[1].attributes['aria-label'],originalLabel+' megnyitása');
  // Live case shape: adults/children are known while the separate guests field is absent.
  assert.match(e['detail-facts'].textContent,/Létszám: 4 felnőtt, 0 gyermek/);
  for(const [values,expected] of [
   [{guests:6,adults:'4',children:'2'},'6'],
   [{adults:'4'},'4 felnőtt'],
   [{children:2},'2 gyermek'],
   [{adults:'4',children:''},'4 felnőtt'],
   [{},'Nincs megadva'],
   [{adults:-1,children:'ismeretlen'},'Nincs megadva'],
   [{adults:'4.5',children:false},'Nincs megadva']
  ]){
   guestValues=values;await open();
   assert.equal(e['detail-facts'].textContent.split('Létszám: ')[1].split('\n')[0],expected);
  }
  guestValues={adults:'4',children:'0'};await open();
  assert.equal(e['detail-draft'].textContent,'Kitalált első tervezet.');assert.match(e['detail-capacity'].textContent,/szabad helyet a rendszer nem ellenőrzi.*kézi Previo-ellenőrzés/);
  assert.match(e['detail-status'].textContent,/^Jóváhagyásra vár\./);
  // Writer: may edit, may not decide.
  assert.equal(e['draft-editor'].disabled,false);assert.equal(e['approve-confirm'].disabled,true);assert.equal(e['reject-draft'].disabled,true);
  assert.equal(e['save-draft'].disabled,true);
  e['draft-editor'].value='Kitalált második tervezet.';await e['draft-editor'].dispatch('input');assert.equal(e['save-draft'].disabled,false);
  await e['save-draft'].dispatch('click');await settle();
  assert.deepEqual(posts.at(-1),{tenantId:'sarberki-test',caseId,action:'test-mailbox-redraft',expectedRevision:1,draftText:'Kitalált második tervezet.'});
  assert.match(e['detail-status'].textContent,/Új tervezet mentve és visszaolvasva/);assert.equal(e['detail-draft'].textContent,'Kitalált második tervezet.');
  // Approver: return with reason, decide buttons need pending state.
  role='approver';await open();
  assert.equal(e['draft-editor'].disabled,true);assert.equal(e['approve-confirm'].disabled,false);assert.equal(e['return-draft'].disabled,false);
  assert.equal(e['approve-draft'].disabled,true);
  e['decision-reason'].value='Kitalált indok';await e['return-draft'].dispatch('click');await settle();
  assert.deepEqual(posts.at(-1),{tenantId:'sarberki-test',caseId,action:'test-mailbox-decide',decision:'return',expectedRevision:2,reviewedDraftHash:hash('Kitalált második tervezet.'),reason:'Kitalált indok'});
  assert.match(e['detail-status'].textContent,/Visszaküldés mentve/);assert.match(e['detail-price'].textContent,/visszaküldve javításra.*Kitalált indok/);
  assert.equal(e['return-draft'].disabled,true);assert.equal(e['approve-confirm'].disabled,true);
  // Writer redrafts, Approver rejects (case stays open), Writer reopens, Approver approves internally.
  role='writer';await open();e['draft-editor'].value='Kitalált harmadik tervezet.';await e['draft-editor'].dispatch('input');await e['save-draft'].dispatch('click');await settle();
  role='approver';await open();await e['reject-draft'].dispatch('click');await settle();
  assert.equal(posts.at(-1).decision,'reject');assert.equal(Object.hasOwn(posts.at(-1),'reason'),false);
  assert.match(e['detail-status'].textContent,/Elutasítás mentve.*nyitva marad/);
  role='writer';await open();assert.match(e['detail-status'].textContent,/Elutasítva/);assert.equal(e['draft-editor'].disabled,false);
  // "No free cabin": needs its own confirmation, unticks the price checkbox, server builds the text (no browser text).
  assert.equal(e['unavailable-confirm'].disabled,false);assert.equal(e['unavailable-insert'].disabled,true);
  const noFreeCount=posts.length;await e['unavailable-insert'].dispatch('click');await settle();assert.equal(posts.length,noFreeCount,'no request without the confirmation');
  e['price-available'].checked=true;e['unavailable-confirm'].checked=true;await e['unavailable-confirm'].dispatch('change');
  assert.equal(e['price-available'].checked,false);assert.equal(e['price-insert'].disabled,true);assert.equal(e['unavailable-insert'].disabled,false);
  await e['unavailable-insert'].dispatch('click');await settle();
  assert.deepEqual(posts.at(-1),{tenantId:'sarberki-test',caseId,action:'test-mailbox-unavailable',expectedRevision:5,unavailableConfirmed:true});
  assert.match(e['detail-status'].textContent,/Nincs szabad hely.*ár nélkül/);assert.equal(e['detail-draft'].textContent,'Kitalált nincs-szabad válasz.');
  assert.equal(e['unavailable-confirm'].checked,false);assert.equal(e['unavailable-insert'].disabled,true);
  e['draft-editor'].value='Kitalált negyedik tervezet.';await e['draft-editor'].dispatch('input');await e['save-draft'].dispatch('click');await settle();
  role='approver';await open();
  assert.equal(e['copy-approved'].hidden,true,'a pending draft cannot be copied for sending');
  assert.equal(e['send-approved'].hidden,true,'a pending draft cannot be sent');
  // Price panel: visible on the case; a failed calculation is reported and nothing can be inserted.
  assert.equal(e['price-panel'].hidden,false);const priceCount=posts.length;
  await e['price-calc'].dispatch('click');await settle();
  assert.equal(posts.length,priceCount);assert.match(e['price-result'].textContent,/^Az ár nem számítható: .*kézzel ellenőrizze\.$/u);assert.equal(e['price-insert'].disabled,true);
  await e['approve-draft'].dispatch('click');await settle();
  assert.equal(posts.at(-1).action,'test-mailbox-redraft','approval needs the confirmation checkbox');
  e['approve-confirm'].checked=true;await e['approve-confirm'].dispatch('change');assert.equal(e['approve-draft'].disabled,false);
  await e['approve-draft'].dispatch('click');await settle();
  assert.deepEqual(posts.at(-1),{tenantId:'sarberki-test',caseId,action:'test-mailbox-decide',decision:'approve',expectedRevision:7,reviewedDraftHash:hash('Kitalált negyedik tervezet.')});
  assert.match(e['detail-status'].textContent,/Belső jóváhagyás mentve.*Nincs levélküldés vagy Previo-foglalás/);
  assert.equal(e['approve-confirm'].disabled,true);assert.equal(e['draft-editor'].disabled,true);
  // Approved text can be copied for a MANUAL Gmail reply; nothing is sent and no request is made.
  assert.equal(e['copy-approved'].hidden,false);
  // Send: visible only when approved; without the Google script the operator is asked to press again and no request is made.
  assert.equal(e['send-approved'].hidden,false);
  const sendCount=posts.length;await e['send-approved'].dispatch('click');await settle();
  assert.equal(posts.length,sendCount);assert.match(e['send-approved'].textContent,/^Nem ment el – A Google-belépés betöltődik/u);
  assert.equal(e['send-approved'].disabled,false);
  const copied=[],postCount=posts.length;
  Object.defineProperty(globalThis.navigator,'clipboard',{value:{writeText:async text=>{copied.push(text);}},configurable:true});
  try{
   await e['copy-approved'].dispatch('click');await settle();
   assert.deepEqual(copied,['Kitalált negyedik tervezet.']);assert.equal(posts.length,postCount);
   assert.match(e['detail-status'].textContent,/vágólapra.*kézzel, Gmailből/);
   assert.match(e['copy-approved'].textContent,/^Másolva ✓/u,'feedback on the button itself');
   Object.defineProperty(globalThis.navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied');}},configurable:true});
   await e['copy-approved'].dispatch('click');await settle();
   assert.match(e['detail-status'].textContent,/másolás nem sikerült/);
   assert.match(e['copy-approved'].textContent,/^Nem sikerült – a szöveg kijelölve/u);
  }finally{delete globalThis.navigator.clipboard;}
  // A result that is not exactly the next revision is not accepted as proof of the decision.
  state.approval='pending';await open();skew=1;await e['reject-draft'].dispatch('click');await settle();skew=0;
  assert.equal(e['case-detail'].hidden,true);assert.match(e['list-status'].textContent,/nem igazolt/);
  // A server conflict is shown honestly and never retried automatically.
  state.approval='pending';await open();failNext='CASE_CONFLICT';const count=posts.length;await e['reject-draft'].dispatch('click');await settle();
  assert.equal(posts.length,count+1);assert.equal(e['case-detail'].hidden,true);assert.match(e['list-status'].textContent,/nincs automatikus ismétlés/);
  assert.ok(posts.every(p=>['test-mailbox-redraft','test-mailbox-decide','test-mailbox-unavailable'].includes(p.action)&&p.tenantId==='sarberki-test'));
 }finally{Object.assign(globalThis,previous);}
});
