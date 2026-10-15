import test from 'node:test';
import assert from 'node:assert/strict';
import {initBilingualClone} from '../bilingual-clone-preview.mjs';
import {syntheticMailEnvelope} from '../shared-core/synthetic-mail-fixtures.mjs';
const text=syntheticMailEnvelope('en').text;
const hu='Üdvözlöm! Deluxe faház 2026-10-23 és 2026-10-25 között, 2 felnőtt, 0 gyermek. Telefon: +36 00 000 0000.';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({translate=null}={}){
 const nodes=new Map();
 class Element{
  constructor(){this.value='';this.textContent='';this.style={};this.dataset={};this.listeners=new Map();this.hidden=false;this.disabled=false;}
  set id(value){this.identifier=value;nodes.set(value,this);}get id(){return this.identifier;}
  setAttribute(){} append(...items){for(const item of items)item.parent=this;}
  insertAdjacentElement(_position,item){item.parent=this;}
  addEventListener(name,fn){this.listeners.set(name,fn);}
  async fire(name){return this.listeners.get(name)?.({preventDefault(){},stopImmediatePropagation(){}});}
  closest(){return {classList:{contains:()=>false}};}
  dispatchEvent(event){void this.fire(event.type);}
 }
 const doc={getElementById:id=>nodes.get(id)||null,createElement:()=>new Element(),listeners:new Map(),
  addEventListener(name,fn){this.listeners.set(name,fn);},dispatch(name){this.listeners.get(name)?.();}};
 for(const id of ['message','draft','gmail_original','gmail_draft','approve','refresh']){const n=new Element();n.id=id;}
 nodes.get('message').value=text;nodes.get('draft').value='Original draft';nodes.get('gmail_original').value=text;
 const globalRef={SarberkiNormalize:{languageFromText:()=> 'en'},SarberkiCaseStoreSession:{getCsrfToken:async()=> 'ab'.repeat(32)}};
 const clone=initBilingualClone({doc,globalRef,translate});
 return {nodes,doc,globalRef,clone};
}
test('processing/restore/draft input never invokes translation; explicit duplicate buttons share one request',async()=>{
 let calls=0,complete;const f=fixture({translate:async()=>{calls++;return new Promise(resolve=>{complete=resolve;});}});
 await f.clone.sync();assert.equal(calls,0);
 await f.nodes.get('draft').fire('input');await tick();assert.equal(calls,0);
 const a=f.nodes.get('foreign_incoming_hu_request').fire('click');
 const b=f.nodes.get('gmail_foreign_incoming_hu_request').fire('click');
 assert.equal(calls,1);assert.equal(f.nodes.get('foreign_incoming_hu_request').disabled,true);
 complete(hu);await Promise.all([a,b]);
 assert.equal(f.nodes.get('foreign_incoming_hu').value,hu);assert.equal(f.nodes.get('gmail_foreign_incoming_hu').value,hu);
 assert.equal(f.nodes.get('draft').value,'Original draft');assert.equal(f.nodes.get('foreign_incoming_hu_request').disabled,false);
 assert.match(f.nodes.get('foreign_incoming_hu_status').textContent,/kezelői ellenőrzés/);
});
test('changed source or session discards late translation and clears old panels',async()=>{
 for(const change of ['source','session']){
  let complete;const f=fixture({translate:()=>new Promise(resolve=>{complete=resolve;})});await f.clone.sync();
  const pending=f.nodes.get('foreign_incoming_hu_request').fire('click');
  if(change==='source'){f.nodes.get('message').value='Another text';await f.nodes.get('message').fire('input');}
  else{f.globalRef.SarberkiCaseStoreSession=null;f.doc.dispatch('sarberki:session-changed');}
  complete(hu);await pending;assert.equal(f.nodes.get('foreign_incoming_hu').value,'');assert.equal(f.nodes.get('gmail_foreign_incoming_hu').value,'');
 }
});
test('default edit/back-translation remains unavailable and approval stays locked',async()=>{
 const f=fixture();await f.clone.sync();f.nodes.get('foreign_reply_hu').value='Magyar módosítás';
 await f.nodes.get('foreign_reply_hu').fire('input');await tick();
 assert.equal(f.nodes.get('approve').disabled,true);assert.equal(f.nodes.get('draft').value,'Original draft');
 assert.match(f.nodes.get('foreign_reply_hu_status').textContent,/nincs bekötve/);
});
test('default client rejects arbitrary source before even a same-origin POST and explains closed-test scope',async()=>{
 const originalFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;assert.fail('private text must not be sent');};
 try{
  const f=fixture();f.nodes.get('message').value='Hello, private arbitrary booking inquiry.';
  await f.clone.sync();assert.equal(calls,0);
  await f.nodes.get('foreign_incoming_hu_request').fire('click');
  assert.equal(calls,0);assert.match(f.nodes.get('foreign_incoming_hu_status').textContent,/zárt tesztlevél/);
  assert.equal(f.nodes.get('foreign_incoming_hu').value,'');
 }finally{globalThis.fetch=originalFetch;}
});
test('default client displays disabled provider truthfully without fabricating a translation',async()=>{
 const originalFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'/.netlify/functions/translate-incoming');assert.equal(options.method,'POST');
  return new Response(JSON.stringify({error:'TRANSLATION_DISABLED'}),{status:503});};
 try{
  const f=fixture();await f.clone.sync();assert.equal(calls,0);
  await f.nodes.get('foreign_incoming_hu_request').fire('click');
  assert.equal(calls,1);assert.match(f.nodes.get('foreign_incoming_hu_status').textContent,/nincs bekapcsolva/);
  assert.equal(f.nodes.get('foreign_incoming_hu').value,'');assert.equal(f.nodes.get('draft').value,'Original draft');
 }finally{globalThis.fetch=originalFetch;}
});
test('default UI displays distinct safe Hungarian errors without reflecting unknown upstream details',async()=>{
 const originalFetch=globalThis.fetch;
 try{
  for(const [code,message] of [
   ['TRANSLATION_UNVERIFIED',/számai nem ellenőrizhetők/],['AUTH_REQUIRED',/belépés szükséges/],
   ['FORBIDDEN',/Writer-jogosultság szükséges/],['TRANSLATION_KEY_REJECTED',/elutasította.*API-kulcsot/],
   ['TRANSLATION_ACCESS_DENIED',/megtagadta az API-hozzáférést/],
   ['TRANSLATION_MODEL_UNAVAILABLE',/fordítómodell nem érhető el/],['TRANSLATION_QUOTA_EXHAUSTED',/egyenlege elfogyott/],
   ['TRANSLATION_RATE_LIMITED',/átmeneti kéréskorlátot/],['SECRET_UNKNOWN_PROVIDER_DETAIL',/átmenetileg nem érhető el/]
  ]){
   globalThis.fetch=async()=>new Response(JSON.stringify({error:code,detail:'SECRET_RESPONSE_BODY'}),{status:503});
   const f=fixture();await f.clone.sync();await f.nodes.get('foreign_incoming_hu_request').fire('click');
   const shown=f.nodes.get('foreign_incoming_hu_status').textContent;assert.match(shown,message);assert.doesNotMatch(shown,/SECRET/);
   assert.equal(f.nodes.get('foreign_incoming_hu').value,'');assert.equal(f.nodes.get('draft').value,'Original draft');
  }
 }finally{globalThis.fetch=originalFetch;}
});
