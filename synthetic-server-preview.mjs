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
 const a=result?.auditProof;
 const auditVerified=valid&&s.auditStatus==='verified'&&s.storedApproval==='pending'&&a?.verified===true&&a.scope==='stored-case-write'&&
  a.tenantId==='sarberki-test'&&a.caseId===result.caseId&&a.revision===result.revision&&
  a.kind===(result.revision===1?'insert':'update')&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(a.actor||'')&&/^[a-f0-9]{64}$/.test(a.dataHash||'');
 const audit=auditVerified?'Audit visszaolvasva · '+(a.kind==='insert'?'létrehozás':'módosítás')+' · v'+a.revision+' · kezelő: '+a.actor+' · SHA256: '+a.dataHash+'. Ez nem jóváhagyás.':'Audit: ezen az olvasási előnézeten nincs igazolt visszaolvasás; NEM IGAZOLT.';
 const service=result?.serviceRequest;
 const serviceFields={service_requested:service?.requested===true?'Igen – dézsaigény érkezett.':service?.requested===false?'Az igény visszavonását ellenőrizni kell.':'Nincs felismert dézsaigény.',
  service_date:service?.startDate||'Nincs megadva – pontosítandó.',service_time:service?.startTime||'Nincs megadva – pontosítandó.',
  service_duration:Number.isInteger(service?.durationHours)&&service.durationHours>0?service.durationHours+' óra':'Nincs megadva – pontosítandó.',
  service_case:service?.linkedCaseId||'Nem igazolt – emberi ügyazonosítás szükséges.',
  service_verification:service?.verificationStatus==='not_available'?'A szállásegységhez nincs dézsa. Nincs visszaigazolás.':service?.verificationStatus==='cancelled_unverified'?'Visszavonás – emberi ellenőrzés szükséges.':'Elérhetőség NEM IGAZOLT – nincs visszaigazolás.',
  service_human:service?'Igen – külön emberi jóváhagyás szükséges.':'Nem alkalmazható – nincs aktuális dézsaigény.'};
 return {details,capacity,price,...serviceFields,revision:valid?'Ügyverzió: '+s.caseRevision+' · tényverzió: '+s.factsRevision+' · '+(current?'Tárolt tervezet verziója egyezik; külön kezelői ellenőrzés szükséges.':'Nincs aktuális, az üzenetekhez kötött tárolt tervezet. Új ellenőrzés szükséges.'):'Tárolt tervezet verziója: NEM IGAZOLT.',approval:'Az előnézet függőben van; itt nincs jóváhagyás.',audit};
}
export function initSyntheticPreviewPanel({documentRef=document,sessionProvider=()=>window.SarberkiCaseStoreSession}={}){
 const get=id=>documentRef.getElementById(id),action=get('server_preview_action'),status=get('server_preview_status'),output=get('server_preview_text');
 const editText=get('server_edit_text'),editAction=get('server_edit_action'),editStatus=get('server_edit_status');
 if(!action||!status||!output)return false;
 let epoch=0,editableCase=null;
 const selectionKey=()=>JSON.stringify([get('server_preview_case_id')?.value.trim()||'',Number(get('server_preview_revision')?.value)]);
 let selection=selectionKey();
 const clear=()=>{editableCase=null;if(editText){editText.value='';editText.disabled=true;}if(editAction)editAction.disabled=true;if(editStatus)editStatus.textContent='Nincs aktív, szerkeszthető szerveres tervezet.';output.value='';if(get('server_preview_hu'))get('server_preview_hu').value='';for(const field of ['details','capacity','price','revision','approval','audit','service_requested','service_date','service_time','service_duration','service_case','service_verification','service_human'])if(get('server_preview_'+(field==='revision'?'revision_state':field)))get('server_preview_'+(field==='revision'?'revision_state':field)).textContent='NEM IGAZOLT.';};
 const invalidate=()=>{epoch++;selection=selectionKey();clear();action.disabled=false;status.textContent='A tesztügy vagy munkamenet megváltozott. Új előnézet szükséges.';};
 for(const id of ['server_preview_case_id','server_preview_revision'])get(id)?.addEventListener('input',()=>{if(selectionKey()!==selection)invalidate();});
 for(const event of ['sarberki:session-changed','isolated-approval-session-changed'])documentRef.addEventListener?.(event,invalidate);
 action.addEventListener('click',async()=>{
  const attempt=++epoch;selection=selectionKey();clear();
  const id=get('server_preview_case_id').value.trim(),revision=Number(get('server_preview_revision').value);
  if(!isIsolatedReviewCaseId(id)||!Number.isSafeInteger(revision)||revision<1){status.textContent='Csak szintetikus tesztügy-azonosító és pozitív egész verzió engedélyezett.';return;}
  const session=sessionProvider();
  const cookieRead=Boolean(session?.cookieReadOnly===true&&typeof session?.getCsrfToken==='function');
  if(!cookieRead&&typeof session?.getAccessToken!=='function'){status.textContent='A tesztügytárhoz hitelesített kezelői bejelentkezés szükséges. Nincs adatlekérés vagy mentés.';return;}
  action.disabled=true;status.textContent='Előnézet betöltése hitelesített tesztügyből…';
  try{
   const client=cookieRead?createCaseStoreClient({cookieReadOnly:true,getCsrfToken:()=>session.getCsrfToken(),request:session.request||fetch}):
    createCaseStoreClient({getAccessToken:()=>session.getAccessToken(),request:session.request||fetch});
   const result=await client.previewDraft('sarberki-test',id,revision);
   if(attempt!==epoch)return;
   if(result?.persisted!==false||result?.caseId!==id||result?.revision!==revision||result?.approval!=='pending'||typeof result?.text!=='string')throw Error('INVALID_PREVIEW');
   const view=syntheticPreviewState(result);
   output.value=result.text;
   if(editText&&editAction&&editStatus){
    const stored=result.storedDraft;
    if(stored&&stored.caseRevision===revision&&typeof stored.text==='string'&&stored.text.length<=20000&&stored.text.trim()&&result.reviewState?.storedApproval==='pending'){
     editText.value=stored.text;
     const permitted=!cookieRead&&session.canEditDraft===true;
     editText.disabled=!permitted;editAction.disabled=!permitted;
     editableCase=permitted?{id,revision,epoch:attempt,text:stored.text}:null;
     editStatus.textContent=permitted?'A mentett tervezet szerkeszthető, a változtatás nem jóváhagyás.':'Mentett tervezet betöltve – szerkesztéshez külön írási jogosultság szükséges.';
    }else editStatus.textContent='Nincs aktuális, szerveresen mentett tervezet. Szerkesztés nem engedélyezett.';
   }
   if(get('server_preview_hu'))get('server_preview_hu').value=typeof result.operatorReviewText==='string'?result.operatorReviewText:'Magyar ellenőrző szöveg: NEM IGAZOLT.';
   for(const [field,text]of Object.entries(view))if(get('server_preview_'+(field==='revision'?'revision_state':field)))get('server_preview_'+(field==='revision'?'revision_state':field)).textContent=text;
   status.textContent='Belső előnézet kész. Nincs mentés, jóváhagyás vagy e-mail-küldés.';
  }catch(e){if(attempt===epoch){clear();status.textContent='Az előnézet nem kérhető le: '+(['AUTH_REQUIRED','FORBIDDEN','CASE_CONFLICT','CASE_STORE_DISABLED','SERVICE_UNAVAILABLE'].includes(e?.message)?e.message:'ellenőrzés szükséges')+'. Semmi nem lett elküldve.';}}
  finally{if(attempt===epoch)action.disabled=false;}
 });
 if(editText&&editAction&&editStatus)editAction.addEventListener('click',async()=>{
  const active=editableCase;
  const session=sessionProvider();
  if(!active||active.epoch!==epoch||session?.cookieReadOnly===true||session?.canEditDraft!==true||typeof session.getAccessToken!=='function'){
   editStatus.textContent='Nincs hitelesített és engedélyezett szerkesztési munkamenet.';return;
  }
  const edited=editText.value;
  if(!edited.trim()||edited.length>20000||edited===active.text){editStatus.textContent='Adjon meg egy új, nem üres szerkesztett szöveget (legfeljebb 20 000 karakter).';return;}
  editAction.disabled=true;
  editStatus.textContent='Szintetikus tervezet mentése a szerveres ügytárba…';
  try{
   const client=createCaseStoreClient({getAccessToken:()=>session.getAccessToken(),request:session.request||fetch});
   const saved=await client.editDraft('sarberki-test',active.id,active.revision,edited);
   if(active.epoch!==epoch)return;
   const latest=saved?.data?.drafts?.at(-1);
   if(saved?.caseId!==active.id||saved?.revision!==active.revision+1||saved.data?.state?.approval!=='pending'||
      latest?.text!==edited||latest?.edited!==true||latest?.reviewStatus!=='manual_edit_requires_review')throw Error('INVALID_DRAFT');
   invalidate();
   get('server_preview_revision').value=String(saved.revision);
   editStatus.textContent='A szerkesztett szöveg mentve új ügyverzióba, jóváhagyás nélkül. Kérj friss előnézetet.';
   status.textContent='Szerveres mentés igazolva. Nincs e-mail-küldés vagy jóváhagyás.';
  }catch(error){
   if(active.epoch===epoch){
    invalidate();
    editStatus.textContent='A mentés nem igazolt ('+(['AUTH_REQUIRED','FORBIDDEN','CASE_CONFLICT','INVALID_DRAFT','CASE_STORE_DISABLED'].includes(error?.message)?error.message:'ellenőrzés szükséges')+'). Friss előnézet szükséges.';
   }
  }
 });
 clear();status.textContent='Csak szintetikus ügy. Külön hitelesített tesztkezelői munkamenet szükséges.';return true;
}
if(typeof document!=='undefined')initSyntheticPreviewPanel();
