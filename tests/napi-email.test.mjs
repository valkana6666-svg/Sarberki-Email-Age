import test from 'node:test';
import assert from 'node:assert/strict';
import {createDailyEmailReader} from '../napi-kezelo/napi-email.mjs';
import {buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';
import {syntheticMailMime,syntheticMailEnvelope,syntheticMailLanguages} from '../shared-core/synthetic-mail-fixtures.mjs';
import {languageFromText} from '../sarberki-core.mjs';
class Element{
 constructor(){this.children=[];this.listeners={};this.textContent='';this.disabled=false;this.value='';this.attributes={};}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children.flatMap(child=>child.fragment?child.children:[child]);}
 addEventListener(type,fn){this.listeners[type]=fn;}
 setAttribute(key,value){this.attributes[key]=value;}
 async click(){await this.listeners.click?.();}
}
function setup({unreadableIndex=-1,messages=null,now=null}={}){
 const elements=Object.fromEntries(['read-email','email-list','email-status','email-detail','email-picker','email-picker-wrap','email-previous','email-next','email-draft-request','email-draft-status','email-draft-text','email-draft-review','email-draft-checks'].map(id=>[id,new Element()]));
 const doc={getElementById:id=>elements[id],visibilityState:'visible',createElement:()=>new Element(),createDocumentFragment:()=>Object.assign(new Element(),{fragment:true})};
 let authenticated=true,expired=false,sessionHold=null,callback,reads=0,restores=0,release;const consentRequests=[];
 const google={accounts:{oauth2:{initTokenClient(options){assert.equal(options.scope,'https://www.googleapis.com/auth/gmail.readonly');assert.equal(options.include_granted_scopes,false);callback=options.callback;return {requestAccessToken(input){consentRequests.push(input);}};}}}};
 const reader=createDailyEmailReader({documentImpl:doc,canRead:()=>authenticated,restoreSession:async()=>{restores++;if(sessionHold)await sessionHold;if(!authenticated||expired)throw Error('AUTH_REQUIRED');},...(now?{now:()=>now}:{}),loadGoogleImpl:async()=>google,clientId:'synthetic',readInbox:async token=>{assert.equal(token,'SYNTHETIC_TOKEN');reads++;if(release)await release;if(messages)return messages;return [0,1,2].map(index=>({payload:{mimeType:'text/plain',headers:[{name:'Subject',value:'Kitalált levél '+(index+1)},{name:'From',value:'guest@synthetic.invalid'}],body:{data:index===unreadableIndex?'%%%':Buffer.from('Kitalált érdeklődés. Levél '+(index+1)).toString('base64url')}}}));}});
 return {reader,e:elements,doc,consentRequests,get callback(){return callback;},get reads(){return reads;},get restores(){return restores;},hideForConsent(){doc.visibilityState='hidden';authenticated=false;reader.suspend();reader.setEnabled(false);},returnFromConsent(){doc.visibilityState='visible';authenticated=true;reader.setEnabled(true);},logout(){authenticated=false;reader.clear();},delay(p){release=p;},expire(){expired=true;},holdSession(p){sessionHold=p;},get authenticated(){return authenticated;},set authenticated(v){authenticated=v;}};
}
test('daily Gmail uses readonly consent and shared reader, opens original without persisting or submitting a case',async()=>{
 const h=setup();h.reader.setEnabled(true);await Promise.resolve();await h.e['read-email'].click();
 assert.deepEqual(h.consentRequests,[{prompt:''}]);
 await h.callback({access_token:'SYNTHETIC_TOKEN'});assert.equal(h.reads,1);assert.equal(h.restores,1);
 assert.equal(h.e['email-list'].children.length,3);await h.e['email-list'].children[0].children[0].click();
 assert.match(h.e['email-detail'].textContent,/Kitalált érdeklődés/);
 assert.equal(h.e['email-picker'].value,'0');assert.equal(h.e['email-previous'].disabled,true);
 await h.e['email-next'].click();assert.match(h.e['email-detail'].textContent,/Levél 2/);assert.equal(h.e['email-picker'].value,'1');
 h.e['email-picker'].value='2';await h.e['email-picker'].listeners.change();
 assert.match(h.e['email-detail'].textContent,/Levél 3/);assert.equal(h.e['email-next'].disabled,true);
 assert.equal(h.e['email-list'].children.length,3);
 await h.e['email-list'].children[0].children[0].click();assert.equal(h.e['email-picker'].value,'0');
 assert.equal(h.e['email-list'].children[0].children[0].attributes['aria-pressed'],'true');
 assert.match(h.e['email-detail'].textContent,/Levél 1/);assert.match(h.e['email-status'].textContent,/átadás még nem/);
 h.logout();assert.equal(h.e['email-picker'].children.length,1);assert.equal(h.e['email-picker-wrap'].hidden,false);assert.equal(h.e['email-list'].children.length,0);assert.equal(h.e['email-detail'].textContent,'');assert.equal(h.e['read-email'].disabled,true);
});
test('late OAuth and mailbox responses cannot reopen messages after logout',async()=>{
 for(const stage of ['consent','reading']){
  const h=setup();h.reader.setEnabled(true);await Promise.resolve();await h.e['read-email'].click();
  let release;h.delay(new Promise(resolve=>{release=resolve;}));
  if(stage==='consent'){h.logout();await h.callback({access_token:'SYNTHETIC_TOKEN'});assert.equal(h.reads,0);}
  else{const pending=h.callback({access_token:'SYNTHETIC_TOKEN'});await Promise.resolve();h.logout();release();await pending;}
  assert.equal(h.e['email-list'].children.length,0);assert.equal(h.e['email-detail'].textContent,'');
 }
});
test('failed consent allows manual retry without claiming successful reading',async()=>{
 const h=setup();h.reader.setEnabled(true);await Promise.resolve();await h.e['read-email'].click();await h.callback({error:'access_denied'});
 assert.equal(h.reads,0);assert.equal(h.e['read-email'].disabled,false);assert.match(h.e['email-status'].textContent,/engedélyt nem adta/);
});

