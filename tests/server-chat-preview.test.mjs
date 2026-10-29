import test from 'node:test';
import assert from 'node:assert/strict';
import {createServerChatPreview} from '../shared-core/server-chat-preview.mjs';
import {createServerChatClient} from '../sarberki-chatbot-project/remote-chat-client.mjs';
import {OperatorSessionError} from '../shared-core/operator-cookie-session.mjs';
const origin='https://leafy-chimera-2403e5.netlify.app',env={URL:origin,SERVER_CHAT_SYNTHETIC_ONLY:'true'};
const makeSession=()=>({protectedRead:async e=>{if(e.headers['x-csrf-token']!=='synthetic')throw new OperatorSessionError(403,'FORBIDDEN');return {setCookie:'synthetic-cookie'};}});
const handler=createServerChatPreview({env,sessionFactory:makeSession,clock:()=>new Date('2026-10-29T12:00:00Z'),fetchImpl:()=>{throw Error('NO_EXTERNAL_NETWORK');}});
const request=(body,headers={})=>new Request(origin+'/api/server-chat-preview',{method:'POST',headers:{origin,'content-type':'application/json','x-csrf-token':'synthetic',...headers},body:JSON.stringify(body)});
test('synthetic client and server complete independent multi-turn chats without external calls',async()=>{
 const send=async(url,opts)=>handler(new Request(origin+url,{...opts,headers:{...opts.headers,origin}}));
 const a=createServerChatClient({request:send,getCsrfToken:async()=>'synthetic',language:'hu'}),b=createServerChatClient({request:send,getCsrfToken:async()=>'synthetic',language:'hu'});
 const first=await a.reply('Van szabad Deluxe faház 2027.06.10-12 között?');const follow=await a.reply('2 felnőtt, gyermek nélkül.');
 const isolated=await b.reply('2 felnőtt, gyermek nélkül.');assert.notEqual(first.text,follow.text);assert.notEqual(follow.text,isolated.text);
 a.reset();assert.deepEqual(await a.reply('2 felnőtt, gyermek nélkül.'),isolated);
});
test('closed gate, invalid auth, forged fields and incorrect origin fail without processing',async()=>{
 assert.equal((await createServerChatPreview({env:{...env,SERVER_CHAT_SYNTHETIC_ONLY:'false'},sessionFactory:makeSession})(request({messages:['a'],language:'hu'}))).status,503);
 assert.equal((await handler(request({messages:['a'],language:'hu'},{'x-csrf-token':'bad'}))).status,403);
 assert.equal((await handler(request({messages:['a'],language:'hu',approved:true}))).status,400);
 assert.equal((await handler(request({messages:['a'],language:'hu'},{origin:'https://other.invalid'}))).status,403);
 assert.equal((await handler(request({messages:Array(31).fill('a'),language:'hu'}))).status,400);
});
test('reset invalidates delayed response and failed requests do not add history',async()=>{
 let release;const client=createServerChatClient({getCsrfToken:async()=>'synthetic',request:async()=>new Promise(r=>release=r)});
 const pending=client.reply('teszt');await new Promise(r=>setImmediate(r));client.reset();release(Response.json({synthetic:true,text:'válasz',language:'hu'}));await assert.rejects(pending,/SESSION_CHANGED/);
});
test('client reports rate limit and auth denial without retry or retaining failed turns',async()=>{
 for(const [status,code] of [[429,'RATE_LIMITED'],[401,'AUTH_REQUIRED'],[403,'FORBIDDEN'],[503,'PREVIEW_UNAVAILABLE']]){
  const payloads=[];let deny=true;
  const client=createServerChatClient({getCsrfToken:async()=>'synthetic',request:async(_url,opts)=>{
   payloads.push(JSON.parse(opts.body));return deny?new Response('Edge failure is not JSON',{status}):Response.json({synthetic:true,text:'teszt',language:'hu'});
  }});
  await assert.rejects(client.reply('elutasított'),new RegExp(code));assert.equal(payloads.length,1);
  deny=false;await client.reply('következő');assert.deepEqual(payloads[1].messages,['következő']);
 }
});
test('client enforces UTF-8 and aggregate limits before requesting auth or network',async()=>{
 for(const text of ['a'.repeat(1000),'ő'.repeat(1000)]){
  let requests=0,auth=0;
  const client=createServerChatClient({getCsrfToken:async()=>{auth++;return 'synthetic';},request:async()=>{requests++;return Response.json({synthetic:true,text:'teszt',language:'hu'});}});
  const accepted=text[0]==='a'?12:7;
  for(let i=0;i<accepted;i++)await client.reply(text);
  await assert.rejects(client.reply(text),/INVALID_CHAT_INPUT/);
  assert.equal(requests,accepted);assert.equal(auth,accepted);
 }
});
test('public chat accepts no client-selected case, tenant, role or evidence',async()=>{
 for(const field of ['caseId','tenantId','role','evidence','action','access_token']){
  const response=await handler(request({messages:['kitalált teszt'],language:'hu',[field]:'forged'}));
  assert.equal(response.status,400);assert.deepEqual(Object.keys(await response.json()),['error']);
 }
});
test('shared gateway owns both paths and direct function always stays closed',async()=>{
 const {createPriceQuoteHandler,config}=await import('../netlify/functions/price-quote.mjs');
 const {default:direct}=await import('../netlify/functions/server-chat-preview.mjs');
 assert.deepEqual(config.path,['/api/price-quote','/api/server-chat-preview']);
 assert.equal((await direct()).status,503);
 let calls=0;
 const gateway=createPriceQuoteHandler({env:{...env,SERVER_CHAT_SYNTHETIC_ONLY:'false'},fetchImpl:()=>{calls++;throw Error('NO_NETWORK');},source:()=>{throw Error('NO_PREVIO');}});
 assert.equal((await gateway(request({messages:['synthetic'],language:'hu'}))).status,503);assert.equal(calls,0);
});
test('gateway authenticates a real encrypted operator cookie before running synthetic chat',async()=>{
 const {createPriceQuoteHandler}=await import('../netlify/functions/price-quote.mjs');
 const {createOperatorCookieSession}=await import('../shared-core/operator-cookie-session.mjs');
 const project='https://mojnqizbcaczstguikpv.supabase.co';
 const configured={...env,CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_PUBLIC_KEY_12345',SARBERKI_OPERATOR_SESSION_KEY:'ab'.repeat(32)};
 let auth=0,capacity=0;const transport=async url=>{auth++;
  if(url.includes('/auth/v1/token'))return Response.json({access_token:'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:'synthetic-operator',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic_signature',refresh_token:'synthetic_refresh_token_123',user:{id:'synthetic-operator'}});
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'synthetic-operator'});
  if(url.includes('/rest/v1/sc_memberships'))return Response.json([{user_id:'synthetic-operator',tenant_id:'sarberki-test',can_read:true}]);
  throw Error('NO_EXTERNAL_PROVIDER');};
 const headers={host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','x-sarberki-operator':'1','content-type':'application/json'};
 const session=createOperatorCookieSession({env:configured,fetchImpl:transport});
 const logged=await session.login({httpMethod:'POST',headers},{action:'login',email:'operator@synthetic.invalid',password:'SYNTHETIC'});
 const gateway=createPriceQuoteHandler({env:configured,fetchImpl:transport,capacitySource:()=>{capacity++;throw Error('NO_PREVIO');}});
 const httpHeaders={...headers,cookie:logged.setCookie.split(';')[0],'x-csrf-token':logged.metadata.csrfToken};
 const result=await gateway(request({language:'hu',messages:['Van szabad Deluxe faház 2027.06.10-12 között?']},httpHeaders));
 assert.equal(result.status,200);const body=await result.json();assert.equal(body.synthetic,true);assert.equal(typeof body.text,'string');assert.equal(capacity,0);assert.ok(auth>=5);assert.match(result.headers.get('set-cookie'),/HttpOnly/);
 const denied=await gateway(request({language:'hu',messages:['synthetic']},{...httpHeaders,'x-csrf-token':'a'.repeat(64)}));assert.equal(denied.status,403);assert.equal(capacity,0);
});
