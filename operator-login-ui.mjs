// Explicit, read-only operator login for the synthetic Sárberki test case store.
// The password travels only to the Auth server; access/refresh tokens never enter the browser.
import {createCaseStoreClient} from './shared-core/case-store-client.mjs';
import {createCookieJsonRequest} from './shared-core/cookie-json-request.mjs';
import {isIsolatedReviewCaseId} from './shared-core/isolated-review-case-id.mjs';
import {syntheticMailMime,closedMailRequestFromGmailRecord,isClosedSyntheticMailUiRecord,syntheticTubFollowupEnvelope,syntheticTubFollowupMime,isClosedTubFollowup,isClosedTubPreviousRecord,syntheticTubReviewEnvelope,syntheticTubReviewMime,isClosedTubReview,isClosedTubReviewRecord} from './shared-core/synthetic-mail-fixtures.mjs';
import {formatCloudApprovalFailure} from './shared-core/cloud-approval-errors.mjs';
const endpoint='/.netlify/functions/operator-session';
const tokenPattern=/^[a-f0-9]{64}$/;
// Public shape validation only; authorization and the one private receipt match
// remain server-side. Preserve original text bytes, including CRLF, in payload.
export function gmailReceiptRequestFromRecord(record,currentMessage){
 const source=record?.source,text=record?.original_message;
 const keys=['provider','message_id','thread_id','rfc_message_id','in_reply_to','references','subject','from','from_email','to','received_at'];
 if(!source||Array.isArray(source)||Object.keys(source).sort().join(',')!==keys.sort().join(',')||
   source.provider!=='gmail'||source.to!=='sarberkiprojecttest@gmail.com'||source.in_reply_to!==null||
   !Array.isArray(source.references)||source.references.length||
   keys.filter(k=>!['in_reply_to','references'].includes(k)).some(k=>typeof source[k]!=='string'||!source[k]||source[k].length>2000)||
   !/^[a-zA-Z0-9_-]{1,256}$/.test(source.message_id)||!Number.isFinite(Date.parse(source.received_at))||
   !/^[^@\s]+@[^@\s]+$/.test(source.from_email)||typeof text!=='string'||!text||text.length>20000||
   typeof currentMessage!=='string'||currentMessage.replace(/\r\n?/g,'\n')!==text.replace(/\r\n?/g,'\n'))throw Error('INVALID_INPUT');
 const mailbox_id='sarberki_gmail_test';
 return {tenantId:'sarberki-test',action:'ingest-and-draft',expectedRevision:0,
  sourceReceipt:{...structuredClone(source),mailbox_id},
  envelope:{sender:source.from_email,text,mailbox_id,message_id:source.message_id,thread_id:source.thread_id,
   rfc_message_id:source.rfc_message_id,references:[],received_at:source.received_at}};
}
export function initOperatorLoginPanel({documentRef=document,globalRef=window,request=fetch}={}){
 request=createCookieJsonRequest({request});
 const get=id=>documentRef.getElementById(id);
 globalRef.SarberkiClosedSyntheticMailPreview=message=>{
  try{const current=get('message')?.value||'';return (!message||message===current)&&isClosedSyntheticMailUiRecord(JSON.parse(get('gmail_json')?.value||'null'),current);}catch{return false;}
 };
 const form=get('operator_login_form'),email=get('operator_login_email'),password=get('operator_login_password'),
  status=get('operator_login_status'),restore=get('operator_restore'),logout=get('operator_logout'),
  login=get('operator_login'),listCases=get('operator_list_cases'),caseSelect=get('operator_case_select'),
  openCase=get('operator_open_case'),caseStatus=get('operator_case_status');
 const createFixture=get('operator_create_fixture'),fixtureStatus=get('operator_fixture_status'),tubFollowup=get('gmail_cloud_tub_followup'),tubReview=get('gmail_cloud_tub_review');
 const mailLanguage=get('gmail_cloud_fixture_language'),mailLoad=get('gmail_cloud_fixture_load'),
  mailSave=get('gmail_cloud_fixture_save'),mailStatus=get('gmail_cloud_fixture_status'),mailApproval=get('gmail_cloud_fixture_approval');
 if(!form||!email||!password||!status||!restore||!logout||!login||!listCases||!caseSelect||!openCase||!caseStatus)return false;
 let active=false,busy=false,listed=[],authEpoch=0,authRequestEpoch=null,resumePending=false;
 let visible=documentRef.visibilityState!=='hidden';
 let requestQueue=Promise.resolve();
 const serialRequest=job=>{const next=requestQueue.then(job,job);requestQueue=next.catch(()=>{});return next;};
 const receiptPanel=get('gmail_bridge');let receiptSave=null,receiptStatus=null;
 if(receiptPanel){
  receiptSave=documentRef.createElement('button');receiptSave.id='gmail_exact_receipt_save';receiptSave.type='button';receiptSave.disabled=true;
  receiptSave.textContent='Betöltött Gmail-tesztlevél mentése · Writer';
  receiptStatus=documentRef.createElement('p');receiptStatus.id='gmail_exact_receipt_status';receiptStatus.setAttribute?.('role','status');
  receiptStatus.textContent='Csak a szerveren privátan engedélyezett egyetlen szintetikus tesztlevél menthető. Nincs automatikus mentés vagy jóváhagyás.';
  receiptPanel.appendChild(receiptSave);receiptPanel.appendChild(receiptStatus);
 }
 let receiptEpoch=0,receiptEventId=null;
 const receiptInput=()=>{
  const record=JSON.parse(get('gmail_json')?.value||'null');
  if(receiptEventId!==null&&record?.source?.message_id!==receiptEventId)throw Error('INVALID_INPUT');
  return gmailReceiptRequestFromRecord(record,get('message')?.value);
 };
 const refreshReceipt=()=>{if(receiptSave){try{receiptInput();receiptSave.disabled=busy||!active||!globalRef.SarberkiCaseStoreSession;}catch{receiptSave.disabled=true;}}};
 const invalidateReceipt=()=>{receiptEpoch++;refreshReceipt();};

 let loadedMail=null,mailEpoch=0,savedClosedMail=null;
 const clearMail=()=>{loadedMail=null;savedClosedMail=null;if(tubFollowup)tubFollowup.disabled=true;if(tubReview)tubReview.disabled=true;mailEpoch++;if(mailSave)mailSave.disabled=true;if(mailApproval){mailApproval.hidden=true;mailApproval.removeAttribute?.('href');}};
 const emit=()=>documentRef.dispatchEvent?.(new Event('sarberki:session-changed'));
 const resetCases=()=>{listed=[];caseSelect.replaceChildren();caseSelect.disabled=true;openCase.disabled=true;caseStatus.textContent='Csak hitelesített, szintetikus tesztügyek jelenhetnek meg.';};
 const clear=()=>{clearMail();active=false;globalRef.SarberkiCaseStoreSession=null;logout.disabled=true;listCases.disabled=true;if(mailLoad)mailLoad.disabled=true;if(createFixture)createFixture.disabled=true;if(fixtureStatus)fixtureStatus.textContent='Writer-belépés szükséges. Reader nem hozhat létre ügyet.';resetCases();emit();};
 const enable=metadata=>{
  const exp=Date.parse(metadata?.expiresAt);
  if(metadata?.authenticated!==true||metadata?.tenantId!=='sarberki-test'||
   !tokenPattern.test(metadata.csrfToken||'')||!Number.isFinite(exp)||exp<=Date.now()||
   exp>Date.now()+8*24*3600*1000)throw Error('INVALID_SESSION');
  const csrfToken=metadata.csrfToken;
  const session=Object.freeze({
   cookieReadOnly:true,canEditDraft:false,
   getCsrfToken:async()=>{
    if(globalRef.SarberkiCaseStoreSession!==session||!visible)throw Error('AUTH_REQUIRED');
    if(Date.now()>=exp){clear();status.textContent='A tesztkezelői munkamenet lejárt. Új ellenőrzés szükséges.';throw Error('AUTH_REQUIRED');}
    return csrfToken;
   },request:(url,options)=>serialRequest(()=>{
    if(!visible||globalRef.SarberkiCaseStoreSession!==session)throw Error('AUTH_REQUIRED');
    return request(url,options);
   })
  });
  globalRef.SarberkiCaseStoreSession=session;
  active=true;logout.disabled=false;listCases.disabled=false;resetCases();emit();
  status.textContent='Hitelesített tesztkezelői olvasás aktív. Szintetikus ügyek ellenőrizhetők; szerkesztés, jóváhagyás és küldés nem engedélyezett.';
 };
 const waiting=on=>{busy=on;login.disabled=on;restore.disabled=on;logout.disabled=on||!active;listCases.disabled=on||!active;openCase.disabled=on||listed.length===0;if(createFixture)createFixture.disabled=on||!active;if(mailLoad)mailLoad.disabled=on||!active;if(mailSave)mailSave.disabled=on||!active||!loadedMail;if(mailLanguage)mailLanguage.disabled=on;refreshReceipt();if(tubFollowup)tubFollowup.disabled=on||!active||!savedClosedMail;if(tubReview)tubReview.disabled=on||!active||!savedClosedMail;if(!on&&resumePending&&visible){resumePending=false;void Promise.resolve().then(()=>perform('restore'));}};
 async function call(method,body,csrf,path=endpoint){
  const turn=authEpoch;
  const response=await serialRequest(()=>{
   if(!visible||turn!==authEpoch)throw Error('AUTH_REQUIRED');
   return request(path,{
   method,cache:'no-store',credentials:'same-origin',redirect:'error',
   headers:{'X-Sarberki-Operator':'1',...(body?{'Content-Type':'application/json'}:{}),
    ...(csrf?{'X-CSRF-Token':csrf}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
   });
  });
  const data=await response.json();
  if(!response.ok)throw Error(['AUTH_REQUIRED','FORBIDDEN','SESSION_SETUP_REQUIRED','SESSION_SERVICE_UNAVAILABLE','CASE_STORE_DISABLED','SYNTHETIC_FIXTURE_UNVERIFIED','CASE_CONFLICT','INVALID_INPUT','SERVICE_UNAVAILABLE'].includes(data?.error)?data.error:'SESSION_UNAVAILABLE');
  return data;
 }
 async function loadClosedMail(){
  if(!active||busy||!mailStatus)return;
  clearMail();const turn=mailEpoch,session=globalRef.SarberkiCaseStoreSession;waiting(true);
  try{
   if(typeof globalRef.sarberkiGmailTransform!=='function'||typeof globalRef.displayGmailRecord!=='function')throw Error('SERVICE_UNAVAILABLE');
   const parsed=globalRef.sarberkiGmailTransform(syntheticMailMime(mailLanguage.value));
   const input=closedMailRequestFromGmailRecord(parsed);
   if(await globalRef.displayGmailRecord(parsed)===false)throw Error('SERVICE_UNAVAILABLE');
   if(globalRef.SarberkiCaseStoreSession!==session||mailEpoch!==turn)return;
   loadedMail=input;
   mailStatus.textContent='A kitalált Gmail MIME minta betöltve a meglévő helyi elemzőbe. Felhős mentés még nincs; a következő gombhoz Writer jogosultság szükséges.';
  }catch(error){if(mailEpoch===turn)mailStatus.textContent=formatCloudApprovalFailure(error,'case-id');}
  finally{waiting(false);}
 }
 async function saveClosedMail(){
  if(!active||busy||!loadedMail||!mailStatus)return;
  const session=globalRef.SarberkiCaseStoreSession,turn=mailEpoch,input=structuredClone(loadedMail);waiting(true);
  try{
   const csrf=await session?.getCsrfToken?.();
   if(globalRef.SarberkiCaseStoreSession!==session||mailEpoch!==turn||!active)throw Error('SESSION_CHANGED');
   if(!tokenPattern.test(csrf||''))throw Error('AUTH_REQUIRED');
   if(!globalRef.SarberkiClosedSyntheticMailPreview(input.envelope.text))throw Error('FORBIDDEN');
   const body=await call('POST',input,csrf,'/.netlify/functions/booking-cases');
   if(globalRef.SarberkiCaseStoreSession!==session||mailEpoch!==turn)return;
   const r=body?.result,record=r?.record;
   if(!['new','duplicate'].includes(r?.resolution?.status)||record?.tenantId!=='sarberki-test'||
    !isIsolatedReviewCaseId(record.caseId)||!Number.isSafeInteger(record.revision)||record.revision<1)throw Error('INVALID_INPUT');
   savedClosedMail=isClosedTubPreviousRecord(record)?{caseId:record.caseId,revision:record.revision,session}:null;
   const id=get('server_preview_case_id'),revision=get('server_preview_revision');
   if(id&&revision){id.value=record.caseId;id.dispatchEvent(new Event('input'));revision.value=String(record.revision);revision.dispatchEvent(new Event('input'));}
   mailStatus.textContent=(r.resolution.status==='duplicate'?'Meglévő':'Mentett')+' szintetikus felhős ügy: '+record.caseId+' · v'+record.revision+'. A Reader-előnézet kiválasztva; nincs küldés, foglalás vagy jóváhagyás.';
   if(mailApproval){mailApproval.href='/cloud-approval.html?caseId='+encodeURIComponent(record.caseId);mailApproval.hidden=false;}
  }catch(error){if(globalRef.SarberkiCaseStoreSession===session&&mailEpoch===turn)mailStatus.textContent=formatCloudApprovalFailure(error,'review-draft');}
  finally{waiting(false);}
 }
 async function saveTubFollowup(){
  const base=savedClosedMail,session=globalRef.SarberkiCaseStoreSession,turn=mailEpoch;
  const selected=()=>get('server_preview_case_id')?.value===base?.caseId&&Number(get('server_preview_revision')?.value)===base?.revision;
  if(!active||busy||!base||base.session!==session||!selected())return;
  waiting(true);
  try{
   if(typeof globalRef.sarberkiGmailTransform!=='function')throw Error('SERVICE_UNAVAILABLE');
   const parsed=globalRef.sarberkiGmailTransform(syntheticTubFollowupMime()),expected=syntheticTubFollowupEnvelope();
   const envelope={...expected,text:parsed.original_message,sender:parsed.source?.from_email,message_id:parsed.source?.message_id,thread_id:parsed.source?.thread_id,received_at:parsed.source?.received_at};
   if(!isClosedTubFollowup(envelope))throw Error('FORBIDDEN');
   const csrf=await session.getCsrfToken();
   if(globalRef.SarberkiCaseStoreSession!==session||mailEpoch!==turn||savedClosedMail!==base||!selected()||!tokenPattern.test(csrf||''))throw Error('AUTH_REQUIRED');
   const body=await call('POST',{tenantId:'sarberki-test',action:'ingest-and-draft',caseId:base.caseId,expectedRevision:base.revision,envelope},csrf,'/.netlify/functions/booking-cases');
   if(globalRef.SarberkiCaseStoreSession!==session||mailEpoch!==turn||!selected())return;
   const result=body?.result,record=result?.record;
   if(!['linked','duplicate'].includes(result?.resolution?.status)||record?.caseId!==base.caseId||![base.revision,base.revision+1].includes(record.revision)||!isClosedTubPreviousRecord(record)||record.data.messages.length!==2)throw Error('INVALID_INPUT');
   savedClosedMail={caseId:record.caseId,revision:record.revision,session};
   const id=get('server_preview_case_id'),revision=get('server_preview_revision');
   if(id&&revision){id.value=record.caseId;id.dispatchEvent(new Event('input'));revision.value=String(record.revision);revision.dispatchEvent(new Event('input'));}
   if(mailApproval){mailApproval.hidden=true;mailApproval.removeAttribute?.('href');}
   mailStatus.textContent='A rögzített kitalált Gmail-dézsaüzenet '+(result.resolution.status==='duplicate'?'már mentve volt':'a meglévő ügyhöz mentve')+': '+record.caseId+' · v'+record.revision+'. A Reader-előnézet kiválasztva. Nincs dézsa-visszaigazolás vagy jóváhagyás.';
  }catch(error){if(globalRef.SarberkiCaseStoreSession===session&&mailEpoch===turn)mailStatus.textContent=formatCloudApprovalFailure(error,'review-draft');}
  finally{waiting(false);}
 }
 async function saveTubReview(){
  const base=savedClosedMail,session=globalRef.SarberkiCaseStoreSession,turn=mailEpoch;
  const selected=()=>get('server_preview_case_id')?.value===base?.caseId&&Number(get('server_preview_revision')?.value)===base?.revision;
  if(!active||busy||!base||base.session!==session||!selected())return;
  waiting(true);
  try{
   if(typeof globalRef.sarberkiGmailTransform!=='function')throw Error('SERVICE_UNAVAILABLE');
   const parsed=globalRef.sarberkiGmailTransform(syntheticTubReviewMime()),expected=syntheticTubReviewEnvelope();
   const envelope={...expected,text:parsed.original_message,sender:parsed.source?.from_email,message_id:parsed.source?.message_id,thread_id:parsed.source?.thread_id,received_at:parsed.source?.received_at};
   if(!isClosedTubReview(envelope))throw Error('FORBIDDEN');
   const csrf=await session.getCsrfToken();
   if(globalRef.SarberkiCaseStoreSession!==session||mailEpoch!==turn||savedClosedMail!==base||!selected()||!tokenPattern.test(csrf||''))throw Error('AUTH_REQUIRED');
   const body=await call('POST',{tenantId:'sarberki-test',action:'ingest-and-draft',caseId:base.caseId,expectedRevision:base.revision,envelope},csrf,'/.netlify/functions/booking-cases');
   if(globalRef.SarberkiCaseStoreSession!==session||mailEpoch!==turn||savedClosedMail!==base||!selected())return;
   const r=body?.result,record=r?.record;
   if(!['ambiguous','duplicate'].includes(r?.resolution?.status)||!isClosedTubReviewRecord(record)||record.caseId===base.caseId||r.fixtureTarget?.caseId!==base.caseId||r.fixtureTarget.revision!==base.revision)throw Error('INVALID_INPUT');
   savedClosedMail=null;
   for(const [id,value]of Object.entries({server_preview_case_id:record.caseId,server_preview_revision:record.revision,service_link_target:base.caseId,service_link_target_revision:base.revision})){
    const node=get(id);if(node){node.value=String(value);node.dispatchEvent(new Event('input'));}
   }
   if(mailApproval){mailApproval.hidden=true;mailApproval.removeAttribute?.('href');}
   mailStatus.textContent='Külön szintetikus ügykapcsolási felülvizsgálat: '+record.caseId+' · v'+record.revision+'. Célfoglalás változatlan: '+base.caseId+' · v'+base.revision+'. A Reader-előnézet után külön jóváhagyói jog és indoklás szükséges a rendezéshez. Nincs szolgáltatás-visszaigazolás.';
  }catch(error){if(globalRef.SarberkiCaseStoreSession===session&&mailEpoch===turn)mailStatus.textContent=formatCloudApprovalFailure(error,'review-draft');}
  finally{waiting(false);}
 }
 async function saveExactReceipt(){
  if(!active||busy||!receiptStatus)return;
  let input;try{input=receiptInput();}catch{refreshReceipt();return;}
  const session=globalRef.SarberkiCaseStoreSession,turn=receiptEpoch,snapshot=JSON.stringify(input);waiting(true);
  try{
   const csrf=await session?.getCsrfToken?.();
   if(!active||globalRef.SarberkiCaseStoreSession!==session||receiptEpoch!==turn)throw Error('AUTH_REQUIRED');
   if(!tokenPattern.test(csrf||'')||JSON.stringify(receiptInput())!==snapshot)throw Error('INVALID_INPUT');
   const body=await call('POST',input,csrf,'/.netlify/functions/booking-cases');
   if(!active||globalRef.SarberkiCaseStoreSession!==session||receiptEpoch!==turn||JSON.stringify(receiptInput())!==snapshot)return;
   const r=body?.result,record=r?.record;
   if(!['new','duplicate'].includes(r?.resolution?.status)||record?.tenantId!=='sarberki-test'||!isIsolatedReviewCaseId(record.caseId)||!Number.isSafeInteger(record.revision)||record.revision<1)throw Error('INVALID_INPUT');
   const id=get('server_preview_case_id'),revision=get('server_preview_revision');
   if(id&&revision){id.value=record.caseId;id.dispatchEvent(new Event('input'));revision.value=String(record.revision);revision.dispatchEvent(new Event('input'));}
   if(mailApproval){mailApproval.hidden=true;mailApproval.removeAttribute?.('href');}
   receiptStatus.textContent=(r.resolution.status==='duplicate'?'Meglévő':'Mentett')+' privátan engedélyezett szintetikus tesztügy: '+record.caseId+' · v'+record.revision+'. Reader-előnézet kiválasztva. Kapacitás és ár nem igazolt; nincs jóváhagyás, küldés vagy foglalás.';
  }catch(error){if(globalRef.SarberkiCaseStoreSession===session&&receiptEpoch===turn)receiptStatus.textContent=formatCloudApprovalFailure(error,'review-draft');}
  finally{waiting(false);}
 }
 async function createReaderFixture(){
  if(!active||busy)return;
  const session=globalRef.SarberkiCaseStoreSession;waiting(true);
  fixtureStatus.textContent='Writer-jogosultság és szintetikus minta ellenőrzése…';
  try{
   const csrf=await session?.getCsrfToken?.();
   if(!tokenPattern.test(csrf||''))throw Error('AUTH_REQUIRED');
   const body=await call('POST',{action:'create-reader-fixture'},csrf,'/.netlify/functions/writer-reader-fixture');
   if(globalRef.SarberkiCaseStoreSession!==session)return;
   const r=body?.result;
   if(!r||Object.keys(r).sort().join(',')!=='caseId,duplicate,readyForReaderPreview,revision,tenantId'||r.tenantId!=='sarberki-test'||
    !isIsolatedReviewCaseId(r.caseId)||!Number.isSafeInteger(r.revision)||r.revision<1||r.readyForReaderPreview!==true||typeof r.duplicate!=='boolean')throw Error('INVALID_FIXTURE');
   fixtureStatus.textContent=(r.duplicate?'Meglévő':'Létrehozott')+' szintetikus ügy: '+r.caseId+' · v'+r.revision+'. Mentett, ellenőrzésre váró tervezet; nincs küldés vagy foglalás.';
   get('server_preview_case_id').value=r.caseId;get('server_preview_case_id').dispatchEvent(new Event('input'));
   get('server_preview_revision').value=String(r.revision);get('server_preview_revision').dispatchEvent(new Event('input'));
  }catch(e){
   if(globalRef.SarberkiCaseStoreSession===session)fixtureStatus.textContent=({FORBIDDEN:'Writer-jogosultság szükséges vagy a szerver elutasította a kérést. Reader hozzáférése változatlan, csak olvasás.',AUTH_REQUIRED:'Writer-munkamenet nem igazolt. Ellenőrizd a tesztbelépést.',SESSION_SETUP_REQUIRED:'A tesztkörnyezet kezelői munkamenete nincs megfelelően beállítva.',SESSION_SERVICE_UNAVAILABLE:'A hitelesítési szolgáltatás nem elérhető.',SERVICE_UNAVAILABLE:'A Writer-mentési szolgáltatás nem elérhető.',SYNTHETIC_FIXTURE_UNVERIFIED:'A szerver válaszolt, de a szintetikus tesztügy függőben lévő tervezete NEM IGAZOLT. Korábbi jóváhagyott ügy nem írható felül.',SESSION_UNAVAILABLE:'A Writer-végpont válasza nem ellenőrizhető.',INVALID_INPUT:'A Writer-tesztkérés nem megfelelő.',CASE_CONFLICT:'A tesztügy időközben megváltozott.'})[e.message]||'A szintetikus ügy létrehozása NEM IGAZOLT. Ismeretlen szerverhiba; titkot ne másolj a chatbe.';
  }finally{waiting(false);}
 }
 const problem=e=>{
  const code=String(e?.message||'');
  if(code==='SESSION_SETUP_REQUIRED')return 'A tesztkörnyezet biztonságos kezelői beállítása még nincs aktiválva.';
  if(code==='AUTH_REQUIRED'||code==='FORBIDDEN')return 'A bejelentkezés vagy jogosultság ellenőrzése nem sikerült.';
  return 'A kezelői munkamenet nem igazolható. Próbáld újra később.';
 };
 async function perform(kind){
  if(busy||!visible)return;
  const turn=++authEpoch;authRequestEpoch=turn;
  waiting(true);
  if(kind==='restore'){
   clear();
   status.textContent='Korábbi tesztkezelői munkamenet ellenőrzése…';
  }
  try{
   if(kind==='login'){
    const value=email.value.trim(),secret=password.value;
    password.value='';
    if(!value||value.length>254||!secret||secret.length>1024)throw Error('INVALID_INPUT');
    const result=await call('POST',{action:'login',email:value,password:secret});
    if(turn!==authEpoch||!visible)return;
    enable(result);
   }else if(kind==='restore'){
    const result=await call('GET');
    if(turn!==authEpoch||!visible)return;
    enable(result);
   }else{
    const csrf=await globalRef.SarberkiCaseStoreSession?.getCsrfToken?.();
    if(turn!==authEpoch||!visible)return;
    if(!active||!tokenPattern.test(csrf||''))throw Error('AUTH_REQUIRED');
    await call('POST',{action:'logout'},csrf);
    if(turn!==authEpoch||!visible)return;
    clear();
    status.textContent='A tesztkezelői munkamenet kijelentkeztetve. Nincs küldés vagy foglalás.';
   }
  }catch(e){
   if(turn!==authEpoch||!visible)return;
   clear();
   status.textContent=kind==='logout'?'A helyi hozzáférés lezárva; a szerveroldali kijelentkezés nem igazolt.':problem(e);
  }finally{password.value='';waiting(false);}
 }
 async function loadCases(){
  if(!active||busy)return;
  const session=globalRef.SarberkiCaseStoreSession;
  if(session?.cookieReadOnly!==true||typeof session.getCsrfToken!=='function')return;
  waiting(true);resetCases();caseStatus.textContent='Hitelesített szintetikus ügylista betöltése…';
  try{
   const client=createCaseStoreClient({cookieReadOnly:true,getCsrfToken:()=>session.getCsrfToken(),request:session.request});
   const rows=await client.list('sarberki-test');
   if(globalRef.SarberkiCaseStoreSession!==session)return;
   if(!Array.isArray(rows))throw Error('INVALID_CASE_LIST');
   listed=rows.filter(row=>row&&Object.keys(row).sort().join(',')==='caseId,revision,tenantId'&&
    row.tenantId==='sarberki-test'&&isIsolatedReviewCaseId(row.caseId)&&
    Number.isSafeInteger(row.revision)&&row.revision>=1)
    .map(row=>({id:row.caseId,revision:row.revision})).slice(0,100);
   const placeholder=documentRef.createElement('option');placeholder.value='';placeholder.textContent='Válassz szintetikus tesztügyet';
   caseSelect.appendChild(placeholder);
   for(const row of listed){
    const option=documentRef.createElement('option');option.value=row.id;
    option.textContent=row.id+' · v'+row.revision;caseSelect.appendChild(option);
   }
   caseSelect.disabled=listed.length===0;
   openCase.disabled=listed.length===0;
   caseStatus.textContent=listed.length?'Összesen '+listed.length+' ellenőrzött tesztügy betöltve.':'Nincs megfelelő szintetikus tesztügy az elérhető listában.';
  }catch(e){
   resetCases();
   caseStatus.textContent='A tesztügylista nem tölthető be ('+(['AUTH_REQUIRED','FORBIDDEN','CASE_STORE_DISABLED','SERVICE_UNAVAILABLE'].includes(e?.message)?e.message:'ellenőrzés szükséges')+').';
  }finally{waiting(false);}
 }
 function openSelectedCase(){
  if(!active||busy||!listed.length)return;
  const selected=listed.find(x=>x.id===caseSelect.value);
  if(!selected){caseStatus.textContent='Válassz érvényes tesztügyet.';return;}
  const id=get('server_preview_case_id'),revision=get('server_preview_revision');
  if(!id||!revision){caseStatus.textContent='A szerveres előnézet nem áll rendelkezésre.';return;}
  id.value=selected.id;id.dispatchEvent(new Event('input'));
  revision.value=String(selected.revision);revision.dispatchEvent(new Event('input'));
  caseStatus.textContent='A szintetikus ügy kiválasztva. A szerveres előnézet gombbal olvasható.';
 }
 form.addEventListener('submit',event=>{event.preventDefault();return perform('login');});
 restore.addEventListener('click',()=>perform('restore'));
 logout.addEventListener('click',()=>perform('logout'));
 listCases.addEventListener('click',loadCases);
 openCase.addEventListener('click',openSelectedCase);
 createFixture?.addEventListener('click',createReaderFixture);
 mailLoad?.addEventListener('click',loadClosedMail);
 mailSave?.addEventListener('click',saveClosedMail);
 tubFollowup?.addEventListener('click',saveTubFollowup);
 tubReview?.addEventListener('click',saveTubReview);
 receiptSave?.addEventListener('click',saveExactReceipt);
 get('gmail_json')?.addEventListener('input',invalidateReceipt);
 get('message')?.addEventListener('input',invalidateReceipt);
 for(const id of ['message','gmail_json'])get(id)?.addEventListener('input',()=>{savedClosedMail=null;if(tubFollowup)tubFollowup.disabled=true;if(tubReview)tubReview.disabled=true;});
 mailLanguage?.addEventListener('change',clearMail);
 documentRef.addEventListener?.('sarberki:gmail-normalized',event=>{
  receiptEventId=event.detail?.message_id||'';invalidateReceipt();
  if(busy){
   if(loadedMail&&event.detail?.message_id!==loadedMail.envelope.message_id)clearMail();
   return;
  }
  clearMail();
  if(!active||!globalRef.SarberkiCaseStoreSession)return;
  try{
   const parsed=JSON.parse(get('gmail_json')?.value||'null');
   const input=closedMailRequestFromGmailRecord(parsed);
   if(event.detail?.message_id!==input.envelope.message_id||!globalRef.SarberkiClosedSyntheticMailPreview(input.envelope.text))return;
   loadedMail=input;waiting(false);
   if(mailStatus)mailStatus.textContent='A pontos zárt Gmail minta előkészítve. Felhős mentés még nincs; a mentés külön Writer-művelet.';
  }catch{ /* Normal or changed Gmail records stay excluded from cloud writes. */ }
 });
 documentRef.addEventListener?.('sarberki:session-changed',()=>{clearMail();invalidateReceipt();});
 const suspend=()=>{visible=false;authEpoch++;password.value='';clear();status.textContent='A nézet lezárva. Visszatéréskor új munkamenet-ellenőrzés szükséges.';};
 const resume=()=>{
  if(documentRef.visibilityState==='hidden')return;
  visible=true;
  if(busy){if(authRequestEpoch!==authEpoch)resumePending=true;return;}
  resumePending=false;
  return perform('restore');
 };
 globalRef.addEventListener?.('pagehide',suspend);
 // A normal load restores once below. Only a bfcache return needs pageshow
 // revalidation; the existing busy gate prevents concurrent cookie rotation.
 globalRef.addEventListener?.('pageshow',event=>{
  if(event.persisted)return resume();
 });
 documentRef.addEventListener?.('visibilitychange',()=>documentRef.visibilityState==='hidden'?suspend():resume());
 clear();
 void perform('restore');
 return true;
}
if(typeof document!=='undefined'&&typeof window!=='undefined')initOperatorLoginPanel();
