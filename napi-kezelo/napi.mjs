import {createDailyEmailReader} from './napi-email.mjs';
import {createOperatorSession} from '../sarberki-chatbot-project/operator-session.mjs';
import {isIsolatedReviewCaseId} from '../shared-core/isolated-review-case-id.mjs';
import {createCloudCaseRequest} from '../shared-core/cloud-case-request.mjs';
import {createEpochRequestQueue} from '../shared-core/epoch-request-queue.mjs';
import {createIsolatedApprovalReview} from '../shared-core/isolated-approval-review.mjs';
import {createServerChatClient} from '../sarberki-chatbot-project/remote-chat-client.mjs';

const TEST_ORIGIN='https://leafy-chimera-2403e5.netlify.app';
const TENANT='sarberki-test';
const sections=Object.freeze({
 incoming:['Beérkezett ügyek','Új vendégüzenetek és feldolgozásra váró megkeresések.'],
 approval:['Jóváhagyásra vár','Átnézendő választervezetek.'],
 progress:['Folyamatban','Pontosításra vagy ellenőrzésre váró ügyek.'],
 // No close/reject lifecycle exists on the server yet; never imply closed cases.
 closed:['Lezárt ügyek','Az ügylezárás és elutasítás még nincs bekötve a szerveren, ezért ide jelenleg egyetlen ügy sem kerülhet.']
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
 clientId:document.querySelector('meta[name="google-oauth-client-id"]')?.content,onChange:()=>scheduleSave()});
// Encrypted local copy of the read mail list, selection and local reply preview, so an iOS relaunch does not
// force a re-read. AES-GCM with a per-login key that only an authenticated, non-idle server session returns;
// expires after 30 minutes and is deleted on lock/logout. Never a Gmail token; never plaintext.
const STATE_STORE='sarberki-napi-state',STATE_TTL_MS=30*60*1000,encoder=new TextEncoder();
let stateKey=null,saveTimer=null,saveQueue=Promise.resolve();
function rememberKey(meta){stateKey=/^[a-f0-9]{64}$/.test(meta?.stateKey||'')?meta.stateKey:null;return meta;}
const toB64=bytes=>{let out='';for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(out);};
const fromB64=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
const aesKey=hex=>crypto.subtle.importKey('raw',Uint8Array.from(hex.match(/../g),h=>parseInt(h,16)),'AES-GCM',false,['encrypt','decrypt']);
const aad=savedAt=>encoder.encode('sarberki-napi-state-v1|sarberki-test|'+savedAt);
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
let selectedSection='incoming',rows=[],selected=null,editBase=null,canApprove=false,actionBusy=false;
const request=createEpochRequestQueue({getEpoch:()=>epoch,isAuthenticated:()=>authenticated,
 prepare:()=>session.restore(),execute:createCloudCaseRequest()});
const review=createIsolatedApprovalReview({enabled:true,client:{
 get:(_tenant,caseId)=>request({tenantId:TENANT,caseId,action:'review-record'},'GET'),
 approve:(_tenant,caseId,expectedRevision,reviewedDraftHash)=>request({tenantId:TENANT,caseId,action:'approve',expectedRevision,reviewedDraftHash})}});
