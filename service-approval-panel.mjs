// Human review only. Server proofs, keys and binding providers never enter this module.
export function initServiceApprovalPanel({documentRef=document,sessionProvider=()=>window.SarberkiCaseStoreSession}={}){
 const get=id=>documentRef.getElementById(id),read=get('service_approval_read'),approve=get('service_approval_action'),status=get('service_approval_status'),preview=get('service_approval_preview');
 if(!read||!approve||!status||!preview)return false;
 let epoch=0,active=null,busy=false;
 const selection=()=>JSON.stringify([get('server_preview_case_id')?.value.trim(),Number(get('server_preview_revision')?.value)]);
 const clear=()=>{epoch++;active=null;busy=false;approve.hidden=true;approve.disabled=true;read.disabled=false;preview.textContent='Nincs aktuális, emberileg ellenőrizhető szolgáltatásbizonyíték.';status.textContent='Dézsajóváhagyás: NEM IGAZOLT.';};
 for(const id of ['server_preview_case_id','server_preview_revision'])get(id)?.addEventListener('input',clear);
 for(const event of ['sarberki:session-changed','isolated-approval-session-changed'])documentRef.addEventListener?.(event,clear);
 async function call(method,body,session,valid){
  const csrf=await session.getCsrfToken();if(!valid())return null;
  const response=await (session.request||fetch)('/.netlify/functions/booking-cases'+(method==='GET'?'?'+new URLSearchParams(body):''),{method,credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json','X-Sarberki-Operator':'1','X-CSRF-Token':csrf},...(method==='POST'?{body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!valid())return null;
  if(!response.ok)throw Error(['FORBIDDEN','AUTH_REQUIRED','CASE_CONFLICT','REVIEW_CHANGED','SERVICE_AVAILABILITY_UNKNOWN'].includes(data?.error)?data.error:'SERVICE_UNAVAILABLE');
  return data.result;
 }
 read.addEventListener('click',async()=>{
  if(busy)return;clear();const turn=epoch,key=selection(),session=sessionProvider(),[caseId,revision]=JSON.parse(key);
  const valid=()=>epoch===turn&&selection()===key&&sessionProvider()===session;
  if(session?.cookieReadOnly!==true||typeof session.getCsrfToken!=='function'||!caseId||!Number.isSafeInteger(revision)||revision<1)return;
  busy=true;read.disabled=true;
  try{
   const data=await call('GET',{tenantId:'sarberki-test',action:'service-approval-state',caseId,expectedRevision:revision},session,valid);if(!valid()||!data)return;
   const labels={unapproved:'Nincs szolgáltatás-jóváhagyás.',current:'Aktuális belső szolgáltatás-jóváhagyás; ez nem foglalás vagy küldés.',stale:'Elavult; új ellenőrzés szükséges.',expired:'Lejárt bizonyíték; új ellenőrzés szükséges.',unverified:'Elérhetőség NEM IGAZOLT.'};
   status.textContent=labels[data.status]||'NEM IGAZOLT.';
   const p=data.preview;
   if(data.canApproveService===true&&p&&/^[a-f0-9]{64}$/.test(p.hash)){
    preview.textContent='Ellenőrizendő: '+p.houseNumber+'. ház · '+p.resourceId+' · '+p.start+' → '+p.end+' · '+p.timezone+' · forrás: '+p.sourceId+' · bizonyíték: '+p.evidenceReference+'/'+p.version+' · házkötés: '+p.bindingReference+'/'+p.bindingVersion;
    active={turn,key,session,caseId,revision,hash:p.hash};approve.hidden=false;approve.disabled=false;
   }
  }catch(error){if(valid())status.textContent='Ellenőrzés nem igazolt: '+error.message;}
  finally{if(valid()){busy=false;read.disabled=false;}}
 });
 approve.addEventListener('click',async()=>{
  const a=active;if(busy||!a)return;
  const valid=()=>epoch===a.turn&&selection()===a.key&&sessionProvider()===a.session;
  if(!valid())return;busy=true;approve.disabled=true;read.disabled=true;
  try{
   const data=await call('POST',{tenantId:'sarberki-test',action:'approve-service',caseId:a.caseId,expectedRevision:a.revision,servicePreviewHash:a.hash},a.session,valid);if(!valid()||!data)return;
   if(!Number.isSafeInteger(data.approval_id)||data.approval_id<1||data.case_id!==a.caseId||data.payload?.caseRevision!==a.revision||data.payload?.previewHash!==a.hash)throw Error('SERVICE_UNAVAILABLE');
   clear();status.textContent='Külön belső dézsajóváhagyás rögzítve. Az ügyverzió változatlan; állapotát frissen kérdezze le. Nincs foglalás vagy küldés.';
  }catch(error){if(valid()){clear();status.textContent='Jóváhagyás nem igazolt: '+error.message+'. Új előnézet szükséges.';}}
  finally{if(valid()){busy=false;read.disabled=false;}}
 });
 clear();return true;
}
if(typeof document!=='undefined')initServiceApprovalPanel();
