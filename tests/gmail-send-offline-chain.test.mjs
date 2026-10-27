import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createOfflineJoinedGmailSendPreview} from '../shared-core/gmail-send-verified-preview.mjs';
import {createOfflineExactGmailReceiptVerifier} from '../shared-core/gmail-send-exact-receipt-offline.mjs';
import {EXACT_CASE,TEST_DESTINATION} from '../shared-core/gmail-send-dry-run.mjs';

const body='Hello,\n\nPlease provide a contact phone number.\n\nThank you.';
const hash=createHash('sha256').update(body,'utf8').digest('hex');
const record=()=>({tenantId:'sarberki-test',caseId:EXACT_CASE,revision:6,data:{tenantId:'sarberki-test',id:EXACT_CASE,state:{approval:'pending'},clarificationApproval:{scope:'clarification-only-v1',templateId:'missing-phone-en-v1',reviewedRevision:5,approvedRevision:6,draftHash:hash},drafts:[{text:body,reviewStatus:'clarification_review_required',clarification:{templateId:'missing-phone-en-v1'}}]}});
const identity=()=>({environment:'TEST_ONLY_DISABLED_BY_DEFAULT',authenticated:true,subject:'fixture',tenant:'sarberki-test',caseId:EXACT_CASE,independentSendPermission:true,csrfVerified:true,explicitOperatorConsent:true});
const req={tenantId:'sarberki-test',caseId:EXACT_CASE,destination:TEST_DESTINATION,sourceAccount:TEST_DESTINATION};
function harness({current=record(),auth=identity(),receiptValid=true}={}) {
 const trustedReceipt={caseId:EXACT_CASE,matchesRecord:r=>receiptValid&&r===current};
 return createOfflineJoinedGmailSendPreview({getCase:async()=>current,resolveVerifiedIdentity:async()=>auth,verifyExactReceipt:createOfflineExactGmailReceiptVerifier(trustedReceipt)});
}
test('integrated trusted offline pipeline is eligible, never sends',async()=>{
 const r=await harness()(req);assert.equal(r.eligible,true);assert.equal(r.willSend,false);assert.equal(r.simulation,true);
});
test('integrated pipeline denies revoked clarification approval',async()=>{
 const current=record();delete current.data.clarificationApproval;
 assert.equal((await harness({current})(req)).eligible,false);
});
test('integrated pipeline denies mutated message receipt',async()=>{
 assert.equal((await harness({receiptValid:false})(req)).reason,'EXACT_RECEIPT_UNVERIFIED');
});
test('integrated pipeline denies stale saved case revision',async()=>{
 const current=record();current.revision=7;
 assert.equal((await harness({current})(req)).reason,'STALE_REVISION');
});
test('integrated pipeline denies missing independent send role',async()=>{
 const auth=identity();auth.independentSendPermission=false;
 assert.equal((await harness({auth})(req)).reason,'SENDER_AUTH_REQUIRED');
});
test('integrated pipeline denies recipient substitution',async()=>{
 assert.equal((await harness()({...req,destination:'outside@example.test'})).reason,'DESTINATION_DENIED');
});
