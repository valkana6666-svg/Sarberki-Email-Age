import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperatorCookieSession} from '../shared-core/operator-cookie-session.mjs';
import {createTranslationHandler} from '../netlify/functions/translate-incoming.mjs';
import {translateClosedIncoming} from '../shared-core/server-translation.mjs';
import {syntheticMailEnvelope} from '../shared-core/synthetic-mail-fixtures.mjs';
import {sameProtectedTokens} from '../bilingual-preview.mjs';
import {createIncomingTranslator} from '../translation-client.mjs';
const origin='https://leafy-chimera-2403e5.netlify.app',project='https://mojnqizbcaczstguikpv.supabase.co';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status});
const input=language=>({text:syntheticMailEnvelope(language).text,sourceLanguage:language,targetLanguage:'hu',purpose:'incoming'});
const hu='Üdvözlöm! Deluxe faház 2026-10-23 és 2026-10-25 között, 2 felnőtt, 0 gyermek. Telefon: +36 00 000 0000.';
const output=text=>({status:'completed',output:[{type:'reasoning',summary:[]},{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text}]}]});
const env=()=>({URL:origin,CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',SUPABASE_URL:project,
 SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_PUBLIC_KEY_12345',SARBERKI_OPERATOR_SESSION_KEY:'ab'.repeat(32),
 SARBERKI_TRANSLATION_ENABLED:'closed-synthetic-only',OPENAI_TRANSLATION_API_KEY:'synthetic_not_a_real_key',OPENAI_TRANSLATION_MODEL:'synthetic-test-model'});
