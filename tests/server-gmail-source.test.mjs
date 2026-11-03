import test from 'node:test';
import assert from 'node:assert/strict';
import {readVerifiedTestMailboxMessage,attestTestMailboxSource,verifyTestMailboxAttestation,TEST_MAILBOX_SOURCE_SCOPE} from '../shared-core/server-gmail-source.mjs';
import {isMarkedTestSubject} from '../gmail-subject.mjs';
import {createHash,createHmac} from 'node:crypto';

const TOKEN='ya29.SYNTHETIC_TEST_ONLY_TOKEN_0123456789';
const ID='18f2a0b1c2d3e4f5',KEY='c3'.repeat(32);
const BODY='Jó napot! Deluxe faházat szeretnénk foglalni 2027-05-14 és 2027-05-16 között 2 felnőtt, 0 gyermek számára.';
const b64=text=>Buffer.from(text).toString('base64url');
function message(overrides={}){
 const headers={Subject:'Sárberki élő teszt – AI előnézet',From:'Teszt Küldő <Sender@Example.test>',To:'sarberkiprojecttest@gmail.com','Message-ID':'<synthetic-1@example.test>',...overrides.headers};
 const payload=overrides.payload||{mimeType:'multipart/alternative',headers:Object.entries(headers).filter(([,v])=>v!==undefined).map(([name,value])=>({name,value})),
  parts:[{mimeType:'text/plain',body:{data:b64(overrides.body??BODY)}},{mimeType:'text/html',body:{data:b64('<p>'+(overrides.body??BODY)+'</p>')}}]};
 if(overrides.payload)payload.headers=Object.entries(headers).filter(([,v])=>v!==undefined).map(([name,value])=>({name,value}));
 return {id:overrides.id??ID,threadId:overrides.threadId??'18f2a0b1c2d3e4f0',labelIds:overrides.labelIds??['INBOX'],internalDate:overrides.internalDate??String(Date.parse('2026-10-31T10:00:00Z')),payload};
}
function gmail({account='sarberkiprojecttest@gmail.com',status=200,messageStatus=200,body=message()}={}){
 const calls=[];
 const fetchImpl=async(url,options={})=>{
  calls.push({url:String(url),auth:options.headers?.Authorization});
  const u=new URL(url);assert.equal(u.origin,'https://gmail.googleapis.com');assert.equal(options.headers.Authorization,'Bearer '+TOKEN);
  if(u.pathname.endsWith('/profile'))return new Response(JSON.stringify({emailAddress:account}),{status});
  assert.equal(u.pathname,'/gmail/v1/users/me/messages/'+ID);assert.equal(u.searchParams.get('format'),'full');
  return new Response(JSON.stringify(body),{status:messageStatus});
 };
 return {calls,fetchImpl};
}
const read=(g,extra={})=>readVerifiedTestMailboxMessage({token:TOKEN,messageId:ID,fetchImpl:g.fetchImpl,...extra});

test('shared subject gate: same marker rule for client and server',()=>{
 for(const s of ['Sárberki élő teszt','SARBERKI ELO TESZT de','  Sárberki   élő teszt  - EN','Sárberki élő teszt – AI előnézet'])assert.equal(isMarkedTestSubject(s),true,s);
 for(const s of ['Re: Sárberki élő teszt','Fwd: Sárberki élő teszt','Sárberki élő tesztelés','x Sárberki élő teszt','',undefined,null,42])assert.equal(isMarkedTestSubject(s),false,String(s));
});

test('server reads ONE verified test-mailbox message and builds the existing exact-receipt request shape from server-read content',async()=>{
 const g=gmail(),result=await read(g);
 assert.deepEqual(g.calls.map(c=>new URL(c.url).pathname),['/gmail/v1/users/me/profile','/gmail/v1/users/me/messages/'+ID]);
 assert.deepEqual(Object.keys(result).sort(),['bodySha256','envelope','source']);
 assert.deepEqual(result.source,{provider:'gmail',mailbox_id:'sarberki_gmail_test',message_id:ID,thread_id:'18f2a0b1c2d3e4f0',rfc_message_id:'<synthetic-1@example.test>',
  in_reply_to:null,references:[],subject:'Sárberki élő teszt – AI előnézet',from:'Teszt Küldő <Sender@Example.test>',from_email:'sender@example.test',to:'sarberkiprojecttest@gmail.com',received_at:'2026-10-31T10:00:00.000Z'});
 assert.deepEqual(result.envelope,{sender:'sender@example.test',text:BODY,mailbox_id:'sarberki_gmail_test',message_id:ID,thread_id:'18f2a0b1c2d3e4f0',
  rfc_message_id:'<synthetic-1@example.test>',references:[],received_at:'2026-10-31T10:00:00.000Z'});
 assert.match(result.bodySha256,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(result).includes(TOKEN),false,'token never in the result');
 assert.ok(Object.isFrozen(result));
});

