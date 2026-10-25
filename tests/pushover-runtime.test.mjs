import test from 'node:test';import assert from 'node:assert/strict';
import {createRuntimeHandler} from '../netlify/functions/pushover-gmail.mjs';
const origin='https://leafy-chimera-2403e5.netlify.app',messageId='19abcdef12345',claim='12345678-1234-4123-8123-123456789abc';
const req=()=>new Request(origin+'/api/pushover-gmail',{method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer synthetic'},body:JSON.stringify({event:'gmail-new-message',messageId})});
const site={site:{name:'leafy-chimera-2403e5'}};
function fixture(mode){let claimed=false,pushes=0,claims=0,unknown=0,receipt=null;
 const database=async(url,options)=>{
  const p=JSON.parse(options.body);
  if(url.endsWith('sc_pushover_claim_once')){claims++;if(mode==='db-down')throw Error('synthetic DB failure');if(claimed)return Response.json({status:'duplicate'});claimed=true;return Response.json({status:'claimed',claimId:claim});}
  if(url.endsWith('sc_pushover_mark_sent')){receipt=p.p_provider_request_id;return Response.json(mode!=='db-false');}
  if(url.endsWith('sc_pushover_mark_unknown')){unknown++;return Response.json(true);}
  assert.fail('unexpected RPC');
 };
 const send=async (url,options)=>{
  if(url.startsWith('https://mojnqizbcaczstguikpv.supabase.co/'))return database(url,options);
  if(url.endsWith('/profile'))return mode==='expired-auth'?new Response('',{status:401}):Response.json({emailAddress:'sarberkiprojecttest@gmail.com'});
  if(url.startsWith('https://gmail.googleapis.com/'))return Response.json({id:messageId,internalDate:String(Date.parse('2026-10-05T16:30:00Z')),labelIds:['INBOX'],payload:{headers:[]}});
  assert.equal(url,'https://api.pushover.net/1/messages.json');pushes++;if(mode==='push-timeout')throw Error('synthetic timeout');return Response.json({status:1,request:'synthetic-provider-receipt'});
 };
 const handler=()=>createRuntimeHandler({env:{PUSHOVER_ENABLED:'true',PUSHOVER_LEDGER_ENABLED:'true',PUSHOVER_SUPABASE_URL:'https://mojnqizbcaczstguikpv.supabase.co',PUSHOVER_SUPABASE_SERVICE_ROLE_KEY:'synthetic-server-only',PUSHOVER_API_TOKEN:'a'.repeat(30),PUSHOVER_USER_KEY:'u'.repeat(30)},send});
 return{handler,state:()=>({pushes,claims,unknown,receipt})};
}
test('runtime endpoint RPC chain persists receipt and suppresses concurrent requests and restarted handler',async()=>{
 const f=fixture('ok');const responses=await Promise.all([f.handler()(req(),site),f.handler()(req(),site)]);assert.ok(responses.every(r=>r.status===200));await f.handler()(req(),site);assert.equal(f.state().pushes,1);assert.equal(f.state().receipt,'synthetic-provider-receipt');
});
for(const mode of ['db-down','push-timeout','db-false','expired-auth'])test('runtime fail-closed: '+mode,async()=>{
 const f=fixture(mode);const first=await f.handler()(req(),site);assert.ok(first.status>=400);await f.handler()(req(),site);
 assert.equal(f.state().pushes,['db-down','expired-auth'].includes(mode)?0:1);
 if(mode==='expired-auth')assert.equal(f.state().claims,0);
 if(['push-timeout','db-false'].includes(mode))assert.equal(f.state().unknown,1);
});

for(const flags of [{},{PUSHOVER_ENABLED:'true'}])test('runtime disabled gate does not resolve credentials: '+JSON.stringify(flags),async()=>{
 let reads=0,calls=0;
 const env={...flags,get PUSHOVER_SUPABASE_SERVICE_ROLE_KEY(){reads++;throw Error('must not read');}};
 const handler=createRuntimeHandler({env,send:async()=>{calls++;throw Error('must not send');}});
 const response=await handler(req(),site);assert.equal(response.status,503);assert.equal(reads,0);assert.equal(calls,0);
});
test('runtime rejects wrong project without network or leaking credentials',async()=>{
 let calls=0;const secret='synthetic-private-value';
 const handler=createRuntimeHandler({env:{PUSHOVER_ENABLED:'true',PUSHOVER_LEDGER_ENABLED:'true',PUSHOVER_SUPABASE_URL:'https://wrong.invalid',PUSHOVER_SUPABASE_SERVICE_ROLE_KEY:secret},send:async()=>{calls++;}});
 const response=await handler(req(),site);assert.equal(response.status,503);assert.equal(calls,0);assert.equal((await response.text()).includes(secret),false);
});
test('runtime rejects wrong site before resolving credentials',async()=>{
 let reads=0;const env={PUSHOVER_ENABLED:'true',PUSHOVER_LEDGER_ENABLED:'true',get PUSHOVER_SUPABASE_SERVICE_ROLE_KEY(){reads++;throw Error('must not read');}};
 const response=await createRuntimeHandler({env})(req(),{site:{name:'production'}});assert.equal(response.status,403);assert.equal(reads,0);
});
