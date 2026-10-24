import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {TEST_GMAIL_ACCOUNT} from '../gmail-policy.mjs';
const modules={};
for(const name of ['sarberki-core.mjs','business-config.mjs','split-units.mjs','fishing-rules.mjs','gmail-policy.mjs'])modules[name]=await import('../'+name);
const source=(await readFile(new URL('../gmail-readonly.js',import.meta.url),'utf8'))
 .replace(/await import\('\.\/([^']+)'\)/gu,(_,name)=>`modules[${JSON.stringify(name.split('?')[0])}]`)
 .replace("  button.addEventListener('click',", "  window.testRead=readWithToken;\n  button.addEventListener('click',");
const ok=body=>({ok:true,status:200,json:async()=>body});
const message=id=>({id,labelIds:['INBOX'],internalDate:String(Date.parse('2026-10-03T09:23:00Z'))});
async function reader(fetch,search='',runtime={}){
 const window={location:{search}};
 await vm.runInContext(source,vm.createContext({AbortController,setTimeout,clearTimeout,...runtime,modules,window,fetch,URL,URLSearchParams,Date,Number,
  document:{getElementById:()=>({addEventListener(){}}),querySelector:()=>({content:'synthetic-client'})}}));
 return window.testRead;
}
test('Gmail full-body reads remain serial across paginated lists',async()=>{
 let active=0,peak=0;const urls=[];
 const read=await reader(async(url,options)=>{
  const u=String(url);urls.push(u);assert.equal(options.cache,'no-store');
  if(u.endsWith('/profile'))return ok({emailAddress:TEST_GMAIL_ACCOUNT});
  if(u.includes('/messages?'))return ok(u.includes('pageToken=next')?{messages:[{id:'b'}]}:{messages:[{id:'a'}],nextPageToken:'next'});
  active++;peak=Math.max(peak,active);
  return {ok:true,status:200,json:async()=>{await new Promise(r=>setImmediate(r));active--;return message(u.includes('/a?')?'a':'b');}};
 });
 const result=await read('SYNTHETIC_TOKEN');assert.equal(result.length,2);assert.equal(peak,1);assert.equal(active,0);assert.equal(urls.length,5);
});
test('429 on body stops remaining reads without retry or false success',async()=>{
 const urls=[];const read=await reader(async url=>{
  const u=String(url);urls.push(u);
  if(u.endsWith('/profile'))return ok({emailAddress:TEST_GMAIL_ACCOUNT});
  if(u.includes('/messages?'))return ok({messages:[{id:'a'},{id:'b'},{id:'c'}]});
  return {ok:false,status:429,json:()=>assert.fail('provider details must not be displayed')};
 });
 await assert.rejects(read('SYNTHETIC_TOKEN'),/429.*kézzel/u);
 assert.equal(urls.length,3);assert.ok(urls.at(-1).includes('/a?'));
});
test('profile denial stops before listing or reading any message',async()=>{
 let calls=0;const read=await reader(async()=>{calls++;return {ok:false,status:403};});
 await assert.rejects(read('SYNTHETIC_TOKEN'),/403/u);assert.equal(calls,1);
});
test('exact synthetic selector never falls back to a list after 429',async()=>{
 let calls=0;const read=await reader(async url=>{
  calls++;if(String(url).endsWith('/profile'))return ok({emailAddress:TEST_GMAIL_ACCOUNT});
  assert.ok(String(url).includes('/messages/abcdef1234567890?format=full'));
  return {ok:false,status:429};
 },'?syntheticGmailMessageId=abcdef1234567890');
 await assert.rejects(read('SYNTHETIC_TOKEN'),/429/u);assert.equal(calls,2);
});

