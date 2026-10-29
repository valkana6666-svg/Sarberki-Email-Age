import {createOperatorSession} from '../sarberki-chatbot-project/operator-session.mjs';
import {createCaseStoreClient} from '../shared-core/case-store-client.mjs';
import {createCookieJsonRequest} from '../shared-core/cookie-json-request.mjs';
import {isIsolatedReviewCaseId} from '../shared-core/isolated-review-case-id.mjs';
import {createServerChatClient} from '../sarberki-chatbot-project/remote-chat-client.mjs';

const TEST_ORIGIN='https://leafy-chimera-2403e5.netlify.app';
const TENANT='sarberki-test';
const MAX_DISPLAY_MS=30000;
const sections=Object.freeze({
 incoming:['Beérkezett ügyek','Új vendégüzenetek és feldolgozásra váró megkeresések.'],
 approval:['Jóváhagyásra vár','Átnézendő választervezetek.'],
 progress:['Folyamatban','Pontosításra vagy ellenőrzésre váró ügyek.'],
 closed:['Lezárt ügyek','Korábban lezárt érdeklődések.']
});
const el=id=>document.getElementById(id);
for(const button of document.querySelectorAll('[data-section]'))button.addEventListener('click',()=>{
 const value=sections[button.dataset.section];if(!value)return;
 for(const item of document.querySelectorAll('[data-section]'))item.setAttribute('aria-pressed',String(item===button));
 el('section-heading').textContent=value[0];el('section-description').textContent=value[1];
});

const session=createOperatorSession();
const client=createCaseStoreClient({cookieReadOnly:true,
 getCsrfToken:async()=>(await session.restore()).csrfToken,
 request:createCookieJsonRequest()});
