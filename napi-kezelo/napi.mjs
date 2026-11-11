import {createDailyEmailReader,reviewDisplay} from './napi-email.mjs';
import {createOperatorSession} from '../sarberki-chatbot-project/operator-session.mjs';
import {isIsolatedReviewCaseId} from '../shared-core/isolated-review-case-id.mjs';
import {createCloudCaseRequest} from '../shared-core/cloud-case-request.mjs';
import {createEpochRequestQueue} from '../shared-core/epoch-request-queue.mjs';
import {createIsolatedApprovalReview} from '../shared-core/isolated-approval-review.mjs';
import {createServerChatClient} from '../sarberki-chatbot-project/remote-chat-client.mjs';
import {translationErrorMessage} from '../translation-errors.mjs';
import {CABIN_NAMES,huf,priceExplanation} from '../shared-core/price-insert-sentence.mjs';
import {unitsOfType} from '../shared-core/unit-inventory.mjs';

const TEST_ORIGIN='https://leafy-chimera-2403e5.netlify.app';
// The server session states the deployment's single tenant (live store slice 2); TEST until it says otherwise.
const KNOWN_TENANTS=['sarberki-test','sarberki-live'];
let TENANT='sarberki-test';
const sections=Object.freeze({
 incoming:['Beérkezett foglalások','Új vendégüzenetek és feldolgozásra váró megkeresések.'],
 // Owner request 2026-11-06: a booking the guest replied to waits here until our answer to that reply is sent.
 followup:['Folytatásra vár','Foglalások, amelyekre a vendég válaszolt, és még nem küldtük el a választ.'],
 approval:['Jóváhagyásra vár','Átnézendő választervezetek.'],
 progress:['Folyamatban','Pontosításra vagy ellenőrzésre váró foglalások.'],
 // No close/reject lifecycle exists on the server yet; never imply closed cases.
 closed:['Lezárt foglalások','A foglaláslezárás még nincs bekötve a szerveren, ezért ide jelenleg egyetlen foglalás sem kerülhet. Az elutasított tesztlevél-foglalás a Folyamatban részben marad.']
});
const el=id=>document.getElementById(id);
for(const button of document.querySelectorAll('[data-section]'))button.addEventListener('click',()=>{
 const value=sections[button.dataset.section];if(!value)return;
 for(const item of document.querySelectorAll('[data-section]'))item.setAttribute('aria-pressed',String(item===button));
 el('section-heading').textContent=value[0];el('section-description').textContent=value[1];
 selectedSection=button.dataset.section;renderRows();
 el('cases-title').focus({preventScroll:true});
 el('cases-panel').scrollIntoView({behavior:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
});

const session=createOperatorSession();
let authenticated=false,epoch=0;
const emailReader=createDailyEmailReader({canRead:()=>authenticated,restoreSession:async()=>rememberKey(await session.restore()),
 clientId:document.querySelector('meta[name="google-oauth-client-id"]')?.content,onChange:()=>scheduleSave(),
 // Writer saves a marked test mail as a pending case; the server re-reads it from Gmail with this one-off token.
 // Server triage of the read mails into new / continuation / uncertain / already stored (owner 2026-11-06).
 onTriage:async({token,messageIds})=>{
  const result=await request({tenantId:TENANT,action:'test-mailbox-triage',messageIds},'POST',{'X-Sarberki-Gmail-Token':token});
  if(!Array.isArray(result))throw Error('INVALID_DATA');return result;
 },
 // A guest's reply (followup) continues its existing case (owner decision 2026-11-06).
 onSaveCase:async({messageId,token,followup=false})=>{
  const result=await request({tenantId:TENANT,action:followup?'test-mailbox-followup':'test-mailbox-ingest',messageId},'POST',{'X-Sarberki-Gmail-Token':token});
  if(!isTestMailboxCaseId(result?.caseId)||!Number.isSafeInteger(result.revision))throw Error('INVALID_DATA');
  await loadCases();void openCase(result.caseId);return result;
 }});
// Encrypted local copy of the read mail list, selection and local reply preview, so an iOS relaunch does not
// force a re-read. AES-GCM with a per-login key that only an authenticated, non-idle server session returns;
// expires after 30 minutes and is deleted on lock/logout. Never a Gmail token; never plaintext.
const STATE_STORE='sarberki-napi-state',STATE_TTL_MS=30*60*1000,encoder=new TextEncoder();
let stateKey=null,saveTimer=null,saveQueue=Promise.resolve();
function rememberKey(meta){stateKey=/^[a-f0-9]{64}$/.test(meta?.stateKey||'')?meta.stateKey:null;if(KNOWN_TENANTS.includes(meta?.tenantId))TENANT=meta.tenantId;return meta;}
const toB64=bytes=>{let out='';for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(out);};
const fromB64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
const aesKey=hex=>crypto.subtle.importKey('raw',Uint8Array.from(hex.match(/../g),h=>parseInt(h,16)),'AES-GCM',false,['encrypt','decrypt']);
const aad=savedAt=>encoder.encode('sarberki-napi-state-v1|'+TENANT+'|'+savedAt);
function dropState(){clearTimeout(saveTimer);saveTimer=null;try{localStorage.removeItem(STATE_STORE);}catch{}}
async function saveState(){
 const key=stateKey,snap=authenticated&&key?emailReader.snapshot():null;
 if(!snap){try{localStorage.removeItem(STATE_STORE);}catch{}return;}
 try{
  const savedAt=Date.now(),iv=crypto.getRandomValues(new Uint8Array(12));
  const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(savedAt)},await aesKey(key),encoder.encode(JSON.stringify(snap))));
  if(!authenticated||key!==stateKey)return;
  const value=JSON.stringify({v:1,savedAt,iv:toB64(iv),data:toB64(data)});
  if(value.length>3500000)throw Error('TOO_LARGE');
  localStorage.setItem(STATE_STORE,value);
 }catch{try{localStorage.removeItem(STATE_STORE);}catch{}}
}
function queueSave(){saveQueue=saveQueue.then(saveState,saveState);return saveQueue;}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveTimer=null;void queueSave();},400);}
async function loadState(){
 let raw=null;try{raw=localStorage.getItem(STATE_STORE);}catch{}
 if(!raw)return null;
 try{
  const box=JSON.parse(raw),age=Date.now()-box?.savedAt;
  if(box?.v!==1||!Number.isSafeInteger(box.savedAt)||!(age>=-60000&&age<STATE_TTL_MS)||typeof box.iv!=='string'||typeof box.data!=='string'||!stateKey)throw Error('INVALID');
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(box.iv),additionalData:aad(box.savedAt)},await aesKey(stateKey),fromB64(box.data));
  return JSON.parse(new TextDecoder().decode(plain));
 }catch{dropState();return null;}
}
let listLoaded=false;
let selectedSection='incoming',rows=[],selected=null,editBase=null,canApprove=false,actionBusy=false,tmCase=null,approvedText=null;
const COPY_LABEL='Jóváhagyott szöveg másolása',SEND_LABEL='Válasz küldése';
let approvedCase=null;
// Price from the existing public price-list calculator (/api/price-reference, TEST site only): the
// operator picks the cabin after checking availability; the result can be inserted into the editor.
let priceCase=null,priceQuote=null,bookingCase=null;
const isTestMailboxCaseId=id=>typeof id==='string'&&/^tm-[a-f0-9]{12,32}$/.test(id);
const request=createEpochRequestQueue({getEpoch:()=>epoch,isAuthenticated:()=>authenticated,
 prepare:()=>session.restore(),execute:createCloudCaseRequest()});
