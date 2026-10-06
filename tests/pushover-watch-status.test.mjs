import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../gmail-readonly.js',import.meta.url),'utf8');
function harness(){
 const nodes=new Map(),store=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',className:'',setAttribute(){},insertAdjacentElement(){}});return nodes.get(id);};
 const context=vm.createContext({document:{getElementById:node,createElement:()=>node('gmail_pushover_watch_status')},status:node('gmail_auth_status'),Date,JSON,Set,Error,Number,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},setInterval:()=>1,clearInterval(){},readWithToken:async()=>[],renderPicker(){}});
 vm.runInContext(source.slice(source.indexOf('  const READ_STORAGE_KEY'),source.indexOf('  function messageLabel('))+';globalThis.start=startPushoverWatch;globalThis.poll=pollPushoverWatch;globalThis.token=value=>currentToken=value;',context);
 return {context,node};
}
test('configured Gmail watch does not claim end-to-end Pushover delivery',()=>{
 const h=harness();h.context.start([]);const text=h.node('gmail_pushover_watch_status').textContent;
 assert.match(text,/Gmail figyelés konfigurálva/u);assert.match(text,/csak megnyitott oldalon/u);assert.match(text,/Pushover-küldés.*még nincs igazolva/u);assert.doesNotMatch(text,/Pushover figyelés aktív/u);
});
test('successful Gmail poll and successful send have separate observed timestamps',async()=>{
 const h=harness();h.context.token('offline-fake-token');h.context.readWithToken=async()=>[{id:'fixture-message',internalDate:1}];h.context.fetch=async()=>({ok:true,json:async()=>({ok:true})});await h.context.poll();
 const text=h.node('gmail_pushover_watch_status').textContent;assert.match(text,/API-visszaigazolás/u);assert.doesNotMatch(text,/még nincs igazolva/u);assert.match(text,/telefonos kézbesítés külön ellenőrizendő/u);
});
test('failed Pushover send does not become a successful send status',async()=>{
 const h=harness();h.context.token('offline-fake-token');h.context.readWithToken=async()=>[{id:'fixture-message',internalDate:1}];h.context.fetch=async()=>({ok:false,json:async()=>({code:'PUSHOVER_REJECTED'})});await h.context.poll();
 assert.match(h.node('gmail_pushover_watch_status').textContent,/Pushover-küldés.*még nincs igazolva/u);assert.match(h.node('gmail_pushover_watch_status').textContent,/elutasította/u);assert.equal(h.node('gmail_pushover_watch_status').className,'warning');
});
