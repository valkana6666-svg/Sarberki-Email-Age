import test from 'node:test';
import assert from 'node:assert/strict';
import {attestTestMailboxSource,verifyTestMailboxAttestation,buildMailboxSource,readVerifiedMailboxMessage} from '../shared-core/server-gmail-source.mjs';
import {ingestMailboxMessage} from '../shared-core/server-test-mailbox-case.mjs';
import {assertTestGmailAccount} from '../gmail-policy.mjs';
import {enabledMailboxProfile,knownMailboxProfile} from '../shared-core/server-mailbox-profiles.mjs';
import {createPushoverLedger} from '../netlify/functions/_shared/pushover-ledger.mjs';

// Slice 2d-1: attestation and ledger identity follow the tenant's mailbox profile. Fictional data only.
const KEY='d4'.repeat(32),checkedAt=new Date('2026-11-03T10:00:00.000Z').toISOString();
function mail(profile){
 const id='19a0b1c2d3e4f501';
 const source={provider:'gmail',mailbox_id:profile.mailboxId,message_id:id,thread_id:id,rfc_message_id:'<f@example.test>',in_reply_to:null,references:[],
  subject:'Kitalált',from:'G <guest@example.test>',from_email:'guest@example.test',to:profile.account,received_at:'2026-11-03T09:00:00.000Z'};
 return {source,envelope:{sender:'guest@example.test',text:'Kitalált szöveg',mailbox_id:source.mailbox_id,message_id:id,thread_id:id,rfc_message_id:source.rfc_message_id,references:[],received_at:source.received_at}};
}
const test_=knownMailboxProfile('sarberki-test'),live=knownMailboxProfile('sarberki-live');

test('live profile stays disabled for runtime entry points',()=>{
 assert.throws(()=>enabledMailboxProfile('sarberki-live'),/MAILBOX_PROFILE_DISABLED/);
 assert.throws(()=>knownMailboxProfile('other'),/MAILBOX_PROFILE_UNKNOWN/);
 assert.deepEqual([test_.approvalScope,live.approvalScope],['test-mailbox-v1','live-mailbox-v1']);
});

test('attestation scope follows the tenant profile and never crosses deployments',()=>{
 const t=mail(test_),l=mail(live);
 const tp=attestTestMailboxSource({key:KEY,tenantId:'sarberki-test',...t,checkedAt});
 const lp=attestTestMailboxSource({key:KEY,tenantId:'sarberki-live',...l,checkedAt});
 assert.equal(tp.scope,'test-mailbox-source-v1');assert.equal(lp.scope,'live-mailbox-source-v1');
 assert.equal(verifyTestMailboxAttestation({key:KEY,tenantId:'sarberki-test',...t,proof:tp}),true);
 assert.equal(verifyTestMailboxAttestation({key:KEY,tenantId:'sarberki-live',...l,proof:lp}),true);
 assert.equal(verifyTestMailboxAttestation({key:KEY,tenantId:'sarberki-live',...l,proof:{...lp,scope:'test-mailbox-source-v1'}}),false);
 assert.equal(verifyTestMailboxAttestation({key:KEY,tenantId:'sarberki-test',...l,proof:lp}),false);
 for(const [tenantId,m] of [['sarberki-live',t],['sarberki-test',l],['other',t]])
  assert.throws(()=>attestTestMailboxSource({key:KEY,tenantId,...m,checkedAt}),/INVALID_EVIDENCE/);
});

test('ledger identity accepts only a known (tenant, mailbox) pair',async()=>{
 const calls=[];const ledger=createPushoverLedger({rpc:async(name,args)=>{calls.push(args);return {data:{status:'duplicate'}};}});
 const k=(tenantId,mailbox)=>({tenantId,mailbox,messageId:'19abcdef12345',notificationType:'gmail-new-message'});
 assert.equal((await ledger.claimOnce(k('sarberki-test',test_.account))).status,'duplicate');
 assert.equal((await ledger.claimOnce(k('sarberki-live',live.account))).status,'duplicate');
 for(const bad of [k('sarberki-live',test_.account),k('sarberki-test',live.account),k('other',live.account),k('constructor',undefined)])
  await assert.rejects(ledger.claimOnce(bad),/INVALID_LEDGER_IDENTITY/);
 assert.equal(calls.length,2);
});

// Slice 2d-2: reader gates by profile (pure), and the disabled live profile never reaches the network.
const b64=text=>Buffer.from(text,'utf8').toString('base64url');
function gmail({to,from='Vendég <guest@example.test>',subject='Érdeklődés júniusra'}){
 return {id:'19a0b1c2d3e4f5a6',threadId:'19a0b1c2d3e4f5a6',internalDate:String(Date.parse('2026-11-03T09:00:00Z')),labelIds:['INBOX'],
  payload:{mimeType:'multipart/alternative',headers:[{name:'Subject',value:subject},{name:'From',value:from},{name:'To',value:to},{name:'Message-ID',value:'<f1@example.test>'}],
   parts:[{mimeType:'text/plain',body:{data:b64('Jó napot! Kitalált érdeklődés.')}}]}};
}
test('reader gates follow the profile: live needs no test subject, only its own recipient, never its own sender',()=>{
 const ok=buildMailboxSource(live,gmail({to:live.account}));
 assert.deepEqual([ok.source.to,ok.source.mailbox_id,ok.envelope.mailbox_id],[live.account,live.mailboxId,live.mailboxId]);
 assert.throws(()=>buildMailboxSource(live,gmail({to:test_.account})),/NOT_ADDRESSED_TO_TEST_MAILBOX/);
 assert.throws(()=>buildMailboxSource(live,gmail({to:live.account,from:'Sárberki <info@sarberkito.hu>'})),/AUTOMATED_MESSAGE/);
 assert.throws(()=>buildMailboxSource(test_,gmail({to:test_.account})),/NOT_MARKED_TEST_MESSAGE/);
 assert.equal(buildMailboxSource(test_,gmail({to:test_.account,subject:'Sárberki élő teszt – próba'})).source.to,test_.account);
 assert.throws(()=>buildMailboxSource({...live,enabled:true},gmail({to:live.account})),/MAILBOX_PROFILE_UNKNOWN/,'a forged/enabled copy is not a profile');
});
test('disabled live profile: read and ingest stop before any network or storage call',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error('no network');};
 await assert.rejects(readVerifiedMailboxMessage({tenantId:'sarberki-live',token:'x'.repeat(40),messageId:'19a0b1c2d3e4f5a6',fetchImpl}),/MAILBOX_PROFILE_DISABLED/);
 await assert.rejects(ingestMailboxMessage({tenantId:'sarberki-live',token:'x'.repeat(40),messageId:'19a0b1c2d3e4f5a6',fetchImpl,transport:async()=>{calls++;},attestationKey:KEY}),/MAILBOX_PROFILE_DISABLED/);
 assert.equal(calls,0);
});
test('browser default account is unchanged; the server can name its profile account',()=>{
 assert.doesNotThrow(()=>assertTestGmailAccount({emailAddress:test_.account}));
 assert.throws(()=>assertTestGmailAccount({emailAddress:live.account}),/tesztfiók/);
 assert.doesNotThrow(()=>assertTestGmailAccount({emailAddress:live.account},live.account));
});
