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
  .replace("  button.addEventListener('click',", "  window.testRead=readWithToken; button.addEventListener('click',");
 const modules={'gmail-policy.mjs':policy};
 for(const name of ['sarberki-core.mjs','business-config.mjs','split-units.mjs','fishing-rules.mjs'])modules[name]=await import('./'+name);
 const window={location:{search}},button={addEventListener(){}};
 const context=vm.createContext({window,modules,URL,Date,Number,TextDecoder,Uint8Array,
  document:{getElementById:()=>button,querySelector:()=>({content:'synthetic-client'})},
  fetch:async(url,options)=>{calls.push({url:String(url),method:options.method||'GET'});return String(url).endsWith('/profile')?{ok:true,json:async()=>({emailAddress:account})}:{ok:status===200,status,json:async()=>message};}
 });
 await vm.runInContext(source,context);return {calls,read:()=>window.testRead('synthetic-not-real-token')};
}
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
