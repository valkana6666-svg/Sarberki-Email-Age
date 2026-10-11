// Test-only, explicitly enabled UI bridge. No production initialization.
// The only write is a server-authorized approval of a freshly loaded, persisted synthetic draft.
import {createCaseStoreClient} from './shared-core/case-store-client.mjs';
import {createIsolatedApprovalReview} from './shared-core/isolated-approval-review.mjs';

const allowedTarget='https://isolated-approval.supabase.co';
const caseIdPattern=/^case-[A-Za-z0-9_-]{1,120}$/;
const safeCode=error=>['AUTH_REQUIRED','FORBIDDEN','CASE_CONFLICT','REVIEW_CHANGED',
 'REVIEW_NOT_READY','INVALID_DRAFT','INVALID_INPUT','REVIEW_REQUIRED',
 'REVIEW_BUSY','REVIEW_CANCELLED','SERVICE_UNAVAILABLE','CASE_STORE_DISABLED'].includes(error?.message)
 ?error.message:'ELLENORZES_SZUKSEGES';

export function initIsolatedApprovalPanel({
 documentRef=globalThis.document, sessionProvider=()=>null, enabled=false,
 approvalTarget=null, request=globalThis.fetch?.bind(globalThis),
 cryptoProvider=globalThis.crypto
}={}){
 const element=id=>documentRef?.getElementById(id);
 const ids=['isolated_approval_case_id','isolated_approval_load',
  'isolated_approval_text','isolated_approval_revision','isolated_approval_confirm',
  'isolated_approval_submit','isolated_approval_status'];
 const found=ids.map(element);
 if(found.some(x=>!x))return false;
 const [caseInput,loadButton,reviewText,revisionField,confirmation,submit,status]=found;
 let loaded=null,busy=false,epoch=0;
 const message=text=>{status.textContent=text;};
 const locked=()=>{submit.disabled=busy||!loaded||confirmation.checked!==true;loadButton.disabled=busy;};
 const reset=()=>{
  epoch++;loaded=null;confirmation.checked=false;
  reviewText.value='';revisionField.value='';submit.disabled=true;
  bridge?.clear();
 };
 reviewText.readOnly=true;
 revisionField.readOnly=true;
 confirmation.checked=false;submit.disabled=true;
 // Passing an expected target string is not a server-side authorization bypass.
 // No token, network call, or approval client is initialized without both gates.
 if(enabled!==true||approvalTarget!==allowedTarget||typeof request!=='function'){
  loadButton.disabled=true;
  message('Elkülönített jóváhagyás kikapcsolva. Nincs hálózati kérés.');
  return false;
 }
 const client=createCaseStoreClient({
  getAccessToken:async()=>{
   const provider=typeof sessionProvider==='function'?sessionProvider():null;
   if(typeof provider?.getAccessToken!=='function')throw Error('AUTH_REQUIRED');
   const token=await provider.getAccessToken();
   if(typeof token!=='string'||!token)throw Error('AUTH_REQUIRED');
   return token;
  },
  request,isolatedApproval:true,approvalTarget
 });
 const bridge=createIsolatedApprovalReview({client,enabled:true,cryptoProvider});
 const clearOnChange=()=>{
  if(!busy){reset();message('Az ügyazonosító megváltozott. Új betöltés szükséges.');}
 };
 caseInput.addEventListener('input',clearOnChange);
 confirmation.addEventListener('change',locked);
 loadButton.addEventListener('click',async()=>{
  if(busy)return;
  reset();
  const id=caseInput.value.trim();
  if(!caseIdPattern.test(id)){message('Csak case- kezdetű szintetikus ügyazonosító engedélyezett.');return;}
  busy=true;locked();const generation=epoch;
  message('Tárolt szintetikus tervezet hitelesített lekérése…');
  try{
   const value=await bridge.load(id);
   if(epoch!==generation)throw Error('REVIEW_CANCELLED');
   loaded=value;
   reviewText.value=value.text;
   revisionField.value=String(value.revision);
   message('Tárolt tervezet betöltve. Olvasd el, majd külön erősítsd meg. Nincs e-mail-küldés.');
  }catch(error){
   reset();message('A tervezet nem tölthető be: '+safeCode(error)+'. Nincs jóváhagyás.');
  }finally{busy=false;locked();}
 });
 submit.addEventListener('click',async()=>{
  if(busy)return;
  if(!loaded||confirmation.checked!==true||reviewText.value!==loaded.text||
      revisionField.value!==String(loaded.revision)||caseInput.value.trim()!==loaded.caseId){
   reset();message('REVIEW_REQUIRED: újra kell olvasni és meg kell erősíteni a tárolt tervezetet.');return;
  }
  busy=true;locked();
  const selected=loaded;
  // The reviewed hash and CAS revision come only from bridge.load, never the preview.
  reset();
  message('Hitelesített szerveres jóváhagyás ellenőrzése…');
  try{
   const approved=await bridge.approve({
    caseId:selected.caseId,revision:selected.revision,reviewedText:selected.text,confirmed:true
   });
   message('Izolált szintetikus jóváhagyás mentve; új verzió: '+approved.revision+'. Nem foglalás és nem elküldött levél.');
  }catch(error){message('Nincs igazolt jóváhagyás: '+safeCode(error)+'. Az ügyet újra be kell tölteni.');}
  finally{busy=false;locked();}
 });
 message('Elkülönített tesztkezelői munkamenet szükséges. Jóváhagyás még nincs.');
 return true;
}
