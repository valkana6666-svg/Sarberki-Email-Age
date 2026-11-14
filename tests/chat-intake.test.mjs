// V3-3 chat booking request: off by default, same-origin, consent + phone, IP never stored, fixed codes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatIntakeHandler} from '../netlify/functions/chat-intake.mjs';
import {requestFacts} from '../sarberki-chatbot-project/chat-request-client.mjs';

const env={INTAKE_ENABLED:'test-only',INTAKE_CHAT_ENABLED:'test-only',SUPABASE_URL:'https://mojnqizbcaczstguikpv.supabase.co',INTAKE_HMAC_KEY:'ab'.repeat(32),
 SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',INTAKE_ACCOUNT_EMAIL:'intake@example.test',INTAKE_ACCOUNT_PASSWORD:'not-a-real-secret',ISOLATED_APPROVAL_ATTESTATION_KEY:'e5'.repeat(32)};
const body={consent:true,facts:{arrival:'2027-07-12',departure:'2027-07-15',adults:2,children:0,cabin:'deluxe'},language:'hu',phone:'+36 30 000 0000',transcript:['Deluxe faházat kérnénk július 12–15.']};
const req=(b=body,h={})=>new Request('https://leafy-chimera-2403e5.netlify.app/.netlify/functions/chat-intake',{method:'POST',body:JSON.stringify(b),
 headers:{origin:'https://leafy-chimera-2403e5.netlify.app','sec-fetch-site':'same-origin','content-type':'application/json','x-nf-client-connection-ip':'198.51.100.7',...h}});

test('off by default; only same-origin JSON; consent and phone required',async()=>{
 assert.equal((await createChatIntakeHandler({env:{...env,INTAKE_CHAT_ENABLED:''}})(req())).status,503);
 assert.equal((await createChatIntakeHandler({env:{...env,INTAKE_ENABLED:''}})(req())).status,503);
 const h=createChatIntakeHandler({env});
 assert.equal((await h(req(body,{origin:'https://evil.example'}))).status,403);
 assert.equal((await h(req(body,{'sec-fetch-site':'cross-site'}))).status,403);
 assert.deepEqual(await (await h(req({...body,consent:false}))).json(),{error:'CONSENT_REQUIRED'});
 assert.deepEqual(await (await h(req({...body,phone:'nincs'}))).json(),{error:'PHONE_REQUIRED'});
 assert.equal((await h(req({...body,extra:1}))).status,400,'unknown keys refused');
 assert.equal((await h(req({...body,transcript:[]}))).status,400);
});

test('creates the request through the intake account; the IP is only a keyed fingerprint; failures say "try later"',async()=>{
 const calls=[];
 const fetchImpl=async(url,o={})=>{calls.push({url:String(url),body:o.body?JSON.parse(o.body):null});
  if(String(url).includes('/auth/v1/token'))return new Response(JSON.stringify({access_token:'jwt-intake'}));
  return new Response(JSON.stringify({caseId:'tm-x',revision:1}));};
 const r=await createChatIntakeHandler({env,fetchImpl,random:()=>'0123456789abcdef'})(req());
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:'sent'});
 const rpc=calls.find(c=>c.url.endsWith('/rest/v1/rpc/sc_intake_create'));
 const ext=rpc.body.p_data.sourceReceipt.external_id;
 assert.match(ext,/^chat_[a-f0-9]{16}_0123456789abcdef$/);
 assert.doesNotMatch(JSON.stringify(rpc.body),/198\.51\.100\.7/,'the IP is never stored');
 assert.equal(rpc.body.p_data.state.values.phone,'+36 30 000 0000');assert.equal(rpc.body.p_data.state.values.unit,'Deluxe');
 assert.ok(!calls.some(c=>c.url.includes('previo')),'no Previo read from the public path');
 const down=await createChatIntakeHandler({env,fetchImpl:async(url)=>String(url).includes('token')?new Response(JSON.stringify({access_token:'j'})):new Response('{"message":"limit detail"}',{status:400})})(req());
 assert.equal(down.status,503);const body=await down.json();assert.equal(body.error,'TRY_LATER');assert.match(body.stage,/^store-/);assert.doesNotMatch(JSON.stringify(body),/limit detail/,'no provider detail leaks');
});

test('chat facts -> request facts only when dates, adults and a cabin type are known',()=>{
 assert.equal(requestFacts({dates:{arrival:'2027-07-12',departure:'2027-07-15'},adults:2}),null);
 assert.deepEqual(requestFacts({dates:{arrival:'2027-07-12',departure:'2027-07-15'},adults:2,children:1,child_ages:[5],cabin:'Osztott C'}),
  {arrival:'2027-07-12',departure:'2027-07-15',adults:2,children:1,childAges:[5],cabin:'splitC'});
});