const review=createIsolatedApprovalReview({enabled:true,client:{
 get:(_tenant,caseId)=>request({tenantId:TENANT,caseId,action:'review-record'},'GET'),
 approve:(_tenant,caseId,expectedRevision,reviewedDraftHash)=>request({tenantId:TENANT,caseId,action:'approve',expectedRevision,reviewedDraftHash})}});
function resetActions(){
 selected=null;editBase=null;canApprove=false;tmCase=null;review.clear();
 for(const id of ['return-draft','reject-draft','decision-reason'])el(id).disabled=true;el('decision-reason').value='';
 el('draft-editor').value='';el('draft-editor').disabled=true;el('save-draft').disabled=true;
 el('approve-draft').disabled=true;el('approve-confirm').checked=false;el('approve-confirm').disabled=true;
}
function updateCounts(){
 for(const section of Object.keys(sections))el('count-'+section).textContent=listLoaded?rows.filter(row=>row.category===section).length+' foglalás':'Nincs betöltve';
}
const ROW_STATUS=Object.freeze({approved_internal:'Jóváhagyva – küldhető',returned_for_edit:'Javításra visszaküldve',rejected:'Elutasítva'});
function renderRows(){
 updateCounts();el('cases-title').textContent=sections[selectedSection][0]+' – tárolt tesztfoglalások';
 // Approved test-mail replies (ready to send) first, so the operator does not have to search for them.
 const visible=rows.filter(row=>row.category===selectedSection).sort((a,b)=>(b.approval==='approved_internal')-(a.approval==='approved_internal')),fragment=document.createDocumentFragment();
 visible.forEach((row,index)=>{
  const li=document.createElement('li'),label=document.createElement('span'),button=document.createElement('button');
  // Mailbox cases keep the identity shown by the save receipt even when the list order changes.
  label.textContent=row.kind==='test-mailbox'?'Tesztlevél-foglalás '+row.caseId+(ROW_STATUS[row.approval]?' · '+ROW_STATUS[row.approval]:''):'Tesztfoglalás '+(rows.indexOf(row)+1);button.type='button';button.textContent='Megnyitás';
  button.setAttribute('aria-label',label.textContent+' megnyitása');
  button.addEventListener('click',()=>openCase(row.caseId));li.append(label,button);fragment.append(li);
 });
 el('case-list').replaceChildren(fragment);
 if(!authenticated)el('list-status').textContent='A foglalási listához jelentkezzen be a Belépés részben.';
 else if(!listLoaded)el('list-status').textContent='A kategória foglalási listája még nincs betöltve. Nyomja meg az Foglalások frissítése gombot.';
 else el('list-status').textContent=visible.length?'A kiválasztott kategória: '+visible.length+' tárolt tesztfoglalás.':'Ebben a kategóriában nincs elérhető tárolt tesztfoglalás.';
}

let chatEpoch=0,chatBusy=false;
const chat=createServerChatClient({language:'hu',getCsrfToken:async()=>(await session.restore()).csrfToken});
function resetChat(){
 chatEpoch++;chat.reset();el('chat-input').value='';el('chat-output').textContent='';
}
el('chat-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!authenticated||chatBusy||document.visibilityState==='hidden')return;
 const message=el('chat-input').value.trim();if(!message)return;
 const turn=chatEpoch;chatBusy=true;el('chat-send').disabled=true;
 el('chat-output').textContent='Szerveres tesztválasz készül…';
 try{
  const result=await chat.reply(message);
  if(turn!==chatEpoch||!authenticated||document.visibilityState==='hidden')return;
  el('chat-output').textContent=result.text;el('chat-input').value='';
 }catch(error){
  if(turn!==chatEpoch)return;
  if(['AUTH_REQUIRED','FORBIDDEN'].includes(error.message)){failed(error);return;}
  el('chat-output').textContent=error.message==='RATE_LIMITED'?
   'Túl sok kérés. Várjon egy percet, majd próbálja újra.':
   error.message==='INVALID_CHAT_INPUT'?'A beszélgetés elérte a méretkorlátot. Indítson új beszélgetést.':
   'A szerveres teszt most nem elérhető. Próbálja újra később.';
 }finally{chatBusy=false;el('chat-send').disabled=!authenticated;}
});
el('chat-reset').addEventListener('click',resetChat);
function clearDetail(){
 resetActions();
 el('detail-messages').replaceChildren();el('detail-facts').textContent='';
 el('case-detail').hidden=true;
 for(const id of ['detail-status','detail-summary','detail-capacity','detail-price','detail-draft'])el(id).textContent='';
 el('copy-approved').hidden=true;el('copy-approved').textContent=COPY_LABEL;approvedText=null;
 el('send-approved').hidden=true;el('send-approved').disabled=false;el('send-approved').textContent=SEND_LABEL;approvedCase=null;
 el('price-panel').hidden=true;el('price-result').textContent='';el('price-insert').disabled=true;el('price-available').checked=false;el('price-available').disabled=true;priceCase=null;priceQuote=null;
 el('unavailable-confirm').checked=false;el('unavailable-confirm').disabled=true;el('unavailable-insert').disabled=true;el('unavailable-result').textContent='';
 el('booking-panel').hidden=true;bookingCase=null;el('booking-state').textContent='';el('booking-result').textContent='';
 for(const id of ['booking-unit','previo-ref','previo-recorded','previo-auto','booking-finalize','deposit-date','deposit-confirm','deposit-mark','cancel-reason','cancel-confirm','booking-cancel'])el(id).disabled=true;
 el('booking-unit').replaceChildren();
 el('previo-ref').value='';el('previo-recorded').checked=false;el('previo-auto').checked=false;el('cancel-confirm').checked=false;el('cancel-reason').value='';el('deposit-confirm').checked=false;el('deposit-date').value='';
 el('detail-link').href='../cloud-approval.html';
}
function clearData(message='A listához jelentkezzen be.'){
 epoch++;rows=[];listLoaded=false;updateCounts();
 el('case-list').replaceChildren();clearDetail();el('list-status').textContent=message;
}
function sessionUI(isAuthenticated,message){
 authenticated=isAuthenticated;emailReader.setEnabled(isAuthenticated);el('session-status').textContent=message;
 el('login').hidden=isAuthenticated;el('logout').hidden=!isAuthenticated;
 el('load-cases').disabled=!isAuthenticated;
 el('chat-input').disabled=!isAuthenticated;el('chat-send').disabled=!isAuthenticated||chatBusy;
 el('chat-reset').disabled=!isAuthenticated;
}
function lockSession(message){
 forgetSwitch();dropState();stateKey=null;setConcealed(false);emailReader.clear();resetChat();session.clear();clearData();el('password').value='';
 sessionUI(false,message);
}
// The view may be concealed during an app switch; results still land in memory and stay hidden.
function current(turn){return turn===epoch&&authenticated;}
function failed(error){
 lockSession(error?.message==='FORBIDDEN'?'Ehhez a művelethez nincs megfelelő jogosultság.':
 error?.message==='AUTH_REQUIRED'?'A bejelentkezés szükséges vagy lejárt.':'Az adatok most nem ellenőrizhetők. Próbálja újra.');
}
async function resume(){
 if(location.origin!==TEST_ORIGIN){lockSession('A kapcsolat csak a kijelölt tesztoldalon használható.');return;}
 if(document.visibilityState==='hidden')return;
 const turn=epoch;
 try{rememberKey(await session.restore());if(turn!==epoch||document.visibilityState==='hidden')return;
  sessionUI(true,'Bejelentkezve.');
  const saved=await loadState();if(turn!==epoch)return;
  if(saved&&emailReader.restoreSnapshot(saved))reloadedAfterSwitch=false;
  else dropState();
  if(reloadedAfterSwitch){reloadedAfterSwitch=false;el('email-status').textContent='Az alkalmazásváltás közben a böngésző újratöltötte az oldalt. A leveleket és a helyi AI-javaslatot biztonsági okból nem tároljuk, ezért olvassa be újra a leveleket.';}
  await loadCases({selectAvailable:true});
 }catch(error){if(turn===epoch)failed(error);}
}
el('login').addEventListener('submit',async event=>{
 event.preventDefault();
 if(location.origin!==TEST_ORIGIN){lockSession('A kapcsolat csak a kijelölt tesztoldalon használható.');return;}
 const email=el('email').value.trim(),password=el('password').value;
 el('password').value='';emailReader.clear();resetChat();session.clear();clearData();const turn=epoch;
 sessionUI(false,'Bejelentkezés ellenőrzése…');
 try{dropState();rememberKey(await session.login(email,password));if(turn===epoch&&document.visibilityState!=='hidden'){
  sessionUI(true,'Bejelentkezve.');await loadCases({selectAvailable:true});
 }}
 catch(error){if(turn===epoch)failed(error);}
});
el('logout').addEventListener('click',async()=>{
 emailReader.clear();dropState();stateKey=null;forgetSwitch();resetChat();clearData();const turn=epoch;sessionUI(false,'Kijelentkezés ellenőrzése…');
 try{await session.logout();if(turn===epoch&&!authenticated)el('session-status').textContent='Kijelentkezve.';}
 catch{if(turn===epoch&&!authenticated)el('session-status').textContent='A kijelentkezés nem ellenőrizhető. Próbálja újra.';}
});
const tmStatus=Object.freeze({pending:'Jóváhagyásra vár.',returned_for_edit:'Visszaküldve javításra. Writer új tervezetet menthet.',
 rejected:'Elutasítva; a foglalás nyitva marad, Writer új tervezettel újranyithatja.',approved_internal:'Belső jóváhagyás mentve (test-mailbox-v1). Nincs levélküldés vagy Previo-foglalás.'});
