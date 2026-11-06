import test from 'node:test';
import assert from 'node:assert/strict';
import {serverDeployment,TEST_DEPLOYMENT} from '../shared-core/server-deployment.mjs';
import {createOperatorCookieSession} from '../shared-core/operator-cookie-session.mjs';
import {MAILBOX_PROFILES} from '../shared-core/server-mailbox-profiles.mjs';

const LIVE={SARBERKI_DEPLOYMENT:'live',SARBERKI_LIVE_ORIGIN:'https://sarberki-live.example.app',SARBERKI_LIVE_SUPABASE_URL:'https://livexprojectxrefxabc.supabase.co'};
const enabledLive={...MAILBOX_PROFILES,'sarberki-live':{...MAILBOX_PROFILES['sarberki-live'],enabled:true}};

test('default and explicit test: exactly the existing TEST site, project, tenant and mailbox',()=>{
 for(const env of [{},{SARBERKI_DEPLOYMENT:''},{SARBERKI_DEPLOYMENT:'test'}])assert.equal(serverDeployment(env),TEST_DEPLOYMENT);
 assert.deepEqual([TEST_DEPLOYMENT.tenantId,TEST_DEPLOYMENT.origin,TEST_DEPLOYMENT.supabaseUrl,TEST_DEPLOYMENT.mailbox.account],
  ['sarberki-test','https://leafy-chimera-2403e5.netlify.app','https://mojnqizbcaczstguikpv.supabase.co','sarberkiprojecttest@gmail.com']);
});
test('live fails closed while the live mailbox profile is disabled (no consent yet)',()=>{
 assert.equal(MAILBOX_PROFILES['sarberki-live'].enabled,false);
 assert.throws(()=>serverDeployment(LIVE),/LIVE_MAILBOX_DISABLED/);
});
test('live needs its own origin and project; never the TEST ones; unknown modes refused',()=>{
 const d=serverDeployment(LIVE,{profiles:enabledLive});
 assert.deepEqual([d.environment,d.tenantId,d.projectRef,d.mailbox.account],['live','sarberki-live','livexprojectxrefxabc','info@sarberkito.hu']);
 for(const bad of [{SARBERKI_LIVE_ORIGIN:TEST_DEPLOYMENT.origin},{SARBERKI_LIVE_SUPABASE_URL:TEST_DEPLOYMENT.supabaseUrl},{SARBERKI_LIVE_ORIGIN:'http://x.example'},
  {SARBERKI_LIVE_SUPABASE_URL:'https://evil.example/x.supabase.co'},{SARBERKI_LIVE_ORIGIN:undefined},{SARBERKI_DEPLOYMENT:'prod'}])
  assert.throws(()=>serverDeployment({...LIVE,...bad},{profiles:enabledLive}),/DEPLOYMENT_SETUP_REQUIRED/,JSON.stringify(bad));
});
test('operator session: a live deployment cannot start (setup required) and never contacts Auth',async()=>{
 const calls=[];
 const session=createOperatorCookieSession({env:{...LIVE,URL:LIVE.SARBERKI_LIVE_ORIGIN,CASE_STORE_ENABLED:'sarberki-live',SUPABASE_URL:LIVE.SARBERKI_LIVE_SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC',SARBERKI_OPERATOR_SESSION_KEY:'a'.repeat(64)},fetchImpl:async(...args)=>{calls.push(args);throw Error('no network');}});
 const event={httpMethod:'POST',headers:{host:'sarberki-live.example.app',origin:LIVE.SARBERKI_LIVE_ORIGIN,'x-sarberki-operator':'1','sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify({email:'a@example.test',password:'x'})};
 await assert.rejects(session.login(event),error=>error.status===503&&error.code==='SESSION_SETUP_REQUIRED');
 assert.equal(calls.length,0);
});

test('live reader: only with an enabled live profile; new inquiries to info@ only; replies stay in Gmail; attestation tenant-bound',async()=>{
 const {readVerifiedTestMailboxMessage,attestTestMailboxSource}=await import('../shared-core/server-gmail-source.mjs');
 const live=serverDeployment(LIVE,{profiles:enabledLive});
 const ID='28f2a0b1c2d3e4f0',b64=t=>Buffer.from(t,'utf8').toString('base64url');
 const gmail=(headers,{account='info@sarberkito.hu'}={})=>{const calls=[];return {calls,fetchImpl:async url=>{calls.push(String(url));
  if(String(url).endsWith('/profile'))return new Response(JSON.stringify({emailAddress:account}));
  return new Response(JSON.stringify({id:ID,threadId:ID,labelIds:['INBOX'],internalDate:String(Date.parse('2026-11-06T10:00:00Z')),
   payload:{mimeType:'text/plain',headers:Object.entries(headers).map(([name,value])=>({name,value})),body:{data:b64('Jó napot! Május 20-23 között jönnénk ketten. (kitalált)')}}}));}};};
 const base={From:'Kitalált Vendég <guest@example.test>',To:'info@sarberkito.hu',Subject:'Érdeklődés','Message-ID':'<fictional-live@example.test>'};
 const read=(headers,opts)=>{const g=gmail(headers,opts);return {g,run:readVerifiedTestMailboxMessage({token:'t'.repeat(40),messageId:ID,fetchImpl:g.fetchImpl,deployment:live})};};
 const ok=await read(base).run;
 assert.deepEqual([ok.source.to,ok.source.mailbox_id,ok.source.from_email],['info@sarberkito.hu','sarberkito_info','guest@example.test']);
 assert.equal((await read({...base,To:'someone@example.test',Cc:'Sárberki <info@sarberkito.hu>'}).run).source.to,'info@sarberkito.hu','info@ in Cc counts');
 for(const [headers,code] of [[{...base,'In-Reply-To':'<x@y>'},/REPLY_HANDLED_IN_GMAIL/],[{...base,Subject:'Re: Érdeklődés'},/REPLY_HANDLED_IN_GMAIL/],
  [{...base,'Auto-Submitted':'auto-replied'},/AUTOMATED_MESSAGE/],[{...base,From:'Sárberki <info@sarberkito.hu>'},/AUTOMATED_MESSAGE/],
  [{...base,From:'Previo <noreply@previo.cz>'},/AUTOMATED_MESSAGE/],[{...base,To:'other@example.test'},/NOT_ADDRESSED_TO_TEST_MAILBOX/]])
  await assert.rejects(read(headers).run,code,JSON.stringify(headers));
 await assert.rejects(read(base,{account:'sarberkiprojecttest@gmail.com'}).run,/WRONG_GMAIL_ACCOUNT/,'token of another mailbox');
 const calls=[];
 await assert.rejects(readVerifiedTestMailboxMessage({token:'t'.repeat(40),messageId:ID,fetchImpl:async(...a)=>{calls.push(a);},deployment:{...live,mailbox:{...live.mailbox,enabled:false}}}),/LIVE_MAILBOX_READER_PENDING/);
 assert.equal(calls.length,0,'a disabled live profile never contacts Gmail');
 const source={mailbox_id:'m',message_id:'1',thread_id:'1',rfc_message_id:'<a@b>',from_email:'g@example.test',to:'info@sarberkito.hu',subject:'S',received_at:'2026-11-06T08:00:00.000Z'};
 const envelope={sender:'g@example.test',text:'x',mailbox_id:'m',message_id:'1',thread_id:'1',rfc_message_id:'<a@b>',received_at:source.received_at};
 const checkedAt=new Date().toISOString();
 assert.equal(attestTestMailboxSource({key:'e5'.repeat(32),tenantId:'sarberki-live',source,envelope,checkedAt,deployment:live}).scope,'test-mailbox-source-v1');
 assert.throws(()=>attestTestMailboxSource({key:'e5'.repeat(32),tenantId:'sarberki-live',source,envelope,checkedAt}),/INVALID_EVIDENCE/,'TEST deployment refuses the live tenant');
 assert.throws(()=>attestTestMailboxSource({key:'e5'.repeat(32),tenantId:'sarberki-test',source,envelope,checkedAt,deployment:live}),/INVALID_EVIDENCE/,'live deployment refuses the TEST tenant');
});

test('booking-cases: a live deployment is closed (503) while the live mailbox is disabled, for every route',async()=>{
 const {createCaseHandler}=await import('../netlify/functions/booking-cases.mjs');
 const calls=[];
 const handler=createCaseHandler({env:{...LIVE,URL:LIVE.SARBERKI_LIVE_ORIGIN,CASE_STORE_ENABLED:'sarberki-live',CASE_LIVE_MAILBOX_ENABLED:'sarberki-live-mailbox'},fetchImpl:async(...a)=>{calls.push(a);throw Error('no network');}});
 for(const [method,body] of [['GET',{tenantId:'sarberki-live',action:'daily-list'}],['POST',{tenantId:'sarberki-live',action:'test-mailbox-send',caseId:'tm-18f2a0b1c2d3e4f0',expectedRevision:1}]]){
  const r=await handler({httpMethod:method,headers:{cookie:'x','x-sarberki-operator':'1'},queryStringParameters:method==='GET'?body:{},body:method==='POST'?JSON.stringify(body):''});
  assert.equal(r.statusCode,503);assert.deepEqual(JSON.parse(r.body),{error:'CASE_STORE_DISABLED'});
 }
 assert.equal(calls.length,0);
});