test('repeated Gmail pagination stops before any message body is fetched',async()=>{
 let lists=0,bodies=0;
 const read=await reader(async url=>{
  if(String(url).endsWith('/profile'))return ok({emailAddress:TEST_GMAIL_ACCOUNT});
  if(String(url).includes('/messages?')){lists++;return ok({messages:[{id:'a'}],nextPageToken:'same'});}
  bodies++;return ok(message('a'));
 });
 await assert.rejects(read('SYNTHETIC_TOKEN'),/lapozást/u);
 assert.equal(lists,2);assert.equal(bodies,0);
});
test('unbounded distinct page tokens stop at ten pages without partial success',async()=>{
 let lists=0;
 const read=await reader(async url=>{
  if(String(url).endsWith('/profile'))return ok({emailAddress:TEST_GMAIL_ACCOUNT});
  assert.ok(String(url).includes('/messages?'));
  lists++;return ok({messages:[{id:'m'+lists}],nextPageToken:'page'+lists});
 });
 await assert.rejects(read('SYNTHETIC_TOKEN'),/lapozást/u);assert.equal(lists,10);
});
test('overlapping Gmail pages read each unique message body once',async()=>{
 const bodies=[];
 const read=await reader(async url=>{
  const u=String(url);
  if(u.endsWith('/profile'))return ok({emailAddress:TEST_GMAIL_ACCOUNT});
  if(u.includes('/messages?'))return ok(u.includes('pageToken=next')?{messages:[{id:'a'},{id:'b'}]}:{messages:[{id:'a'}],nextPageToken:'next'});
  const id=u.match(/messages\/([^?]+)/u)[1];bodies.push(id);return ok(message(id));
 });
 assert.equal((await read('SYNTHETIC_TOKEN')).length,2);assert.deepEqual(bodies,['a','b']);
});
test('invalid list shape, token or message ID stops without a body request',async()=>{
 for(const page of [null,[],{messages:{}},{messages:[null]},{messages:[{id:'../profile'}]},{nextPageToken:4},{nextPageToken:''},{messages:Array.from({length:1001},(_,i)=>({id:'m'+i}))}]){
  let calls=0;const read=await reader(async url=>{calls++;return String(url).endsWith('/profile')?ok({emailAddress:TEST_GMAIL_ACCOUNT}):ok(page);});
  await assert.rejects(read('SYNTHETIC_TOKEN'));assert.equal(calls,2);
 }
});
test('a body returned for another message ID stops the remaining reads',async()=>{
 const calls=[];const read=await reader(async url=>{
  const u=String(url);calls.push(u);
  if(u.endsWith('/profile'))return ok({emailAddress:TEST_GMAIL_ACCOUNT});
  if(u.includes('/messages?'))return ok({messages:[{id:'a'},{id:'b'}]});
  return ok(message('different'));
 });
 await assert.rejects(read('SYNTHETIC_TOKEN'),/levélazonossága/u);assert.equal(calls.length,3);
});
for(const stage of ['headers','body'])test('Gmail deadline bounds stalled '+stage+' and aborts without retry',async()=>{
 let calls=0,signal,release;const timers=[];
 const read=await reader(async(_url,options)=>{
  calls++;signal=options.signal;
  const pending=new Promise(resolve=>{release=resolve;});
  return stage==='headers'?pending:{ok:true,status:200,json:()=>pending};
 },'',{setTimeout:(fn,ms)=>{assert.equal(ms,15000);const t=setTimeout(fn,5);timers.push(t);return t;},clearTimeout});
 await assert.rejects(read('SYNTHETIC_TOKEN'),/időkorlátja.*kézzel/u);
 assert.equal(calls,1);assert.equal(signal.aborted,true);assert.equal(timers.length,1);
 release(stage==='headers'?ok({emailAddress:TEST_GMAIL_ACCOUNT}):{emailAddress:TEST_GMAIL_ACCOUNT});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);
});
test('Gmail network/JSON errors never expose token or provider error content',async()=>{
 for(const jsonFailure of [false,true]){
  let calls=0;const read=await reader(async()=>{
   calls++;
   if(jsonFailure)return {ok:true,status:200,json:async()=>{throw Error('SYNTHETIC_TOKEN private-provider-detail');}};
   throw Error('SYNTHETIC_TOKEN private-provider-detail');
  });
  await assert.rejects(read('SYNTHETIC_TOKEN'),error=>/hálózati vagy válaszfeldolgozási/u.test(error.message)&&!/SYNTHETIC_TOKEN|private-provider/u.test(error.message));assert.equal(calls,1);
 }
});