test('Google consent survives popup visibility change but waits for restored operator authentication',async()=>{
 const h=setup();h.reader.setEnabled(true);await Promise.resolve();await h.e['read-email'].click();
 h.hideForConsent();assert.equal(h.e['email-list'].children.length,0);
 await h.callback({access_token:'SYNTHETIC_TOKEN'});assert.equal(h.reads,0);assert.equal(h.e['read-email'].disabled,true);
 h.returnFromConsent();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.reads,1);assert.equal(h.restores,1);assert.equal(h.e['email-list'].children.length,3);
 assert.match(h.e['email-detail'].textContent,/Kitalált érdeklődés/);
 h.logout();
});
test('logout invalidates consent queued while the Google popup hides the page',async()=>{
 const h=setup();h.reader.setEnabled(true);await Promise.resolve();await h.e['read-email'].click();
 h.hideForConsent();await h.callback({access_token:'SYNTHETIC_TOKEN'});h.logout();h.returnFromConsent();
 await new Promise(resolve=>setImmediate(resolve));assert.equal(h.reads,0);assert.equal(h.e['email-list'].children.length,0);
 assert.equal(h.e['email-picker-wrap'].hidden,false);assert.equal(h.e['email-picker'].disabled,true);
});

test('unreadable original is isolated during automatic opening and manual selection',async()=>{
 for(const unreadableIndex of [0,1]){
  const h=setup({unreadableIndex});h.reader.setEnabled(true);await Promise.resolve();await h.e['read-email'].click();
  await h.callback({access_token:'SYNTHETIC_TOKEN'});
  assert.equal(h.e['email-list'].children.length,3);
  if(unreadableIndex===0)assert.match(h.e['email-detail'].textContent,/nem jeleníthető meg/);
  else assert.match(h.e['email-detail'].textContent,/Levél 1/);
  await assert.doesNotReject(()=>h.e['email-list'].children[unreadableIndex].children[0].click());
  assert.match(h.e['email-detail'].textContent,/nem jeleníthető meg/);
  assert.doesNotMatch(h.e['email-detail'].textContent,/Kitalált érdeklődés/);
  assert.equal(h.e['email-picker'].disabled,false);
  const validIndex=2;h.e['email-picker'].value=String(validIndex);await h.e['email-picker'].listeners.change();
  assert.match(h.e['email-detail'].textContent,/Levél 3/);
  assert.equal(h.e['read-email'].disabled,false);h.logout();
 }
});

