import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createExactGmailReceipt} from './shared-core/server-exact-gmail-receipt.mjs';

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
