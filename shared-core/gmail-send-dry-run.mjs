import {createHash} from 'node:crypto';
// Offline-only Gmail dispatch eligibility simulator.
// No Google API, network client, OAuth token, or side effects are imported here.
export const TEST_DESTINATION = 'sarberkiprojecttest@gmail.com';
export const EXACT_CASE = '13c8ecb7-f836-4e2c-9833-d58ee96f2dda';
export const EXACT_TEMPLATE = 'missing-phone-en-v1';
export const EXACT_SCOPE = 'clarification-only-v1';

const fail = (reason) => Object.freeze({eligible:false,reason,simulation:true,willSend:false});
export function simulateGmailClarificationSend(input) {
  if (!input || typeof input !== 'object') return fail('INVALID_INPUT');
  const {tenant,caseId,destination,sourceAccount,approval,caseRevision,latestDraft,operator,alreadyDispatched=false} = input;
  if (tenant !== 'sarberki-test' || caseId !== EXACT_CASE) return fail('SCOPE_DENIED');
  if (destination !== TEST_DESTINATION || sourceAccount !== TEST_DESTINATION) return fail('DESTINATION_DENIED');
  if (!approval || approval.scope !== EXACT_SCOPE || approval.templateId !== EXACT_TEMPLATE) return fail('APPROVAL_SCOPE_DENIED');
  if (!Number.isSafeInteger(caseRevision) || caseRevision < 1 || approval.approvedRevision !== caseRevision || approval.reviewedRevision !== caseRevision-1) return fail('STALE_REVISION');
  if (!latestDraft || latestDraft.text !== 'Hello,\n\nPlease provide a contact phone number.\n\nThank you.' || typeof latestDraft.hash !== 'string' || !/^[a-f0-9]{64}$/.test(latestDraft.hash) || approval.draftHash !== latestDraft.hash || createHash('sha256').update(latestDraft.text,'utf8').digest('hex') !== latestDraft.hash) return fail('DRAFT_MISMATCH');
  if (!operator || operator.authorized !== true || operator.role !== 'sender' || operator.tenant !== tenant) return fail('SENDER_AUTH_REQUIRED');
  if (alreadyDispatched) return fail('ALREADY_DISPATCHED');
  return Object.freeze({eligible:true,reason:'DRY_RUN_ELIGIBLE',simulation:true,willSend:false,caseId,caseRevision,destination});
}

// Maps a server-side sc_cases record to the offline evaluator.
// Caller identity must be supplied by a trusted server, never by an HTML input.
export function simulateStoredClarification(record,{destination,sourceAccount,operator,alreadyDispatched=false}={}) {
  if (!record || typeof record !== 'object' || !record.data || typeof record.data !== 'object') return fail('INVALID_INPUT');
  const latest=Array.isArray(record.data.drafts)?record.data.drafts.at(-1):null;
  const approval=record.data.clarificationApproval;
  if (record.data.state?.approval !== 'pending' || record.data.serverApproval) return fail('APPROVAL_SCOPE_DENIED');
  if (!latest || latest.clarification?.templateId !== EXACT_TEMPLATE || latest.reviewStatus !== 'clarification_review_required') return fail('DRAFT_MISMATCH');
  return simulateGmailClarificationSend({
    tenant:record.tenantId,caseId:record.caseId,caseRevision:record.revision,
    destination,sourceAccount,operator,alreadyDispatched,
    approval,latestDraft:{text:latest.text,hash:approval?.draftHash}
  });
}
