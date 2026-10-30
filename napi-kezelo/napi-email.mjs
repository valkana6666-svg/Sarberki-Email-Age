import {readTestGmailInbox,TEST_GMAIL_ACCOUNT,gmailReadableBody} from '../gmail-policy.mjs';

let googleLoader;
function loadGoogle(){
 if(globalThis.google?.accounts?.oauth2)return Promise.resolve(globalThis.google);
 if(!googleLoader)googleLoader=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
  script.onload=()=>resolve(globalThis.google);script.onerror=()=>{googleLoader=null;reject(Error('GOOGLE_UNAVAILABLE'));};
  document.head.append(script);
 });
 return googleLoader;
}
// Separate mailbox reading from cloud case writes. Reuses the existing readonly
// transport and account policy; no tokens or message bodies are persisted.
export function createDailyEmailReader({canRead,restoreSession,loadGoogleImpl=loadGoogle,readInbox=readTestGmailInbox,documentImpl=document,clientId}={}){
 const el=id=>documentImpl.getElementById(id);
 let generation=0,busy=false,googleApi=null,chooseMessage=null,pendingConsent=false,queuedConsent=null,consentTimer=null;
 const active=turn=>turn===generation&&canRead()&&documentImpl.visibilityState!=='hidden';
 function clearPicker(){
  chooseMessage=null;const placeholder=documentImpl.createElement('option');placeholder.value='';placeholder.textContent='Még nincs beolvasott e-mail';el('email-picker').replaceChildren(placeholder);el('email-picker').disabled=true;el('email-picker-wrap').hidden=false;
  el('email-previous').disabled=true;el('email-next').disabled=true;
 }
 el('email-picker').addEventListener('change',()=>chooseMessage?.(Number(el('email-picker').value)));
 el('email-previous').addEventListener('click',()=>chooseMessage?.(Number(el('email-picker').value)-1));
 el('email-next').addEventListener('click',()=>chooseMessage?.(Number(el('email-picker').value)+1));
 function clear(){
  clearPicker();
  generation++;busy=false;pendingConsent=false;queuedConsent=null;clearTimeout(consentTimer);consentTimer=null;el('email-list').replaceChildren();el('email-detail').textContent='';
  el('email-status').textContent='A tesztpostafiók olvasásához jelentkezzen be.';el('read-email').disabled=true;
 }
 function setEnabled(enabled){if(enabled&&!googleApi)void loadGoogleImpl().then(api=>{googleApi=api;}).catch(()=>{});el('read-email').disabled=!enabled||busy;if(enabled&&queuedConsent)void processConsent();if(enabled&&!busy)el('email-status').textContent='Beolvasás: '+TEST_GMAIL_ACCOUNT+'. A Google külön olvasási engedélyt kér.';}
 function showMessages(messages,turn){
  const fragment=documentImpl.createDocumentFragment(),options=documentImpl.createDocumentFragment(),buttons=[];
  const headers=messages.map(message=>Object.fromEntries((message.payload?.headers||[]).map(h=>[h.name.toLowerCase(),h.value])));
  const open=index=>{
   if(!active(turn)||!Number.isInteger(index)||index<0||index>=messages.length)return;
   const message=messages[index],header=headers[index];
   el('email-picker').value=String(index);
   buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
   el('email-previous').disabled=index===0;el('email-next').disabled=index===messages.length-1;
   let body;
   try{body=gmailReadableBody(message.payload)||'A levélnek nincs olvasható szöveges része.';}
   catch{body='A levél szövege nem jeleníthető meg. Válasszon másik levelet a listából.';}
   el('email-detail').textContent='Feladó: '+(header.from||'Nincs megadva')+'\nTárgy: '+(header.subject||'(nincs tárgy)')+'\n\n'+body;
  };
  messages.forEach((message,index)=>{
   const li=documentImpl.createElement('li'),button=documentImpl.createElement('button'),option=documentImpl.createElement('option');button.type='button';
   const header=headers[index],label=(index+1)+'. '+(header.subject||'(nincs tárgy)')+' — '+(header.from||'Ismeretlen feladó');
   button.textContent=label;button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>open(index));buttons.push(button);
   option.value=String(index);option.textContent=label;options.append(option);li.append(button);fragment.append(li);
  });
  chooseMessage=open;el('email-picker').replaceChildren(options);el('email-picker').disabled=!messages.length;el('email-picker-wrap').hidden=false;
  el('email-list').replaceChildren(fragment);
  el('email-status').textContent=messages.length+' levél beolvasva. Válasszon levelet a választóból vagy a görgethető listából. A felhős ügykezeléshez való átadás még nem érhető el.';
  if(messages.length)open(0);
 }
 function finish(){busy=false;pendingConsent=false;queuedConsent=null;clearTimeout(consentTimer);consentTimer=null;el('read-email').disabled=!canRead();}
 function fail(error){
  const code=error?.type||error?.error||error?.message;
  const messages={popup_failed_to_open:'A Google-belépési ablak nem nyílt meg. Nyissa meg ezt az oldalt Safariban, majd próbálja újra.',popup_closed:'A Google-belépési ablak bezárult. Nyomja meg újra az E-mailek beolvasása gombot.',access_denied:'A Google-olvasási engedélyt nem adta meg. A levelek nem kerültek beolvasásra.',AUTH_REQUIRED:'A kezelői bejelentkezés lejárt. Jelentkezzen be újra.',GOOGLE_UNAVAILABLE:'A Google belépési szolgáltatása nem érhető el. Nyissa meg az oldalt Safariban, majd próbálja újra.',CONSENT_TIMEOUT:'A Google-engedélyezés nem fejeződött be. Indítsa újra az E-mailek beolvasása gombbal.'};
  el('email-status').textContent=messages[code]||(String(code).includes('429')?'A Gmail átmenetileg korlátozta az olvasást. Várjon néhány percet, majd próbálja újra.':'Az e-mail-beolvasás nem sikerült. Válassza a sarberkiprojecttest@gmail.com fiókot, és ellenőrizze a Google olvasási engedélyét.');
  finish();
 }
 async function processConsent(){
  const consent=queuedConsent;if(!consent||!active(consent.turn))return;
  queuedConsent=null;pendingConsent=false;clearTimeout(consentTimer);consentTimer=null;
  const {turn,result}=consent;
  try{
   if(!result.access_token)throw result;
   await restoreSession();if(!active(turn))return;
   el('email-status').textContent='E-mailek beolvasása…';
   const messages=await readInbox(result.access_token,{search:globalThis.location?.search||''});
   if(active(turn))showMessages(messages,turn);
  }catch(error){if(active(turn))fail(error);}finally{if(active(turn))finish();}
 }
 // Opening the Google popup may hide the main page on iPhone. Drop displayed
 // data, but retain only the pending consent attempt until fresh operator auth
 // on return. Explicit logout/pagehide always invalidates it through clear().
 function suspend(){
  if(!pendingConsent){clear();return;}
  clearPicker();el('email-list').replaceChildren();el('email-detail').textContent='';el('read-email').disabled=true;
  el('email-status').textContent='Google-engedélyezés folyamatban. Visszatéréskor ellenőrizzük a belépést, majd betöltjük a leveleket.';
 }
 el('read-email').addEventListener('click',()=>{
  if(!canRead()||busy||documentImpl.visibilityState==='hidden')return;
  clearPicker();const turn=++generation;busy=true;el('read-email').disabled=true;
  el('email-list').replaceChildren();el('email-detail').textContent='';
  const failure=error=>{if(turn===generation)fail(error);};
  try{
   el('email-status').textContent='Google-olvasási engedély előkészítése…';
   const google=googleApi;
   if(!google){
    void loadGoogleImpl().then(api=>{googleApi=api;if(active(turn))el('email-status').textContent='A Google-belépés betöltődött. Nyomja meg az E-mailek beolvasása gombot.';}).catch(failure);
    el('email-status').textContent='A Google-belépés betöltése folyamatban van. Ezután nyomja meg újra az E-mailek beolvasása gombot.';finish();return;
   }
   if(!clientId||!google?.accounts?.oauth2)throw Error('GOOGLE_UNAVAILABLE');
   const client=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'https://www.googleapis.com/auth/gmail.readonly',hint:TEST_GMAIL_ACCOUNT,include_granted_scopes:false,
    callback:result=>{
     if(turn!==generation)return;
     queuedConsent={turn,result};return processConsent();
    },error_callback:failure});
   pendingConsent=true;el('email-status').textContent='A Google-ablakban válassza a sarberkiprojecttest@gmail.com fiókot, és engedélyezze a levelek olvasását.';
   consentTimer=setTimeout(()=>failure(Error('CONSENT_TIMEOUT')),120000);
   client.requestAccessToken({prompt:'consent'});
  }catch(error){failure(error);}
 });
 return {clear,setEnabled,suspend};
}