test('negative: wrong account, Gmail auth/rate/availability errors and malformed inputs fail closed without leaking the token',async()=>{
 const cases=[
  [{account:'someone@gmail.com'},'WRONG_GMAIL_ACCOUNT'],
  [{status:401},'GMAIL_AUTH_REQUIRED'],[{status:403},'GMAIL_AUTH_REQUIRED'],
  [{messageStatus:429},'GMAIL_RATE_LIMITED'],[{messageStatus:503},'GMAIL_SOURCE_UNVERIFIED'],[{messageStatus:404},'GMAIL_SOURCE_UNVERIFIED'],
  [{body:message({id:'aaaaaaaaaaaaaaaa'})},'GMAIL_SOURCE_UNVERIFIED'],
  [{body:message({labelIds:['SENT']})},'GMAIL_SOURCE_UNVERIFIED'],
  [{body:message({internalDate:String(Date.parse('2026-09-24T10:00:00Z'))})},'GMAIL_SOURCE_UNVERIFIED']
 ];
 for(const [options,code] of cases){
  await assert.rejects(read(gmail(options)),error=>{assert.equal(error.code,code,JSON.stringify(options).slice(0,80));assert.equal(String(error.message).includes(TOKEN),false);assert.equal(JSON.stringify(error).includes(TOKEN),false);return true;});
 }
 for(const [token,messageId] of [['',ID],['short',ID],[TOKEN+'\n',ID],[TOKEN,'not-hex-id'],[TOKEN,'18F2A0B1C2D3E4F5'],[TOKEN,'18f2'],[TOKEN,undefined]]){
  const g=gmail();await assert.rejects(readVerifiedTestMailboxMessage({token,messageId,fetchImpl:g.fetchImpl}),/GMAIL_AUTH_REQUIRED|INVALID_INPUT/);assert.equal(g.calls.length,0,'no Gmail call for invalid input');
 }
});

test('negative: unmarked, reply/forward, not addressed to the test mailbox, HTML-only, blank, oversized or unreadable messages are rejected',async()=>{
 const html={mimeType:'text/html',body:{data:b64('<p>'+BODY+'</p>')}};
 const cases=[
  [message({headers:{Subject:'Érdeklődés a szállásról'}}),'NOT_MARKED_TEST_MESSAGE'],
  [message({headers:{Subject:'Re: Sárberki élő teszt'}}),'NOT_MARKED_TEST_MESSAGE'],
  [message({headers:{Subject:undefined}}),'NOT_MARKED_TEST_MESSAGE'],
  [message({headers:{'In-Reply-To':'<earlier@example.test>'}}),'REPLY_NOT_ALLOWED'],
  [message({headers:{References:'<earlier@example.test>'}}),'REPLY_NOT_ALLOWED'],
  [message({headers:{To:'other@example.test'}}),'NOT_ADDRESSED_TO_TEST_MAILBOX'],
  [message({headers:{To:'sarberkiprojecttest@gmail.com, other@example.test'}}),'NOT_ADDRESSED_TO_TEST_MAILBOX'],
  [message({headers:{From:'no address'}}),'INVALID_SENDER'],
  [message({headers:{'Message-ID':undefined}}),'MESSAGE_ID_REQUIRED'],
  [message({payload:html}),'TEXT_PART_REQUIRED'],
  [message({body:'   \n  '}),'EMPTY_TEXT'],
  [message({body:'A'.repeat(20001)}),'TEXT_TOO_LONG'],
  [message({payload:{mimeType:'text/plain',body:{data:'%%%'}}}),'UNREADABLE_TEXT']
 ];
 for(const [body,code] of cases)await assert.rejects(read(gmail({body})),error=>error.code===code||assert.fail(code+' got '+error.code));
});

