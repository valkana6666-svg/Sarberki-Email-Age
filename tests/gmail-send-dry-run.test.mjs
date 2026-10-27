import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateGmailClarificationSend as check, TEST_DESTINATION, EXACT_CASE } from '../shared-core/gmail-send-dry-run.mjs';

const hash='a'.repeat(64);
const valid = () => ({
  tenant:'sarberki-test',caseId:EXACT_CASE,destination:TEST_DESTINATION,sourceAccount:TEST_DESTINATION,
  approval:{scope:'clarification-only-v1',templateId:'missing-phone-en-v1',reviewedRevision:5,approvedRevision:6,draftHash:hash},
  caseRevision:6,latestDraft:{text:'Hello,\n\nPlease provide a contact phone number.\n\nThank you.',hash},
  operator:{authorized:true,role:'sender',tenant:'sarberki-test'}
});
test('offline simulation never sends, including eligible case',()=>{
  const r=check(valid()); assert.equal(r.eligible,true);assert.equal(r.simulation,true);assert.equal(r.willSend,false);
});
for(const [name,change,reason] of [
  ['wrong tenant',v=>v.tenant='other','SCOPE_DENIED'],
  ['wrong case',v=>v.caseId='other','SCOPE_DENIED'],
  ['guest recipient',v=>v.destination='guest@example.test','DESTINATION_DENIED'],
  ['wrong source account',v=>v.sourceAccount='other@example.test','DESTINATION_DENIED'],
  ['ordinary approval',v=>v.approval.scope='accommodation','APPROVAL_SCOPE_DENIED'],
  ['wrong template',v=>v.approval.templateId='other','APPROVAL_SCOPE_DENIED'],
  ['stale case revision',v=>v.caseRevision=7,'STALE_REVISION'],
  ['stale reviewed revision',v=>v.approval.reviewedRevision=4,'STALE_REVISION'],
  ['body mutation',v=>v.latestDraft.text+=' extra','DRAFT_MISMATCH'],
  ['hash mismatch',v=>v.latestDraft.hash='b'.repeat(64),'DRAFT_MISMATCH'],
  ['missing sender authority',v=>v.operator.authorized=false,'SENDER_AUTH_REQUIRED'],
  ['reader trying to send',v=>v.operator.role='reader','SENDER_AUTH_REQUIRED'],
  ['cross tenant sender',v=>v.operator.tenant='other','SENDER_AUTH_REQUIRED'],
  ['already dispatched',v=>v.alreadyDispatched=true,'ALREADY_DISPATCHED'],
]) test(name+' denied without sending',()=>{const v=valid();change(v);const r=check(v);assert.equal(r.eligible,false);assert.equal(r.reason,reason);assert.equal(r.willSend,false)});
test('missing input fails closed',()=>assert.equal(check(null).eligible,false));