const event=(body,extra={})=>({httpMethod:'POST',body:JSON.stringify(body),headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','x-sarberki-operator':'1','content-type':'application/json',...extra}});
async function harness(){
 const config=env(),state={write:true,read:true,revoked:false,provider:[],auth:0,result:output(hu),status:200};
 const now=()=>Date.parse('2026-10-15T12:00:00Z');
 const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role:'authenticated',sub:'synthetic-operator',exp:Math.floor(now()/1000)+3600})).toString('base64url')+'.synthetic_signature';
 const fetchImpl=async(url,options)=>{
  if(url==='https://api.openai.com/v1/responses'){state.provider.push(options);if(state.network)throw Error('SECRET_PROVIDER_ERROR');return state.malformed?{ok:true,json:async()=>{throw Error('SECRET_JSON');}}:json(state.result,state.status);}
  assert.ok(url.startsWith(project+'/'));
  if(url.includes('/auth/v1/token')){state.auth++;return state.revoked?json({},401):json({access_token:token,refresh_token:'synthetic_refresh_token_12345',user:{id:'synthetic-operator'}});}
  if(url.endsWith('/auth/v1/user'))return json({id:'synthetic-operator',is_anonymous:false});
  if(url.includes('/rest/v1/sc_memberships'))return json([{tenant_id:'sarberki-test',user_id:'synthetic-operator',can_read:state.read,can_write:state.write,can_approve:false}]);
  assert.fail('unexpected URL '+url);
 };
 const session=createOperatorCookieSession({env:config,fetchImpl,now});
 const logged=await session.login(event({}),{action:'login',email:'writer@synthetic.invalid',password:'SYNTHETIC_NOT_REAL'});
 const handler=createTranslationHandler({env:config,fetchImpl,now});
 const request=(body=input('en'),headers={})=>handler(event(body,{cookie:logged.setCookie.split(';')[0],'x-csrf-token':logged.metadata.csrfToken,...headers}));
 return {config,state,request,handler,fetchImpl};
}
test('multiset guard rejects replaced duplicate numbers and retains strict numeric units/dates',()=>{
 assert.equal(sameProtectedTokens('2, 2','2, 3'),false);
 assert.equal(sameProtectedTokens('2, 3','3, 2'),true);
 assert.equal(sameProtectedTokens('2026-10-23, 120 000 Ft','2026-10-24, 120 000 Ft'),false);
 assert.equal(sameProtectedTokens('2 adults','2 fő'),false); // Fail closed on number-localized units.
});
test('all three closed fictional incoming bodies use bounded raw Responses POST; dedup still reauthenticates',async()=>{
 const f=await harness();
 for(const lang of ['de','en','si']){
  const result=await f.request(input(lang));assert.equal(result.statusCode,200);assert.deepEqual(JSON.parse(result.body),{verified:true,text:hu});assert.ok(result.headers['Set-Cookie']);
 }
 const auth=f.state.auth;
 await Promise.all([f.request(),f.request()]);assert.equal(f.state.provider.length,3);assert.ok(f.state.auth>auth);
 for(const options of f.state.provider){
  const body=JSON.parse(options.body);assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);
  assert.equal(body.store,false);assert.deepEqual(body.tools,[]);assert.equal(body.max_output_tokens,1200);assert.equal(body.model,'synthetic-test-model');
 }
 f.state.write=false;
 const denied=await f.request();assert.equal(denied.statusCode,403);assert.equal(f.state.provider.length,3);assert.ok(denied.headers['Set-Cookie']);
});
test('disabled, missing model/key and invalid body never call provider or Auth',async()=>{
 for(const key of ['SARBERKI_TRANSLATION_ENABLED','OPENAI_TRANSLATION_MODEL','OPENAI_TRANSLATION_API_KEY']){
  const f=await harness();delete f.config[key];const auth=f.state.auth;
  const result=await f.request();assert.equal(result.statusCode,503);assert.equal(JSON.parse(result.body).error,'TRANSLATION_DISABLED');assert.equal(f.state.auth,auth);assert.equal(f.state.provider.length,0);
 }
 for(const changed of [{text:'private guest text'},{purpose:'reply'},{purpose:'edited_reply'},{sourceLanguage:'de'},
  {targetLanguage:'de'},{synthetic:true},{text:input('en').text+' '},{text:input('en').text.replace('2 adults','3 adults')}]){
  const f=await harness(),auth=f.state.auth;const result=await f.request({...input('en'),...changed});
  assert.equal(result.statusCode,400);assert.equal(f.state.provider.length,0);assert.equal(f.state.auth,auth);
 }
});
test('Reader, cross-site, wrong CSRF/host/project and revoked login cannot reach provider',async()=>{
 for(const kind of ['reader','origin','csrf','host','project','revoked','membership']){
  const f=await harness(),headers={};
  if(kind==='reader')f.state.write=false;
  if(kind==='origin')headers.origin='https://other.invalid';
  if(kind==='csrf')headers['x-csrf-token']='ff'.repeat(32);
  if(kind==='host')headers.host='moonlit-torrone-88b39d.netlify.app';
  if(kind==='project')f.config.SUPABASE_URL='https://other.invalid';
  if(kind==='revoked')f.state.revoked=true;
  if(kind==='membership')f.state.read=false;
  const result=await f.request(input('en'),headers);assert.ok([401,403,503].includes(result.statusCode),kind);assert.equal(f.state.provider.length,0,kind);
  if(kind==='reader')assert.ok(result.headers['Set-Cookie']);
 }
});
test('refusal, incomplete/tool/multiple message output, malformed JSON/numbers and upstream errors fail closed without retry or detail leak',async()=>{
 const bad=[{status:'incomplete',output:output(hu).output},{status:'completed',output:[{type:'function_call'}]},
  {status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'refusal',refusal:'SECRET'}]}]},
  {status:'completed',output:[output(hu).output[1],output(hu).output[1]]},output(hu.replace('2 felnőtt','3 felnőtt')),
  {status:'completed',output_text:hu},{status:'completed',output:[]},output('')];
 for(const result of bad){const f=await harness();f.state.result=result;const r=await f.request();assert.equal(r.statusCode,503);assert.ok(r.headers['Set-Cookie']);assert.doesNotMatch(r.body,/SECRET|synthetic-test-model|synthetic_not_a_real_key/);}
 for(const mode of ['network','malformed','429']){
  const f=await harness();if(mode==='429')f.state.status=429;else f.state[mode]=true;
  const r=await f.request();assert.equal(r.statusCode,503);assert.ok(r.headers['Set-Cookie']);await f.request();assert.equal(f.state.provider.length,1);
 }
});
test('transport also rejects unapproved input/config before its injected provider',async()=>{
 let calls=0;const fetchImpl=()=>{calls++;assert.fail('unexpected egress');};
 await assert.rejects(translateClosedIncoming({...input('en'),synthetic:true},{env:env(),fetchImpl}),/INVALID_INPUT/);
 await assert.rejects(translateClosedIncoming(input('en'),{env:{},fetchImpl}),/TRANSLATION_DISABLED/);assert.equal(calls,0);
});
test('client deduplicates same session, rejects unapproved egress, and discards late previous-session responses',async()=>{
 const globalRef={SarberkiCaseStoreSession:{getCsrfToken:async()=> 'ab'.repeat(32)}};let calls=0,complete;
 const request=async()=>{calls++;return new Promise(resolve=>{complete=()=>resolve(json({verified:true,text:hu}));});};
 const translate=createIncomingTranslator({globalRef,request});
 for(const change of [{text:'private'},{purpose:'reply'},{sourceLanguage:'de'}])await assert.rejects(translate({...input('en'),...change}));
 assert.equal(calls,0);
 const a=translate(input('en')),b=translate(input('en'));await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);
 globalRef.SarberkiCaseStoreSession=null;complete();await assert.rejects(a,/SESSION_CHANGED/);await assert.rejects(b,/SESSION_CHANGED/);
 await assert.rejects(translate(input('en')),/AUTH_REQUIRED/);
});
