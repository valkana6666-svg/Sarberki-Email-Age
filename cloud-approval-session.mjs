import {initClarificationPanel} from './clarification-panel.mjs';
import {createOperatorSession} from './sarberki-chatbot-project/operator-session.mjs';
import {initIsolatedApprovalPanel} from './isolated-approval-panel.mjs';
import {createEpochRequestQueue} from './shared-core/epoch-request-queue.mjs';
import {createCloudCaseRequest} from './shared-core/cloud-case-request.mjs';
import {formatCloudApprovalFailure} from './shared-core/cloud-approval-errors.mjs';
import {isIsolatedReviewCaseId} from './shared-core/isolated-review-case-id.mjs';
const origin='https://leafy-chimera-2403e5.netlify.app';
const el=id=>document.getElementById(id);
const selectedCase=new URLSearchParams(location.search).get('caseId');
if(isIsolatedReviewCaseId(selectedCase))el('isolated_approval_case_id').value=selectedCase;
if(location.origin===origin){
 const session=createOperatorSession();let authenticated=false,epoch=0,explicitlyLoggedOut=false,readbackEpoch=0;
 const clearReadback=()=>{
  readbackEpoch++;el('readback_status').textContent='';
  el('stored_readback_status').textContent='';el('stored_readback_text').value='';el('stored_readback_hu').value='';
 };
 const clear=()=>{epoch++;session.clear();authenticated=false;el('workspace').disabled=true;el('logout').disabled=true;el('password').value='';clearReadback();document.dispatchEvent(new Event('isolated-approval-session-changed'));};
 const queuedRequest=createEpochRequestQueue({getEpoch:()=>epoch,isAuthenticated:()=>authenticated,
  prepare:()=>session.restore(),
  execute:createCloudCaseRequest()
 });
 const request=async(...args)=>{
  const turn=epoch;
  try{return await queuedRequest(...args);}
  catch(error){
   if(turn===epoch&&error.message==='AUTH_REQUIRED'){
    clear();el('auth_status').textContent='Bejelentkezés szükséges. A korábbi helyi nézet és jóváhagyási kijelölés törölve; nincs automatikus ismétlés.';
   }
   throw error;
  }
 };
 const client={edit:(tenantId,caseId,expectedRevision,expectedDraftHash,editedDraftText)=>request({tenantId,caseId,action:'edit-draft',expectedRevision,expectedDraftHash,editedDraftText}),get:(tenantId,caseId)=>request({tenantId,caseId,action:'review-record'},'GET'),
  approve:(tenantId,caseId,expectedRevision,reviewedDraftHash)=>request({tenantId,caseId,action:'approve',expectedRevision,reviewedDraftHash})};
 el('cloud_prepare').addEventListener('click',async()=>{
  clearReadback();
  const turn=epoch,id=el('isolated_approval_case_id').value.trim();
  document.dispatchEvent(new Event('isolated-approval-session-changed'));
  let stage='case-id';
  try{
   if(!isIsolatedReviewCaseId(id))throw Error('INVALID_INPUT');
   stage='list';
   const rows=await request({tenantId:'sarberki-test'},'GET'),row=rows.find(value=>value.caseId===id);
   if(!row)throw Error('CASE_NOT_FOUND');
   stage='review-draft';
   const result=await request({tenantId:'sarberki-test',caseId:id,action:'review-draft',expectedRevision:row.revision});
   if(turn===epoch)el('readback_status').textContent='Tervezet mentve, verzió: '+result.record.revision+'. A jóváhagyó külön töltse be és olvassa el.';
  }catch(error){if(turn===epoch)el('readback_status').textContent=formatCloudApprovalFailure(error,stage);}
 });
 initClarificationPanel({client:{get:caseId=>request({tenantId:'sarberki-test',caseId,action:'review-record'},'GET'),prepare:(caseId,expectedRevision)=>request({tenantId:'sarberki-test',caseId,expectedRevision,action:'prepare-clarification'}),approve:(caseId,expectedRevision,reviewedDraftHash)=>request({tenantId:'sarberki-test',caseId,expectedRevision,reviewedDraftHash,action:'approve-clarification'})}});
 initIsolatedApprovalPanel({enabled:true,approvalTarget:'https://mojnqizbcaczstguikpv.supabase.co',cloudSyntheticApproval:true,cloudClient:client});
 document.addEventListener('clarification-draft-changed',clearReadback);
 document.addEventListener('cloud-draft-edited',clearReadback);
 const restored=()=>{authenticated=true;el('workspace').disabled=false;el('logout').disabled=false;el('auth_status').textContent='Hitelesített szintetikus tesztmunkamenet.';};
 el('login').addEventListener('submit',async event=>{
  event.preventDefault();const email=el('email').value,password=el('password').value;clear();const turn=epoch;
  try{await session.login(email,password);if(turn===epoch){explicitlyLoggedOut=false;restored();}}catch(error){if(turn===epoch)el('auth_status').textContent=formatCloudApprovalFailure(error,'login');}finally{el('password').value='';}
 });
 el('logout').addEventListener('click',async()=>{explicitlyLoggedOut=true;clear();try{await session.logout();el('auth_status').textContent='Kijelentkezve.';}catch(error){el('auth_status').textContent=formatCloudApprovalFailure(error,'logout');}});
 el('isolated_approval_case_id').addEventListener('input',clearReadback);
 el('isolated_approval_submit').addEventListener('click',clearReadback);
 el('readback').addEventListener('click',async()=>{
  const turn=epoch,id=el('isolated_approval_case_id').value.trim();clearReadback();const readTurn=readbackEpoch;
  // An informational read never retains consent for an earlier loaded review.
  document.dispatchEvent(new Event('isolated-approval-session-changed'));
  try{
   if(!isIsolatedReviewCaseId(id))throw Error('INVALID_INPUT');
   const result=await request({tenantId:'sarberki-test',caseId:id,action:'approval-state'},'GET');
   if(turn!==epoch||readTurn!==readbackEpoch||el('isolated_approval_case_id').value.trim()!==id)return;
   if(result?.caseId!==id||result.readOnly!==true||!Number.isSafeInteger(result.revision)||result.revision<1||!Array.isArray(result.audit))throw Error('INVALID_INPUT');
   const stored=result.storedDraft;
   if(stored!==null&&(!stored||typeof stored.text!=='string'||typeof stored.operatorReviewText!=='string'||typeof stored.current!=='boolean'))throw Error('INVALID_INPUT');
   el('stored_readback_text').value=stored?.text||'';el('stored_readback_hu').value=stored?.operatorReviewText||'';
   el('stored_readback_status').textContent='Tárolt ügy: '+id+' · v'+result.revision+' · '+result.approval+'. '+
    (stored?(stored.current?'A tárolt tervezet az aktuális üzenetszámhoz kötött.':'A tárolt tervezet korábbi állapothoz tartozik; nem aktuális jóváhagyási bizonyíték.'):'Nincs tárolt tervezet.')+
    ' Csak olvasás; a korábbi audit nem hagyja jóvá az új üzenetet.';
   const {storedDraft,...metadata}=result;
   el('readback_status').textContent=JSON.stringify(metadata,null,2);
  }catch(error){if(turn===epoch&&readTurn===readbackEpoch){el('stored_readback_text').value='';el('stored_readback_hu').value='';el('stored_readback_status').textContent='';el('readback_status').textContent=formatCloudApprovalFailure(error,'approval-state');}}
 });
 const resume=async()=>{
  if(document.visibilityState==='hidden'||explicitlyLoggedOut)return;
  const turn=epoch;
  try{
   try{await session.restore();}catch(error){if(error.message!=='SESSION_CHANGED'||turn!==epoch)throw error;await session.restore();}
   if(turn===epoch)restored();
  }catch{if(turn===epoch)el('auth_status').textContent='Bejelentkezés szükséges.';}
 };
 const suspend=()=>{clear();el('auth_status').textContent='A nézet lezárva. Visszatéréskor új ellenőrzés szükséges.';};
 void resume();
 addEventListener('pagehide',suspend);
 addEventListener('pageshow',event=>{if(event.persisted)return resume();});
 document.addEventListener('visibilitychange',()=>document.visibilityState==='hidden'?suspend():resume());
}