// Local AI reply preview: the shared email adapter, closed synthetic registry only.
const PREVIEW_NOW=new Date('2026-10-17T12:00:00Z');
const closedMessages=()=>syntheticMailLanguages.map(language=>syntheticMailMime(language));
async function openInbox(options){
 const h=setup(options);h.reader.setEnabled(true);await Promise.resolve();await h.e['read-email'].click();
 await h.callback({access_token:'SYNTHETIC_TOKEN'});return h;
}
const select=async(h,index)=>{h.e['email-picker'].value=String(index);await h.e['email-picker'].listeners.change();};
const checks=h=>h.e['email-draft-checks'].children.map(child=>child.textContent).join('\n');
function noNetworkOrStorage(){
 const calls=[],saved={fetch:globalThis.fetch,localStorage:globalThis.localStorage,sessionStorage:globalThis.sessionStorage,console:{...console}};
 globalThis.fetch=(...args)=>{calls.push(['fetch',args]);throw Error('NETWORK_FORBIDDEN');};
 const storage={setItem:(...args)=>calls.push(['storage',args]),getItem:()=>null,removeItem:()=>{},clear:()=>{}};
 globalThis.localStorage=storage;globalThis.sessionStorage=storage;
 for(const level of ['log','info','warn','error','debug'])console[level]=(...args)=>calls.push(['console',args]);
 return {calls,restore(){globalThis.fetch=saved.fetch;globalThis.localStorage=saved.localStorage;globalThis.sessionStorage=saved.sessionStorage;Object.assign(console,saved.console);}};
}

test('closed synthetic HU/DE/SI/EN mail gets the exact shared email-adapter draft locally after a fresh session check',async()=>{
 const h=await openInbox({messages:closedMessages(),now:PREVIEW_NOW});
 for(const [index,language] of syntheticMailLanguages.entries()){
  await select(h,index);
  assert.equal(h.e['email-draft-text'].value,'');assert.equal(h.e['email-draft-request'].disabled,false);
  const guard=noNetworkOrStorage(),before=h.restores;
  try{await h.e['email-draft-request'].click();}finally{guard.restore();}
  assert.deepEqual(guard.calls,[]);assert.equal(h.restores,before+1);
  const expected=buildEmailInquiryDraft({message:syntheticMailEnvelope(language).text,language,now:PREVIEW_NOW,tenantId:'sarberki-test'});
  assert.equal(h.e['email-draft-text'].value,expected.text,language);
  assert.equal(h.e['email-draft-review'].textContent,expected.operatorReviewText,language);
  assert.equal(h.e['email-draft-text'].disabled,false);
  assert.match(checks(h),/Kapacitás: nem igazolt/);assert.match(checks(h),/Ár: nem igazolt/);
  assert.match(checks(h),/Emberi jóváhagyás szükséges/);
  assert.match(h.e['email-draft-status'].textContent,/Helyi előnézet.*nincs mentve.*nem küldhető.*nem foglalás/s);
  assert.doesNotMatch(h.e['email-draft-text'].value,/visszaigazol(?:juk|tuk) a foglalás|booking is confirmed|Buchung ist bestätigt/i);
 }
 // Editing stays local: no request, storage or new state transition.
 const guard=noNetworkOrStorage();
 try{h.e['email-draft-text'].value='Kezelői szerkesztés (helyi)';await h.e['email-draft-text'].listeners.input?.();}finally{guard.restore();}
 assert.deepEqual(guard.calls,[]);assert.equal(h.e['email-draft-text'].value,'Kezelői szerkesztés (helyi)');
 h.logout();
});

test('unverified facts are listed: missing data, contradictions, capacity, price and human approval',async()=>{
 const h=await openInbox({messages:closedMessages(),now:new Date('2026-10-31T08:00:00Z')});
 await select(h,0);await h.e['email-draft-request'].click();
 assert.match(checks(h),/Ellentmondás: Az érkezés múltbeli/);
 assert.match(checks(h),/Kapacitás: nem igazolt/);assert.match(checks(h),/Ár: nem igazolt/);
 h.logout();
});

