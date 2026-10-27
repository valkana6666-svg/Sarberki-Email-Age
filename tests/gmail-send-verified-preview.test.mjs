import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createVerifiedGmailSendPreview,createOfflineJoinedGmailSendPreview} from '../shared-core/gmail-send-verified-preview.mjs';
import {EXACT_CASE,TEST_DESTINATION} from '../shared-core/gmail-send-dry-run.mjs';
const text='Hello,\n\nPlease provide a contact phone number.\n\nThank you.';
const hash=createHash('sha256').update(text).digest('hex');
const record=()=>({tenantId:'sarberki-test',caseId:EXACT_CASE,revision:6,data:{state:{approval:'pending'},clarificationApproval:{scope:'clarification-only-v1',templateId:'missing-phone-en-v1',approvedRevision:6,reviewedRevision:5,draftHash:hash},drafts:[{text,reviewStatus:'clarification_review_required',clarification:{templateId:'missing-phone-en-v1'}}]}});
const req={tenantId:'sarberki-test',caseId:EXACT_CASE};
const auth=async()=>({authorized:true,role:'sender',tenant:'sarberki-test'});
test('trusted read-only preview is eligible but never sends',async()=>{
 const preview=createVerifiedGmailSendPreview({getCase:async()=>record(),requireSender:auth});
 const result=await preview(req);assert.equal(result.eligible,true);assert.equal(result.willSend,false);
});
test('rejects missing trusted providers',()=>assert.throws(()=>createVerifiedGmailSendPreview({}),/TRUSTED_READ/));
test('rejects unauthorized user before calling database',async()=>{
 let called=false;
 const preview=createVerifiedGmailSendPreview({getCase:async()=>{called=true;return record()},requireSender:async()=>({authorized:false})});
 assert.equal((await preview(req)).reason,'SENDER_AUTH_REQUIRED');assert.equal(called,false);
});
test('rejects forged client-supplied record',async()=>{
 const preview=createVerifiedGmailSendPreview({getCase:async()=>null,requireSender:auth});
 assert.equal((await preview({...req,record:record()})).reason,'RECORD_NOT_FOUND');
});
test('rejects cross tenant before authority check',async()=>{
 let called=false;const preview=createVerifiedGmailSendPreview({getCase:async()=>record(),requireSender:async()=>{called=true;return auth()}});
 assert.equal((await preview({...req,tenantId:'different'})).reason,'SCOPE_DENIED');assert.equal(called,false);
});
test('rejects destination override before authority check',async()=>{
 let called=false;const preview=createVerifiedGmailSendPreview({getCase:async()=>record(),requireSender:async()=>{called=true;return auth()}});
 assert.equal((await preview({...req,destination:'guest@example.test'})).reason,'DESTINATION_DENIED');assert.equal(called,false);
});
test('rejects stale record after authenticated fetch',async()=>{
 const stale=record();stale.revision=7;const preview=createVerifiedGmailSendPreview({getCase:async()=>stale,requireSender:auth});
 assert.equal((await preview(req)).reason,'STALE_REVISION');
});
test('denies on read error',async()=>{
 const preview=createVerifiedGmailSendPreview({getCase:async()=>{throw Error('unavailable')},requireSender:auth});
 assert.equal((await preview(req)).reason,'TRUSTED_READ_FAILED');
});

test('joined offline authority checks synthetic independent send permission',async()=>{
 const identity={environment:'TEST_ONLY_DISABLED_BY_DEFAULT',authenticated:true,subject:'test-user',tenant:'sarberki-test',caseId:EXACT_CASE,independentSendPermission:true,explicitOperatorConsent:true,csrfVerified:true};
 const p=createOfflineJoinedGmailSendPreview({getCase:async()=>record(),resolveVerifiedIdentity:async()=>identity});
 const ok=await p(req);assert.equal(ok.eligible,true);assert.equal(ok.willSend,false);
 identity.independentSendPermission=false;
 assert.equal((await p(req)).reason,'SENDER_AUTH_REQUIRED');
});
