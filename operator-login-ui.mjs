// Explicit, read-only operator login for the synthetic Sárberki test case store.
// The password travels only to the Auth server; access/refresh tokens never enter the browser.
import {createCaseStoreClient} from './shared-core/case-store-client.mjs';
import {isIsolatedReviewCaseId} from './shared-core/isolated-review-case-id.mjs';
const endpoint='/.netlify/functions/operator-session';
const tokenPattern=/^[a-f0-9]{64}$/;
export function initOperatorLoginPanel({documentRef=document,globalRef=window,request=fetch}={}){
 const get=id=>documentRef.getElementById(id);
 const form=get('operator_login_form'),email=get('operator_login_email'),password=get('operator_login_password'),
  status=get('operator_login_status'),restore=get('operator_restore'),logout=get('operator_logout'),
  login=get('operator_login'),listCases=get('operator_list_cases'),caseSelect=get('operator_case_select'),
  openCase=get('operator_open_case'),caseStatus=get('operator_case_status');
 if(!form||!email||!password||!status||!restore||!logout||!login||!listCases||!caseSelect||!openCase||!caseStatus)return false;
 let active=false,busy=false,listed=[];
 const emit=()=>documentRef.dispatchEvent?.(new Event('sarberki:session-changed'));
 const resetCases=()=>{listed=[];caseSelect.replaceChildren();caseSelect.disabled=true;openCase.disabled=true;caseStatus.textContent='Csak hitelesített, szintetikus tesztügyek jelenhetnek meg.';};
 const clear=()=>{active=false;globalRef.SarberkiCaseStoreSession=null;logout.disabled=true;listCases.disabled=true;resetCases();emit();};
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
  active=true;logout.disabled=false;listCases.disabled=false;resetCases();emit();
  status.textContent='Hitelesített tesztkezelői olvasás aktív. Szintetikus ügyek ellenőrizhetők; szerkesztés, jóváhagyás és küldés nem engedélyezett.';
 };
 const waiting=on=>{busy=on;login.disabled=on;restore.disabled=on;logout.disabled=on||!active;listCases.disabled=on||!active;openCase.disabled=on||listed.length===0;};
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
 // A normal load restores once below. Only a bfcache return needs pageshow
 // revalidation; the existing busy gate prevents concurrent cookie rotation.
 globalRef.addEventListener?.('pageshow',event=>{
  if(event.persisted)return perform('restore');
 });
 clear();
 void perform('restore');
 return true;
}
if(typeof document!=='undefined'&&typeof window!=='undefined')initOperatorLoginPanel();
