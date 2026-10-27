import {isIsolatedReviewCaseId} from './shared-core/isolated-review-case-id.mjs';
// Separate scope: a closed missing-phone question, never accommodation approval.
export function initClarificationPanel({documentRef=document,client,cryptoProvider=globalThis.crypto}={}){
 const get=id=>documentRef.getElementById(id),prepare=get('clarification_prepare'),load=get('clarification_load'),approve=get('clarification_approve'),text=get('clarification_text'),confirm=get('clarification_confirm'),status=get('clarification_status'),input=get('isolated_approval_case_id');
 if(!prepare||!load||!approve||!text||!confirm||!status||!input||!client)return false;
 let epoch=0,selected=null,busy=false;
 const lock=()=>{prepare.disabled=busy;load.disabled=busy;approve.disabled=busy||!selected||confirm.checked!==true;};
 const clear=()=>{epoch++;selected=null;text.value='';confirm.checked=false;approve.disabled=true;status.textContent='Pontosító jóváhagyás nincs betöltve. A szállásajánlat ettől nem jóváhagyott.';};
 const id=()=>{const value=input.value.trim();if(!isIsolatedReviewCaseId(value))throw Error('INVALID_INPUT');return value;};
 const hash=async value=>Array.from(new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
 input.addEventListener('input',()=>{clear();busy=false;lock();});
 for(const event of ['isolated-approval-session-changed','sarberki:session-changed','cloud-draft-edited'])documentRef.addEventListener?.(event,()=>{clear();busy=false;lock();});
 confirm.addEventListener('change',lock);text.readOnly=true;
 const fail=error=>{clear();busy=false;lock();status.textContent='Pontosító művelet nem igazolt: '+(['FORBIDDEN','AUTH_REQUIRED','CASE_CONFLICT','REVIEW_NOT_READY','INVALID_DRAFT','SERVICE_UNAVAILABLE'].includes(error?.message)?error.message:'ellenőrzés szükséges')+'. Nincs küldés vagy szállásjóváhagyás.';};
 prepare.addEventListener('click',async()=>{
  if(busy)return;clear();const turn=epoch;busy=true;lock();
  try{const caseId=id(),r=await client.get(caseId);if(turn!==epoch)return;
   const saved=await client.prepare(caseId,r.revision);if(turn!==epoch)return;
   if(saved?.caseId!==caseId||saved.revision!==r.revision+1)throw Error('INVALID_DRAFT');
   status.textContent='Zárt telefonszám-pontosító kérdés mentve · v'+saved.revision+'. A külön Approver töltse be. Ez nem ajánlat.';
   documentRef.dispatchEvent?.(new Event('clarification-draft-changed'));
  }catch(error){if(turn===epoch)fail(error);}finally{if(turn===epoch){busy=false;lock();}}
 });
 load.addEventListener('click',async()=>{
  if(busy)return;clear();const turn=epoch;busy=true;lock();
  try{const caseId=id(),r=await client.get(caseId),d=r?.data?.drafts?.at(-1);
   if(turn!==epoch)return;
   if(r?.caseId!==caseId||r.tenantId!=='sarberki-test'||r.data.state?.approval!=='pending'||r.data.serverApproval||d?.reviewStatus!=='clarification_review_required'||d?.clarification?.templateId!=='missing-phone-en-v1'||d.edited===true||d.revision!==r.data.state.revision||d.basedOnMessageCount!==1||d.text!=='Hello,\n\nPlease provide a contact phone number.\n\nThank you.')throw Error('REVIEW_NOT_READY');
   const draftHash=await hash(d.text);if(turn!==epoch)return;
   text.value=d.text;
   if(r.data.clarificationApproval){status.textContent='Korábbi pontosító jóváhagyás tárolva; audit-visszaolvasás szükséges. A szállásajánlat továbbra is pending.';return;}
   selected={caseId,revision:r.revision,hash:draftHash,text:d.text};status.textContent='Zárt adatpontosító kérdés · v'+r.revision+'. Csak a telefonszám bekérését hagyhatja jóvá egy külön Approver; nincs ár-, kapacitás- vagy foglalási ígéret.';
  }catch(error){if(turn===epoch)fail(error);}finally{if(turn===epoch){busy=false;lock();}}
 });
 approve.addEventListener('click',async()=>{
  if(busy||!selected||confirm.checked!==true||text.value!==selected.text||input.value.trim()!==selected.caseId)return;
  const value=selected;clear();const turn=epoch;busy=true;lock();
  try{const r=await client.approve(value.caseId,value.revision,value.hash);if(turn!==epoch)return;
   const proof=r?.data?.clarificationApproval;
   if(r.caseId!==value.caseId||r.revision!==value.revision+1||r.data.state?.approval!=='pending'||r.data.serverApproval||proof?.scope!=='clarification-only-v1'||proof.reviewedRevision!==value.revision||proof.draftHash!==value.hash)throw Error('INVALID_DRAFT');
   documentRef.dispatchEvent?.(new Event('clarification-draft-changed'));
   status.textContent='Csak az adatpontosító válasz belső jóváhagyása mentve · v'+r.revision+'. A szállásajánlat pending. Nincs e-mail-küldés.';
  }catch(error){if(turn===epoch)fail(error);}finally{if(turn===epoch){busy=false;lock();}}
 });
 clear();lock();return true;
}