test('arbitrary or altered Gmail messages never reach the AI preview without separate approval',async()=>{
 const base=syntheticMailMime('hu');
 const altered=[
  {...base,id:'18f0c0ffee0000aa'},
  {...base,threadId:'other-thread'},
  {...base,internalDate:String(Number(base.internalDate)+1000)},
  {...base,payload:{...base.payload,headers:base.payload.headers.map(x=>x.name==='Subject'?{...x,value:'TESZT SÁRBERKI CLOSED DE'}:x)}},
  {...base,payload:{...base.payload,headers:base.payload.headers.map(x=>x.name==='From'?{...x,value:'Guest <guest@example.com>'}:x)}},
  {...base,payload:{...base.payload,body:{data:Buffer.from(syntheticMailEnvelope('hu').text+' Módosítva.').toString('base64url')}}},
  {payload:{mimeType:'text/plain',headers:[{name:'Subject',value:'Foglalás'},{name:'From',value:'vendeg@example.com'}],body:{data:Buffer.from('Szeretnénk foglalni.').toString('base64url')}}}
 ];
 const h=await openInbox({messages:altered,now:PREVIEW_NOW});
 for(let index=0;index<altered.length;index++){
  await select(h,index);const before=h.restores;
  assert.equal(h.e['email-draft-request'].disabled,true,String(index));
  assert.match(h.e['email-draft-status'].textContent,/csak a lezárt szintetikus tesztlevelekhez/);
  const guard=noNetworkOrStorage();
  try{await h.e['email-draft-request'].click();}finally{guard.restore();}
  assert.deepEqual(guard.calls,[]);assert.equal(h.restores,before);assert.equal(h.e['email-draft-text'].value,'');assert.equal(checks(h),'');
 }
 h.logout();
});

test('unreadable closed-looking message cannot be previewed',async()=>{
 const base=syntheticMailMime('en');
 const h=await openInbox({messages:[{...base,payload:{...base.payload,body:{data:'%%%'}}}],now:PREVIEW_NOW});
 assert.equal(h.e['email-draft-request'].disabled,true);await h.e['email-draft-request'].click();assert.equal(h.e['email-draft-text'].value,'');
 h.logout();
});

test('expired or missing operator session yields no preview and no automatic retry',async()=>{
 const h=await openInbox({messages:closedMessages(),now:PREVIEW_NOW});
 await select(h,1);h.expire();const before=h.restores;
 await h.e['email-draft-request'].click();
 assert.equal(h.restores,before+1);assert.equal(h.e['email-draft-text'].value,'');assert.equal(checks(h),'');
 assert.equal(h.e['email-draft-text'].disabled,true);
 assert.match(h.e['email-draft-status'].textContent,/munkamenet.*(lejárt|nem ellenőrizhető).*újra/is);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(h.restores,before+1);
 // Not authenticated locally: the request is not even attempted.
 const g=await openInbox({messages:closedMessages(),now:PREVIEW_NOW});await select(g,0);
 g.authenticated=false;const start=g.restores;await g.e['email-draft-request'].click();
 assert.equal(g.restores,start);assert.equal(g.e['email-draft-text'].value,'');
 h.logout();g.logout();
});

test('preview is cleared on message switch, logout, popup suspend and hidden page; late results are dropped',async()=>{
 for(const leave of ['switch','logout','suspend']){
  const h=await openInbox({messages:closedMessages(),now:PREVIEW_NOW});
  await select(h,0);await h.e['email-draft-request'].click();assert.notEqual(h.e['email-draft-text'].value,'');
  if(leave==='switch')await select(h,2);else if(leave==='logout')h.logout();else h.hideForConsent();
  assert.equal(h.e['email-draft-text'].value,'',leave);assert.equal(h.e['email-draft-review'].textContent,'',leave);
  assert.equal(checks(h),'',leave);assert.equal(h.e['email-draft-text'].disabled,true,leave);
  if(leave==='switch'){assert.equal(h.e['email-draft-request'].disabled,false);h.logout();}
 }
 // Hidden page: request is ignored.
 const v=await openInbox({messages:closedMessages(),now:PREVIEW_NOW});await select(v,0);
 v.doc.visibilityState='hidden';const before=v.restores;await v.e['email-draft-request'].click();
 assert.equal(v.restores,before);assert.equal(v.e['email-draft-text'].value,'');v.doc.visibilityState='visible';v.logout();
 // Late session result after switching to another message must not render under it.
 for(const leave of ['switch','logout']){
  const h=await openInbox({messages:closedMessages(),now:PREVIEW_NOW});await select(h,0);
  let release;h.holdSession(new Promise(resolve=>{release=resolve;}));
  const pending=h.e['email-draft-request'].click();await Promise.resolve();
  if(leave==='switch')await select(h,3);else h.logout();
  release();await pending;
  assert.equal(h.e['email-draft-text'].value,'',leave);assert.equal(checks(h),'',leave);
  if(leave==='switch')h.logout();
 }
});

