import test from 'node:test';
import assert from 'node:assert/strict';
import {createDecipheriv} from 'node:crypto';
import {createOperatorCookieSession,clearOperatorCookie} from '../shared-core/operator-cookie-session.mjs';
import {createOperatorSessionHandler} from '../netlify/functions/operator-session.mjs';
import {syntheticMailEnvelope,syntheticTubFollowupEnvelope} from '../shared-core/synthetic-mail-fixtures.mjs';
import {createCaseHandler,syntheticCaseSummaries} from '../netlify/functions/booking-cases.mjs';
import {createWriterReaderFixtureHandler} from '../netlify/functions/writer-reader-fixture.mjs';
const origin='https://leafy-chimera-2403e5.netlify.app',project='https://mojnqizbcaczstguikpv.supabase.co';
const name='__Host-sarberki-operator';
const cookieHeader=setCookie=>setCookie.split(';')[0];
const json=body=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
function event({method='GET',cookie,csrf,body,headers={},query={}}={}){
 return {httpMethod:method,headers:{host:new URL(origin).host,'x-sarberki-operator':'1','sec-fetch-site':'same-origin',origin,'content-type':'application/json',...(cookie?{cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),queryStringParameters:query};
}
function fixture(){
 const env={URL:origin,CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_PUBLIC_KEY_12345',SARBERKI_OPERATOR_SESSION_KEY:'ab'.repeat(32)};
 const state={time:Date.now(),calls:[],refreshCount:0,revoked:false,membershipRead:true,userAnonymous:false,authStatus:null,networkFailure:false,logoutStatus:204,malformedAuth:false,caseSender:'guest@synthetic.invalid'};
 const jwt=()=> 'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role:'authenticated',sub:'synthetic-operator',exp:Math.floor(state.time/1000)+3600})).toString('base64url')+'.synthetic_signature';
 const fetchImpl=async(url,options={})=>{
  state.calls.push({url,options});assert.ok(url.startsWith(project+'/'),url);
  if(url.includes('/auth/v1/token')){
   if(state.networkFailure)throw Error('SYNTHETIC_NETWORK_FAILURE');
   if(state.authStatus||state.revoked)return new Response('{}',{status:state.authStatus||401});
   if(state.malformedAuth)return json({access_token:'INVALID_SYNTHETIC_TOKEN',refresh_token:'short',user:{id:'other'}});
   const refreshing=url.includes('refresh_token');if(refreshing)state.refreshCount++;
   return json({access_token:jwt(),refresh_token:'synthetic_refresh_token_'+state.refreshCount,user:{id:'synthetic-operator'}});
  }
  if(url.includes('/auth/v1/logout'))return new Response(state.logoutStatus===204?null:'{}',{status:state.logoutStatus});
  if(url.endsWith('/auth/v1/user'))return json({id:'synthetic-operator',is_anonymous:state.userAnonymous});
  if(url.includes('/rest/v1/sc_memberships'))return json([{tenant_id:'sarberki-test',user_id:'synthetic-operator',can_read:state.membershipRead,can_write:state.membershipWrite===true,can_approve:state.membershipApprove===true}]);
  if(state.fixtureRows&&url.includes('/rest/v1/rpc/sc_write_case')){
   if(!state.membershipWrite)return new Response('{}',{status:403});
   const input=JSON.parse(options.body),prior=state.fixtureRows.get(input.p_case);
   if((prior?.revision||0)!==input.p_expected)return json(false);
   state.fixtureRows.set(input.p_case,{tenant_id:input.p_tenant,case_id:input.p_case,revision:input.p_expected+1,data:input.p_data,created_at:new Date(state.time).toISOString(),updated_at:new Date(state.time).toISOString(),updated_by:'synthetic-operator'});return json(true);
  }
  if(state.fixtureRows&&url.includes('/rest/v1/sc_cases')){
   const id=new URL(url).searchParams.get('case_id')?.slice(3);
   return json([...state.fixtureRows.values()].filter(row=>!id||row.case_id===id));
  }
  if(url.includes('/rest/v1/sc_cases'))return json([{tenant_id:'sarberki-test',case_id:'case-synthetic',revision:1,data:{id:'case-synthetic',tenantId:'sarberki-test',sender:state.caseSender},created_at:new Date(state.time).toISOString(),updated_at:new Date(state.time).toISOString(),updated_by:'synthetic-operator'}]);
  throw Error('Unexpected synthetic transport');
 };
 const now=()=>state.time,session=createOperatorCookieSession({env,fetchImpl,now}),handler=createOperatorSessionHandler({env,fetchImpl,now});
 const login=()=>session.login(event({method:'POST'}),{action:'login',email:'operator@synthetic.invalid',password:'SYNTHETIC_NOT_A_REAL_PASSWORD'});
 return {env,state,fetchImpl,now,session,handler,login};
}
function decode(setCookie,key){
 const [version,iv,encrypted,tag]=cookieHeader(setCookie).slice(name.length+1).split('.');assert.equal(version,'v1');
 const decrypt=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),Buffer.from(iv,'base64url'));decrypt.setAAD(Buffer.from(name+'|'+origin+'|'+project+'|v1'));decrypt.setAuthTag(Buffer.from(tag,'base64url'));
 return JSON.parse(Buffer.concat([decrypt.update(Buffer.from(encrypted,'base64url')),decrypt.final()]).toString());
}
test('protected Writer fixture stores one pending draft; Reader reads it but cannot create/edit/approve',async()=>{
 const f=fixture();f.state.membershipWrite=true;f.state.fixtureRows=new Map();
 const logged=await f.login(),handler=createWriterReaderFixtureHandler({env:f.env,fetchImpl:f.fetchImpl,now:f.now});
 let cookie=cookieHeader(logged.setCookie);const csrf=logged.metadata.csrfToken;
 const create=()=>handler(event({method:'POST',cookie,csrf,body:{action:'create-reader-fixture'}}));
 const first=await create();assert.equal(first.statusCode,200);
 const result=JSON.parse(first.body).result;cookie=cookieHeader(first.headers['Set-Cookie']);
 assert.equal(result.readyForReaderPreview,true);assert.equal(result.duplicate,false);assert.equal(result.revision,1);
 assert.match(result.caseId,/^[a-f0-9-]{36}$/);
 assert.doesNotMatch(first.body,/access_token|refresh_token|Bearer|guest@|Please book/);
 const stored=f.state.fixtureRows.get(result.caseId);
 assert.equal(stored.data.state.approval,'pending');assert.equal(stored.data.drafts.length,1);
 assert.ok(stored.data.drafts[0].text.length>20);
 const duplicate=await create();assert.equal(duplicate.statusCode,200);assert.equal(JSON.parse(duplicate.body).result.duplicate,true);
 cookie=cookieHeader(duplicate.headers['Set-Cookie']);assert.equal(f.state.fixtureRows.size,1);
 f.state.membershipWrite=false;
 const denied=await create();assert.equal(denied.statusCode,403);assert.equal(JSON.parse(denied.body).error,'FORBIDDEN');
 cookie=cookieHeader(denied.headers['Set-Cookie']); // Reader remains able to refresh/read.
 const cases=createCaseHandler({env:f.env,fetchImpl:f.fetchImpl});
 const list=await cases(event({cookie,csrf,query:{tenantId:'sarberki-test'}}));assert.equal(list.statusCode,200);
 assert.deepEqual(JSON.parse(list.body).result,[{tenantId:'sarberki-test',caseId:result.caseId,revision:1}]);
 cookie=cookieHeader(list.headers['Set-Cookie']);
 const preview=await cases(event({cookie,csrf,query:{tenantId:'sarberki-test',caseId:result.caseId,expectedRevision:'1',action:'preview-draft'}}));
 assert.equal(preview.statusCode,200);const p=JSON.parse(preview.body).result;
 assert.equal(p.storedDraft.text,stored.data.drafts[0].text);assert.equal(p.approval,'pending');assert.equal(p.persisted,false);
 assert.equal(p.decision.capacity.verified,false);assert.equal(p.decision.pricing.verified,false);
 for(const action of ['ingest-and-draft','edit-draft','approve']){
  const response=await cases(event({method:'POST',cookie,csrf,body:{tenantId:'sarberki-test',caseId:result.caseId,action}}));
  assert.equal(response.statusCode,401);
 }
 assert.equal(f.state.fixtureRows.get(result.caseId).revision,1);
});
test('Writer fixture rejects cross-origin, missing CSRF, custom data, revoked sessions and production',async()=>{
 const f=fixture();f.state.membershipWrite=true;const logged=await f.login();
 const handler=createWriterReaderFixtureHandler({env:f.env,fetchImpl:f.fetchImpl,now:f.now});
 const base={method:'POST',cookie:cookieHeader(logged.setCookie),csrf:logged.metadata.csrfToken,body:{action:'create-reader-fixture'}};
 for(const [change,status] of [[{headers:{origin:'https://example.com'}},403],[{headers:{'sec-fetch-site':'cross-site'}},403],[{csrf:undefined},403],
  [{body:{action:'create-reader-fixture',envelope:{sender:'real@example.com'}}},400],[{body:{action:'approve'}},400],[{method:'GET'},405]]){
  f.state.calls=[];const response=await handler(event({...base,...change}));assert.equal(response.statusCode,status);assert.equal(f.state.calls.length,0);
 }
 f.state.revoked=true;assert.equal((await handler(event(base))).statusCode,401);
 f.state.revoked=false;f.env.URL='https://moonlit-torrone-88b39d.netlify.app';f.state.calls=[];
 assert.equal((await handler(event(base))).statusCode,503);assert.equal(f.state.calls.length,0);
});
test('real AEAD cookie has only refresh/CSRF/absolute expiry and is never disclosed in metadata',async()=>{
 const f=fixture(),logged=await f.login(),payload=decode(logged.setCookie,f.env.SARBERKI_OPERATOR_SESSION_KEY);
 assert.deepEqual(Object.keys(payload).sort(),['csrfToken','expiresAt','refreshToken']);assert.equal(payload.expiresAt,f.state.time+7*86400000);
 assert.match(logged.setCookie,/^__Host-sarberki-operator=/);for(const flag of ['Path=/','HttpOnly','Secure','SameSite=Strict','Max-Age=604800'])assert.ok(logged.setCookie.includes(flag));assert.doesNotMatch(logged.setCookie,/Domain=/);
 assert.deepEqual(Object.keys(logged.metadata).sort(),['authenticated','csrfToken','expiresAt','tenantId']);assert.match(logged.metadata.csrfToken,/^[a-f0-9]{64}$/);assert.equal(logged.metadata.tenantId,'sarberki-test');
 assert.doesNotMatch(JSON.stringify(logged.metadata),/synthetic_refresh_token|synthetic_signature|SYNTHETIC_NOT_A_REAL_PASSWORD/);assert.doesNotMatch(logged.setCookie,/synthetic_refresh_token|synthetic_signature/);
});
test('restore refreshes even an unexpired access session, preserves CSRF/absolute expiry and rotates encrypted cookie',async()=>{
 const f=fixture(),logged=await f.login();f.state.calls=[];
 const first=await f.session.restore(event({cookie:cookieHeader(logged.setCookie)}));assert.equal(f.state.refreshCount,1);assert.equal(first.metadata.csrfToken,logged.metadata.csrfToken);assert.equal(first.metadata.expiresAt,logged.metadata.expiresAt);assert.notEqual(first.setCookie,logged.setCookie);
 assert.equal(decode(first.setCookie,f.env.SARBERKI_OPERATOR_SESSION_KEY).refreshToken,'synthetic_refresh_token_1');
 assert.equal(f.state.calls[0].url,project+'/auth/v1/token?grant_type=refresh_token');assert.deepEqual(f.state.calls.map(x=>new URL(x.url).pathname),['/auth/v1/token','/auth/v1/user','/rest/v1/sc_memberships']);
 f.state.time+=1000;const next=await f.session.restore(event({cookie:cookieHeader(first.setCookie)}));assert.equal(next.metadata.expiresAt,logged.metadata.expiresAt);assert.ok(next.setCookie.includes('Max-Age=604799'));
});
test('missing, duplicate, malformed, tampered or expired cookie fails closed before any Auth/DB call',async()=>{
 const f=fixture(),logged=await f.login(),header=cookieHeader(logged.setCookie);f.state.calls=[];
 for(const cookie of [undefined,name+'=broken',header+'; '+header,header.replace('v1.','v2.'),header.slice(0,-10)+'AAAAAAAAAA']){
  await assert.rejects(f.session.restore(event({cookie})),error=>error.status===401&&error.setCookie===clearOperatorCookie);assert.equal(f.state.calls.length,0);
 }
 f.state.time+=7*86400000;await assert.rejects(f.session.restore(event({cookie:header})),error=>error.status===401);assert.equal(f.state.calls.length,0);
});
test('wrong encryption key cannot restore a valid cookie',async()=>{
 const f=fixture(),logged=await f.login();f.state.calls=[];f.env.SARBERKI_OPERATOR_SESSION_KEY='cd'.repeat(32);await assert.rejects(f.session.restore(event({cookie:cookieHeader(logged.setCookie)})),error=>error.status===401);assert.equal(f.state.calls.length,0);
});
test('origin/host/Fetch Metadata/custom header and duplicate-sensitive headers block access before refresh',async()=>{
 const f=fixture(),logged=await f.login();f.state.calls=[];
 for(const headers of [{host:'foreign.netlify.app'},{origin:'https://foreign.example'},{'sec-fetch-site':'cross-site'},{'sec-fetch-site':undefined},{'x-sarberki-operator':'0'},{Origin:origin}]){
  await assert.rejects(f.session.restore(event({cookie:cookieHeader(logged.setCookie),headers})),error=>error.status===403);assert.equal(f.state.calls.length,0);
 }
});
test('cookie-bound CSRF required on protected GET/logout; restore permits nonce recovery with same-origin header',async()=>{
 const f=fixture(),logged=await f.login();f.state.calls=[];
 for(const csrf of [undefined,'00'.repeat(32),'invalid']){
  await assert.rejects(f.session.protectedRead(event({cookie:cookieHeader(logged.setCookie),csrf})),error=>error.status===403);await assert.rejects(f.session.logout(event({method:'POST',cookie:cookieHeader(logged.setCookie),csrf})),error=>error.status===403);assert.equal(f.state.calls.length,0);
 }
 const current=await f.session.protectedRead(event({cookie:cookieHeader(logged.setCookie),csrf:logged.metadata.csrfToken}));assert.equal(current.metadata.authenticated,true);assert.equal(f.state.refreshCount,1);
});
test('all setup gates reject wrong target, missing/invalid key or privileged credentials before Auth',async()=>{
 for(const change of [{URL:'https://foreign.netlify.app'},{CASE_STORE_ENABLED:'true'},{CASE_STORE_TEST_TENANTS:'sarberki-test'},{SUPABASE_URL:'https://other.supabase.co'},{SUPABASE_PUBLISHABLE_KEY:'sb_secret_SYNTHETIC_PRIVATE'},{SARBERKI_OPERATOR_SESSION_KEY:undefined},{SARBERKI_OPERATOR_SESSION_KEY:'short'}]){
  const f=fixture();Object.assign(f.env,change);await assert.rejects(f.login(),error=>error.status===503&&error.code==='SESSION_SETUP_REQUIRED');assert.equal(f.state.calls.length,0);
 }
});
test('invalid credentials and malformed Auth tokens cannot create a cookie; anonymous/wrong authority cannot login',async()=>{
 for(const change of [{authStatus:400},{authStatus:401},{authStatus:403},{malformedAuth:true},{membershipRead:false},{userAnonymous:true}]){
  const f=fixture();Object.assign(f.state,change);await assert.rejects(f.login(),error=>[401,403].includes(error.status));assert.equal(f.state.calls.some(x=>x.url.includes('/sc_cases')),false);
 }
});
test('revoked session rejects refresh and clears cookie despite originally unexpired access token',async()=>{
 const f=fixture(),logged=await f.login();f.state.revoked=true;f.state.calls=[];
 await assert.rejects(f.session.protectedRead(event({cookie:cookieHeader(logged.setCookie),csrf:logged.metadata.csrfToken})),error=>error.status===401&&error.setCookie===clearOperatorCookie);
 assert.equal(f.state.calls.length,1);assert.ok(f.state.calls[0].url.includes('grant_type=refresh_token'));
});
test('transient refresh failure preserves cookie but denies data, and removed read membership clears cookie',async()=>{
 for(const change of [{networkFailure:true},{authStatus:500}]){
  const f=fixture(),logged=await f.login();Object.assign(f.state,change);f.state.calls=[];
  await assert.rejects(f.session.restore(event({cookie:cookieHeader(logged.setCookie)})),error=>error.status===503&&!error.setCookie);assert.equal(f.state.calls.length,1);
 }
 const f=fixture(),logged=await f.login();f.state.membershipRead=false;await assert.rejects(f.session.restore(event({cookie:cookieHeader(logged.setCookie)})),error=>error.status===403&&error.setCookie===clearOperatorCookie);
});
test('logout refreshes and revokes only current session, always clears local cookie on upstream failure',async()=>{
 for(const logoutStatus of [204,500]){
  const f=fixture(),logged=await f.login();f.state.logoutStatus=logoutStatus;f.state.calls=[];
  if(logoutStatus===204){const result=await f.session.logout(event({method:'POST',cookie:cookieHeader(logged.setCookie),csrf:logged.metadata.csrfToken}));assert.deepEqual(result.metadata,{authenticated:false});assert.equal(result.setCookie,clearOperatorCookie);}
  else await assert.rejects(f.session.logout(event({method:'POST',cookie:cookieHeader(logged.setCookie),csrf:logged.metadata.csrfToken})),error=>error.status===503&&error.setCookie===clearOperatorCookie);
  assert.ok(f.state.calls.some(x=>x.url===project+'/auth/v1/logout?scope=local'));assert.equal(f.state.calls.some(x=>x.url.includes('/sc_cases')),false);
 }
});
test('HTTP endpoint has private no-store responses, no tokens and bounded input/method validation',async()=>{
 const f=fixture();const missing=await f.handler(event());assert.equal(missing.statusCode,401);assert.equal(JSON.parse(missing.body).error,'AUTH_REQUIRED');
 const response=await f.handler(event({method:'POST',body:{action:'login',email:'operator@synthetic.invalid',password:'SYNTHETIC_NOT_A_REAL_PASSWORD'}}));assert.equal(response.statusCode,200);assert.equal(response.headers['Cache-Control'],'private, no-store');assert.ok(response.headers['Set-Cookie']);assert.doesNotMatch(response.body,/access_token|refresh_token|synthetic_refresh|synthetic_signature/);
 for(const e of [{...event(),httpMethod:'DELETE'},event({method:'POST',body:{action:'login',email:'operator@synthetic.invalid',password:'x',role:'admin'}}),{...event({method:'POST'}),body:'not json'}, {...event({method:'POST'}),body:'x'.repeat(4097)}, {...event({method:'POST'}),isBase64Encoded:true,body:'e30='}]){assert.ok([400,405].includes((await f.handler(e)).statusCode));}
});
test('booking cookie GET refreshes first, reuses verified authority once, forwards rotation; cannot write or change tenant',async()=>{
 const f=fixture(),logged=await f.login(),handler=createCaseHandler({env:f.env,fetchImpl:f.fetchImpl});f.state.calls=[];
 const e=event({cookie:cookieHeader(logged.setCookie),csrf:logged.metadata.csrfToken,query:{tenantId:'sarberki-test'}}),result=await handler(e);
 assert.equal(result.statusCode,200);
 assert.deepEqual(JSON.parse(result.body).result,[{tenantId:'sarberki-test',caseId:'case-synthetic',revision:1}]);
 assert.doesNotMatch(result.body,/synthetic-operator|guest@synthetic|updated_by|\/auth\/|original/);
 assert.equal(result.headers['Cache-Control'],'private, no-store');assert.ok(result.headers['Set-Cookie']);
 assert.deepEqual(f.state.calls.map(x=>new URL(x.url).pathname),['/auth/v1/token','/auth/v1/user','/rest/v1/sc_memberships','/rest/v1/sc_cases']);
 f.state.calls=[];assert.equal((await handler({...e,httpMethod:'POST',body:'{"action":"draft"}'})).statusCode,401);
 assert.equal((await handler({...e,queryStringParameters:{tenantId:'demo-test'}})).statusCode,403);
 assert.equal((await handler({...e,queryStringParameters:{tenantId:'sarberki-test',caseId:'case-synthetic'}})).statusCode,403);
 assert.equal(f.state.calls.length,0);
});
test('cookie case API CSRF, revoked, malformed and transient errors never reach case storage',async()=>{
 for(const mode of ['csrf','revoked','malformed','transient']){
  const f=fixture(),logged=await f.login(),handler=createCaseHandler({env:f.env,fetchImpl:f.fetchImpl});f.state.calls=[];
  if(mode==='revoked')f.state.revoked=true;if(mode==='malformed')f.state.malformedAuth=true;if(mode==='transient')f.state.networkFailure=true;
  const result=await handler(event({cookie:cookieHeader(logged.setCookie),csrf:mode==='csrf'?'00'.repeat(32):logged.metadata.csrfToken,query:{tenantId:'sarberki-test'}}));
  assert.equal(result.statusCode,mode==='csrf'?403:mode==='transient'?503:401);assert.equal(f.state.calls.some(x=>x.url.includes('/rest/v1/sc_cases')),false);if(mode==='transient')assert.equal(result.headers['Set-Cookie'],undefined);
 }
});
test('synthetic case picker projects only tenant, id and revision, never stored guest fields',()=>{
 const privateValues='DO_NOT_SHARE_RECORD_CONTENT';
 const records=[
  {tenantId:'sarberki-test',caseId:'case-fake123',revision:9,data:{sender:'guest@synthetic.invalid',original:privateValues,drafts:[{text:privateValues}],state:{quote:{total:12500}}}},
  {tenantId:'sarberki-test',caseId:'case-real123',revision:4,data:{sender:'guest@example.com',original:'real guest'}},
  {tenantId:'sarberki-test',caseId:'case-fake456',revision:5,data:{sender:'guest@notinvalid',original:'invalid sender'}},
  {tenantId:'demo-test',caseId:'case-demo123',revision:3,data:{sender:'guest@synthetic.invalid'}},
  {tenantId:'sarberki-test',caseId:'case-fake789',revision:0,data:{sender:'guest@synthetic.invalid'}},
  {tenantId:'sarberki-test',caseId:'bad-ID',revision:2,data:{sender:'guest@synthetic.invalid'}}
 ];
 const actual=syntheticCaseSummaries(records);
 assert.deepEqual(actual,[{tenantId:'sarberki-test',caseId:'case-fake123',revision:9}]);
 assert.doesNotMatch(JSON.stringify(actual),/DO_NOT_SHARE_RECORD_CONTENT|guest@|drafts|quote|state/);
 assert.throws(()=>syntheticCaseSummaries({}),/INVALID_CASE_LIST/);
});
test('cookie reader cannot retrieve a raw case by ID even with valid cookie',async()=>{
 const f=fixture(),logged=await f.login(),handler=createCaseHandler({env:f.env,fetchImpl:f.fetchImpl});f.state.calls=[];
 const r=await handler(event({cookie:cookieHeader(logged.setCookie),csrf:logged.metadata.csrfToken,
  query:{tenantId:'sarberki-test',caseId:'case-synthetic'}}));
 assert.equal(r.statusCode,403);assert.equal(JSON.parse(r.body).error,'FORBIDDEN');
 assert.equal(f.state.calls.length,0);
});
test('cookie-only server preview fails closed on a non-synthetic guest sender',async()=>{
 const f=fixture(),logged=await f.login(),handler=createCaseHandler({env:f.env,fetchImpl:f.fetchImpl});
 f.state.caseSender='guest@example.com';
 const result=await handler(event({cookie:cookieHeader(logged.setCookie),csrf:logged.metadata.csrfToken,
  query:{tenantId:'sarberki-test',action:'preview-draft',caseId:'case-synthetic',expectedRevision:'1'}}));
 assert.equal(result.statusCode,403);
 assert.equal(JSON.parse(result.body).error,'FORBIDDEN');
 assert.doesNotMatch(result.body,/guest@example|original|text|draft/);
});
test('existing bearer GET remains independent of cookie key and cookie CSRF requirements',async()=>{
 const f=fixture();delete f.env.SARBERKI_OPERATOR_SESSION_KEY;const handler=createCaseHandler({env:f.env,fetchImpl:f.fetchImpl});
 const result=await handler(event({headers:{authorization:'Bearer SYNTHETIC_EXISTING_BEARER_12345'},query:{tenantId:'sarberki-test',caseId:'case-synthetic'}}));assert.equal(result.statusCode,200);assert.equal(result.headers['Set-Cookie'],undefined);assert.equal(f.state.refreshCount,0);
});

test('removal of DB read membership does not prevent explicit current-session Auth logout',async()=>{
 const f=fixture(),logged=await f.login();f.state.membershipRead=false;f.state.calls=[];const result=await f.session.logout(event({method:'POST',cookie:cookieHeader(logged.setCookie),csrf:logged.metadata.csrfToken}));assert.equal(result.metadata.authenticated,false);assert.equal(result.setCookie,clearOperatorCookie);assert.deepEqual(f.state.calls.map(c=>new URL(c.url).pathname),['/auth/v1/token','/auth/v1/logout']);
});
test('cookie read refuses ignored write-like fields and duplicate header inputs before any upstream call',async()=>{
 const f=fixture(),logged=await f.login(),handler=createCaseHandler({env:f.env,fetchImpl:f.fetchImpl});f.state.calls=[];
 const response=await handler(event({cookie:cookieHeader(logged.setCookie),csrf:logged.metadata.csrfToken,query:{tenantId:'sarberki-test',envelope:'ignored'}}));assert.equal(response.statusCode,403);assert.equal(f.state.calls.length,0);
 const e=event({cookie:cookieHeader(logged.setCookie)});e.multiValueHeaders={'Cookie':[e.headers.cookie,e.headers.cookie]};await assert.rejects(f.session.restore(e),error=>error.status===403);assert.equal(f.state.calls.length,0);
});

test('conflicting or malformed primary/multivalue header maps fail before any Auth request',async()=>{
 const f=fixture(),logged=await f.login();f.state.calls=[];
 for(const multiValueHeaders of [{host:['foreign.example']},{'x-csrf-token':['00'.repeat(32)]},{host:origin},{host:[123]},{host:[{}]},{host:['x'.repeat(8193)]}]){
  const e=event({cookie:cookieHeader(logged.setCookie),csrf:logged.metadata.csrfToken});e.multiValueHeaders=multiValueHeaders;await assert.rejects(f.session.protectedRead(e),error=>error.status===403);assert.equal(f.state.calls.length,0);
 }
 const valid=event({cookie:cookieHeader(logged.setCookie),csrf:logged.metadata.csrfToken});valid.multiValueHeaders={host:[valid.headers.host],'x-csrf-token':[valid.headers['x-csrf-token']]};assert.equal((await f.session.protectedRead(valid)).metadata.authenticated,true);
});


test('cloud cookie approval requires separate fresh approve permission and same-origin CSRF',async()=>{
 const f=fixture(),logged=await f.login(),cookie=cookieHeader(logged.setCookie),csrf=logged.metadata.csrfToken;
 const approval=()=>f.session.protectedApproval(event({method:'POST',cookie,csrf}));
 await assert.rejects(approval(),error=>error.code==='FORBIDDEN');
 f.state.membershipWrite=true;await assert.rejects(approval(),error=>error.code==='FORBIDDEN');
 f.state.membershipWrite=false;f.state.membershipApprove=true;
 assert.ok((await approval()).authority.tenants['sarberki-test'].includes('approve'));
 await assert.rejects(f.session.protectedApproval(event({method:'POST',cookie})),error=>error.code==='FORBIDDEN');
 await assert.rejects(f.session.protectedApproval(event({method:'POST',cookie,csrf,headers:{origin:'https://other.example'}})),error=>error.code==='FORBIDDEN');
 f.state.revoked=true;await assert.rejects(approval(),error=>error.code==='AUTH_REQUIRED');
});
test('enabled cloud cookie route still denies Reader review and approval, including custom fields',async()=>{
 const f=fixture(),logged=await f.login(),cookie=cookieHeader(logged.setCookie),csrf=logged.metadata.csrfToken;
 const env={...f.env,CASE_APPROVAL_ENABLED:'sarberki-test-synthetic-only',ISOLATED_APPROVAL_ATTESTATION_KEY:'a1'.repeat(32)};
 const handler=createCaseHandler({env,fetchImpl:f.fetchImpl});
 for(const action of ['review-draft','approve']){
  const response=await handler(event({method:'POST',cookie,csrf,body:{tenantId:'sarberki-test',action,caseId:'case-synthetic',expectedRevision:1}}));
  assert.equal(response.statusCode,403);assert.ok(response.headers['Set-Cookie']);
 }
 const response=await handler(event({method:'POST',cookie,csrf,body:{tenantId:'sarberki-test',action:'approve',caseId:'case-synthetic',expectedRevision:1,envelope:{sender:'not@synthetic.invalid'}}}));assert.equal(response.statusCode,403);
});


test('closed mail cookie ingestion requires exact registry, Writer and CSRF; cannot accept arbitrary invalid guests or facts',async()=>{
 const f=fixture();f.state.membershipWrite=true;f.state.fixtureRows=new Map();
 const env={...f.env,CASE_APPROVAL_ENABLED:'sarberki-test-synthetic-only',ISOLATED_APPROVAL_ATTESTATION_KEY:'a1'.repeat(32)};
 const logged=await f.login();let cookie=cookieHeader(logged.setCookie);const csrf=logged.metadata.csrfToken;
 const handler=createCaseHandler({env,fetchImpl:f.fetchImpl});
 const input={tenantId:'sarberki-test',action:'ingest-and-draft',envelope:syntheticMailEnvelope('hu'),expectedRevision:0};
 const call=body=>handler(event({method:'POST',cookie,csrf,body}));
 for(const envelope of [{...input.envelope,text:input.envelope.text+' changed'},{...input.envelope,sender:'other@synthetic.invalid'},{...input.envelope,mailbox_id:'other'},{...input.envelope,message_id:'other'},{...input.envelope,thread_id:'other'},{...input.envelope,received_at:'2026-10-13T06:00:00.000Z'},{...input.envelope,case_id:'case-synthetic'}])assert.equal((await call({...input,envelope})).statusCode,403);
 assert.equal((await call({...input,values:{adults:'999'}})).statusCode,403);
 assert.equal((await call({...input,expectedRevision:1})).statusCode,403);
 assert.equal((await handler(event({method:'POST',cookie,body:input}))).statusCode,403);
 assert.equal((await handler(event({method:'POST',cookie,csrf,body:input,headers:{origin:'https://other.example'}}))).statusCode,403);
 f.state.membershipWrite=false;assert.equal((await call(input)).statusCode,403);f.state.membershipWrite=true;
 const first=await call(input);assert.equal(first.statusCode,200,first.body);cookie=cookieHeader(first.headers['Set-Cookie']);
 const created=JSON.parse(first.body).result;assert.equal(created.record.revision,1);assert.equal(created.record.data.state.values.language,'hu');assert.ok(created.record.data.state.values.phone);
 const duplicate=await call(input);assert.equal(duplicate.statusCode,200);assert.equal(JSON.parse(duplicate.body).result.record.revision,1);assert.equal(f.state.fixtureRows.size,1);
 const disabled=createCaseHandler({env:{...env,CASE_APPROVAL_ENABLED:''},fetchImpl:f.fetchImpl});assert.equal((await disabled(event({method:'POST',cookie,csrf,body:input}))).statusCode,401);
});

test('fixed cookie tub follow-up requires the exact persisted base, current revision and unique identity; Reader/revoked/CSRF remain closed',async()=>{
 const f=fixture();f.state.membershipWrite=true;f.state.fixtureRows=new Map();
 const env={...f.env,CASE_APPROVAL_ENABLED:'sarberki-test-synthetic-only',ISOLATED_APPROVAL_ATTESTATION_KEY:'a1'.repeat(32)};
 const logged=await f.login(),handler=createCaseHandler({env,fetchImpl:f.fetchImpl});let cookie=cookieHeader(logged.setCookie);const csrf=logged.metadata.csrfToken;
 const call=(body,headers={})=>handler(event({method:'POST',cookie,csrf,body,headers}));
 const base={tenantId:'sarberki-test',action:'ingest-and-draft',envelope:syntheticMailEnvelope('hu'),expectedRevision:0};
 const absent={...base,envelope:syntheticTubFollowupEnvelope(),caseId:'case-missing',expectedRevision:1};
 assert.equal((await call(absent)).statusCode,403);assert.equal(f.state.fixtureRows.size,0);
 const created=await call(base);assert.equal(created.statusCode,200,created.body);cookie=cookieHeader(created.headers['Set-Cookie']);const original=JSON.parse(created.body).result.record;
 const input={...base,envelope:syntheticTubFollowupEnvelope(),caseId:original.caseId,expectedRevision:original.revision};
 const originalRows=structuredClone(f.state.fixtureRows),writes=()=>f.state.calls.filter(x=>x.url.includes('/rpc/sc_write_case')).length;
 const before=writes();
 for(const envelope of [{...input.envelope,text:input.envelope.text+' changed'},{...input.envelope,sender:'other@synthetic.invalid'},{...input.envelope,thread_id:'other-thread'},{...input.envelope,case_id:original.caseId}])assert.equal((await call({...input,envelope})).statusCode,403);
 assert.equal((await handler(event({method:'POST',cookie,body:input}))).statusCode,403);
 f.state.membershipWrite=false;assert.equal((await call(input)).statusCode,403);f.state.membershipWrite=true;
 f.state.revoked=true;assert.equal((await call(input)).statusCode,401);f.state.revoked=false;
 f.state.fixtureRows.get(original.caseId).data.state.values.unit='VIP';assert.equal((await call(input)).statusCode,403);f.state.fixtureRows=structuredClone(originalRows);
 for(const change of [{caseKind:'service_link_review'},{linkReview:{status:'ambiguous'}},{status:'link_review_required'}]){
  Object.assign(f.state.fixtureRows.get(original.caseId).data,change);assert.equal((await call(input)).statusCode,403);f.state.fixtureRows=structuredClone(originalRows);
 }
 const corrupt=structuredClone(f.state.fixtureRows.get(original.caseId));corrupt.case_id='case-conflict';corrupt.data.id='case-conflict';corrupt.data.messages[0].message_id='conflicting-synthetic-message';f.state.fixtureRows.set('case-conflict',corrupt);
 assert.equal((await call(input)).statusCode,403);f.state.fixtureRows=structuredClone(originalRows);assert.equal(writes(),before);
 f.state.fixtureRows.get(original.caseId).data.state.approval='internally_approved';
 f.state.fixtureRows.get(original.caseId).data.serverApproval={actor:'synthetic-approver',draftHash:'a'.repeat(64)};
 const updated=await call(input);assert.equal(updated.statusCode,200,updated.body);cookie=cookieHeader(updated.headers['Set-Cookie']);const result=JSON.parse(updated.body).result;
 assert.equal(result.resolution.status,'linked');assert.equal(result.record.caseId,original.caseId);assert.equal(result.record.revision,2);assert.equal(result.record.data.messages.length,2);assert.equal(result.record.data.state.values.arrival,'2026-10-23');assert.equal(result.record.data.state.approval,'pending');
 assert.equal(result.record.data.serverApproval,undefined);assert.equal(result.record.data.drafts.at(-1).basedOnMessageCount,2);assert.equal(result.record.data.drafts.at(-1).revision,result.record.data.state.revision);
 const after=writes();assert.equal((await call(input)).statusCode,409);
 const replay=await call({...input,expectedRevision:2});assert.equal(replay.statusCode,200,replay.body);assert.equal(JSON.parse(replay.body).result.resolution.status,'duplicate');assert.equal(writes(),after);
 f.state.membershipWrite=false;const preview=await handler(event({cookie,csrf,query:{tenantId:'sarberki-test',caseId:original.caseId,expectedRevision:'2',action:'preview-draft'}}));
 assert.equal(preview.statusCode,200,preview.body);const service=JSON.parse(preview.body).result.serviceRequest;assert.equal(service.startDate,'2026-10-24');assert.equal(service.linkedCaseId,original.caseId);assert.equal(service.requiresHumanApproval,true);assert.equal(service.verificationStatus,'unverified');assert.equal(writes(),after);
});

test('service-link cookie mutation requires approval, CSRF and current membership before any resolution RPC',async()=>{
 const f=fixture(),env={...f.env,CASE_APPROVAL_ENABLED:'sarberki-test-synthetic-only',ISOLATED_APPROVAL_ATTESTATION_KEY:'a1'.repeat(32)},logged=await f.login();
 const handler=createCaseHandler({env,fetchImpl:f.fetchImpl}),base={method:'POST',cookie:cookieHeader(logged.setCookie),csrf:logged.metadata.csrfToken,body:{tenantId:'sarberki-test',action:'resolve-service-link',caseId:'case-review123',expectedRevision:1,targetCaseId:'case-target123',targetRevision:1,reason:'Synthetic identity checked'}};
 for(const role of ['reader','writer']){f.state.membershipWrite=role==='writer';assert.equal((await handler(event(base))).statusCode,403);}
 f.state.membershipWrite=true;f.state.membershipApprove=true;
 assert.equal((await handler(event({...base,csrf:undefined}))).statusCode,403);
 assert.equal((await handler(event({...base,headers:{origin:'https://other.example'}}))).statusCode,403);
 f.state.revoked=true;assert.equal((await handler(event(base))).statusCode,401);
 assert.equal(f.state.calls.filter(c=>c.url.includes('/rpc/sc_resolve_service_link')).length,0);
});
