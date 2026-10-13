import {createOperatorSession} from './sarberki-chatbot-project/operator-session.mjs';
import {initIsolatedApprovalPanel} from './isolated-approval-panel.mjs';
import {createEpochRequestQueue} from './shared-core/epoch-request-queue.mjs';
import {isIsolatedReviewCaseId} from './shared-core/isolated-review-case-id.mjs';
const origin='https://leafy-chimera-2403e5.netlify.app';
const el=id=>document.getElementById(id);
if(location.origin===origin){
 const session=createOperatorSession();let authenticated=false,epoch=0;
 const clear=()=>{epoch++;authenticated=false;el('workspace').disabled=true;el('logout').disabled=true;el('password').value='';el('readback_status').textContent='';document.dispatchEvent(new Event('isolated-approval-session-changed'));};
 const request=createEpochRequestQueue({getEpoch:()=>epoch,isAuthenticated:()=>authenticated,
  prepare:()=>session.restore(),
  execute:async(metadata,input,method='POST')=>{
   const r=await fetch('/.netlify/functions/booking-cases'+(method==='GET'?'?'+new URLSearchParams(input):''),{method,credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'X-Sarberki-Operator':'1','X-CSRF-Token':metadata.csrfToken,...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:JSON.stringify(input)}:{})});
   const body=await r.json();if(!r.ok)throw Error(body.error||'SERVICE_UNAVAILABLE');return body.result;
  }
 });
 const client={get:(tenantId,caseId)=>request({tenantId,caseId,action:'review-record'},'GET'),
  approve:(tenantId,caseId,expectedRevision,reviewedDraftHash)=>request({tenantId,caseId,action:'approve',expectedRevision,reviewedDraftHash})};
 el('cloud_prepare').addEventListener('click',async()=>{
  const turn=epoch,id=el('isolated_approval_case_id').value.trim();
  document.dispatchEvent(new Event('isolated-approval-session-changed'));
  try{
   if(!isIsolatedReviewCaseId(id))throw Error();
   const rows=await request({tenantId:'sarberki-test'},'GET'),row=rows.find(value=>value.caseId===id);
   if(!row)throw Error();
   const result=await request({tenantId:'sarberki-test',caseId:id,action:'review-draft',expectedRevision:row.revision});
   if(turn===epoch)el('readback_status').textContent='Tervezet mentve, verzió: '+result.record.revision+'. A jóváhagyó külön töltse be és olvassa el.';
  }catch{if(turn===epoch)el('readback_status').textContent='A tervezet mentése nem igazolt. Writer jogosultság szükséges.';}
 });
 initIsolatedApprovalPanel({enabled:true,approvalTarget:'https://mojnqizbcaczstguikpv.supabase.co',cloudSyntheticApproval:true,cloudClient:client});
 const restored=()=>{authenticated=true;el('workspace').disabled=false;el('logout').disabled=false;el('auth_status').textContent='Hitelesített szintetikus tesztmunkamenet.';};
 el('login').addEventListener('submit',async event=>{
  event.preventDefault();const email=el('email').value,password=el('password').value;clear();const turn=epoch;
  try{await session.login(email,password);if(turn===epoch)restored();}catch{el('auth_status').textContent='A bejelentkezés nem igazolt.';}finally{el('password').value='';}
 });
 el('logout').addEventListener('click',async()=>{clear();try{await session.logout();el('auth_status').textContent='Kijelentkezve.';}catch{el('auth_status').textContent='Kijelentkezés nem igazolt.';}});
 el('readback').addEventListener('click',async()=>{
  const turn=epoch,id=el('isolated_approval_case_id').value.trim();el('readback_status').textContent='';
  try{if(!isIsolatedReviewCaseId(id))throw Error();const result=await request({tenantId:'sarberki-test',caseId:id,action:'approval-state'},'GET');if(turn===epoch)el('readback_status').textContent=JSON.stringify(result,null,2);}
  catch{if(turn===epoch)el('readback_status').textContent='Visszaolvasás nem igazolt.';}
 });
 const initialEpoch=epoch;session.restore().then(()=>{if(epoch===initialEpoch)restored();}).catch(()=>{if(epoch===initialEpoch)el('auth_status').textContent='Bejelentkezés szükséges.';});
 addEventListener('pagehide',clear);
}
