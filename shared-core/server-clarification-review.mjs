import {createHash} from 'node:crypto';
import {matchesExactGmailEditRecord} from './server-exact-gmail-receipt.mjs';
import {extractServerMessage} from './server-message-extraction.mjs';
import {CaseServiceError} from './server-case-service.mjs';
export const CLARIFICATION_TEMPLATE='missing-phone-en-v1';
export const CLARIFICATION_TEXT='Hello,\n\nPlease provide a contact phone number.\n\nThank you.';
export const CLARIFICATION_HU='Kedves Vendég!\n\nKérjük, adja meg kapcsolattartási telefonszámát.\n\nKöszönjük.';
export const clarificationHash=text=>createHash('sha256').update(text,'utf8').digest('hex');
const deny=()=>{throw new CaseServiceError('REVIEW_NOT_READY','REVIEW_NOT_READY');};
export function clarificationEnabled(env){return env.CASE_CLARIFICATION_ENABLED==='sarberki-test-exact-phone-only-v1';}
export function assertClarificationScope(record,receipt){
 if(!matchesExactGmailEditRecord(record,receipt)||record.data.state?.approval!=='pending'||record.data.serverApproval||
  record.data.state.values?.language!=='en'||String(record.data.state.values.phone||'').trim())deny();
 const extracted=extractServerMessage(record.data.messages[0]);
 if(extracted.language!=='en'||String(extracted.phone||'').trim())deny();
}
export function assertClarificationDraft(record,receipt){
 assertClarificationScope(record,receipt);
 const d=record.data.drafts?.at(-1),c=d?.clarification;
 if(d?.text!==CLARIFICATION_TEXT||d.edited===true||d.reviewStatus!=='clarification_review_required'||
  c?.templateId!==CLARIFICATION_TEMPLATE||c.factsRevision!==record.data.state.revision||
  d.revision!==record.data.state.revision||d.basedOnMessageCount!==1||c.preparedBy!==record.updatedBy)deny();
 return d;
}