// A1: verified test-mailbox messages whose subject starts with the existing test marker (gmail-subject.mjs).
const markedBodies={
 hu:'Jó napot! Deluxe faházat szeretnénk foglalni 2027-05-14 és 2027-05-16 között 2 felnőtt, 0 gyermek számára.',
 de:'Guten Tag! Deluxe Ferienhaus 2027-05-14 bis 2027-05-16, 2 Erwachsene, 0 Kinder.',
 en:'Hello! One Deluxe cabin from 2027-05-14 to 2027-05-16 for 2 adults and 0 children.',
 si:'Pozdravljeni! Deluxe hiška 2027-05-14 do 2027-05-16, 2 odrasli, 0 otroci.'
};
const marked=(subject,body,{id='18f2a0b1c2d3e4f5',labelIds=['INBOX'],internalDate=String(Date.parse('2026-10-30T09:00:00Z')),payload=null}={})=>({id,threadId:id,labelIds,internalDate,
 payload:payload||{mimeType:'text/plain',headers:[...(subject===undefined?[]:[{name:'Subject',value:subject}]),{name:'From',value:'Teszt Küldő <sender@example.test>'}],body:{data:Buffer.from(body).toString('base64url')}}});

test('marked test-mailbox messages get the exact shared-adapter preview in HU/DE/EN/SI without network, storage or logging',async()=>{
 const subjects=['Sárberki élő teszt – HU foglalás','SARBERKI ELO TESZT de','  Sárberki   élő teszt  - EN','Sárberki élő teszt'];
 const languages=Object.keys(markedBodies),messages=languages.map((language,index)=>marked(subjects[index],markedBodies[language],{id:'18f2a0b1c2d3e4f'+index}));
 const h=await openInbox({messages,now:PREVIEW_NOW});
 for(const [index,language] of languages.entries()){
  await select(h,index);assert.equal(h.e['email-draft-request'].disabled,false,subjects[index]);
  const guard=noNetworkOrStorage(),before=h.restores;
  try{await h.e['email-draft-request'].click();}finally{guard.restore();}
  assert.deepEqual(guard.calls,[]);assert.equal(h.restores,before+1);
  assert.equal(languageFromText(markedBodies[language]),language);
  const expected=buildEmailInquiryDraft({message:markedBodies[language],language,now:PREVIEW_NOW,tenantId:'sarberki-test'});
  assert.equal(h.e['email-draft-text'].value,expected.text,language);
  assert.equal(h.e['email-draft-review'].textContent,expected.operatorReviewText,language);
  assert.match(checks(h),/Kapacitás: nem igazolt/);assert.match(checks(h),/Ár: nem igazolt/);assert.match(checks(h),/Emberi jóváhagyás szükséges/);
  assert.match(h.e['email-draft-status'].textContent,/Helyi előnézet.*nincs mentve.*nem küldhető.*nem foglalás/s);
 }
 h.logout();
});

test('unmarked, reply/forward, lookalike, out-of-scope or oversized test-mailbox messages get no preview',async()=>{
 const body=markedBodies.hu;
 const rejected=[
  ['reply','Re: Sárberki élő teszt',body],['reply-hu','VS: Sárberki élő teszt',body],['forward','Fwd: Sárberki élő teszt',body],['forward-de','AW: Sárberki élő teszt',body],
  ['lookalike-suffix','Sárberki élő tesztelés',body],['lookalike-order','Teszt Sárberki élő',body],['prefix-not-first','x Sárberki élő teszt',body],
  ['ordinary-inquiry','Érdeklődés a szállásról',body],['empty-subject','',body],['missing-subject',undefined,body],
  ['marker-only-in-body','Foglalás','Sárberki élő teszt '+body],
  ['no-inbox-label','Sárberki élő teszt',body,{labelIds:['SENT']}],
  ['before-test-window','Sárberki élő teszt',body,{internalDate:String(Date.parse('2026-09-24T12:00:00Z'))}],
  ['oversized','Sárberki élő teszt','A'.repeat(20001)],['blank-body','Sárberki élő teszt','   \n  '],
  ['unreadable','Sárberki élő teszt',body,{payload:{mimeType:'text/plain',headers:[{name:'Subject',value:'Sárberki élő teszt'}],body:{data:'%%%'}}}]
 ];
 const h=await openInbox({messages:rejected.map(([,subject,text,extra],index)=>marked(subject,text,{id:'28f2a0b1c2d3e4'+String(index).padStart(2,'0'),...extra})),now:PREVIEW_NOW});
 for(const [index,[name]] of rejected.entries()){
  await select(h,index);const before=h.restores;
  assert.equal(h.e['email-draft-request'].disabled,true,name);
  assert.match(h.e['email-draft-status'].textContent,/csak a lezárt szintetikus tesztlevelekhez/,name);
  const guard=noNetworkOrStorage();
  try{await h.e['email-draft-request'].click();}finally{guard.restore();}
  assert.deepEqual(guard.calls,[],name);assert.equal(h.restores,before,name);assert.equal(h.e['email-draft-text'].value,'',name);assert.equal(checks(h),'',name);
 }
 h.logout();
});