let authenticated=false,epoch=0,expiryTimer=null;
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
 el('case-detail').hidden=true;
 for(const id of ['detail-status','detail-summary','detail-capacity','detail-price','detail-draft'])el(id).textContent='';
 el('detail-link').href='../cloud-approval.html';
}
function clearData(message='A listához jelentkezzen be.'){
 epoch++;if(expiryTimer!==null)clearTimeout(expiryTimer);expiryTimer=null;
 el('case-list').replaceChildren();clearDetail();el('list-status').textContent=message;
}
function expireData(){clearData('Az adatok frissessége nem igazolt. Töltse be újra az ügyeket.');}
function startExpiry(){if(expiryTimer!==null)clearTimeout(expiryTimer);expiryTimer=setTimeout(expireData,MAX_DISPLAY_MS);}
function sessionUI(isAuthenticated,message){
 authenticated=isAuthenticated;el('session-status').textContent=message;
 el('login').hidden=isAuthenticated;el('logout').hidden=!isAuthenticated;
 el('load-cases').disabled=!isAuthenticated;
 el('chat-input').disabled=!isAuthenticated;el('chat-send').disabled=!isAuthenticated||chatBusy;
 el('chat-reset').disabled=!isAuthenticated;
}
function lockSession(message){
 resetChat();session.clear();clearData();el('password').value='';
 sessionUI(false,message);
}
function current(turn){return turn===epoch&&authenticated&&document.visibilityState!=='hidden';}
function failed(error){
 lockSession(error?.message==='FORBIDDEN'?'Ehhez a művelethez nincs megfelelő jogosultság.':
 error?.message==='AUTH_REQUIRED'?'A bejelentkezés szükséges vagy lejárt.':'Az adatok most nem ellenőrizhetők. Próbálja újra.');
}
async function resume(){
 if(location.origin!==TEST_ORIGIN){lockSession('A kapcsolat csak a kijelölt tesztoldalon használható.');return;}
 if(document.visibilityState==='hidden')return;
 const turn=epoch;
 try{await session.restore();if(turn!==epoch||document.visibilityState==='hidden')return;
  sessionUI(true,'Bejelentkezve. Az ügyeket külön kell betölteni.');
 }catch(error){if(turn===epoch)failed(error);}
}
el('login').addEventListener('submit',async event=>{
 event.preventDefault();
 if(location.origin!==TEST_ORIGIN){lockSession('A kapcsolat csak a kijelölt tesztoldalon használható.');return;}
 const email=el('email').value.trim(),password=el('password').value;
 el('password').value='';resetChat();session.clear();clearData();const turn=epoch;
 sessionUI(false,'Bejelentkezés ellenőrzése…');
 try{await session.login(email,password);if(turn===epoch&&document.visibilityState!=='hidden')sessionUI(true,'Bejelentkezve. Az ügyeket külön kell betölteni.');}
 catch(error){if(turn===epoch)failed(error);}
});
el('logout').addEventListener('click',async()=>{
 resetChat();clearData();const turn=epoch;sessionUI(false,'Kijelentkezés ellenőrzése…');
 try{await session.logout();if(turn===epoch&&!authenticated)el('session-status').textContent='Kijelentkezve.';}
 catch{if(turn===epoch&&!authenticated)el('session-status').textContent='A kijelentkezés nem ellenőrizhető. Próbálja újra.';}
});
function validateRows(rows){
 if(!Array.isArray(rows)||rows.length>100)throw Error('INVALID_DATA');
 const seen=new Set();
 for(const row of rows){
  if(!row||Object.keys(row).sort().join(',')!=='caseId,revision,tenantId'||row.tenantId!==TENANT||
   !isIsolatedReviewCaseId(row.caseId)||!Number.isSafeInteger(row.revision)||row.revision<1||seen.has(row.caseId))throw Error('INVALID_DATA');
  seen.add(row.caseId);
 }
 return rows;
}
async function openCase(caseId){
 if(!authenticated||!isIsolatedReviewCaseId(caseId))return;
 clearDetail();const turn=++epoch;el('case-detail').hidden=false;el('detail-status').textContent='Ügy ellenőrzése…';
 try{
  await session.restore();if(!current(turn))return;
  const result=await session.loadCase(caseId);if(!current(turn))return;
  if(result.caseId!==caseId||result.fresh!==true||!Number.isSafeInteger(result.revision)||typeof result.operatorReviewText!=='string'||typeof result.draft!=='string'||typeof result.capacity!=='string'||typeof result.price!=='string')throw Error('INVALID_DATA');
  el('detail-status').textContent='Ellenőrzött olvasói előnézet. Az adatok változhatnak; szükség esetén töltse be újra.';
  el('detail-summary').textContent=result.operatorReviewText;
  el('detail-capacity').textContent=result.capacity;
  el('detail-price').textContent=result.price;
  el('detail-draft').textContent=result.draft||'Ellenőrzött vendégtervezet még nem áll rendelkezésre.';
  el('detail-link').href='../cloud-approval.html?'+new URLSearchParams({caseId});
  startExpiry();
 }catch(error){if(current(turn))failed(error);}
}
el('load-cases').addEventListener('click',async()=>{
 if(!authenticated)return;
 clearData('Ügyek ellenőrzése…');const turn=epoch;el('load-cases').disabled=true;
 try{
  const rows=validateRows(await client.list(TENANT));if(!current(turn))return;
  if(!rows.length){el('list-status').textContent='Az elérhető tesztügyek listája jelenleg üres.';startExpiry();return;}
  const fragment=document.createDocumentFragment();
  rows.forEach((row,index)=>{
   const li=document.createElement('li'),label=document.createElement('span'),button=document.createElement('button');
   label.textContent='Tesztügy '+(index+1);button.type='button';button.textContent='Megnyitás';
   button.setAttribute('aria-label','Tesztügy '+(index+1)+' megnyitása');
   button.addEventListener('click',()=>openCase(row.caseId));li.append(label,button);fragment.append(li);
  });
  el('case-list').replaceChildren(fragment);el('list-status').textContent='Ügyek betöltve. Az adatok változhatnak; a kategóriák még nem szűrik a listát.';startExpiry();
 }catch(error){if(current(turn))failed(error);}
 finally{if(current(turn))el('load-cases').disabled=false;}
});
function suspend(){lockSession('A nézet lezárult. Visszatéréskor a munkamenetet újra ellenőrizzük.');}
addEventListener('pagehide',suspend);
addEventListener('pageshow',event=>{if(event.persisted)void resume();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')suspend();else void resume();});
void resume();
