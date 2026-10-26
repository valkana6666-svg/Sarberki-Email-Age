import {attachOperatorRequestFailure} from './operator-request-error.mjs';
// Explicit opt-in async client. Existing localStorage runtime remains the default.
import {isIsolatedReviewCaseId} from './isolated-review-case-id.mjs';
export function createCaseStoreClient({getAccessToken,request=fetch,isolatedApproval=false,approvalTarget=null,cookieReadOnly=false,getCsrfToken}={}){
 if(cookieReadOnly!==true&&typeof getAccessToken!=='function')throw Error('Hitelesített munkamenet szükséges.');
 const call=async(method,input)=>{
  if(cookieReadOnly===true&&method!=='GET')throw Error('READ_ONLY');
  const token=cookieReadOnly===true?await getCsrfToken?.():await getAccessToken();if(!token)throw Error('AUTH_REQUIRED');
  const response=await request('/.netlify/functions/booking-cases'+(method==='GET'?'?'+new URLSearchParams(input):''),{method,cache:'no-store',...(cookieReadOnly===true?{credentials:'same-origin',redirect:'error'}:{}),headers:cookieReadOnly===true?{'X-Sarberki-Operator':'1','X-CSRF-Token':token,'Content-Type':'application/json'}:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(input)}:{})});
  const body=await response.json();if(!response.ok){throw attachOperatorRequestFailure(Error(body.error||'SERVICE_UNAVAILABLE'),response,body);}return body.result;
 };
 const approve=async(tenantId,caseId,expectedRevision,reviewedDraftHash)=>{
  // Client opt-in never enables the server gate or the source Supabase project.
  if(isolatedApproval!==true||approvalTarget!=='https://isolated-approval.supabase.co')throw Error('SETUP_REQUIRED');
  if(tenantId!=='sarberki-test'||!isIsolatedReviewCaseId(caseId)||!Number.isSafeInteger(expectedRevision)||expectedRevision<1||! /^[a-f0-9]{64}$/.test(reviewedDraftHash))throw Error('INVALID_INPUT');
  return call('POST',{action:'approve',tenantId,caseId,expectedRevision,reviewedDraftHash});
 };
 return {get:(tenantId,caseId)=>call('GET',{tenantId,caseId}),list:tenantId=>call('GET',{tenantId}),ingest:input=>call('POST',input),ingestAndDraft:input=>call('POST',{...input,action:'ingest-and-draft'}),previewDraft:(tenantId,caseId,expectedRevision)=>call('GET',{action:'preview-draft',tenantId,caseId,expectedRevision}),draft:(tenantId,caseId,expectedRevision)=>call('POST',{action:'draft',tenantId,caseId,expectedRevision}),editDraft:(tenantId,caseId,expectedRevision,editedDraftText)=>call('POST',{action:'edit-draft',tenantId,caseId,expectedRevision,editedDraftText}),approve};
}