const tmDecisionLabel=Object.freeze({approve:'jóváhagyva',return:'visszaküldve javításra',reject:'elutasítva'});
// Display known adult/child counts when extraction did not supply a separate total.
// This is a read-only label: never infer an unknown child count or change stored facts.
function guestSummary(values){
 if(values.guests)return values.guests;
 const count=value=>(typeof value==='number'||typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value))&&Number.isSafeInteger(Number(value))&&Number(value)>=0;
 const parts=[];
 if(count(values.adults))parts.push(values.adults+' felnőtt');
 if(count(values.children))parts.push(values.children+' gyermek');
 return parts.join(', ')||'Nincs megadva';
}
// A foreign-language guest message gets a machine Hungarian translation right under it (server-read text,
// verified numbers; the operator still checks the original). Hungarian messages need none.
async function showTranslation(caseId,turn){
 const note=document.createElement('p');note.className='readout';
 try{
  const result=await request({tenantId:TENANT,caseId,action:'test-mailbox-translate'},'GET');if(!current(turn))return;
  if(result?.caseId!==caseId||result.needed!==true)return;
  if(typeof result.text!=='string')throw Error('TRANSLATION_UNVERIFIED');
  note.textContent='Magyar fordítás (gépi, az eredetivel együtt ellenőrizendő):\n'+result.text;
 }catch(error){if(!current(turn)||error?.message==='AUTH_REQUIRED')return;note.className='muted note';note.textContent='Magyar fordítás: '+translationErrorMessage(error?.message);}
 el('detail-messages').append(note);
}
// Test-mailbox case: same detail panel, own server read model. Edit/decide flags are hints only; the database re-checks.
// Owner feedback 2026-11-06: readable Hungarian time, and the Hungarian draft shown only once.
function localTime(iso){const d=new Date(iso);if(!Number.isFinite(d.getTime()))return String(iso);
 return d.toLocaleString('hu-HU',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function reviewSummary(text,review){return reviewDisplay(text,review)||'Magyar ellenőrző összefoglaló még nincs.';}
async function openTestMailboxCase(caseId,turn,status){
 const record=await request({tenantId:TENANT,caseId,action:'test-mailbox-record'},'GET');if(!current(turn))return;
 if(record?.caseId!==caseId||!Number.isSafeInteger(record.revision)||record.revision<1||!tmStatus[record.approval]||
  !Array.isArray(record.messages)||typeof record.draft?.text!=='string'||!/^[a-f0-9]{64}$/.test(record.draft.hash||'')||!Array.isArray(record.decisions))throw Error('INVALID_DATA');
 const messages=document.createDocumentFragment();
 for(const message of record.messages){
  if(typeof message.text!=='string')throw Error('INVALID_DATA');
  const item=document.createElement('p');item.className='readout';
  item.textContent=(message.received_at?localTime(message.received_at)+'\n':'')+message.text;messages.append(item);
 }
 const values=record.values||{};
 el('detail-messages').replaceChildren(messages);void showTranslation(caseId,turn);
 el('detail-facts').textContent='Érkezés: '+(values.arrival||'Nincs megadva')+'\nTávozás: '+(values.departure||'Nincs megadva')+
  '\nLétszám: '+guestSummary(values)+'\nHáztípus: '+(values.unit||'Nincs megadva');
 el('detail-status').textContent=status||tmStatus[record.approval];
 el('detail-draft').textContent=record.draft.text;
 el('detail-summary').textContent=reviewSummary(record.draft.text,record.draft.operatorReviewText);
 el('detail-capacity').textContent=record.previoRead===true
  ?'Tesztlevél-foglalás: a szabad helyet és az árat a rendszer a Previo-tesztből (73521) csak olvasva ellenőrzi; ez pillanatfelvétel, nem foglalás – küldés előtt a Previóban is nézd meg.'
  :'Tesztlevél-foglalás (test-mailbox-v1): a szabad helyet a rendszer nem ellenőrzi (Previo-olvasás nincs bekötve) – ár csak kézi Previo-ellenőrzés után illeszthető be; foglalás nincs.';
 el('detail-price').textContent=record.decisions.length?'Döntések: '+record.decisions.map(d=>(tmDecisionLabel[d.decision]||'ismeretlen')+(d.at?' ('+localTime(d.at)+')':'')+(d.reason?' – '+d.reason:'')).join('; '):'';
 tmCase={caseId,revision:record.revision,hash:record.draft.hash,text:record.draft.text};
 // Only an internally approved draft can be copied; an approved draft cannot change, so it is the reviewed text.
 priceCase={caseId,revision:record.revision,values,language:/^(hu|de|en|si)$/.test(values.language||'')?values.language:'hu',editable:record.canEditDraft===true};el('price-panel').hidden=false;el('unavailable-confirm').checked=false;el('unavailable-confirm').disabled=!priceCase.editable;el('unavailable-insert').disabled=true;
 // The case stores the reviewed Hungarian type name ("Családi"); preselect that type, never a silent Deluxe default
 // (owner iPhone test 2026-11-09: a Családi request was priced as Deluxe). Osztott without A/B/C: no preselection.
 const caseCabin=CABIN_NAMES[values.unit]?values.unit:Object.entries(CABIN_NAMES).find(([,n])=>n.hu.toLowerCase()===String(values.unit||'').trim().toLowerCase())?.[0];
 if(caseCabin)el('price-cabin').value=caseCabin;
 showBooking(caseId,record);
 if(record.approval==='approved_internal'){approvedText=record.draft.text;el('copy-approved').hidden=false;approvedCase={caseId,revision:record.revision};el('send-approved').hidden=false;}
 if(record.canEditDraft===true){el('draft-editor').value=record.draft.text;el('draft-editor').disabled=false;}
 if(record.canDecide===true&&record.approval==='pending'){
  tmCase.canDecide=true;el('approve-confirm').disabled=false;
  for(const id of ['return-draft','reject-draft','decision-reason'])el(id).disabled=false;
 }
}
// Copy for a manual Gmail reply; the separate "Válasz küldése" button sends the approved text server-side (test pair only).
// Feedback is shown on the button itself (the status line is far above on a phone).
el('copy-approved').addEventListener('click',async()=>{
 const text=approvedText,button=el('copy-approved');if(!authenticated||typeof text!=='string')return;
 try{
  await navigator.clipboard.writeText(text);
  button.textContent='Másolva ✓ – illessze be a Gmail-válaszba';
  el('detail-status').textContent='A jóváhagyott szöveg a vágólapra került. A választ kézzel, Gmailből küldje el.';
 }catch{
  // Fallback: select the approved text so the phone's own Copy works.
  try{const range=document.createRange();range.selectNodeContents(el('detail-draft'));const selection=globalThis.getSelection();selection.removeAllRanges();selection.addRange(range);}catch{}
  button.textContent='Nem sikerült – a szöveg kijelölve, használja a Másolás funkciót';
  el('detail-status').textContent='A másolás nem sikerült. Jelölje ki a választervezet szövegét kézzel.';
 }
});
el('price-calc').addEventListener('click',async()=>{
 const target=priceCase;if(!authenticated||!target)return;
 const v=target.values,ages=String(v.child_ages||'').split(',').filter(Boolean).map(Number);
 const input={arrival:v.arrival,departure:v.departure,cabin:el('price-cabin').value,adults:Number(v.adults),children:Number(v.children||0)===ages.length?ages:[]};
 el('price-insert').disabled=true;el('price-available').checked=false;el('price-available').disabled=true;priceQuote=null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.arrival||'')||!/^\d{4}-\d{2}-\d{2}$/.test(input.departure||'')||!Number.isInteger(input.adults)||input.adults<1||Number(v.children||0)!==ages.length){
  el('price-result').textContent='Az árhoz pontos érkezés, távozás, felnőttszám és minden gyermek életkora kell a foglalási adatokban.';return;}
 el('price-result').textContent='Ár számítása…';
 try{
  const response=await fetch('/api/price-reference',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),cache:'no-store',credentials:'same-origin'});
  const quote=await response.json();if(priceCase!==target)return;
  if(!response.ok||quote?.status!=='public_reference'||!Number.isSafeInteger(quote.total)||quote.cabin!==input.cabin)throw Error(typeof quote?.error==='string'?quote.error:'');
  priceQuote=quote;el('price-result').textContent=priceExplanation(quote);
  el('price-available').disabled=!target.editable;
 }catch(error){if(priceCase===target)el('price-result').textContent='Az ár nem számítható: '+(error.message||'ismeretlen hiba')+' Kérjük, kézzel ellenőrizze.';}
});
// The operator confirms availability (Previo read is not connected yet); without it no price is inserted.
el('price-available').addEventListener('change',()=>{el('price-insert').disabled=!(priceQuote&&priceCase?.editable&&el('price-available').checked);
 if(el('price-available').checked){el('unavailable-confirm').checked=false;el('unavailable-insert').disabled=true;}});