test('marked preview keeps session check, clearing and late-result rules',async()=>{
 const messages=[marked('Sárberki élő teszt 1',markedBodies.hu,{id:'38f2a0b1c2d3e4f0'}),marked('Sárberki élő teszt 2',markedBodies.en,{id:'38f2a0b1c2d3e4f1'})];
 const h=await openInbox({messages,now:PREVIEW_NOW});await select(h,0);h.expire();
 await h.e['email-draft-request'].click();assert.equal(h.e['email-draft-text'].value,'');assert.match(h.e['email-draft-status'].textContent,/munkamenet/);h.logout();
 const g=await openInbox({messages,now:PREVIEW_NOW});await select(g,0);await g.e['email-draft-request'].click();assert.notEqual(g.e['email-draft-text'].value,'');
 await select(g,1);assert.equal(g.e['email-draft-text'].value,'');assert.equal(checks(g),'');
 let release;g.holdSession(new Promise(resolve=>{release=resolve;}));const pending=g.e['email-draft-request'].click();await Promise.resolve();
 await select(g,0);release();await pending;assert.equal(g.e['email-draft-text'].value,'');
 g.logout();assert.equal(g.e['email-draft-text'].value,'');assert.equal(g.e['email-draft-request'].disabled,true);
});

// App switch (iPhone): concealing keeps the read list, selection and edited local preview in memory only.
test('conceal/reveal keeps the selected mail and edited preview without re-reading or storage',async()=>{
 const h=await openInbox({messages:closedMessages(),now:PREVIEW_NOW});
 await select(h,2);await h.e['email-draft-request'].click();h.e['email-draft-text'].value='Kezelő által szerkesztett helyi szöveg';
 const guard=noNetworkOrStorage(),reads=h.reads,restores=h.restores;
 try{h.doc.visibilityState='hidden';h.reader.conceal();h.doc.visibilityState='visible';h.reader.reveal();}finally{guard.restore();}
 assert.deepEqual(guard.calls,[]);assert.equal(h.reads,reads);assert.equal(h.restores,restores);
 assert.equal(h.e['email-picker'].value,'2');assert.equal(h.e['email-list'].children.length,4);
 assert.equal(h.e['email-draft-text'].value,'Kezelő által szerkesztett helyi szöveg');assert.equal(h.e['email-draft-text'].disabled,false);
 assert.notEqual(checks(h),'');assert.equal(h.e['read-email'].disabled,false);
 h.logout();assert.equal(h.e['email-draft-text'].value,'');assert.equal(h.e['email-list'].children.length,0);
});
test('conceal during a pending preview session check drops the result and leaves a usable button',async()=>{
 const h=await openInbox({messages:closedMessages(),now:PREVIEW_NOW});await select(h,0);
 let release;h.holdSession(new Promise(resolve=>{release=resolve;}));
 const pending=h.e['email-draft-request'].click();await Promise.resolve();
 h.doc.visibilityState='hidden';h.reader.conceal();release();await pending;
 assert.equal(h.e['email-draft-text'].value,'');assert.equal(h.e['email-draft-request'].disabled,false);
 h.doc.visibilityState='visible';h.holdSession(null);h.reader.reveal();
 await h.e['email-draft-request'].click();assert.notEqual(h.e['email-draft-text'].value,'');h.logout();
});
test('conceal while the Google consent popup is open keeps the existing suspend behaviour; reveal resumes the read',async()=>{
 const h=setup({messages:closedMessages(),now:PREVIEW_NOW});h.reader.setEnabled(true);await Promise.resolve();await h.e['read-email'].click();
 h.doc.visibilityState='hidden';h.reader.conceal();
 await h.callback({access_token:'SYNTHETIC_TOKEN'});assert.equal(h.reads,0);assert.equal(h.e['read-email'].disabled,true);
 h.doc.visibilityState='visible';h.reader.reveal();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.reads,1);assert.equal(h.e['email-list'].children.length,4);h.logout();
});
