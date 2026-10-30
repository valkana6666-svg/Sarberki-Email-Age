import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as policy from './gmail-policy.mjs';
const id='abcdef1234567890';
test('exact synthetic selector rejects empty, malformed and duplicate values without broad fallback',()=>{
 assert.equal(policy.syntheticMessageIdFromSearch(''),null);
 assert.equal(policy.syntheticMessageIdFromSearch('?syntheticGmailMessageId='+id),id);
 for(const search of ['?syntheticGmailMessageId=','?syntheticGmailMessageId=bad','?syntheticGmailMessageId='+id+'&syntheticGmailMessageId='+id])assert.throws(()=>policy.syntheticMessageIdFromSearch(search));
});
async function harness(search,{account=policy.TEST_GMAIL_ACCOUNT,status=200,message={id,labelIds:['INBOX'],internalDate:String(Date.parse('2026-10-03T10:00:00Z'))}}={}){
 const calls=[];
 const source=(await fs.readFile(new URL('./gmail-readonly.js',import.meta.url),'utf8'))
  .replace(/await import\('\.\/([^']+)'\)/gu,(_,name)=>`modules[${JSON.stringify(name.split('?')[0])}]`)
  .replace("  button.addEventListener('click',", "  window.testDisplay=displayMessage; window.testRead=readWithToken; button.addEventListener('click',");
 const modules={'gmail-policy.mjs':policy};
 for(const name of ['sarberki-core.mjs','business-config.mjs','split-units.mjs','fishing-rules.mjs'])modules[name]=await import('./'+name);
 let captured,proof;
 const window={location:{search}},button={addEventListener(){}},statusElement={textContent:''},writes=[];
 const context=vm.createContext({atob,AbortController,setTimeout,clearTimeout,window,modules,URL,Date,Number,TextDecoder,Uint8Array,
  displayGmailRecord:async record=>{captured=record;proof=window.SarberkiGmailReadOrigin.consume(record);return false;},
  localStorage:{getItem:()=>null,setItem:(...args)=>writes.push(args)},
  document:{getElementById:key=>key==='gmail_auth_status'?statusElement:button,querySelector:()=>({content:'synthetic-client'})},
  fetch:async(url,options)=>{calls.push({url:String(url),method:options.method||'GET'});return String(url).endsWith('/profile')?{ok:true,json:async()=>({emailAddress:account})}:{ok:status===200,status,json:async()=>message};}
 });
 await vm.runInContext(source,context);return {calls,writes,status:()=>statusElement.textContent,read:()=>window.testRead('synthetic-not-real-token'),display:message=>window.testDisplay(message),observation:()=>({captured,proof}),origin:window.SarberkiGmailReadOrigin,transform:window.sarberkiGmailTransform};
}
test('unreadable Gmail message reports a recoverable failure without marking read or blocking another message',async()=>{
 const f=await harness('?syntheticGmailMessageId='+id);
 assert.equal(await f.display({id,payload:{}}),false);
 assert.match(f.status(),/nincs olvasható szöveges része/u);
 assert.equal(f.observation().captured,undefined);
 assert.equal(f.writes.length,0);
 const message={id,internalDate:String(Date.parse('2026-10-03T10:00:00Z')),payload:{mimeType:'text/plain',body:{data:Buffer.from('2 adults. VIP. 2026-11-13 to 2026-11-15.').toString('base64url')},headers:[]}};
 assert.equal(await f.display(message),false);
 assert.equal(f.observation().captured.source.message_id,id);
 assert.equal(f.writes.length,0);
 assert.match(f.status(),/nem jelöltük helyileg olvasottnak/u);
});
test('scoped OAuth read verifies account then GETs only the selected message; no list or writes',async()=>{
 const f=await harness('?syntheticGmailMessageId='+id);
 const result=await f.read();assert.equal(result.length,1);assert.equal(result[0].id,id);
 assert.deepEqual(f.calls,[{url:'https://gmail.googleapis.com/gmail/v1/users/me/profile',method:'GET'},{url:'https://gmail.googleapis.com/gmail/v1/users/me/messages/'+id+'?format=full',method:'GET'}]);
});
test('wrong account, invalid selector, missing/wrong/non-inbox message fail closed without list fallback',async()=>{
 for(const [search,options,count] of [
  ['?syntheticGmailMessageId=',{},0],
  ['?syntheticGmailMessageId='+id,{account:'other@synthetic.invalid'},1],
  ['?syntheticGmailMessageId='+id,{status:404},2],
  ['?syntheticGmailMessageId='+id,{message:{id:'1111111111111111',labelIds:['INBOX'],internalDate:Date.now()}},2],
  ['?syntheticGmailMessageId='+id,{message:{id,labelIds:['SENT'],internalDate:Date.now()}},2]
 ]){const f=await harness(search,options);await assert.rejects(f.read());assert.equal(f.calls.length,count);assert.ok(f.calls.every(c=>!c.url.includes('/messages?')&&c.method==='GET'));}
});

test('only a completed readonly fetch can attach a session-only API observation to its transformed record',async()=>{
 const message={id,threadId:'synthetic-thread',labelIds:['INBOX'],internalDate:String(Date.parse('2026-10-03T10:00:00Z')),payload:{mimeType:'text/plain',body:{data:Buffer.from('2 adults. VIP. 2026-11-13 to 2026-11-15.').toString('base64url')},headers:[]}};
 const f=await harness('?syntheticGmailMessageId='+id,{message});
 assert.equal(f.origin.consume(f.transform(message)),null);
 const result=await f.read();await f.display(result[0]);
 const observed=f.observation();assert.equal(observed.proof.channel,'gmail_readonly_api');assert.equal(observed.proof.serverVerified,false);
 assert.equal(observed.proof.evidence,'browser_observed');assert.ok(Number.isFinite(Date.parse(observed.proof.readAt)));
 assert.equal(f.origin.consume(observed.captured),null);
 assert.equal(f.origin.consume(JSON.parse(JSON.stringify(observed.captured))),null);
 assert.ok(!JSON.stringify(observed.proof).includes('synthetic-not-real-token'));
});