// Owner request 2026-11-04: booked period -> no price at all, a server-built "no free cabin" reply instead.
el('unavailable-confirm').addEventListener('change',()=>{const on=el('unavailable-confirm').checked;el('unavailable-insert').disabled=!(on&&priceCase?.editable);
 if(on){el('price-available').checked=false;el('price-insert').disabled=true;}});
// Approving the price saves a SERVER-computed, server-attested priced draft (no browser text); the operator
// confirms availability by hand until the Previo read is connected. Nothing is inserted automatically.
const priceErrors={PRICE_FACTS_MISSING:'A foglalási adatokból hiányzik a pontos dátum, a felnőttszám vagy egy gyermek életkora.',
 PRICE_LINE_MISSING:'A válaszban már nincs meg az általános ármondat (kézzel módosították); az árat kézzel írja be.',
 PRICE_REFUSED:'Az árlista ehhez nem ad igazolt árat; kézi ellenőrzés szükséges.',STORAGE_FAILURE:'Az adatbázis-funkció nem érhető el (valószínűleg még nincs telepítve). Szóljon Claude-nak.',NOT_FOUND:'A foglalás nem található; töltse be újra a listát.',PREVIO_NO_FREE_UNIT:'A Previo szerint a kért időszakra nincs szabad ilyen ház, ezért ár nem illeszthető be. Válasszon más háztípust, vagy használja a „Nincs szabad hely” gombot.',CASE_CONFLICT:'A foglalás közben megváltozott; nyissa meg újra.',
 FORBIDDEN:'Ehhez nincs írási jog, vagy a funkció nincs telepítve.',TEST_MAILBOX_REJECTED:'Az adatbázis elutasította (lehet, hogy a frissítés még nincs telepítve).'};
el('price-insert').addEventListener('click',async()=>{
 const target=priceCase,quote=priceQuote;if(!authenticated||!target||!quote||!el('price-available').checked||actionBusy)return;
 const turn=epoch;actionBusy=true;el('price-insert').disabled=true;el('price-result').textContent+='\n\nÁr jóváhagyása és mentése…';
 try{
  const result=await request({tenantId:TENANT,caseId:target.caseId,action:'test-mailbox-price',expectedRevision:target.revision,cabin:quote.cabin,availabilityConfirmed:true});
  if(!current(turn))return;
  if(result?.caseId!==target.caseId||result.revision!==target.revision+1||result.approval!=='pending')throw Error('INVALID_DATA');
  rows=[];listLoaded=false;updateCounts();el('case-list').replaceChildren();
  const previoNote=result.previo?.decision==='AVAILABLE'?' Previo: '+result.previo.free+' szabad (pillanatfelvétel).':result.previo?' Previo: nem adott biztos eredményt, a kézi ellenőrzés érvényes.':'';
  await openTestMailboxCase(target.caseId,turn,'Ár jóváhagyva és beillesztve ('+huf(result.total)+' Ft).'+previoNote+' A tervezet jóváhagyásra vár.');
 }catch(error){
  if(!current(turn))return;
  if(error?.message==='AUTH_REQUIRED')failed(error);
  else{el('price-result').textContent+='\nNem sikerült: '+(priceErrors[error?.message]||'a mentés nem igazolt; nincs automatikus ismétlés.');el('price-insert').disabled=false;}
 }finally{actionBusy=false;}
});
const unavailableErrors={ALREADY_UNAVAILABLE:'A válasz már a „nincs szabad hely” szöveg.',DRAFT_SHAPE_UNKNOWN:'A tervezet szerkezete nem ismerhető fel (kézzel módosították); a választ kézzel írja meg.',
 CASE_CONFLICT:'A foglalás közben megváltozott; nyissa meg újra.',FORBIDDEN:'Ehhez nincs írási jog, vagy a funkció nincs telepítve.',
 TEST_MAILBOX_REJECTED:'Az adatbázis elutasította (lehet, hogy a frissítés még nincs telepítve).',
 // Owner video 2026-11-06: a missing database function surfaced only as a generic message.
 STORAGE_FAILURE:'Az adatbázis-funkció nem érhető el (valószínűleg még nincs telepítve). Szóljon Claude-nak; addig a választ kézzel írja meg.',NOT_FOUND:'A foglalás nem található; töltse be újra a listát.'};