function resetActions(){
 selected=null;editBase=null;canApprove=false;review.clear();
 el('draft-editor').value='';el('draft-editor').disabled=true;el('save-draft').disabled=true;
 el('approve-draft').disabled=true;el('approve-confirm').checked=false;el('approve-confirm').disabled=true;
}
function updateCounts(){
 for(const section of Object.keys(sections))el('count-'+section).textContent=listLoaded?rows.filter(row=>row.category===section).length+' ügy':'Nincs betöltve';
}
function renderRows(){
 updateCounts();el('cases-title').textContent=sections[selectedSection][0]+' – tárolt tesztügyek';
 const visible=rows.filter(row=>row.category===selectedSection),fragment=document.createDocumentFragment();
 visible.forEach((row,index)=>{
  const li=document.createElement('li'),label=document.createElement('span'),button=document.createElement('button');
  label.textContent='Tesztügy '+(rows.indexOf(row)+1);button.type='button';button.textContent='Megnyitás';
  button.setAttribute('aria-label',label.textContent+' megnyitása');
  button.addEventListener('click',()=>openCase(row.caseId));li.append(label,button);fragment.append(li);
 });
 el('case-list').replaceChildren(fragment);
 if(!authenticated)el('list-status').textContent='Az ügylistához jelentkezzen be a Belépés részben.';
 else if(!listLoaded)el('list-status').textContent='A kategória ügylistája még nincs betöltve. Nyomja meg az Ügyek frissítése gombot.';
 else el('list-status').textContent=visible.length?'A kiválasztott kategória: '+visible.length+' tárolt tesztügy.':'Ebben a kategóriában nincs elérhető tárolt tesztügy.';
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
async function openCase(caseId){
 if(!authenticated||!isIsolatedReviewCaseId(caseId)||actionBusy)return;
 clearDetail();const turn=++epoch;el('case-detail').hidden=false;el('detail-status').textContent='Ügy ellenőrzése…';
 try{
  const record=await request({tenantId:TENANT,caseId,action:'review-record'},'GET');if(!current(turn))return;
  if(record?.tenantId!==TENANT||record.caseId!==caseId||!Number.isSafeInteger(record.revision)||record.revision<1||
   !Array.isArray(record.data?.messages)||!record.data?.state?.values)throw Error('INVALID_DATA');
  const values=record.data.state.values,draft=record.data.drafts?.at(-1);
  const messages=document.createDocumentFragment();
  for(const message of record.data.messages){
   if(typeof message.text!=='string')throw Error('INVALID_DATA');
   const item=document.createElement('p');item.className='readout';
   item.textContent=(message.received_at?message.received_at+'\n':'')+message.text;messages.append(item);
  }
  el('detail-messages').replaceChildren(messages);
  el('detail-facts').textContent='Érkezés: '+(values.arrival||'Nincs megadva')+'\nTávozás: '+(values.departure||'Nincs megadva')+
   '\nLétszám: '+(values.guests||'Nincs megadva')+'\nHáztípus: '+(values.unit||'Nincs megadva');
  el('detail-status').textContent=record.data.state.approval==='internally_approved'?'Belső jóváhagyás mentve. Az ügy folyamatban van; nincs elküldött levél vagy foglalás.':'A közös ügytárból betöltött tesztügy.';
  el('detail-draft').textContent=draft?.text||'Még nincs tárolt választervezet.';
  el('detail-summary').textContent=draft?.operatorReviewText||'Magyar ellenőrző összefoglaló még nincs.';
  el('detail-capacity').textContent='Tesztadat. Valós foglalhatóság ebből nem igazolt.';
  el('detail-price').textContent=record.approvalBlockedReason?'A jóváhagyáshoz szükséges ügyre kötött ár- és kapacitásbizonyíték hiányzik.':'';
  el('detail-link').href='../cloud-approval.html?'+new URLSearchParams({caseId});
  const draftCurrent=draft?.revision===record.data.state.revision&&draft?.basedOnMessageCount===record.data.messages.length;
  if(draft&&!draftCurrent)el('detail-price').textContent='A tárolt válasz korábbi ügyállapothoz tartozik. Új ellenőrzött tervezet szükséges; szerkesztése és jóváhagyása itt tiltott.';
  if(draftCurrent&&record.data.state.approval==='pending'&&draft?.text&&
   (record.approvalBlockedReason==='EXACT_REVIEW_EVIDENCE_REQUIRED'||draft.synthetic===true&&draft.reviewStatus==='internal_review_required')){
   const loaded=await review.load(caseId);if(!current(turn))return;
   if(loaded.revision!==record.revision)throw Error('CASE_CONFLICT');
   selected=loaded;canApprove=record.canApproveDraft===true&&!loaded.approvalBlockedReason;
   el('approve-confirm').disabled=!canApprove;
   if(loaded.canEditDraft){editBase=loaded;el('draft-editor').value=loaded.text;el('draft-editor').disabled=false;}
  }
 }catch(error){if(current(turn)){clearDetail();if(['AUTH_REQUIRED','FORBIDDEN'].includes(error.message))failed(error);else el('list-status').textContent='Az ügy most nem tölthető be. Töltse be újra az ügyeket.';}}
}
el('draft-editor').addEventListener('input',()=>{
 review.clear();selected=null;canApprove=false;el('approve-confirm').checked=false;el('approve-confirm').disabled=true;el('approve-draft').disabled=true;
 el('save-draft').disabled=actionBusy||!editBase||el('draft-editor').value===editBase.text||!el('draft-editor').value.trim();
});
el('approve-confirm').addEventListener('change',()=>{el('approve-draft').disabled=actionBusy||!selected||!canApprove||!el('approve-confirm').checked;});
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
  el('detail-status').textContent=kind==='edit'?'Módosítás mentve és visszaolvasva. A jóváhagyó külön nyissa meg újra.':'Belső jóváhagyás mentve és visszaolvasva. Nincs levélküldés vagy foglalás.';
  el('detail-draft').textContent=back.data.drafts.at(-1).text;
 }catch(error){if(current(turn)){
  if(error.message==='AUTH_REQUIRED')failed(error);
  else {clearDetail();el('list-status').textContent=error.message==='FORBIDDEN'?'A művelethez nincs megfelelő jogosultság.':'A mentés eredménye nem igazolt, vagy az ügy közben megváltozott. Töltse be újra; nincs automatikus ismétlés.';}
 }}finally{actionBusy=false;}
}
el('save-draft').addEventListener('click',()=>mutate('edit'));
el('approve-draft').addEventListener('click',()=>mutate('approve'));
async function loadCases({selectAvailable=false}={}){
 if(!authenticated||actionBusy)return;
 clearData('Ügyek ellenőrzése…');const turn=epoch;el('load-cases').disabled=true;
 try{
  const result=await request({tenantId:TENANT,action:'daily-list'},'GET');if(!current(turn))return;
  if(!Array.isArray(result)||result.length>100)throw Error('INVALID_DATA');
  const seen=new Set();
  for(const row of result){if(row?.tenantId!==TENANT||!isIsolatedReviewCaseId(row.caseId)||!Number.isSafeInteger(row.revision)||row.revision<1||!sections[row.category]||seen.has(row.caseId))throw Error('INVALID_DATA');seen.add(row.caseId);}
  rows=result;listLoaded=true;
  if(selectAvailable&&rows.length&&!rows.some(row=>row.category===selectedSection)){
   selectedSection=rows[0].category;
   for(const item of document.querySelectorAll('[data-section]'))item.setAttribute('aria-pressed',String(item.dataset.section===selectedSection));
   el('section-heading').textContent=sections[selectedSection][0];el('section-description').textContent=sections[selectedSection][1];
  }
  renderRows();

 }catch(error){if(current(turn)){
  if(['AUTH_REQUIRED','FORBIDDEN'].includes(error.message))failed(error);
  else {clearData('Az ügykezelési backend most nem elérhető. Később próbálja újra.');}
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
