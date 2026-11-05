import test from 'node:test';
import assert from 'node:assert/strict';
import {ingestTestMailboxMessage} from '../shared-core/server-test-mailbox-case.mjs';
import {verifyTestMailboxAttestation} from '../shared-core/server-gmail-source.mjs';

// Fictional data, fake Gmail and fake transport only. Real PostgreSQL behaviour of sc_tm_create is covered
// by tests/test-mailbox-sql-pglite.test.mjs; this file proves the server-side link in front of it.
const TOKEN='ya29.SYNTHETIC_TEST_ONLY_TOKEN_0123456789',ID='18f2a0b1c2d3e4f5',KEY='c3'.repeat(32);
const BODY='Jó napot! Deluxe faházat szeretnénk foglalni 2027-05-14 és 2027-05-16 között 2 felnőtt, 0 gyermek számára.';
const b64=text=>Buffer.from(text).toString('base64url');
function gmail({headers={},body=BODY,html=false}={}){
 const h={Subject:'Sárberki élő teszt – AI előnézet',From:'Teszt Vendég <sarberkito@gmail.com>',To:'sarberkiprojecttest@gmail.com','Message-ID':'<synthetic-1@example.test>',...headers};
 const parts=html?[{mimeType:'text/html',body:{data:b64('<p>'+body+'</p>')}}]:[{mimeType:'text/plain',body:{data:b64(body)}}];
 const message={id:ID,threadId:'18f2a0b1c2d3e4f0',labelIds:['INBOX'],internalDate:String(Date.parse('2026-10-31T10:00:00Z')),
  payload:{mimeType:'multipart/alternative',headers:Object.entries(h).filter(([,v])=>v!==undefined).map(([name,value])=>({name,value})),parts}};
 const calls=[];
 return {calls,fetchImpl:async(url)=>{calls.push(String(url));const u=new URL(url);
  return new Response(JSON.stringify(u.pathname.endsWith('/profile')?{emailAddress:'sarberkiprojecttest@gmail.com'}:message),{status:200});}};
}
function transport(result={revision:1},error=null){
 const calls=[];
 const fn=async(path,options)=>{calls.push({path,options});if(error)throw error;return result;};
 fn.calls=calls;return fn;
}
const run=(g,t,extra={})=>ingestTestMailboxMessage({token:TOKEN,messageId:ID,transport:t,attestationKey:KEY,fetchImpl:g.fetchImpl,clock:()=>new Date().toISOString(),...extra});
const rejectsWith=(promise,code)=>assert.rejects(promise,error=>error.code===code||assert.fail('expected '+code+' got '+error.code+' '+error.message));