el('unavailable-insert').addEventListener('click',async()=>{
 const target=priceCase;if(!authenticated||!target||!target.editable||!el('unavailable-confirm').checked||actionBusy)return;
 const turn=epoch;actionBusy=true;el('unavailable-insert').disabled=true;el('unavailable-result').textContent='Ár nélküli „nincs szabad hely” válasz mentése…';
 try{
  const result=await request({tenantId:TENANT,caseId:target.caseId,action:'test-mailbox-unavailable',expectedRevision:target.revision,unavailableConfirmed:true});
  if(!current(turn))return;
  if(result?.caseId!==target.caseId||result.revision!==target.revision+1||result.approval!=='pending')throw Error('INVALID_DATA');
  rows=[];listLoaded=false;updateCounts();el('case-list').replaceChildren();
  await openTestMailboxCase(target.caseId,turn,'„Nincs szabad hely” válasz mentve, ár nélkül. A tervezet jóváhagyásra vár.');
 }catch(error){
  if(!current(turn))return;
  if(error?.message==='AUTH_REQUIRED')failed(error);
  else{el('unavailable-result').textContent='Nem sikerült: '+(unavailableErrors[error?.message]||'a mentés nem igazolt; nincs automatikus ismétlés.');el('unavailable-insert').disabled=false;}
 }finally{actionBusy=false;}
});

// V1 booking completion (2026-11-06): finalized only after the operator's Previo attestation; the deposit is a
// separate step. The server builds the confirmation letter; it still goes through approval and the send button.
const bookingStatus={finalized:'Véglegesítve (Previóban rögzítve) – a foglaló még nem érkezett meg.',deposit_received:'Foglaló beérkezett.',cancelled:'Lemondva.'};
function showBooking(caseId,record){
 const b=record.booking;bookingCase={caseId,revision:record.revision};el('booking-panel').hidden=false;
 const dep=b?.deposit&&Number.isSafeInteger(b.deposit.amount)?'\nFoglaló: '+b.deposit.pct+'% = '+huf(b.deposit.amount)+' Ft, határidő: '+new Date(b.deposit.deadlineUtc).toLocaleString('hu-HU',{timeZone:'Europe/Budapest'}):'';
 const intent=typeof record.bookingIntent==='string'&&record.bookingIntent?'🟢 A vendég foglalni szeretne („'+record.bookingIntent+'”). Rögzítsd a Previóban, majd: Véglegesítés.\n':'';
 el('booking-state').textContent=intent+(b?(bookingStatus[b.status]||'Ismeretlen állapot')+(b.unit?'\nEgység: '+b.unit:'')+(b.previoReference?'\nPrevio-hivatkozás: '+b.previoReference:'')+dep+(b.depositReceivedOn?'\nBeérkezett: '+b.depositReceivedOn:''):'Még nincs véglegesítve.');
 const fin=record.canFinalize===true,dpt=record.canMarkDeposit===true;
 // Units of the booking's cabin type only (V2 step 1b); the server and database re-check collisions.
 const cabinKey=Object.entries(CABIN_NAMES).find(([,n])=>n.hu.toLowerCase()===String(record.values?.unit||'').trim().toLowerCase())?.[0];
 const options=cabinKey?unitsOfType(cabinKey).map(u=>{const o=document.createElement('option');o.value=u.id;o.textContent=u.id;return o;}):[];
 const blank=document.createElement('option');blank.value='';blank.textContent=cabinKey?'– válassz –':'Előbb add meg a háztípust';
 el('booking-unit').replaceChildren(blank,...options);el('booking-unit').disabled=!fin||!cabinKey;
 for(const id of ['previo-ref','previo-recorded'])el(id).disabled=!fin;
 // V2: offered only when the server says it can write the Previo TEST booking itself.
 el('previo-auto-wrap').hidden=record.previoWrite!==true;el('previo-auto').disabled=!fin||record.previoWrite!==true;el('previo-auto').checked=false;
 for(const id of ['deposit-date','deposit-confirm'])el(id).disabled=!dpt;
 for(const id of ['cancel-reason','cancel-confirm'])el(id).disabled=record.canCancelBooking!==true;el('cancel-confirm').checked=false;el('cancel-reason').value='';
 if(dpt)el('deposit-date').value=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Budapest'});
}
const bookingErrors={PREVIO_RECORDING_REQUIRED:'Add meg a Previo-hivatkozást, és pipáld be a rögzítést.',ALREADY_FINALIZED:'Ez a foglalás már véglegesítve van.',
 CONFIRMATION_FACTS_MISSING:'Hiányzik a pontos dátum, a felnőttszám vagy egy gyermek életkora.',CONFIRMATION_CABIN_UNKNOWN:'A háztípus nincs egyértelműen megadva.',
 CONFIRMATION_PRICE_MISSING:'Az árlista ehhez nem ad igazolt árat; kézi ellenőrzés szükséges.',DEPOSIT_POLICY_UNVERIFIED:'A foglaló határideje nem számítható (pl. múltbeli érkezés).',
 NOT_FINALIZED:'Előbb véglegesíteni kell a foglalást.',UNIT_TAKEN:'Ez az egység erre az időszakra már foglalt (egy másik véglegesített foglalás miatt). Válassz másik egységet.',UNIT_NOT_IN_TYPE:'Ez az egység nem a foglalás háztípusához tartozik.',PREVIO_WRITE_DISABLED:'A Previo-írás (V2) nincs bekapcsolva.',NOT_ACTIVE_BOOKING:'Csak véglegesített foglalás mondható le.',INVALID_REASON:'Adj meg rövid lemondási okot (egy sor).',CANCEL_NOT_CONFIRMED:'Pipáld be a lemondás megerősítését.',PREVIO_WRITE_UNCERTAIN:'A Previo nem igazolta a létrehozást – nézd meg a Previóban, mielőtt újra próbálod.',PREVIO_BOOKING_NOT_ACTIVE:'Ehhez az ügyhöz a Previóban már van egy lemondott foglalás – kézi ellenőrzés kell.',PREVIO_ORPHAN_OPTION:'A Previóban létrejött az opció, de nálunk nem mentődött, és a lemondás sem igazolt – nézd meg a Previóban!',PREVIO_AUTH_REFUSED:'A Previo elutasította a kulcsot.',PREVIO_REJECTED:'A Previo elutasította a foglalást.',PREVIO_TIMEOUT:'A Previo nem válaszolt időben.',PREVIO_UNAVAILABLE:'A Previo nem érhető el.',UNIT_TAKEN_IN_PREVIO:'A Previo szerint ez az egység erre az időszakra egy másik foglalás miatt foglalt. Válassz másik egységet.',INVALID_DATE:'Érvénytelen dátum.',CASE_CONFLICT:'A foglalás közben megváltozott; nyisd meg újra.',
 FORBIDDEN:'Ehhez nincs írási jog.',STORAGE_FAILURE:'Az adatbázis-funkció nem érhető el (valószínűleg még nincs telepítve). Szólj Claude-nak.',
 TEST_MAILBOX_REJECTED:'Az adatbázis elutasította (lehet, hogy a frissítés még nincs telepítve).',NOT_FOUND:'A foglalás nem található; töltsd be újra a listát.'};
