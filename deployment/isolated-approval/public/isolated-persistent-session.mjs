import {isTrustedIsolatedShell} from './isolated-persistent-policy.mjs';
import {initIsolatedApprovalPanel} from './isolated-approval-panel.mjs';
import {createCaseStoreClient} from './shared-core/case-store-client.mjs';
import {isIsolatedReviewCaseId} from './shared-core/isolated-review-case-id.mjs';

// Pinned isolated HTTPS server only. Existing rehearsal files are unchanged.
// Tokens remain in memory; the API independently validates Auth and DB membership.
const el=id=>document.getElementById(id);
let token=null,epoch=0;
const clear=()=>{
 epoch++;token=null;el('workspace').disabled=true;el('logout').disabled=true;
 el('password').value='';el('readback_status').textContent='';
 document.dispatchEvent(new Event('isolated-approval-session-changed'));
};
async function start(){
 if(location.protocol!=='https:')return;
 const response=await fetch('/isolated-config',{cache:'no-store'});
 if(!response.ok)return;
 const config=await response.json();
 if(!isTrustedIsolatedShell(location,config))return;
 const sessionProvider=()=>({getAccessToken:async()=>token});
 initIsolatedApprovalPanel({enabled:true,approvalTarget:config.target,sessionProvider});
 const client=createCaseStoreClient({getAccessToken:async()=>token});
 el('auth_status').textContent='Elkülönített tesztoperátori bejelentkezés szükséges.';
 el('login').addEventListener('submit',async event=>{
  event.preventDefault();const email=el('email').value,password=el('password').value;
  clear();const generation=epoch;el('signin').disabled=true;
  try{
   const r=await fetch('/isolated-auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
   if(!r.ok)throw Error('AUTH_REQUIRED');
   const result=await r.json();
   if(generation!==epoch)return;
   if(typeof result.access_token!=='string')throw Error('AUTH_REQUIRED');
   token=result.access_token;el('workspace').disabled=false;el('logout').disabled=false;
   el('auth_status').textContent='Hitelesített tesztmunkamenet. A jóváhagyási jogosultságot a szerver ellenőrzi.';
  }catch{clear();el('auth_status').textContent='AUTH_REQUIRED: a bejelentkezés nem igazolt.';}
  finally{el('password').value='';el('signin').disabled=false;}
 });
 el('logout').addEventListener('click',()=>{clear();el('auth_status').textContent='Kijelentkezve.';});
 el('readback').addEventListener('click',async()=>{
  const generation=epoch,id=el('isolated_approval_case_id').value.trim();
  el('readback_status').textContent='';
  try{
   if(!isIsolatedReviewCaseId(id))throw Error();
   const record=await client.get('sarberki-test',id);
   const r=await fetch('/isolated-audit?'+new URLSearchParams({caseId:id}),{cache:'no-store',headers:{Authorization:'Bearer '+token}});
   if(!r.ok)throw Error();const audit=await r.json();
   if(generation!==epoch)return;
   el('readback_status').textContent=JSON.stringify({caseId:record.caseId,revision:record.revision,approval:record.data?.state?.approval,serverApproval:record.data?.serverApproval,audit},null,2);
  }catch{if(generation===epoch)el('readback_status').textContent='Nincs igazolt visszaolvasás.';}
 });
}
start().catch(()=>{clear();el('auth_status').textContent='Elkülönített konfiguráció hiányzik. Kikapcsolva.';});