test('verified test mail becomes ONE pending case through sc_tm_create with the shared AI draft and a database-recomputable attestation',async()=>{
 const g=gmail(),t=transport({revision:1});
 const result=await run(g,t);
 assert.deepEqual(result,{caseId:'tm-'+ID,revision:1});
 assert.equal(t.calls.length,1);assert.equal(t.calls[0].path,'/rest/v1/rpc/sc_tm_create');assert.equal(t.calls[0].options.method,'POST');
 const body=t.calls[0].options.body;
 assert.deepEqual(Object.keys(body).sort(),['p_case','p_data','p_proof','p_tenant']);
 assert.equal(body.p_tenant,'sarberki-test');assert.equal(body.p_case,'tm-'+ID);
 const data=body.p_data;
 // Shape required by sc_tm_create.
 assert.equal(data.id,body.p_case);assert.equal(data.tenantId,'sarberki-test');assert.equal(data.state.approval,'pending');
 assert.equal(data.messages.length,1);assert.equal(data.drafts.length,1);
 for(const k of ['serverApproval','clarificationApproval','testMailbox','decisions','internalApproval','caseKind','linkReview'])assert.equal(Object.hasOwn(data,k),false,k);
 const msg=data.messages[0],src=data.sourceReceipt;
 for(const k of ['mailbox_id','message_id','thread_id','rfc_message_id','received_at'])assert.equal(msg[k],src[k],k);
 assert.equal(msg.message_id,ID,'provider id unscoped');assert.equal(msg.rfc_message_id,'<synthetic-1@example.test>');
 assert.deepEqual(msg.references,[]);assert.equal(src.in_reply_to,null);assert.deepEqual(src.references,[]);
 assert.equal(data.sender,'sarberkito@gmail.com');assert.equal(msg.sender,'sarberkito@gmail.com');assert.equal(msg.text,BODY);
 // Shared engine facts and draft (server-extracted, not client-asserted); no sending/booking marker.
 assert.equal(data.state.values.arrival,'2027-05-14');assert.equal(data.state.values.departure,'2027-05-16');
 assert.equal(typeof data.drafts[0].text,'string');assert.ok(data.drafts[0].text.trim().length>0);
 assert.equal(data.drafts[0].reviewStatus,'manual_review_required');assert.equal(data.drafts[0].basedOnMessageCount,1);
 assert.equal(JSON.stringify(body).includes(TOKEN),false,'Gmail token never reaches storage');
 assert.equal(JSON.stringify(body).includes(KEY),false,'attestation key never reaches storage');
 // The same attestation the database recomputes.
 assert.equal(verifyTestMailboxAttestation({key:KEY,tenantId:'sarberki-test',source:src,envelope:msg,proof:body.p_proof}),true);
 assert.equal(verifyTestMailboxAttestation({key:'d4'.repeat(32),tenantId:'sarberki-test',source:src,envelope:msg,proof:body.p_proof}),false);
});

test('Gmail gate failures stop before any storage call and expose only fixed codes',async()=>{
 const cases=[
  ['other sender',{headers:{From:'Más <guest@example.test>'}},'NOT_TEST_PAIR_INQUIRY'],
  ['reply',{headers:{'In-Reply-To':'<x@example.test>'}},'REPLY_NOT_ALLOWED'],
  ['other recipient',{headers:{To:'guest@example.test'}},'NOT_ADDRESSED_TO_TEST_MAILBOX'],
  ['two recipients',{headers:{To:'sarberkiprojecttest@gmail.com, other@example.test'}},'NOT_ADDRESSED_TO_TEST_MAILBOX'],
  ['html only',{html:true},'TEXT_PART_REQUIRED'],
  ['empty',{body:'  '},'EMPTY_TEXT'],
  ['missing message id',{headers:{'Message-ID':undefined}},'MESSAGE_ID_REQUIRED']
 ];
 for(const [name,options,code] of cases){
  const t=transport();await rejectsWith(run(gmail(options),t),code);assert.equal(t.calls.length,0,name+': no storage call');
 }
 const t=transport();
 await rejectsWith(ingestTestMailboxMessage({token:'short',messageId:ID,transport:t,attestationKey:KEY}),'GMAIL_AUTH_REQUIRED');
 await rejectsWith(ingestTestMailboxMessage({token:TOKEN,messageId:'../x',transport:t,attestationKey:KEY}),'INVALID_INPUT');
 assert.equal(t.calls.length,0);
});

test('setup and storage failures are fixed codes; database text, token and key never leak; no retry or fallback write',async()=>{
 await rejectsWith(run(gmail(),null),'SETUP_REQUIRED');
 await rejectsWith(run(gmail(),transport(),{attestationKey:'not-a-key'}),'SETUP_REQUIRED');
 await rejectsWith(run(gmail(),transport(),{attestationKey:undefined}),'SETUP_REQUIRED');
 for(const [thrown,code] of [[Object.assign(Error('forbidden or expired '+TOKEN+KEY),{code:'FORBIDDEN'}),'FORBIDDEN'],[Error('duplicate key '+KEY),'STORAGE_FAILURE'],[Object.assign(Error('x'),{code:'23505'}),'STORAGE_FAILURE']]){
  const t=transport(null,thrown);
  await assert.rejects(run(gmail(),t),error=>{assert.equal(error.code,code);assert.equal(error.message,code);return true;});
  assert.equal(t.calls.length,1,'exactly one write attempt');
 }
});
