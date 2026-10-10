import {createCaseStoreClient} from './shared-core/case-store-client.mjs';

// Opt-in preview panel. No password/token field and no access token persistence.
// A separately verified login flow may provide a getAccessToken callback later.
export function initSyntheticPreviewPanel({documentRef=document,sessionProvider=()=>window.SarberkiCaseStoreSession}={}){
 const get=id=>documentRef.getElementById(id);
 const action=get('server_preview_action'),status=get('server_preview_status'),output=get('server_preview_text');
 if(!action||!status||!output)return false;
 action.addEventListener('click',async()=>{
  output.value='';
  const id=get('server_preview_case_id').value.trim();
  const revision=Number(get('server_preview_revision').value);
  if(!/^case-[A-Za-z0-9_-]{1,120}$/.test(id)||!Number.isSafeInteger(revision)||revision<1){
   status.textContent='Csak szintetikus tesztügy-azonosító és pozitív egész verzió engedélyezett.';return;
  }
  const session=sessionProvider();
  if(typeof session?.getAccessToken!=='function'){
   status.textContent='A tesztügytárhoz hitelesített kezelői bejelentkezés még nincs bekötve. Nincs adatlekérés vagy mentés.';return;
  }
  action.disabled=true;
  status.textContent='Előnézet betöltése hitelesített tesztügyből…';
  try{
   const client=createCaseStoreClient({getAccessToken:session.getAccessToken,request:session.request||fetch});
   const result=await client.previewDraft('sarberki-test',id,revision);
   if(result?.persisted!==false||result?.caseId!==id||result?.revision!==revision||result?.approval!=='pending'||typeof result?.text!=='string'){
    throw Error('INVALID_PREVIEW');
   }
   output.value=result.text;
   status.textContent='Belső előnézet kész. Nincs mentés, jóváhagyás vagy e-mail-küldés.';
  }catch(e){
   status.textContent='Az előnézet nem kérhető le: '+(['AUTH_REQUIRED','FORBIDDEN','CASE_CONFLICT','CASE_STORE_DISABLED','SERVICE_UNAVAILABLE'].includes(e?.message)?e.message:'ellenőrzés szükséges')+'. Semmi nem lett elküldve.';
  }finally{action.disabled=false;}
 });
 status.textContent='Csak szintetikus ügy. Külön hitelesített tesztkezelői munkamenet szükséges.';
 return true;
}
if(typeof document!=='undefined')initSyntheticPreviewPanel();
