import {createServerChatClient} from './remote-chat-client.mjs';
import {createCaseStoreClient} from '../shared-core/case-store-client.mjs';
import {createCookieJsonRequest} from '../shared-core/cookie-json-request.mjs';
import {isIsolatedReviewCaseId} from '../shared-core/isolated-review-case-id.mjs';
import {assertCurrentEvidence} from '../shared-core/availability-model.mjs';
import {renderCentralConversation} from '../shared-core/inquiry-channel-adapters.mjs';
const tenant='sarberki-test',endpoint='/.netlify/functions/operator-session';
export function createOperatorSession({request=fetch,now=()=>Date.now()}={}){
 request=createCookieJsonRequest({request});
 let metadata=null,revocationCsrf=null,epoch=0,queue=Promise.resolve(),restorePending=null;
 const enqueue=job=>{const next=queue.then(job,job);queue=next.catch(()=>{});return next;};
 const invalidate=()=>{epoch++;metadata=null;};
 const current=()=>{if(!metadata||now()>=Date.parse(metadata.expiresAt)){invalidate();throw Error('AUTH_REQUIRED');}return metadata;};
 const parse=async response=>{
  if(!response.ok){const error=Error(response.status===401?'AUTH_REQUIRED':response.status===403?'FORBIDDEN':response.status===503?'SESSION_SETUP_REQUIRED':'SERVICE_UNAVAILABLE');error.status=response.status;throw error;}
  const body=await response.json();
  if(body?.authenticated!==true||body.tenantId!==tenant||!/^[a-f0-9]{64}$/.test(body.csrfToken)||!Number.isFinite(Date.parse(body.expiresAt))||Date.parse(body.expiresAt)<=now()||Date.parse(body.expiresAt)>now()+7*86400000+60000||'access_token' in body||'refresh_token' in body)throw Error('INVALID_SESSION');
  revocationCsrf=body.csrfToken;return {authenticated:true,tenantId:tenant,expiresAt:body.expiresAt,csrfToken:body.csrfToken,...(/^[a-f0-9]{64}$/.test(body.stateKey||'')?{stateKey:body.stateKey}:{})};
 };
 const options=(method,body,csrf)=>({method,cache:'no-store',credentials:'same-origin',redirect:'error',headers:{'X-Sarberki-Operator':'1',...(body?{'Content-Type':'application/json'}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const restore=()=>{
  if(restorePending)return restorePending;const turn=epoch;
  const pending=enqueue(async()=>{try{const value=await parse(await request(endpoint,options('GET')));if(turn!==epoch)throw Error('SESSION_CHANGED');metadata=value;return {...value};}catch(error){if(turn===epoch)metadata=null;throw error;}});
  restorePending=pending;pending.finally(()=>{if(restorePending===pending)restorePending=null;}).catch(()=>{});return pending;
 };
 const logout=()=>{invalidate();return enqueue(async()=>{const response=await request(endpoint,options('POST',{action:'logout'},revocationCsrf));if(!response.ok)throw Error('LOGOUT_NOT_VERIFIED');revocationCsrf=null;return {authenticated:false};});};
 return Object.freeze({logout,restore,clear:invalidate, getCsrfToken:async()=>current().csrfToken,
  async login(email,password){
   invalidate();const turn=epoch;
   if(typeof email!=='string'||!email.includes('@')||email.length>254||typeof password!=='string'||!password||password.length>1024)throw Error('INVALID_INPUT');
   return enqueue(async()=>{const value=await parse(await request(endpoint,options('POST',{action:'login',email,password})));if(turn!==epoch)throw Error('SESSION_CHANGED');const confirmed=await parse(await request(endpoint,options('GET')));if(turn!==epoch||confirmed.csrfToken!==value.csrfToken||confirmed.expiresAt!==value.expiresAt)throw Error('SESSION_CHANGED');metadata=confirmed;return {...confirmed};});
  },
  syntheticChat(step){
   const turn=epoch;if(![1,2].includes(step))return Promise.reject(Error('INVALID_INPUT'));
   return enqueue(async()=>{
    const csrf=current().csrfToken;if(turn!==epoch)throw Error('SESSION_CHANGED');
    const response=await request('/.netlify/functions/decision-parity-fixture',options('POST',{language:'hu',scenario:'chat-step',step},csrf));
    if(!response.ok)throw Error(response.status===401?'AUTH_REQUIRED':response.status===403?'FORBIDDEN':'FIXTURE_UNAVAILABLE');
    const body=await response.json();if(turn!==epoch)throw Error('SESSION_CHANGED');current();
    if(body?.fixture!=='fixed-synthetic-chat'||body.step!==step||body.language!=='hu'||typeof body.text!=='string'||!body.text||body.text.length>12000||Object.keys(body).sort().join(',')!=='fixture,language,step,text')throw Error('INVALID_DATA');
    return body.text;
   });
  },
  loadCase(caseId){
   const turn=epoch;if(!isIsolatedReviewCaseId(caseId))return Promise.reject(Error('INVALID_INPUT'));
   return enqueue(async()=>{
   current();const assertSession=()=>{if(turn!==epoch)throw Error('SESSION_CHANGED');return current().csrfToken;};
   const client=createCaseStoreClient({cookieReadOnly:true,getCsrfToken:assertSession,request:async(url,options)=>{const response=await request(url,options);if(response.status===401){if(turn===epoch)invalidate();throw Error('AUTH_REQUIRED');}if(response.status===403)throw Error('FORBIDDEN');return response;}});
   // The Reader API exposes only synthetic summaries and a protected preview.
   // Do not request raw case data through the intentionally forbidden GET path.
   const summaries=await client.list(tenant);if(turn!==epoch)throw Error('SESSION_CHANGED');
   const record=Array.isArray(summaries)?summaries.find(row=>row?.tenantId===tenant&&row.caseId===caseId):null;
   if(!record||Object.keys(record).sort().join(',')!=='caseId,revision,tenantId'||!Number.isSafeInteger(record.revision)||record.revision<1)throw Error('INVALID_DATA');
   const preview=await client.previewDraft(tenant,caseId,record.revision);assertSession();if(turn!==epoch)throw Error('SESSION_CHANGED');
   if(preview?.caseId!==caseId||preview.revision!==record.revision||preview.persisted!==false||preview.approval!=='pending'||typeof preview.text!=='string')throw Error('INVALID_DATA');
   const d=preview.decision;
   if(!d?.facts||!Array.isArray(d.missing)||!Array.isArray(d.contradictions)||!d.capacity||!d.pricing||d.safety?.emailSent!==false||d.safety.bookingCreated!==false||d.safety.approval!=='pending')throw Error('INVALID_DATA');
   const f=preview.readOnlyFreshness,age=now()-Date.parse(f?.checkedAt||'');
   const fresh=f?.verified===true&&f.syntheticOnly===true&&f.source==='stored-synthetic-case'&&f.tenantId===tenant&&f.caseId===caseId&&f.revision===record.revision&&Number.isFinite(age)&&age>=0&&age<=120000;
   let capacityFresh=false,evidence=[];
   if(fresh&&d.capacity.verified===true&&d.capacity.status==='AVAILABLE'&&Array.isArray(d.capacity.selectedOptions)&&d.capacity.selectedOptions.length){
    try{
     const input=d.capacity.input;
     if(input?.arrival!==d.facts.dates?.arrival||input.departure!==d.facts.dates?.departure||input.guests!==d.facts.guests)throw Error('SCOPE');
     evidence=d.capacity.selectedOptions.map(row=>{
      const e=assertCurrentEvidence(row.evidence,tenant,{arrival:input.arrival,departure:input.departure,cabin:row.key},now());
      if(e.source!=='synthetic-fixture'||e.status!=='AVAILABLE'||!Number.isSafeInteger(row.units)||row.units<1||!Number.isSafeInteger(e.availableUnits)||e.availableUnits<row.units)throw Error('CAPACITY');
      return e;
     });capacityFresh=true;
    }catch{evidence=[];}
   }
   const priceEvidence=d.pricing.evidence,priceAge=now()-Date.parse(priceEvidence?.checkedAt||'');
   const pricingFresh=capacityFresh&&d.pricing.verified===true&&priceEvidence?.source==='synthetic-fixture'&&
    priceEvidence.tenantId===tenant&&priceEvidence.arrival===d.capacity.input.arrival&&priceEvidence.departure===d.capacity.input.departure&&
    priceEvidence.guests===d.facts.guests&&Number.isFinite(priceAge)&&priceAge>=0&&priceAge<=120000&&
    d.capacity.selectedOptions.some(row=>row.key===priceEvidence.unitId&&row.units===priceEvidence.units);
   const safe={...d,pricing:{...d.pricing,verified:pricingFresh},capacity:{...d.capacity,verified:capacityFresh,status:capacityFresh?'AVAILABLE':'UNKNOWN'}};
   return {caseId,revision:record.revision,fresh,text:renderCentralConversation(safe),operatorReviewText:capacityFresh&&pricingFresh&&typeof preview.operatorReviewText==='string'?preview.operatorReviewText:renderCentralConversation(safe,{language:'hu'}),draft:capacityFresh&&pricingFresh?preview.text:'',
    status:fresh?'Friss ügyolvasás: Supabase tesztügytár · szintetikus. Ellenőrzés: '+f.checkedAt:'Ügyadatfrissesség NEM IGAZOLT; nincs jóváhagyás.',
    capacity:capacityFresh?'Kapacitásforrás: '+evidence.map(e=>e.source+' · '+e.checkedAt).join('; ')+' · szintetikus, nem valós foglalhatóság.':'Kapacitásforrás és kapacitásellenőrzési idő: NEM IGAZOLT.',price:pricingFresh?'Árforrás: '+priceEvidence.source+' · '+priceEvidence.checkedAt+' · szintetikus belső számítás; nem jóváhagyott vendégár.':'Árforrás és árellenőrzési idő: NEM IGAZOLT.',audit:'Audit nincs külön visszaolvasva; NEM IGAZOLT.'};
   }).catch(error=>{if(turn===epoch)metadata=null;throw error;});
  }
 });
}
export function initOperatorPanel({documentRef=document,windowRef=typeof window==='undefined'?null:window,request=fetch,now=()=>Date.now(),setTimer=typeof setTimeout==='undefined'?null:setTimeout,clearTimer=typeof clearTimeout==='undefined'?null:clearTimeout}={}){
 const get=id=>documentRef.getElementById(id),form=get('operator_login');if(!form)return false;
 const session=createOperatorSession({request,now});let epoch=0,timer=null,active=documentRef.visibilityState!=='hidden';
 const serverChat=createServerChatClient({request,getCsrfToken:()=>session.getCsrfToken()});
 const clear=()=>{serverChat.reset();if(get('server_live_preview_output'))get('server_live_preview_output').textContent='';if(get('server_fixture_status'))get('server_fixture_status').textContent='';for(const id of ['server_chat_reply','server_operator_hu','server_guest_draft'])get(id).value='';get('server_data_status').textContent='Nincs hitelesített szerveres adat.';};
 const fixtureStatus=get('server_fixture_status');
 const fixtureButton=get('server_fixture_run');
 if(fixtureButton&&fixtureStatus)fixtureButton.addEventListener('click',async()=>{
  const turn=++epoch;fixtureButton.disabled=true;fixtureStatus.textContent='Szintetikus szerveres próba…';
  try{const first=await session.syntheticChat(1),second=await session.syntheticChat(2);if(turn!==epoch||!active)return;fixtureStatus.textContent='1. válasz: '+first+'\n\n2. válasz: '+second;}
  catch(error){if(turn===epoch)fixtureStatus.textContent='Szerveres próba nem elérhető; belépés és tesztengedély szükséges.';}
  finally{fixtureButton.disabled=false;}
 });
 const previewForm=get('server_live_preview_form'),previewInput=get('server_live_preview_input'),previewOutput=get('server_live_preview_output');
 previewForm?.addEventListener('submit',async event=>{
  event.preventDefault();if(!active||!previewInput||!previewOutput)return;
  const turn=epoch,message=previewInput.value.trim();if(!message)return;
  previewOutput.textContent='Szerveres tesztválasz készül…';
  try{const answer=await serverChat.reply(message);if(turn!==epoch||!active)return;previewOutput.textContent=answer.text;previewInput.value='';}
  catch(error){if(turn===epoch&&active){
   if(['AUTH_REQUIRED','FORBIDDEN'].includes(error.message)){session.clear();clear();failed(error);}
   else previewOutput.textContent=error.message==='RATE_LIMITED'?'Túl sok kérés. Várjon egy percet, majd próbálja újra.':error.message==='INVALID_CHAT_INPUT'?'A beszélgetés elérte a méretkorlátot. Indítson új beszélgetést.':'A szerveres próba nem elérhető; belépés és tesztengedély szükséges.';
  }}
 });
 get('server_live_preview_reset')?.addEventListener('click',()=>{serverChat.reset();if(previewInput)previewInput.value='';if(previewOutput)previewOutput.textContent='';});
 const stop=()=>{if(timer!==null)clearTimer?.(timer);timer=null;};
 const schedule=()=>{stop();if(active&&setTimer){timer=setTimer(()=>restore(),300000);timer?.unref?.();}};
 const status=()=>{get('operator_status').textContent='Hitelesített tartós tesztmunkamenet; az ügyhozzáférést a szerver ellenőrzi.';};
 const failed=error=>{clear();get('operator_status').textContent=error.message==='FORBIDDEN'?'A szerver megtagadta a hozzáférést; jogosultság vagy kérésvédelem ellenőrzése szükséges.':error.message==='AUTH_REQUIRED'?'Új bejelentkezés szükséges: a munkamenet lejárt vagy nem érvényes.':'A munkamenet jelenleg nem ellenőrizhető. Újrapróbálható; a szerveres sütit nem töröltük.';};
 const restore=async()=>{if(!active)return;const turn=epoch;let retry=true;clear();try{await session.restore();if(turn===epoch&&active)status();}catch(error){if(error.message==='AUTH_REQUIRED')retry=false;if(turn===epoch&&active)failed(error);}finally{if(turn===epoch&&retry)schedule();}};
 const reset=async()=>{epoch++;stop();clear();get('operator_password').value='';get('operator_status').textContent='Kijelentkezés ellenőrzése…';try{await session.logout();get('operator_status').textContent='Kijelentkezve.';}catch{get('operator_status').textContent='A helyi nézet törölve; a szerveres kijelentkezés NEM IGAZOLT. Próbálja újra.';}};
 form.addEventListener('submit',async event=>{event.preventDefault();const turn=++epoch;stop();clear();const password=get('operator_password').value;get('operator_password').value='';get('operator_status').textContent='Belépés ellenőrzése…';try{await session.login(get('operator_email').value.trim(),password);if(turn===epoch){status();schedule();}}catch(error){if(turn===epoch)failed(error);}});
 get('operator_logout').addEventListener('click',reset);
 get('server_case_id').addEventListener('input',()=>{epoch++;clear();schedule();});
 get('server_case_load').addEventListener('click',async()=>{const turn=++epoch;clear();get('server_data_status').textContent='Szintetikus ügy ellenőrzése…';try{const result=await session.loadCase(get('server_case_id').value.trim());if(turn!==epoch||!active)return;get('server_chat_reply').value=result.text;get('server_operator_hu').value=result.operatorReviewText;get('server_guest_draft').value=result.draft;get('server_data_status').textContent=[result.status,'Ügyverzió: '+result.revision,result.capacity,result.price,result.audit,'Csak olvasás; nincs küldés, mentés vagy jóváhagyás.'].join('\n');}catch(error){if(turn===epoch){failed(error);get('server_data_status').textContent='Szerveres adat nem igazolt: jogosultság, munkamenet vagy ügyverzió ellenőrzése szükséges.';}}});
 windowRef?.addEventListener('pagehide',()=>{active=false;epoch++;stop();clear();get('operator_password').value='';});
 windowRef?.addEventListener('pageshow',()=>{active=true;restore();});
 documentRef.addEventListener?.('visibilitychange',()=>{if(documentRef.visibilityState==='hidden'){active=false;epoch++;stop();clear();}else{active=true;restore();}});
 for(const event of ['isolated-approval-session-changed','sarberki:session-changed'])documentRef.addEventListener?.(event,()=>{epoch++;session.clear();clear();restore();});
 clear();restore();return true;
}
if(typeof document!=='undefined')initOperatorPanel();
