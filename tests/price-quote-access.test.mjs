import test from 'node:test';
import assert from 'node:assert/strict';
import {createPriceQuoteHandler,config} from '../netlify/functions/price-quote.mjs';
import {createOperatorCookieSession} from '../shared-core/operator-cookie-session.mjs';
const origin='https://leafy-chimera-2403e5.netlify.app';
function fixture(){
 const env={URL:origin,PREVIO_READ_SAFETY_VERIFIED:'true',CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',SUPABASE_URL:'https://mojnqizbcaczstguikpv.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_PUBLIC_KEY_12345',SARBERKI_OPERATOR_SESSION_KEY:'ab'.repeat(32)};
 const state={auth:0,capacity:0,price:0,fx:0,revoked:false,read:true,tenant:'sarberki-test',offline:false};
 const fetchImpl=async url=>{
  state.auth++;
  if(state.offline)throw Error('PRIVATE_UPSTREAM_DETAIL');
  if(state.revoked)return new Response('{}',{status:401});
  if(url.includes('/auth/v1/token'))return Response.json({access_token:'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:'synthetic-operator',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic_signature',refresh_token:'synthetic_refresh_token_123',user:{id:'synthetic-operator'}});
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'synthetic-operator'});
  if(url.includes('/rest/v1/sc_memberships'))return Response.json([{user_id:'synthetic-operator',tenant_id:state.tenant,can_read:state.read}]);
  throw Error('UNEXPECTED_AUTH_REQUEST');
 };
 const headers={'origin':origin,'sec-fetch-site':'same-origin','x-sarberki-operator':'1','content-type':'application/json'};
 const session=createOperatorCookieSession({env,fetchImpl});
 const login=()=>session.login({httpMethod:'POST',headers:{...headers,host:new URL(origin).host}},{action:'login',email:'operator@synthetic.invalid',password:'SYNTHETIC_PASSWORD'});
 const handler=createPriceQuoteHandler({env,fetchImpl,
  source:async input=>{state.price++;return {...input,status:'review_required',total:90000,bookingCompleted:false};},
  capacitySource:async()=>{state.capacity++;return {availability:'available',availableUnits:1,source:'MOCK',checkedAt:new Date().toISOString()};},
  fxSource:async()=>{state.fx++;return {rate:400,date:'2026-10-28',source:'MOCK'};}});
 const request=(overrides={},url=origin+'/api/price-quote',body)=>new Request(url,{method:'POST',headers:{...headers,...overrides},body:body??JSON.stringify({arrival:'2027-10-01',departure:'2027-10-03',cabin:'deluxe',adults:2,children:[]})});
 return {env,state,login,handler,request};
}
const noSources=f=>{assert.equal(f.state.capacity,0);assert.equal(f.state.price,0);assert.equal(f.state.fx,0);};
test('anonymous, forged and Bearer requests cannot reach any external quote source',async()=>{
 const f=fixture();
 for(const headers of [{},{cookie:'__Host-sarberki-operator=forged'},{authorization:'Bearer synthetic_partner_token'},{'x-csrf-token':'a'.repeat(64)}]){
  assert.equal((await f.handler(f.request(headers))).status,401);noSources(f);
 }
 assert.equal(f.state.auth,0);
});
test('real encrypted session checks fresh read membership; cookie rotates without disclosing tokens',async()=>{
 const f=fixture(),logged=await f.login();f.state.auth=0;
 const res=await f.handler(f.request({cookie:logged.setCookie.split(';')[0],'x-csrf-token':logged.metadata.csrfToken}));
 assert.equal(res.status,200);assert.equal(f.state.auth,3);assert.equal(f.state.capacity,1);assert.equal(f.state.price,1);assert.equal(f.state.fx,1);
 assert.match(res.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
 assert.equal(res.headers.get('cache-control'),'private, no-store');
 const body=await res.text();assert.doesNotMatch(body,/refresh_token|access_token|synthetic_signature|SYNTHETIC_PASSWORD/);
 assert.equal(JSON.parse(body).bookingCompleted,false);
});
test('missing CSRF, foreign origin/site and spoofed operator flags are denied before Auth',async()=>{
 const f=fixture(),logged=await f.login();f.state.auth=0;
 const headers={cookie:logged.setCookie.split(';')[0],'x-csrf-token':logged.metadata.csrfToken};
 for(const change of [{'x-csrf-token':''},{origin:'https://foreign.invalid'},{'sec-fetch-site':'cross-site'},{'x-sarberki-operator':'0'},{origin:''}]){
  assert.equal((await f.handler(f.request({...headers,...change}))).status,403);noSources(f);
 }
 assert.equal(f.state.auth,0);
});
test('revocation, removed membership, foreign tenant and Auth outage fail closed',async()=>{
 const f=fixture(),logged=await f.login();const headers={cookie:logged.setCookie.split(';')[0],'x-csrf-token':logged.metadata.csrfToken};
 for(const [change,status] of [[{revoked:true},401],[{revoked:false,read:false},403],[{read:true,tenant:'demo-test'},403],[{tenant:'sarberki-test',offline:true},503]]){
  Object.assign(f.state,change);const res=await f.handler(f.request(headers));assert.equal(res.status,status);noSources(f);
  assert.doesNotMatch(await res.text(),/PRIVATE_UPSTREAM_DETAIL|refresh_token|access_token/);
 }
});
test('closed gate, production and unsupported methods never authenticate or call sources',async()=>{
 const f=fixture();f.env.PREVIO_READ_SAFETY_VERIFIED='false';
 assert.equal((await f.handler(f.request())).status,503);
 f.env.PREVIO_READ_SAFETY_VERIFIED='true';
 assert.equal((await f.handler(f.request({},'https://moonlit-torrone-88b39d.netlify.app/api/price-quote'))).status,503);
 assert.equal((await f.handler(new Request(origin+'/api/price-quote'))).status,405);
 assert.equal((await f.handler(f.request({},origin.replace('https:','http:')+'/api/price-quote'))).status,503);
 assert.equal(f.state.auth,0);noSources(f);
});
test('direct function URL has the same cookie boundary and platform rate limit',async()=>{
 const f=fixture();assert.equal((await f.handler(f.request({},origin+'/.netlify/functions/price-quote'))).status,401);noSources(f);
 assert.deepEqual(config.rateLimit,{windowLimit:10,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit'});
});
test('invalid authenticated input preserves rotated cookie and never reaches sources',async()=>{
 const f=fixture(),logged=await f.login();
 const res=await f.handler(f.request({cookie:logged.setCookie.split(';')[0],'x-csrf-token':logged.metadata.csrfToken},undefined,'{"arrival":"invalid"}'));
 assert.equal(res.status,503);assert.ok(res.headers.get('set-cookie'));noSources(f);
});
