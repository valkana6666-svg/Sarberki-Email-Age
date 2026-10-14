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
 const session=createOperatorSession();let authenticated=false,epoch=0;
 const clear=()=>{epoch++;authenticated=false;el('workspace').disabled=true;el('logout').disabled=true;el('password').value='';el('readback_status').textContent='';document.dispatchEvent(new Event('isolated-approval-session-changed'));};
 const request=createEpochRequestQueue({getEpoch:()=>epoch,isAuthenticated:()=>authenticated,
  prepare:()=>session.restore(),
  execute:createCloudCaseRequest()
 });
 const client={get:(tenantId,caseId)=>request({tenantId,caseId,action:'review-record'},'GET'),
  approve:(tenantId,caseId,expectedRevision,reviewedDraftHash)=>request({tenantId,caseId,action:'approve',expectedRevision,reviewedDraftHash})};
 el('cloud_prepare').addEventListener('click',async()=>{
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
 initIsolatedApprovalPanel({enabled:true,approvalTarget:'https://mojnqizbcaczstguikpv.supabase.co',cloudSyntheticApproval:true,cloudClient:client});
 const restored=()=>{authenticated=true;el('workspace').disabled=false;el('logout').disabled=false;el('auth_status').textContent='Hitelesített szintetikus tesztmunkamenet.';};
 el('login').addEventListener('submit',async event=>{
  event.preventDefault();const email=el('email').value,password=el('password').value;clear();const turn=epoch;
  try{await session.login(email,password);if(turn===epoch)restored();}catch(error){if(turn===epoch)el('auth_status').textContent=formatCloudApprovalFailure(error,'login');}finally{el('password').value='';}
 });
 el('logout').addEventListener('click',async()=>{clear();try{await session.logout();el('auth_status').textContent='Kijelentkezve.';}catch(error){el('auth_status').textContent=formatCloudApprovalFailure(error,'logout');}});
 el('readback').addEventListener('click',async()=>{
  const turn=epoch,id=el('isolated_approval_case_id').value.trim();el('readback_status').textContent='';
  try{if(!isIsolatedReviewCaseId(id))throw Error('INVALID_INPUT');const result=await request({tenantId:'sarberki-test',caseId:id,action:'approval-state'},'GET');if(turn===epoch)el('readback_status').textContent=JSON.stringify(result,null,2);}
  catch(error){if(turn===epoch)el('readback_status').textContent=formatCloudApprovalFailure(error,'approval-state');}
 });
 const initialEpoch=epoch;session.restore().then(()=>{if(epoch===initialEpoch)restored();}).catch(()=>{if(epoch===initialEpoch)el('auth_status').textContent='Bejelentkezés szükséges.';});
 addEventListener('pagehide',clear);
}
