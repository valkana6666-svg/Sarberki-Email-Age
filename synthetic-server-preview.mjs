import {createCaseStoreClient} from './shared-core/case-store-client.mjs';
import {isIsolatedReviewCaseId} from './shared-core/isolated-review-case-id.mjs';
import {renderCentralConversation} from './shared-core/inquiry-channel-adapters.mjs';

// Read-only server projection. Unknown evidence is never converted to success.
export function syntheticPreviewState(result){
 const d=result?.decision,s=result?.reviewState;
 let details='Hiányok és ellentmondások: NEM IGAZOLT.';
 if(d&&Array.isArray(d.missing)&&Array.isArray(d.contradictions)&&d.facts&&d.capacity&&d.pricing){
  details=renderCentralConversation({...d,capacity:{...d.capacity,status:d.capacity.verified===true?d.capacity.status:'UNKNOWN'}},{language:'hu'});
  if(d.contradictions.length)details+='\nEllentmondások: '+d.contradictions.map(x=>String(x.code)).join(', ');
 }
 const capacity=d?.capacity?.verified===true&&d.capacity.status==='AVAILABLE'?'Igazolt típusszintű pillanatfelvétel; nem foglalás.':d?.capacity?.verified===true&&d.capacity.status==='UNAVAILABLE'?'Nincs elegendő igazolt kapacitás.':'NEM IGAZOLT – jóváhagyás tiltott.';
 const price=d?.pricing?.verified===true?'Belső számítás ellenőrzött; vendégár nincs jóváhagyva.':'NEM IGAZOLT – nincs jóváhagyott vendégár.';
 const valid=s&&Number.isSafeInteger(s.caseRevision)&&s.caseRevision===result.revision&&Number.isSafeInteger(s.factsRevision)&&Number.isSafeInteger(s.messageCount);
 const current=valid&&s.latestDraftRevision===s.factsRevision&&s.latestDraftMessageCount===s.messageCount;
 return {details,capacity,price,revision:valid?'Ügyverzió: '+s.caseRevision+' · tényverzió: '+s.factsRevision+' · '+(current?'Tárolt tervezet verziója egyezik; külön kezelői ellenőrzés szükséges.':'Nincs aktuális, az üzenetekhez kötött tárolt tervezet. Új ellenőrzés szükséges.'):'Tárolt tervezet verziója: NEM IGAZOLT.',approval:'Az előnézet függőben van; itt nincs jóváhagyás.',audit:'Audit: ezen az olvasási előnézeten nincs visszaolvasva; NEM IGAZOLT.'};
}
export function initSyntheticPreviewPanel({documentRef=document,sessionProvider=()=>window.SarberkiCaseStoreSession}={}){
 const get=id=>documentRef.getElementById(id),action=get('server_preview_action'),status=get('server_preview_status'),output=get('server_preview_text');
 if(!action||!status||!output)return false;
 let epoch=0;
 const clear=()=>{output.value='';if(get('server_preview_hu'))get('server_preview_hu').value='';for(const field of ['details','capacity','price','revision','approval','audit'])if(get('server_preview_'+(field==='revision'?'revision_state':field)))get('server_preview_'+(field==='revision'?'revision_state':field)).textContent='NEM IGAZOLT.';};
 const invalidate=()=>{epoch++;clear();action.disabled=false;status.textContent='A tesztügy vagy munkamenet megváltozott. Új előnézet szükséges.';};
 for(const id of ['server_preview_case_id','server_preview_revision'])get(id)?.addEventListener('input',invalidate);
 for(const event of ['sarberki:session-changed','isolated-approval-session-changed'])documentRef.addEventListener?.(event,invalidate);
 action.addEventListener('click',async()=>{
  const attempt=++epoch;clear();
  const id=get('server_preview_case_id').value.trim(),revision=Number(get('server_preview_revision').value);
  if(!isIsolatedReviewCaseId(id)||!Number.isSafeInteger(revision)||revision<1){status.textContent='Csak szintetikus tesztügy-azonosító és pozitív egész verzió engedélyezett.';return;}
  const session=sessionProvider();
  if(typeof session?.getAccessToken!=='function'){status.textContent='A tesztügytárhoz hitelesített kezelői bejelentkezés még nincs bekötve. Nincs adatlekérés vagy mentés.';return;}
  action.disabled=true;status.textContent='Előnézet betöltése hitelesített tesztügyből…';
  try{
   const client=createCaseStoreClient({getAccessToken:()=>session.getAccessToken(),request:session.request||fetch});
   const result=await client.previewDraft('sarberki-test',id,revision);
   if(attempt!==epoch)return;
   if(result?.persisted!==false||result?.caseId!==id||result?.revision!==revision||result?.approval!=='pending'||typeof result?.text!=='string')throw Error('INVALID_PREVIEW');
   const view=syntheticPreviewState(result);
   output.value=result.text;
   if(get('server_preview_hu'))get('server_preview_hu').value=typeof result.operatorReviewText==='string'?result.operatorReviewText:'Magyar ellenőrző szöveg: NEM IGAZOLT.';
   for(const [field,text]of Object.entries(view))if(get('server_preview_'+(field==='revision'?'revision_state':field)))get('server_preview_'+(field==='revision'?'revision_state':field)).textContent=text;
   status.textContent='Belső előnézet kész. Nincs mentés, jóváhagyás vagy e-mail-küldés.';
  }catch(e){if(attempt===epoch){clear();status.textContent='Az előnézet nem kérhető le: '+(['AUTH_REQUIRED','FORBIDDEN','CASE_CONFLICT','CASE_STORE_DISABLED','SERVICE_UNAVAILABLE'].includes(e?.message)?e.message:'ellenőrzés szükséges')+'. Semmi nem lett elküldve.';}}
  finally{if(attempt===epoch)action.disabled=false;}
 });
 clear();status.textContent='Csak szintetikus ügy. Külön hitelesített tesztkezelői munkamenet szükséges.';return true;
}
if(typeof document!=='undefined')initSyntheticPreviewPanel();
