import {readTestGmailInbox,TEST_GMAIL_ACCOUNT,gmailReadableBody,isTestInquiry} from '../gmail-policy.mjs';
import {TEST_SUBJECT_PREFIXES} from '../gmail-subject.mjs';
import {buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';
import {closedMailRequestFromGmailRecord} from '../shared-core/synthetic-mail-fixtures.mjs';
import {languageFromText} from '../sarberki-core.mjs';

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
const missingLabels={dates:'pontos érkezési és távozási dátum',dates_confirmation:'a dátum megerősítése',accommodation:'háztípus',adults:'felnőttek száma',
 children_status:'érkezik-e gyermek',child_ages:'gyermekek életkora',units_requested:'kért egységszám',current_date:'aktuális dátum'};
// Previewable: the closed fictional registry, or a verified test-mailbox message whose subject
// starts with the existing test marker. The marker must lead the subject, so Re:/Fwd: replies with
// quoted threads are excluded. Any other mailbox content needs separate approval.
const MAX_PREVIEW_CHARS=20000;
function markedTestSubject(subject){
 if(typeof subject!=='string')return false;
 const normalized=subject.trim().toLocaleLowerCase('hu-HU').replace(/\s+/gu,' ');
 return TEST_SUBJECT_PREFIXES.some(prefix=>normalized===prefix||normalized.startsWith(prefix+' '));
}
function previewText(message,header,body){
 const closed=closedPreviewText(message,header,body);if(closed)return closed;
 return isTestInquiry(message)&&markedTestSubject(header.subject)&&body.trim()&&body.length<=MAX_PREVIEW_CHARS?body:null;
}
function closedPreviewText(message,header,body){
 try{
  const from=(/<([^<>\s]+)>\s*$/.exec(header.from||'')?.[1]||'').toLowerCase();
  return closedMailRequestFromGmailRecord({source:{provider:'gmail',from_email:from,message_id:message.id,thread_id:message.threadId,
   received_at:new Date(Number(message.internalDate)).toISOString(),subject:header.subject},original_message:body}).envelope.text;
 }catch{return null;}
}
// Separate mailbox reading from cloud case writes. Reuses the existing readonly
// transport and account policy; no tokens are persisted. The snapshot is encrypted by the daily view.
export function createDailyEmailReader({canRead,restoreSession,loadGoogleImpl=loadGoogle,readInbox=readTestGmailInbox,documentImpl=document,clientId,now=()=>new Date(),onChange=()=>{}}={}){
 const el=id=>documentImpl.getElementById(id);
 let generation=0,busy=false,googleApi=null,chooseMessage=null,pendingConsent=false,queuedConsent=null,consentTimer=null,previewSource=null,previewTurn=0,previewPending=false,shown=null,selectedIndex=-1;
 const active=turn=>turn===generation&&canRead()&&documentImpl.visibilityState!=='hidden';
 // Local, unsaved reply preview from the shared email adapter. No request, storage or case transition.
 function clearPreview(source=null){
  previewTurn++;previewSource=source;
  el('email-draft-text').value='';el('email-draft-text').disabled=true;el('email-draft-review').textContent='';el('email-draft-checks').replaceChildren();
  el('email-draft-request').disabled=!source||!canRead();
  el('email-draft-status').textContent=source?'AI-válaszjavaslat kérhető. Helyi előnézet lesz: nincs mentve, nem küldhető, nem foglalás.':
   'Az AI-válaszjavaslat jelenleg csak a lezárt szintetikus tesztlevelekhez és a tesztpostafiók „Sárberki élő teszt” tárgyú leveleihez érhető el (válasz/továbbítás nem); más levélhez külön jóváhagyás szükséges.';
 }
 function showPreview(draft){
  const d=draft.decision,items=[...d.missing.map(code=>'Hiányzó adat: '+(missingLabels[code]||code)),...d.contradictions.map(c=>'Ellentmondás: '+c.message),
   'Kapacitás: '+(d.capacity?.verified?'típusszinten igazolt, ajánlat előtt újra ellenőrizendő':'nem igazolt'),'Ár: '+(d.pricing?.verified?'igazolt összetevők':'nem igazolt'),
   'Emberi jóváhagyás szükséges; ez nem mentett ügy, nem küldés és nem foglalás.'];
  el('email-draft-checks').replaceChildren(...items.map(text=>{const li=documentImpl.createElement('li');li.textContent=text;return li;}));
  el('email-draft-text').value=draft.text;el('email-draft-text').disabled=false;el('email-draft-review').textContent=draft.operatorReviewText;
  el('email-draft-status').textContent='Helyi előnézet a közös döntési magból: nincs mentve, nem küldhető, nem foglalás. A szöveg itt szerkeszthető; csak titkosított, 30 percig érvényes helyi másolat készül.';
  onChange();
 }
 el('email-draft-text').addEventListener('input',()=>onChange());
 el('email-draft-request').addEventListener('click',async()=>{
  const source=previewSource,turn=generation;
  if(!source||!active(turn))return;
  const request=++previewTurn;previewPending=true;el('email-draft-request').disabled=true;el('email-draft-status').textContent='Munkamenet ellenőrzése…';
  try{
   try{await restoreSession();}
   catch{if(request===previewTurn&&active(turn)){clearPreview(source);el('email-draft-status').textContent='A kezelői munkamenet lejárt vagy nem ellenőrizhető. Jelentkezzen be újra; automatikus újrapróbálás nincs.';}return;}
   if(request!==previewTurn||source!==previewSource||!active(turn))return;
   showPreview(buildEmailInquiryDraft({message:source.text,language:languageFromText(source.text),now:now(),tenantId:'sarberki-test'}));
  }finally{if(request===previewTurn)previewPending=false;}
 });
 function clearPicker(){
  chooseMessage=null;clearPreview();const placeholder=documentImpl.createElement('option');placeholder.value='';placeholder.textContent='Még nincs beolvasott e-mail';el('email-picker').replaceChildren(placeholder);el('email-picker').disabled=true;el('email-picker-wrap').hidden=false;
  el('email-previous').disabled=true;el('email-next').disabled=true;
 }
 el('email-picker').addEventListener('change',()=>chooseMessage?.(Number(el('email-picker').value)));
 el('email-previous').addEventListener('click',()=>chooseMessage?.(Number(el('email-picker').value)-1));
 el('email-next').addEventListener('click',()=>chooseMessage?.(Number(el('email-picker').value)+1));
 function clear(){
  clearPicker();
  generation++;busy=false;pendingConsent=false;queuedConsent=null;clearTimeout(consentTimer);consentTimer=null;el('email-list').replaceChildren();el('email-detail').textContent='';
  shown=null;selectedIndex=-1;onChange();
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
   let body,readable=null;selectedIndex=index;
   try{
    // A restored message carries its already decoded text (null when it was unreadable).
    if(Object.hasOwn(message,'restoredText')&&message.restoredText===null)throw Error('UNREADABLE');
    readable=Object.hasOwn(message,'restoredText')?message.restoredText:gmailReadableBody(message.payload);body=readable||'A levélnek nincs olvasható szöveges része.';
   }
   catch{readable=null;body='A levél szövege nem jeleníthető meg. Válasszon másik levelet a listából.';}
   const text=readable&&previewText(message,header,readable);clearPreview(text?{text}:null);
   el('email-detail').textContent='Feladó: '+(header.from||'Nincs megadva')+'\nTárgy: '+(header.subject||'(nincs tárgy)')+'\n\n'+body;
   onChange();
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
  shown=messages;if(messages.length)open(0);
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
   client.requestAccessToken({prompt:''});
  }catch(error){failure(error);}
 });
 // App switch: keep the read list, selection and local preview in memory (never stored).
 // A pending Google consent or read keeps the existing suspend path; a pending preview is dropped.
 function conceal(){
  if(pendingConsent||busy){suspend();return;}
  if(previewPending){previewPending=false;clearPreview(previewSource);}
 }
 function reveal(){el('read-email').disabled=!canRead()||busy;if(queuedConsent)void processConsent();}
 // Snapshot for the daily view's encrypted, session-bound local copy: decoded text only, never tokens.
 function snapshot(){
  if(!shown?.length)return null;
  const messages=shown.map(message=>{
   const h=Object.fromEntries((message.payload?.headers||[]).map(x=>[x.name.toLowerCase(),x.value]));
   let text=null;try{text=Object.hasOwn(message,'restoredText')?message.restoredText:gmailReadableBody(message.payload);}catch{}
   return {id:message.id,threadId:message.threadId,labelIds:message.labelIds,internalDate:message.internalDate,subject:h.subject??null,from:h.from??null,text};
  });
  const previewShown=previewSource&&!el('email-draft-text').disabled;
  return {messages,selected:selectedIndex,preview:previewShown?{text:el('email-draft-text').value,review:el('email-draft-review').textContent,
   checks:Array.from(el('email-draft-checks').children,child=>child.textContent)}:null};
 }
 const str=(v,max)=>typeof v==='string'&&v.length<=max;
 function restoreSnapshot(snap){
  if(!canRead()||busy||!snap||!Array.isArray(snap.messages)||!snap.messages.length||snap.messages.length>1000)return false;
  const valid=snap.messages.every(m=>str(m.id,128)&&(m.threadId==null||str(m.threadId,128))&&Array.isArray(m.labelIds)&&m.labelIds.every(x=>str(x,64))&&str(m.internalDate,20)&&
   (m.subject==null||str(m.subject,2000))&&(m.from==null||str(m.from,2000))&&(m.text===null||str(m.text,200000)));
  if(!valid||!Number.isInteger(snap.selected))return false;
  const messages=snap.messages.map(m=>({id:m.id,threadId:m.threadId,labelIds:m.labelIds,internalDate:m.internalDate,restoredText:m.text,
   payload:{headers:[...(m.subject==null?[]:[{name:'Subject',value:m.subject}]),...(m.from==null?[]:[{name:'From',value:m.from}])]}}));
  clearPicker();const turn=++generation;showMessages(messages,turn);
  if(snap.selected>=0&&snap.selected<messages.length)chooseMessage?.(snap.selected);
  const p=snap.preview;
  // The preview is restored only where the current gate still allows a preview for this message.
  if(p&&previewSource&&str(p.text,20000)&&str(p.review,40000)&&Array.isArray(p.checks)&&p.checks.length<=40&&p.checks.every(x=>str(x,1000))){
   el('email-draft-checks').replaceChildren(...p.checks.map(text=>{const li=documentImpl.createElement('li');li.textContent=text;return li;}));
   el('email-draft-text').value=p.text;el('email-draft-text').disabled=false;el('email-draft-review').textContent=p.review;
   el('email-draft-status').textContent='Helyi előnézet visszaállítva (titkosított, 30 percig érvényes helyi másolat): nincs mentve ügyként, nem küldhető, nem foglalás.';
  }
  el('email-status').textContent=messages.length+' levél visszaállítva a titkosított, 30 percig érvényes helyi másolatból. Új levelekhez olvassa be újra a postafiókot.';
  onChange();return true;
 }
 return {clear,setEnabled,suspend,conceal,reveal,snapshot,restoreSnapshot};
}