test('manipulation: the attestation binds every source field and the server-read body; any change or other key fails verification',async()=>{
 const {source,envelope,bodySha256}=await read(gmail()),checkedAt='2026-10-31T10:05:00.000Z';
 const proof=attestTestMailboxSource({key:KEY,tenantId:'sarberki-test',source,envelope,checkedAt});
 assert.deepEqual(Object.keys(proof).sort(),['attestation','bodySha256','checkedAt','scope']);assert.equal(proof.scope,TEST_MAILBOX_SOURCE_SCOPE);assert.equal(proof.bodySha256,bodySha256);
 assert.equal(verifyTestMailboxAttestation({key:KEY,tenantId:'sarberki-test',source,envelope,proof}),true);
 const mutate=[
  ['tenant',{tenantId:'demo-test'}],
  ['text',{envelope:{...envelope,text:envelope.text+' '}}],
  ['sender',{envelope:{...envelope,sender:'other@example.test'}}],
  ['message id',{source:{...source,message_id:'aaaaaaaaaaaaaaaa'},envelope:{...envelope,message_id:'aaaaaaaaaaaaaaaa'}}],
  ['subject',{source:{...source,subject:'Sárberki élő teszt – más'}}],
  ['received',{source:{...source,received_at:'2026-10-31T10:00:01.000Z'},envelope:{...envelope,received_at:'2026-10-31T10:00:01.000Z'}}],
  ['envelope/source mismatch',{envelope:{...envelope,thread_id:'other'}}],
  ['checkedAt',{proof:{...proof,checkedAt:'2026-10-31T10:05:01.000Z'}}],
  ['scope',{proof:{...proof,scope:'clarification-only-v1'}}],
  ['attestation',{proof:{...proof,attestation:'0'.repeat(64)}}],
  ['key',{key:'d4'.repeat(32)}]
 ];
 for(const [name,change] of mutate)assert.equal(verifyTestMailboxAttestation({key:KEY,tenantId:'sarberki-test',source,envelope,proof,...change}),false,name);
 // Changing the text AND rewriting the unsigned-looking bodySha256 must still fail: the hash is inside the HMAC.
 const forgedText=envelope.text+' módosítva',forgedHash=createHash('sha256').update(forgedText,'utf8').digest('hex');
 assert.equal(verifyTestMailboxAttestation({key:KEY,tenantId:'sarberki-test',source,envelope:{...envelope,text:forgedText},proof:{...proof,bodySha256:forgedHash}}),false,'body hash is signed');
 // Domain separation: an HMAC with the same key over the same fields but without this scope is not accepted.
 const unscoped=['sarberki-test',source.mailbox_id,source.message_id,source.thread_id,source.rfc_message_id,source.from_email,source.to,source.subject,source.received_at,proof.bodySha256,checkedAt].join('\n');
 const otherPurpose=createHmac('sha256',Buffer.from(KEY,'hex')).update(unscoped).digest('hex');
 assert.equal(verifyTestMailboxAttestation({key:KEY,tenantId:'sarberki-test',source,envelope,proof:{...proof,attestation:otherPurpose}}),false,'scope is signed');
 for(const key of ['', 'short','G'.repeat(64)])assert.throws(()=>attestTestMailboxSource({key,tenantId:'sarberki-test',source,envelope,checkedAt}),/SETUP_REQUIRED/);
 assert.throws(()=>attestTestMailboxSource({key:KEY,tenantId:'other',source,envelope,checkedAt}),/INVALID_EVIDENCE/);
 assert.throws(()=>attestTestMailboxSource({key:KEY,tenantId:'sarberki-test',source:{...source,subject:'a\nb'},envelope,checkedAt}),/INVALID_EVIDENCE/);
 assert.throws(()=>attestTestMailboxSource({key:KEY,tenantId:'sarberki-test',source,envelope,checkedAt:'not a date'}),/INVALID_EVIDENCE/);
});

test('automated or booking-system mail is never accepted as a test-mailbox inquiry, even with the test subject',async()=>{
 for(const headers of [{'Auto-Submitted':'auto-generated'},{From:'Previo <noreply@previo.cz>'},{From:'no-reply@example.test'},{Precedence:'bulk'},{'List-Id':'<x.example.test>'},{'Return-Path':'<b@smtp.previo.cz>'}]){
  await assert.rejects(read(gmail({body:message({headers})})),e=>e.code==='AUTOMATED_MESSAGE',JSON.stringify(headers));
 }
});

test('mailbox attestation: only known profiles, scope and tenant come from the profile, live proofs never verify as TEST',async()=>{
 const {attestMailboxSource,verifyMailboxAttestation}=await import('../shared-core/server-gmail-source.mjs');
 const {MAILBOX_PROFILES}=await import('../shared-core/server-mailbox-profiles.mjs');
 const live=MAILBOX_PROFILES['sarberki-live'],key='e5'.repeat(32),checkedAt='2026-11-03T10:00:00.000Z';
 const source={provider:'gmail',mailbox_id:'sarberkito_info',message_id:'18f2a0b1c2d3e4f5',thread_id:'18f2a0b1c2d3e4f5',rfc_message_id:'<x@example.test>',in_reply_to:null,references:[],
  subject:'Érdeklődés',from:'V <v@example.test>',from_email:'v@example.test',to:'info@sarberkito.hu',received_at:'2026-11-03T09:00:00.000Z'};
 const envelope={sender:'v@example.test',text:'Kitalált szöveg',mailbox_id:'sarberkito_info',message_id:source.message_id,thread_id:source.thread_id,rfc_message_id:source.rfc_message_id,references:[],received_at:source.received_at};
 const proof=attestMailboxSource({profile:live,key,tenantId:'sarberki-live',source,envelope,checkedAt});
 assert.equal(proof.scope,'live-mailbox-source-v1');
 assert.equal(verifyMailboxAttestation({profile:live,key,tenantId:'sarberki-live',source,envelope,proof}),true);
 assert.equal(verifyMailboxAttestation({key,tenantId:'sarberki-live',source,envelope,proof}),false);
 assert.throws(()=>attestMailboxSource({profile:{...live},key,tenantId:'sarberki-live',source,envelope,checkedAt}),/MAILBOX_PROFILE_UNKNOWN/);
 assert.throws(()=>attestMailboxSource({profile:live,key,tenantId:'sarberki-test',source,envelope,checkedAt}),/INVALID_EVIDENCE/);
 assert.throws(()=>attestMailboxSource({profile:live,key,tenantId:'sarberki-live',source:{...source,to:'sarberkiprojecttest@gmail.com'},envelope,checkedAt}),/INVALID_EVIDENCE/);
});
