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
 let generation=0,busy=false,googleApi=null;
 const active=turn=>turn===generation&&canRead()&&documentImpl.visibilityState!=='hidden';
 function clear(){
  generation++;busy=false;el('email-list').replaceChildren();el('email-detail').textContent='';
  el('email-status').textContent='A tesztpostafiók olvasásához jelentkezzen be.';el('read-email').disabled=true;
 }
 function setEnabled(enabled){if(enabled&&!googleApi)void loadGoogleImpl().then(api=>{googleApi=api;}).catch(()=>{});el('read-email').disabled=!enabled||busy;if(enabled&&!busy)el('email-status').textContent='Beolvasás: '+TEST_GMAIL_ACCOUNT+'. A Google külön olvasási engedélyt kér.';}
 function showMessages(messages,turn){
  const fragment=documentImpl.createDocumentFragment();
  for(const message of messages){
   const headers=Object.fromEntries((message.payload?.headers||[]).map(h=>[h.name.toLowerCase(),h.value]));
   const li=documentImpl.createElement('li'),button=documentImpl.createElement('button');button.type='button';
   button.textContent=headers.subject||'(nincs tárgy)';
   button.addEventListener('click',()=>{
    if(!active(turn))return;
    el('email-detail').textContent='Feladó: '+(headers.from||'Nincs megadva')+'\nTárgy: '+(headers.subject||'(nincs tárgy)')+'\n\n'+(gmailReadableBody(message.payload)||'A levélnek nincs olvasható szöveges része.');
   });
   li.append(button);fragment.append(li);
  }
  el('email-list').replaceChildren(fragment);
  el('email-status').textContent=messages.length+' levél beolvasva. Megnyitáshoz érintse meg a tárgyát. A felhős ügykezeléshez való átadás még nem érhető el.';
 }
 el('read-email').addEventListener('click',async()=>{
  if(!canRead()||busy||documentImpl.visibilityState==='hidden')return;
  const turn=++generation;busy=true;el('read-email').disabled=true;
  el('email-list').replaceChildren();el('email-detail').textContent='';
  const finish=()=>{if(active(turn)){busy=false;el('read-email').disabled=false;}};
  const fail=()=>{if(active(turn))el('email-status').textContent='Az e-mail-beolvasás nem sikerült. Ellenőrizze a Google-engedélyt, válassza a Sárberki tesztfiókot, majd próbálja újra. Az Outlook-postafiók itt még nem olvasható.';finish();};
  try{
   el('email-status').textContent='Google-olvasási engedély előkészítése…';
   const google=googleApi;
   if(!google){
    void loadGoogleImpl().then(api=>{googleApi=api;}).catch(()=>{});
    el('email-status').textContent='A Google belépés betöltése folyamatban van. Nyomja meg újra az E-mailek beolvasása gombot.';finish();return;
   }
   if(!clientId||!google?.accounts?.oauth2)throw Error('GOOGLE_UNAVAILABLE');
   const client=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'https://www.googleapis.com/auth/gmail.readonly',hint:TEST_GMAIL_ACCOUNT,include_granted_scopes:false,
    callback:async result=>{
     if(!active(turn))return;
     try{
      if(!result.access_token)throw Error('GOOGLE_AUTH_REQUIRED');
      await restoreSession();if(!active(turn))return;
      el('email-status').textContent='E-mailek beolvasása…';
      const messages=await readInbox(result.access_token,{search:globalThis.location?.search||''});
      if(active(turn))showMessages(messages,turn);
     }catch{fail();}finally{finish();}
    },error_callback:fail});
   client.requestAccessToken({prompt:'consent'});
  }catch{fail();}
 });
 return {clear,setEnabled};
}
