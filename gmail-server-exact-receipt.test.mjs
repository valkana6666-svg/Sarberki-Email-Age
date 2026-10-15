import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createExactGmailReceipt,readExactReceiptAudit} from './shared-core/server-exact-gmail-receipt.mjs';

const text='Synthetic Gmail receipt only; no real guest data.';
function fixture(){
 const source={provider:'gmail',mailbox_id:'sarberki_gmail_test',message_id:'synthetic-id-1',thread_id:'synthetic-thread-1',
  rfc_message_id:'<synthetic@example.invalid>',in_reply_to:null,references:[],subject:'Synthetic test',
  to:'sarberkiprojecttest@gmail.com',from:'Synthetic <guest@example.invalid>',from_email:'guest@example.invalid',
  received_at:'2026-10-15T06:00:00.000Z'};
 const envelope={sender:source.from_email,text,mailbox_id:source.mailbox_id,message_id:source.message_id,
  thread_id:source.thread_id,rfc_message_id:source.rfc_message_id,references:[],received_at:source.received_at};
 const config={caseId:'case-synthetic-gmail-receipt',source,envelope,bodySha256:createHash('sha256').update(text).digest('hex')};
 const env={CASE_EXACT_RECEIPT_ENABLED:'sarberki-test-one-receipt',
  URL:'https://leafy-chimera-2403e5.netlify.app',SUPABASE_URL:'https://mojnqizbcaczstguikpv.supabase.co',
  CASE_EXACT_RECEIPT_PRIVATE_JSON:JSON.stringify(config)};
 return {env,config,source,envelope};
}
test('private exact Gmail receipt requires all isolated server gates',()=>{
 const {env}=fixture();
 assert.ok(createExactGmailReceipt(env));
 for(const key of ['CASE_EXACT_RECEIPT_ENABLED','URL','SUPABASE_URL','CASE_EXACT_RECEIPT_PRIVATE_JSON']){
  assert.equal(createExactGmailReceipt({...env,[key]:'wrong'}),null,key);
 }
});
test('server matches only exact private source and envelope, not modified client data',()=>{
 const {env,source,envelope}=fixture();
 const receipt=createExactGmailReceipt(env);
 assert.equal(receipt.matches(envelope,source),true);
 assert.equal(receipt.matches({...envelope,text:text+' altered'},source),false);
 assert.equal(receipt.matches(envelope,{...source,to:'other@example.invalid'}),false);
 assert.equal(receipt.matches({...envelope,references:['<reply@example.invalid>']},source),false);
});
test('server rejects tampered private body hash and untrusted sender',()=>{
 const {env,config}=fixture();
 assert.equal(createExactGmailReceipt({...env,CASE_EXACT_RECEIPT_PRIVATE_JSON:JSON.stringify({...config,bodySha256:'0'.repeat(64)})}),null);
 const altered=structuredClone(config);altered.source.from_email='Guest@Example.invalid';
 assert.equal(createExactGmailReceipt({...env,CASE_EXACT_RECEIPT_PRIVATE_JSON:JSON.stringify(altered)}),null);
});

