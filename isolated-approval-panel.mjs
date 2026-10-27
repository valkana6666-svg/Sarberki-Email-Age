// Test-only, explicitly enabled UI bridge. No production initialization.
// The only write is a server-authorized approval of a freshly loaded, persisted synthetic draft.
import {createCaseStoreClient} from './shared-core/case-store-client.mjs';
import {createIsolatedApprovalReview} from './shared-core/isolated-approval-review.mjs';
import {isIsolatedReviewCaseId} from './shared-core/isolated-review-case-id.mjs';

const allowedTarget='https://isolated-approval.supabase.co';
const safeCode=error=>['AUTH_REQUIRED','FORBIDDEN','CASE_CONFLICT','REVIEW_CHANGED',
 'REVIEW_NOT_READY','INVALID_DRAFT','INVALID_INPUT','REVIEW_REQUIRED',
 'REVIEW_BUSY','REVIEW_CANCELLED','SERVICE_UNAVAILABLE','CASE_STORE_DISABLED'].includes(error?.message)
 ?error.message:'ELLENORZES_SZUKSEGES';

export function initIsolatedApprovalPanel({
 documentRef=globalThis.document, sessionProvider=()=>null, enabled=false,
 approvalTarget=null, request=globalThis.fetch?.bind(globalThis),
 cryptoProvider=globalThis.crypto,cloudSyntheticApproval=false,cloudClient=null
}={}){
 const element=id=>documentRef?.getElementById(id);
 const ids=['isolated_approval_case_id','isolated_approval_load',
  'isolated_approval_text','isolated_approval_revision','isolated_approval_confirm',
  'isolated_approval_submit','isolated_approval_status'];
 const found=ids.map(element);
 if(found.some(x=>!x))return false;
 const [caseInput,loadButton,reviewText,revisionField,confirmation,submit,status]=found;
 const translation=element('isolated_approval_hu');
 const editor=cloudSyntheticApproval===true?element('cloud_edit_text'):null,save=cloudSyntheticApproval===true?element('cloud_edit_save'):null;
 let editBase=null;
 let loaded=null,busy=false,epoch=0;
 const message=text=>{status.textContent=text;};
 const locked=()=>{submit.disabled=busy||!loaded||Boolean(loaded.approvalBlockedReason)||confirmation.checked!==true;loadButton.disabled=busy;if(editor)editor.disabled=busy||!editBase;if(save)save.disabled=busy||!editBase||editor.value===editBase.text;};
 const reset=()=>{
  epoch++;loaded=null;editBase=null;confirmation.checked=false;if(editor){editor.value='';editor.disabled=true;}if(save)save.disabled=true;
  reviewText.value='';if(translation)translation.value='';revisionField.value='';submit.disabled=true;
  bridge?.clear();
 };
 reviewText.readOnly=true;
 revisionField.readOnly=true;
 confirmation.checked=false;submit.disabled=true;
 // Passing an expected target string is not a server-side authorization bypass.
 // No token, network call, or approval client is initialized without both gates.
 if(enabled!==true||!(approvalTarget===allowedTarget||cloudSyntheticApproval===true&&approvalTarget==='https://mojnqizbcaczstguikpv.supabase.co'&&cloudClient)||typeof request!=='function'){
  loadButton.disabled=true;
  message('Elkülönített jóváhagyás kikapcsolva. Nincs hálózati kérés.');
  return false;
 }
 const client=cloudSyntheticApproval===true?cloudClient:createCaseStoreClient({
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
 documentRef.addEventListener?.('isolated-approval-session-changed',()=>{
  reset();message('Munkamenet változott. Új hitelesített betöltés szükséges.');
 });
 const clearOnChange=()=>{
  reset();message('Az ügyazonosító megváltozott. Új betöltés szükséges.');
 };
 caseInput.addEventListener('input',clearOnChange);
 confirmation.addEventListener('change',locked);
 loadButton.addEventListener('click',async()=>{
  if(busy)return;
  reset();
  const id=caseInput.value.trim();
  if(!isIsolatedReviewCaseId(id)){message('Érvényes tárolt tesztügy-azonosító szükséges.');return;}
  busy=true;locked();const generation=epoch;
  message('Tárolt szintetikus tervezet hitelesített lekérése…');
  try{
   const value=await bridge.load(id);
   if(epoch!==generation||caseInput.value.trim()!==id)throw Error('REVIEW_CANCELLED');
   loaded=value;if(editor&&save&&typeof client.edit==='function'&&value.canEditDraft===true){editBase=value;editor.value=value.text;}
   reviewText.value=value.text;
   if(translation)translation.value=value.operatorReviewText||'Magyar ellenőrző szöveg: NEM IGAZOLT ehhez a korábbi tervezethez.';
   revisionField.value=String(value.revision);
   message(value.approvalBlockedReason?'Tárolt tervezet betöltve. Szerkesztés és visszaolvasás engedélyezett; jóváhagyás tiltva: nincs ügyre kötött kapacitás-, ár- és review-bizonyíték.':'Tárolt tervezet betöltve. Olvasd el, majd külön erősítsd meg. Nincs e-mail-küldés.');
  }catch(error){
   reset();message('A tervezet nem tölthető be: '+safeCode(error)+'. Ezzel a betöltéssel nem történt új jóváhagyás. A korábban tárolt állapotot az audit visszaolvasásával ellenőrizheted.');
  }finally{busy=false;locked();}
 });
 if(editor&&save&&typeof client.edit==='function'){
  editor.addEventListener('input',()=>{
   loaded=null;confirmation.checked=false;bridge.clear();locked();
   message('Módosított szöveg: még nincs mentve vagy jóváhagyva.');
  });
  save.addEventListener('click',async()=>{
   if(busy)return;
   const selected=editBase,text=editor.value;
   if(!selected||caseInput.value.trim()!==selected.caseId||text===selected.text){reset();locked();return;}
   reset();busy=true;locked();const generation=epoch;
   message('Módosított vendégszöveg mentése…');
   try{
    const record=await client.edit('sarberki-test',selected.caseId,selected.revision,selected.hash,text);
    if(epoch!==generation||caseInput.value.trim()!==selected.caseId)return;
    const draft=record?.data?.drafts?.at(-1);
    if(record?.tenantId!=='sarberki-test'||record.caseId!==selected.caseId||record.revision!==selected.revision+1||record.data?.state?.approval!=='pending'||record.data?.serverApproval||draft?.text!==text||draft.edited!==true)throw Error('INVALID_DRAFT');
    message('Módosítás mentve, verzió: '+record.revision+(selected.approvalBlockedReason?'. Jóváhagyás továbbra is tiltva: nincs ügyre kötött kapacitás-, ár- és review-bizonyíték.':'. A független jóváhagyó külön töltse be és olvassa el. Nincs e-mail-küldés.'));
   }catch(error){if(epoch===generation){reset();message('A mentés nem igazolt: '+safeCode(error)+'. Új betöltés szükséges; jóváhagyás nincs.');}}
   finally{busy=false;locked();}
  });
 }
 submit.addEventListener('click',async()=>{
  if(busy)return;
  if(!loaded||confirmation.checked!==true||reviewText.value!==loaded.text||
      revisionField.value!==String(loaded.revision)||caseInput.value.trim()!==loaded.caseId){
   reset();message('REVIEW_REQUIRED: újra kell olvasni és meg kell erősíteni a tárolt tervezetet.');return;
  }
  busy=true;locked();
  const selected=loaded,generation=epoch;
  // Invalidate only the rendered UI. bridge.approve consumes the persisted review itself.
  // Calling bridge.clear here would discard the required server-loaded hash and revision.
  loaded=null;editBase=null;if(editor)editor.value='';confirmation.checked=false;reviewText.value='';revisionField.value='';locked();
  message('Hitelesített szerveres jóváhagyás ellenőrzése…');
  try{
   const approved=await bridge.approve({
    caseId:selected.caseId,revision:selected.revision,reviewedText:selected.text,confirmed:true
   });
   if(epoch===generation)message('Izolált szintetikus jóváhagyás mentve; új verzió: '+approved.revision+'. Nem foglalás és nem elküldött levél.');
  }catch(error){if(epoch===generation)message('Nincs igazolt jóváhagyás: '+safeCode(error)+'. Az ügyet újra be kell tölteni.');}
  finally{busy=false;locked();}
 });
 message('Elkülönített tesztkezelői munkamenet szükséges. Jóváhagyás még nincs.');
 return true;
}