const bookingInputs=()=>{const auto=el('previo-auto').checked&&!el('previo-auto').disabled;
 for(const id of ['previo-ref','previo-recorded'])if(bookingCase&&!el('previo-auto').disabled)el(id).disabled=auto;
 el('booking-finalize').disabled=!(bookingCase&&el('booking-unit').value&&(auto||!el('previo-ref').disabled&&/^[A-Za-z0-9\/_.-]{1,40}$/.test(el('previo-ref').value.trim())&&el('previo-recorded').checked));
 el('deposit-mark').disabled=!(bookingCase&&!el('deposit-confirm').disabled&&el('deposit-confirm').checked&&/^\d{4}-\d{2}-\d{2}$/.test(el('deposit-date').value));
 el('booking-cancel').disabled=!(bookingCase&&!el('cancel-confirm').disabled&&el('cancel-confirm').checked&&el('cancel-reason').value.trim().length>0);};
for(const id of ['booking-unit','previo-ref','previo-recorded','previo-auto','deposit-date','deposit-confirm','cancel-reason','cancel-confirm'])el(id).addEventListener('input',bookingInputs),el(id).addEventListener('change',bookingInputs);
async function bookingAction(button,body,done){
 const target=bookingCase;if(!authenticated||!target||actionBusy)return;
 const turn=epoch;actionBusy=true;el(button).disabled=true;el('booking-result').textContent='Mentés…';
 try{
  const result=await request({tenantId:TENANT,caseId:target.caseId,expectedRevision:target.revision,...body});
  if(!current(turn))return;
  if(result?.caseId!==target.caseId||result.revision!==target.revision+1)throw Error('INVALID_DATA');
  rows=[];listLoaded=false;updateCounts();el('case-list').replaceChildren();
  const message=done(result);
  await openTestMailboxCase(target.caseId,turn,message);
  // The result stays next to the booking buttons too (it said "Mentés…" after a successful action).
  if(current(turn))el('booking-result').textContent=message;
 }catch(error){
  if(!current(turn))return;
  if(error?.message==='AUTH_REQUIRED')failed(error);
  else{el('booking-result').textContent='Nem sikerült: '+(bookingErrors[error?.message]||'a mentés nem igazolt; nincs automatikus ismétlés.');el(button).disabled=false;}
 }finally{actionBusy=false;}
}
el('booking-finalize').addEventListener('click',()=>{const auto=el('previo-auto').checked&&!el('previo-auto').disabled;
 bookingAction('booking-finalize',auto?{action:'test-mailbox-confirm',unit:el('booking-unit').value,previoAuto:true}
  :{action:'test-mailbox-confirm',unit:el('booking-unit').value,previoReference:el('previo-ref').value.trim(),previoRecorded:el('previo-recorded').checked},
 r=>'Véglegesítve'+(auto?', a Previo-tesztben opcióként rögzítve':'')+'. Visszaigazoló levél elkészült'+(r.deposit?' (foglaló: '+huf(r.deposit.amount)+' Ft)':'')+'; jóváhagyásra vár, utána küldhető.');});
el('deposit-mark').addEventListener('click',()=>bookingAction('deposit-mark',{action:'test-mailbox-deposit',receivedOn:el('deposit-date').value,depositConfirmed:el('deposit-confirm').checked},
 r=>'Foglaló beérkezése rögzítve.'+(r.previoSync==='confirmed'?' A Previo-tesztben megerősítve (zöld).':r.previoSync==='confirm_failed'?' FIGYELEM: a Previo-megerősítés nem sikerült – nézd meg a Previóban.':'')));
el('booking-cancel').addEventListener('click',()=>bookingAction('booking-cancel',{action:'test-mailbox-cancel',reason:el('cancel-reason').value.trim(),cancelConfirmed:el('cancel-confirm').checked},
 r=>'Foglalás lemondva.'+(r.previoSync==='cancelled'?' A Previo-tesztben is lemondva.':r.previoSync==='cancel_failed'?' FIGYELEM: a Previo-lemondás nem sikerült – mondd le kézzel a Previóban.':r.previoSync==='manual'?' A Previóban kézzel mondd le (nem V2-foglalás).':'')+' Vendéglevél nem ment.'));
// Sends the stored, approved reply through the server (test pair only). The browser sends no text.
const sendErrors={FORBIDDEN:'A küldés nincs bekapcsolva, vagy nincs jóváhagyói jog.',SEND_OUTCOME_UNKNOWN:'Egy korábbi küldés eredménye nem ismert. Nézze meg a Gmailben (Elküldött levelek); nem küldjük újra automatikusan.',STORAGE_FAILURE:'A küldési napló nem érhető el, ezért nem küldtük el.',NOT_APPROVED:'Csak jóváhagyott válasz küldhető.',
 RECIPIENT_NOT_ALLOWED:'Ez a címzett nem engedélyezett (csak a tesztfeladó).',CASE_CONFLICT:'A foglalás közben megváltozott; nyissa meg újra.',
 GMAIL_AUTH_REQUIRED:'A Google-küldési engedély szükséges.',WRONG_GMAIL_ACCOUNT:'A sarberkiprojecttest@gmail.com fiókot válassza.',
 LOADING:'A Google-belépés betöltődik; nyomja meg újra.',CONSENT:'A Google-engedély nem érkezett meg.',CHANGED:'A belépés közben megváltozott; nyomja meg újra.'};
