// Explicit, read-only operator login for the synthetic Sárberki test case store.
// Tokens and passwords never enter the browser: the server holds a HttpOnly encrypted cookie.
const endpoint='/.netlify/functions/operator-session';
const tokenPattern=/^[a-f0-9]{64}$/;
export function initOperatorLoginPanel({documentRef=document,globalRef=window,request=fetch}={}){
 const get=id=>documentRef.getElementById(id);
 const form=get('operator_login_form'),email=get('operator_login_email'),password=get('operator_login_password'),
  status=get('operator_login_status'),restore=get('operator_restore'),logout=get('operator_logout'),
  login=get('operator_login');
 if(!form||!email||!password||!status||!restore||!logout||!login)return false;
 let active=false,busy=false;
 const emit=()=>documentRef.dispatchEvent?.(new Event('sarberki:session-changed'));
 const clear=()=>{active=false;globalRef.SarberkiCaseStoreSession=null;logout.disabled=true;emit();};
 const enable=metadata=>{
  const exp=Date.parse(metadata?.expiresAt);
  if(metadata?.authenticated!==true||metadata?.tenantId!=='sarberki-test'||
   !tokenPattern.test(metadata.csrfToken||'')||!Number.isFinite(exp)||exp<=Date.now()||
   exp>Date.now()+8*24*3600*1000)throw Error('INVALID_SESSION');
  const csrfToken=metadata.csrfToken;
  globalRef.SarberkiCaseStoreSession=Object.freeze({
   cookieReadOnly:true,canEditDraft:false,
   getCsrfToken:async()=>csrfToken,request
  });
  active=true;logout.disabled=false;emit();
  status.textContent='Hitelesített tesztkezelői olvasás aktív. Szintetikus ügyek ellenőrizhetők; szerkesztés, jóváhagyás és küldés nem engedélyezett.';
 };
 const waiting=on=>{busy=on;login.disabled=on;restore.disabled=on;logout.disabled=on||!active;};
 async function call(method,body,csrf){
  const response=await request(endpoint,{
   method,cache:'no-store',credentials:'same-origin',redirect:'error',
   headers:{'X-Sarberki-Operator':'1',...(body?{'Content-Type':'application/json'}:{}),
    ...(csrf?{'X-CSRF-Token':csrf}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  const data=await response.json();
  if(!response.ok)throw Error(['AUTH_REQUIRED','FORBIDDEN','SESSION_SETUP_REQUIRED','SESSION_SERVICE_UNAVAILABLE'].includes(data?.error)?data.error:'SESSION_UNAVAILABLE');
  return data;
 }
 const problem=e=>{
  const code=String(e?.message||'');
  if(code==='SESSION_SETUP_REQUIRED')return 'A tesztkörnyezet biztonságos kezelői beállítása még nincs aktiválva.';
  if(code==='AUTH_REQUIRED'||code==='FORBIDDEN')return 'A bejelentkezés vagy jogosultság ellenőrzése nem sikerült.';
  return 'A kezelői munkamenet nem igazolható. Próbáld újra később.';
 };
 async function perform(kind){
  if(busy)return;
  waiting(true);
  try{
   if(kind==='login'){
    const value=email.value.trim(),secret=password.value;
    password.value='';
    if(!value||value.length>254||!secret||secret.length>1024)throw Error('INVALID_INPUT');
    const result=await call('POST',{action:'login',email:value,password:secret});
    enable(result);
   }else if(kind==='restore'){
    enable(await call('GET'));
   }else{
    const csrf=await globalRef.SarberkiCaseStoreSession?.getCsrfToken?.();
    if(!active||!tokenPattern.test(csrf||''))throw Error('AUTH_REQUIRED');
    await call('POST',{action:'logout'},csrf);
    clear();
    status.textContent='A tesztkezelői munkamenet kijelentkeztetve. Nincs küldés vagy foglalás.';
   }
  }catch(e){
   clear();
   status.textContent=kind==='logout'?'A helyi hozzáférés lezárva; a szerveroldali kijelentkezés nem igazolt.':problem(e);
  }finally{password.value='';waiting(false);}
 }
 form.addEventListener('submit',event=>{event.preventDefault();return perform('login');});
 restore.addEventListener('click',()=>perform('restore'));
 logout.addEventListener('click',()=>perform('logout'));
 clear();
 status.textContent='Nincs igazolt tesztkezelői munkamenet. A belépés csak a szintetikus ügyek olvasását teszi lehetővé.';
 return true;
}
if(typeof document!=='undefined'&&typeof window!=='undefined')initOperatorLoginPanel();
