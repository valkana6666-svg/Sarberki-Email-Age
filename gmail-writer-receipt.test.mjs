import test from 'node:test';
import assert from 'node:assert/strict';
import {gmailReceiptRequestFromRecord} from './operator-login-ui.mjs';

const text='Synthetic Gmail request, no real guest data.';
function sample(){
 return {source:{provider:'gmail',message_id:'synthetic-message-1',thread_id:'synthetic-thread-1',rfc_message_id:'<synthetic@example.invalid>',in_reply_to:null,references:[],subject:'Synthetic booking test',from:'Synthetic <guest@example.invalid>',from_email:'guest@example.invalid',to:'sarberkiprojecttest@gmail.com',received_at:'2026-10-15T06:00:00.000Z'},original_message:text};
}
test('exact Gmail Writer request includes only the server-validated receipt and envelope',()=>{
 const r=gmailReceiptRequestFromRecord(sample(),text);
 assert.deepEqual(Object.keys(r).sort(),['action','envelope','expectedRevision','sourceReceipt','tenantId'].sort());
 assert.equal(r.tenantId,'sarberki-test');
 assert.equal(r.action,'ingest-and-draft');
 assert.equal(r.expectedRevision,0);
 assert.equal(r.envelope.text,text);
 assert.equal(r.envelope.mailbox_id,'sarberki_gmail_test');
 assert.equal(r.sourceReceipt.mailbox_id,'sarberki_gmail_test');
 assert.deepEqual(r.envelope.references,[]);
});
test('exact Gmail Writer request fails closed for wrong mailbox, altered text or reply',()=>{
 const wrong=sample();wrong.source.to='another@example.invalid';
 assert.throws(()=>gmailReceiptRequestFromRecord(wrong,text),/INVALID_INPUT/);
 assert.throws(()=>gmailReceiptRequestFromRecord(sample(),text+' altered'),/INVALID_INPUT/);
 const reply=sample();reply.source.in_reply_to='<previous@example.invalid>';
 assert.throws(()=>gmailReceiptRequestFromRecord(reply,text),/INVALID_INPUT/);
 const extra=sample();extra.source.unauthorized=true;
 assert.throws(()=>gmailReceiptRequestFromRecord(extra,text),/INVALID_INPUT/);
});