el('send-approved').addEventListener('click',()=>{
 const target=approvedCase,button=el('send-approved');if(!authenticated||!target||button.disabled)return;
 button.disabled=true;button.textContent='Google-engedély…';
 const failedSend=code=>{if(approvedCase!==target)return;button.disabled=false;button.textContent='Nem ment el – '+(sendErrors[code]||'a küldés nem igazolt; nincs automatikus ismétlés.');};
 emailReader.requestSendToken(async token=>{
  if(approvedCase!==target||!authenticated)return;
  button.textContent='Küldés…';
  try{
   const result=await request({tenantId:TENANT,caseId:target.caseId,action:'test-mailbox-send',expectedRevision:target.revision},'POST',{'X-Sarberki-Gmail-Token':token});
   if(approvedCase!==target)return;
   if(result?.caseId!==target.caseId||!['sent','already_sent'].includes(result.status))throw Error('INVALID_DATA');
   button.textContent=result.status==='sent'?'Elküldve ✓':'Már el volt küldve ✓ – nem küldtük újra';
  }catch(error){failedSend(error?.message);}
 },failedSend);
});
async function tmMutate(kind){
 const base=tmCase;if(actionBusy||!authenticated||!base)return;
 const text=el('draft-editor').value,reason=el('decision-reason').value.trim();
 if(kind==='redraft'&&(!text.trim()||text===base.text))return;
 if(kind!=='redraft'&&(!base.canDecide||kind==='approve'&&!el('approve-confirm').checked))return;
 const turn=epoch;actionBusy=true;resetActions();el('detail-status').textContent='Művelet ellenőrzése…';
 try{
  const input=kind==='redraft'?{tenantId:TENANT,caseId:base.caseId,action:'test-mailbox-redraft',expectedRevision:base.revision,draftText:text}:
   {tenantId:TENANT,caseId:base.caseId,action:'test-mailbox-decide',decision:kind,expectedRevision:base.revision,reviewedDraftHash:base.hash,...(reason&&kind!=='approve'?{reason}:{})};
  const result=await request(input);if(!current(turn))return;
  const expected=kind==='redraft'?'pending':{approve:'approved_internal',return:'returned_for_edit',reject:'rejected'}[kind];
  if(result?.caseId!==base.caseId||result.revision!==base.revision+1||result.approval!==expected)throw Error('INVALID_DATA');
  rows=[];listLoaded=false;updateCounts();el('case-list').replaceChildren();
  await openTestMailboxCase(base.caseId,turn,kind==='redraft'?'Új tervezet mentve és visszaolvasva. Független jóváhagyásra vár.':
   kind==='approve'?'Belső jóváhagyás mentve és visszaolvasva (test-mailbox-v1). Nincs levélküldés vagy Previo-foglalás.':
   kind==='return'?'Visszaküldés mentve és visszaolvasva. Writer új tervezetet menthet.':'Elutasítás mentve és visszaolvasva. A foglalás nyitva marad.');
 }catch(error){if(current(turn)){
  if(error.message==='AUTH_REQUIRED')failed(error);
  else {clearDetail();el('list-status').textContent=error.message==='FORBIDDEN'?'A művelethez nincs megfelelő jogosultság.':'A mentés eredménye nem igazolt, vagy a foglalás közben megváltozott. Töltse be újra; nincs automatikus ismétlés.';}
 }}finally{actionBusy=false;}
}
async function openCase(caseId){
 if(!authenticated||actionBusy)return;
 if(isTestMailboxCaseId(caseId)){
  clearDetail();const turn=++epoch;el('case-detail').hidden=false;el('detail-status').textContent='Foglalás ellenőrzése…';
  try{await openTestMailboxCase(caseId,turn);}
  catch(error){if(current(turn)){clearDetail();if(['AUTH_REQUIRED','FORBIDDEN'].includes(error.message))failed(error);else el('list-status').textContent='A foglalás most nem tölthető be. Töltse be újra a foglalásokat.';}}
  return;
 }
 if(!isIsolatedReviewCaseId(caseId))return;
 clearDetail();const turn=++epoch;el('case-detail').hidden=false;el('detail-status').textContent='Foglalás ellenőrzése…';
 try{
  const record=await request({tenantId:TENANT,caseId,action:'review-record'},'GET');if(!current(turn))return;
  if(record?.tenantId!==TENANT||record.caseId!==caseId||!Number.isSafeInteger(record.revision)||record.revision<1||
   !Array.isArray(record.data?.messages)||!record.data?.state?.values)throw Error('INVALID_DATA');
  const values=record.data.state.values,draft=record.data.drafts?.at(-1);
  const messages=document.createDocumentFragment();
  for(const message of record.data.messages){
   if(typeof message.text!=='string')throw Error('INVALID_DATA');
   const item=document.createElement('p');item.className='readout';
   item.textContent=(message.received_at?localTime(message.received_at)+'\n':'')+message.text;messages.append(item);
  }
  el('detail-messages').replaceChildren(messages);
  el('detail-facts').textContent='Érkezés: '+(values.arrival||'Nincs megadva')+'\nTávozás: '+(values.departure||'Nincs megadva')+
   '\nLétszám: '+guestSummary(values)+'\nHáztípus: '+(values.unit||'Nincs megadva');
  el('detail-status').textContent=record.data.state.approval==='internally_approved'?'Belső jóváhagyás mentve. A foglalás folyamatban van; nincs elküldött levél vagy Previo-foglalás.':'A közös foglalástárból betöltött tesztfoglalás.';
  el('detail-draft').textContent=draft?.text||'Még nincs tárolt választervezet.';
  el('detail-summary').textContent=draft?.operatorReviewText||'Magyar ellenőrző összefoglaló még nincs.';
  el('detail-capacity').textContent='Tesztadat. Valós foglalhatóság ebből nem igazolt.';
  el('detail-price').textContent=record.approvalBlockedReason?'A jóváhagyáshoz szükséges foglalásra kötött ár- és kapacitásbizonyíték hiányzik.':'';
  el('detail-link').href='../cloud-approval.html?'+new URLSearchParams({caseId});
  const draftCurrent=draft?.revision===record.data.state.revision&&draft?.basedOnMessageCount===record.data.messages.length;
  if(draft&&!draftCurrent)el('detail-price').textContent='A tárolt válasz korábbi foglalási állapothoz tartozik. Új ellenőrzött tervezet szükséges; szerkesztése és jóváhagyása itt tiltott.';
  if(draftCurrent&&record.data.state.approval==='pending'&&draft?.text&&
   (record.approvalBlockedReason==='EXACT_REVIEW_EVIDENCE_REQUIRED'||draft.synthetic===true&&draft.reviewStatus==='internal_review_required')){
   const loaded=await review.load(caseId);if(!current(turn))return;
   if(loaded.revision!==record.revision)throw Error('CASE_CONFLICT');
   selected=loaded;canApprove=record.canApproveDraft===true&&!loaded.approvalBlockedReason;
   el('approve-confirm').disabled=!canApprove;
   if(loaded.canEditDraft){editBase=loaded;el('draft-editor').value=loaded.text;el('draft-editor').disabled=false;}
  }
 }catch(error){if(current(turn)){clearDetail();if(['AUTH_REQUIRED','FORBIDDEN'].includes(error.message))failed(error);else el('list-status').textContent='A foglalás most nem tölthető be. Töltse be újra a foglalásokat.';}}
}
el('draft-editor').addEventListener('input',()=>{
 if(tmCase){
  // Editing the draft withdraws any pending decision on the loaded version.
  if(tmCase.canDecide){tmCase.canDecide=false;el('approve-confirm').checked=false;el('approve-confirm').disabled=true;el('approve-draft').disabled=true;
   for(const id of ['return-draft','reject-draft','decision-reason'])el(id).disabled=true;}
  el('save-draft').disabled=actionBusy||el('draft-editor').value===tmCase.text||!el('draft-editor').value.trim();return;
 }
 review.clear();selected=null;canApprove=false;el('approve-confirm').checked=false;el('approve-confirm').disabled=true;el('approve-draft').disabled=true;
 el('save-draft').disabled=actionBusy||!editBase||el('draft-editor').value===editBase.text||!el('draft-editor').value.trim();
});
el('approve-confirm').addEventListener('change',()=>{el('approve-draft').disabled=actionBusy||!(tmCase?.canDecide||selected&&canApprove)||!el('approve-confirm').checked;});
async function mutate(kind){
 if(actionBusy||!authenticated)return;
 const base=kind==='edit'?editBase:selected,text=el('draft-editor').value;
 if(!base||kind==='approve'&&(!canApprove||!el('approve-confirm').checked))return;
 const turn=epoch;actionBusy=true;resetActions();el('detail-status').textContent='Művelet ellenőrzése…';
 try{
  let record;
  if(kind==='edit')record=await request({tenantId:TENANT,caseId:base.caseId,action:'edit-draft',expectedRevision:base.revision,expectedDraftHash:base.hash,editedDraftText:text});
  else record=await request({tenantId:TENANT,caseId:base.caseId,action:'approve',expectedRevision:base.revision,reviewedDraftHash:base.hash});
  if(!current(turn))return;
  if(record?.caseId!==base.caseId||record.tenantId!==TENANT||record.revision!==base.revision+1||
   (kind==='edit'?(record.data?.drafts?.at(-1)?.text!==text||record.data.state.approval!=='pending'):
    (record.data?.state?.approval!=='internally_approved'||record.data.serverApproval?.draftHash!==base.hash)))throw Error('INVALID_DATA');
  const back=await request({tenantId:TENANT,caseId:base.caseId,action:'review-record'},'GET');if(!current(turn))return;
  if(back.revision!==record.revision)throw Error('CASE_CONFLICT');
  rows=[];listLoaded=false;updateCounts();el('case-list').replaceChildren();
  el('detail-status').textContent=kind==='edit'?'Módosítás mentve és visszaolvasva. A jóváhagyó külön nyissa meg újra.':'Belső jóváhagyás mentve és visszaolvasva. Nincs levélküldés vagy Previo-foglalás.';
  el('detail-draft').textContent=back.data.drafts.at(-1).text;
 }catch(error){if(current(turn)){
  if(error.message==='AUTH_REQUIRED')failed(error);
  else {clearDetail();el('list-status').textContent=error.message==='FORBIDDEN'?'A művelethez nincs megfelelő jogosultság.':'A mentés eredménye nem igazolt, vagy a foglalás közben megváltozott. Töltse be újra; nincs automatikus ismétlés.';}
 }}finally{actionBusy=false;}
}
el('save-draft').addEventListener('click',()=>tmCase?tmMutate('redraft'):mutate('edit'));
el('approve-draft').addEventListener('click',()=>tmCase?tmMutate('approve'):mutate('approve'));
el('return-draft').addEventListener('click',()=>tmMutate('return'));
el('reject-draft').addEventListener('click',()=>tmMutate('reject'));
async function loadCases({selectAvailable=false}={}){
 if(!authenticated||actionBusy)return;
 clearData('Foglalások ellenőrzése…');const turn=epoch;el('load-cases').disabled=true;
 try{
  const result=await request({tenantId:TENANT,action:'daily-list'},'GET');if(!current(turn))return;
  if(!Array.isArray(result)||result.length>100)throw Error('INVALID_DATA');
  const seen=new Set();
  for(const row of result){if(row?.tenantId!==TENANT||!(row.kind==='test-mailbox'?isTestMailboxCaseId(row.caseId):isIsolatedReviewCaseId(row.caseId))||!Number.isSafeInteger(row.revision)||row.revision<1||!sections[row.category]||seen.has(row.caseId))throw Error('INVALID_DATA');seen.add(row.caseId);}
  rows=result;listLoaded=true;
  if(selectAvailable&&rows.length&&!rows.some(row=>row.category===selectedSection)){
   selectedSection=rows[0].category;
   for(const item of document.querySelectorAll('[data-section]'))item.setAttribute('aria-pressed',String(item.dataset.section===selectedSection));
   el('section-heading').textContent=sections[selectedSection][0];el('section-description').textContent=sections[selectedSection][1];
  }
  renderRows();

 }catch(error){if(current(turn)){
  if(['AUTH_REQUIRED','FORBIDDEN'].includes(error.message))failed(error);
  else {clearData('A foglaláskezelési backend most nem elérhető. Később próbálja újra.');}
 }}finally{if(authenticated)el('load-cases').disabled=false;}
}
el('load-cases').addEventListener('click',()=>loadCases());
// App switch (iPhone): conceal, keep in-memory state, and on return let the server decide.
// The server enforces the 30 minute inactivity limit; a rejected restore locks and clears.
let concealed=false,lastActivity=0;
const ACTIVITY_REFRESH_MS=5*60*1000,SWITCH_MARK='sarberki-napi-concealed-at';
const authError=error=>['AUTH_REQUIRED','FORBIDDEN'].includes(error?.message);
// Only a timestamp is kept, to tell an iOS reload or home-screen relaunch apart from a normal return.
// localStorage is expected to outlive an iOS home-screen relaunch, unlike sessionStorage. No mail, AI text or token.
function markSwitch(){try{localStorage.setItem(SWITCH_MARK,String(Date.now()));}catch{}}
function forgetSwitch(){try{localStorage.removeItem(SWITCH_MARK);}catch{}}
function setConcealed(value,message='Munkamenet ellenőrzése…'){
 concealed=value;document.body?.classList.toggle('concealed',value);if(document.body?.dataset)document.body.dataset.concealedMessage=message;
}
function conceal(){if(!authenticated||concealed)return;setConcealed(true);markSwitch();emailReader.conceal();clearTimeout(saveTimer);saveTimer=null;void queueSave();}
async function reveal(){
 if(!concealed){void resume();return;}
 if(document.visibilityState==='hidden')return;
 const turn=epoch;
 try{rememberKey(await session.restore());if(turn!==epoch||!authenticated||document.visibilityState==='hidden')return;
  lastActivity=Date.now();forgetSwitch();setConcealed(false);el('session-status').textContent='Bejelentkezve.';emailReader.reveal();
 }catch(error){
  if(turn!==epoch)return;
  // Only an authorization failure locks and clears. A transient network error (common right after
  // iOS resumes the page) keeps the data hidden and retries on the next tap or return.
  if(authError(error))failed(error);else setConcealed(true,'A kapcsolat még nem ellenőrizhető. Érintse meg a képernyőt az újrapróbáláshoz.');
 }
}
// Real operator activity slides the server idle deadline, at most once per interval.
function activity(){
 if(!authenticated||document.visibilityState==='hidden')return;
 if(concealed){void reveal();return;}
 if(Date.now()-lastActivity<ACTIVITY_REFRESH_MS)return;
 lastActivity=Date.now();const turn=epoch;
 session.restore().then(rememberKey).catch(error=>{if(turn===epoch&&authenticated&&authError(error))failed(error);});
}
for(const type of ['pointerdown','keydown'])document.addEventListener(type,activity,{capture:true,passive:true});
let reloadedAfterSwitch=false;
// Only a switch within the 30 minute idle window counts; the server still decides the session.
try{const at=Number(localStorage.getItem(SWITCH_MARK));reloadedAfterSwitch=at>0&&Date.now()-at<30*60*1000;}catch{}
forgetSwitch();
addEventListener('pagehide',conceal);
addEventListener('pageshow',event=>{if(event.persisted)void reveal();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')conceal();else void reveal();});
void resume();
