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

test('Gmail source and ingest: a live deployment fails closed before any Gmail call; attestation is tenant-bound',async()=>{
 const {readVerifiedTestMailboxMessage,attestTestMailboxSource}=await import('../shared-core/server-gmail-source.mjs');
 const {ingestTestMailboxMessage}=await import('../shared-core/server-test-mailbox-case.mjs');
 const live=serverDeployment(LIVE,{profiles:enabledLive}),calls=[];
 const fetchImpl=async(...args)=>{calls.push(args);throw Error('no network');};
 await assert.rejects(readVerifiedTestMailboxMessage({token:'t'.repeat(40),messageId:'18f2a0b1c2d3e4f0',fetchImpl,deployment:live}),/LIVE_MAILBOX_READER_PENDING/);
 await assert.rejects(ingestTestMailboxMessage({token:'t'.repeat(40),messageId:'18f2a0b1c2d3e4f0',transport:async()=>{calls.push('db');},attestationKey:'e5'.repeat(32),fetchImpl,deployment:live}),/LIVE_MAILBOX_READER_PENDING/);
 assert.equal(calls.length,0);
 const source={mailbox_id:'m',message_id:'1',thread_id:'1',rfc_message_id:'<a@b>',from_email:'g@example.test',to:'info@sarberkito.hu',subject:'S',received_at:'2026-11-06T08:00:00.000Z'};
 const envelope={sender:'g@example.test',text:'x',mailbox_id:'m',message_id:'1',thread_id:'1',rfc_message_id:'<a@b>',received_at:source.received_at};
 const checkedAt=new Date().toISOString();
 assert.equal(attestTestMailboxSource({key:'e5'.repeat(32),tenantId:'sarberki-live',source,envelope,checkedAt,deployment:live}).scope,'test-mailbox-source-v1');
 assert.throws(()=>attestTestMailboxSource({key:'e5'.repeat(32),tenantId:'sarberki-live',source,envelope,checkedAt}),/INVALID_EVIDENCE/,'TEST deployment refuses the live tenant');
 assert.throws(()=>attestTestMailboxSource({key:'e5'.repeat(32),tenantId:'sarberki-test',source,envelope,checkedAt,deployment:live}),/INVALID_EVIDENCE/,'live deployment refuses the TEST tenant');
});
