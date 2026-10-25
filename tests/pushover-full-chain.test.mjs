import test from 'node:test';import assert from 'node:assert/strict';
import {createHandler} from '../netlify/functions/pushover-gmail.mjs';
import {createPushoverLedger} from '../netlify/functions/_shared/pushover-ledger.mjs';
import {createPushoverRpc} from '../netlify/functions/_shared/pushover-rpc.mjs';
const origin='https://leafy-chimera-2403e5.netlify.app',messageId='19abcdef12345',claim='12345678-1234-4123-8123-123456789abc';
const req=()=>new Request(origin+'/api/pushover-gmail',{method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer synthetic'},body:JSON.stringify({event:'gmail-new-message',messageId})});
const site={site:{name:'leafy-chimera-2403e5'}};
function fixture(mode){let claimed=false,pushes=0,claims=0,unknown=0,receipt=null;
 const rpc=createPushoverRpc({url:'https://mojnqizbcaczstguikpv.supabase.co',key:'synthetic-server-only',send:async(url,options)=>{
  const p=JSON.parse(options.body);
  if(url.endsWith('sc_pushover_claim_once')){claims++;if(mode==='db-down')throw Error('synthetic DB failure');if(claimed)return Response.json({status:'duplicate'});claimed=true;return Response.json({status:'claimed',claimId:claim});}
  if(url.endsWith('sc_pushover_mark_sent')){receipt=p.p_provider_request_id;return Response.json(mode!=='db-false');}
  if(url.endsWith('sc_pushover_mark_unknown')){unknown++;return Response.json(true);}
  assert.fail('unexpected RPC');
 }});
 const ledger=createPushoverLedger({rpc});
 const send=async url=>{
  if(url.endsWith('/profile'))return mode==='expired-auth'?new Response('',{status:401}):Response.json({emailAddress:'sarberkiprojecttest@gmail.com'});
  if(url.startsWith('https://gmail.googleapis.com/'))return Response.json({id:messageId,internalDate:String(Date.parse('2026-10-05T16:30:00Z')),labelIds:['INBOX'],payload:{headers:[]}});
  assert.equal(url,'https://api.pushover.net/1/messages.json');pushes++;if(mode==='push-timeout')throw Error('synthetic timeout');return Response.json({status:1,request:'synthetic-provider-receipt'});
 };
 const handler=()=>createHandler({env:{PUSHOVER_ENABLED:'true',PUSHOVER_API_TOKEN:'a'.repeat(30),PUSHOVER_USER_KEY:'u'.repeat(30)},ledger,send});
 return{handler,state:()=>({pushes,claims,unknown,receipt})};
}
test('full endpoint RPC chain persists receipt and suppresses concurrent requests and restarted handler',async()=>{
 const f=fixture('ok');const responses=await Promise.all([f.handler()(req(),site),f.handler()(req(),site)]);assert.ok(responses.every(r=>r.status===200));await f.handler()(req(),site);assert.equal(f.state().pushes,1);assert.equal(f.state().receipt,'synthetic-provider-receipt');
});
for(const mode of ['db-down','push-timeout','db-false','expired-auth'])test('full chain fail-closed: '+mode,async()=>{
 const f=fixture(mode);const first=await f.handler()(req(),site);assert.ok(first.status>=400);await f.handler()(req(),site);
 assert.equal(f.state().pushes,['db-down','expired-auth'].includes(mode)?0:1);
 if(mode==='expired-auth')assert.equal(f.state().claims,0);
 if(['push-timeout','db-false'].includes(mode))assert.equal(f.state().unknown,1);
});