test('stored Gmail receipt audit validates one matching database snapshot and audit hash',async()=>{
 const {env,source,envelope,config}=fixture();
 const exactReceipt=createExactGmailReceipt(env);
 const actor='12345678-1234-1234-1234-123456789abc';
 const data={sender:envelope.sender,messages:[envelope],sourceReceipt:source,state:{approval:'pending'}};
 const record={tenantId:'sarberki-test',caseId:config.caseId,revision:1,updatedBy:actor,data};
 const serialized=JSON.stringify(data);
 const hash=createHash('sha256').update(serialized,'utf8').digest('hex');
 const calls=[];
 const transport=async url=>{
  calls.push(url);
  if(url.startsWith('/rest/v1/sc_cases?'))return [{tenant_id:record.tenantId,case_id:record.caseId,revision:1,updated_by:actor,data:serialized}];
  if(url.startsWith('/rest/v1/sc_audit?'))return [{tenant_id:record.tenantId,case_id:record.caseId,revision:1,actor,kind:'insert',data_hash:hash}];
  throw Error('UNEXPECTED_ROUTE');
 };
 const result=await readExactReceiptAudit({record,exactReceipt,transport});
 assert.equal(result?.verified,true);
 assert.equal(result?.scope,'stored-case-write');
 assert.equal(result?.dataHash,hash);
 assert.equal(calls.length,2);
});
test('stored Gmail receipt audit fails closed on altered audit hash and approved record',async()=>{
 const {env,source,envelope,config}=fixture();
 const exactReceipt=createExactGmailReceipt(env);
 const actor='12345678-1234-1234-1234-123456789abc';
 const data={sender:envelope.sender,messages:[envelope],sourceReceipt:source,state:{approval:'pending'}};
 const record={tenantId:'sarberki-test',caseId:config.caseId,revision:1,updatedBy:actor,data};
 const serialized=JSON.stringify(data);
 const transport=async url=>url.startsWith('/rest/v1/sc_cases?')
  ?[{tenant_id:record.tenantId,case_id:record.caseId,revision:1,updated_by:actor,data:serialized}]
  :[{tenant_id:record.tenantId,case_id:record.caseId,revision:1,actor,kind:'insert',data_hash:'0'.repeat(64)}];
 assert.equal(await readExactReceiptAudit({record,exactReceipt,transport}),null);
 let called=false;
 assert.equal(await readExactReceiptAudit({record:{...record,data:{...data,state:{approval:'approved'}}},exactReceipt,transport:async()=>{called=true;throw Error('unexpected');}}),null);
 assert.equal(called,false);
});

test('stored Gmail receipt audit rejects duplicate database snapshots without reading audit',async()=>{
 const {env,source,envelope,config}=fixture();
 const exactReceipt=createExactGmailReceipt(env);
 const actor='12345678-1234-1234-1234-123456789abc';
 const data={sender:envelope.sender,messages:[envelope],sourceReceipt:source,state:{approval:'pending'}};
 const record={tenantId:'sarberki-test',caseId:config.caseId,revision:1,updatedBy:actor,data};
 let auditRead=false;
 const transport=async url=>{
  if(url.startsWith('/rest/v1/sc_cases?')){
   const snapshot={tenant_id:record.tenantId,case_id:record.caseId,revision:1,updated_by:actor,data:JSON.stringify(data)};
   return [snapshot,snapshot];
  }
  auditRead=true;return [];
 };
 assert.equal(await readExactReceiptAudit({record,exactReceipt,transport}),null);
 assert.equal(auditRead,false);
});

test('stored Gmail receipt audit rejects wrong actor, revision and untrusted audit kind',async()=>{
 const {env,source,envelope,config}=fixture();
 const exactReceipt=createExactGmailReceipt(env);
 const actor='12345678-1234-1234-1234-123456789abc';
 const data={sender:envelope.sender,messages:[envelope],sourceReceipt:source,state:{approval:'pending'}};
 const record={tenantId:'sarberki-test',caseId:config.caseId,revision:1,updatedBy:actor,data};
 const serialized=JSON.stringify(data);
 const hash=createHash('sha256').update(serialized).digest('hex');
 for(const changed of [
  {revision:2},
  {actor:'87654321-1234-1234-1234-123456789abc'},
  {kind:'update'}
 ]){
  const transport=async url=>url.startsWith('/rest/v1/sc_cases?')
   ?[{tenant_id:record.tenantId,case_id:record.caseId,revision:1,updated_by:actor,data:serialized}]
   :[{tenant_id:record.tenantId,case_id:record.caseId,revision:1,actor,kind:'insert',data_hash:hash,...changed}];
  assert.equal(await readExactReceiptAudit({record,exactReceipt,transport}),null,JSON.stringify(changed));
 }
});
