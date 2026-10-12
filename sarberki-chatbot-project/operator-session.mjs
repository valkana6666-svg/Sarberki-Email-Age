import {createCaseStoreClient} from '../shared-core/case-store-client.mjs';
import {isIsolatedReviewCaseId} from '../shared-core/isolated-review-case-id.mjs';
import {assertCurrentEvidence} from '../shared-core/availability-model.mjs';
import {renderCentralConversation} from '../shared-core/inquiry-channel-adapters.mjs';
const project='https://mojnqizbcaczstguikpv.supabase.co',tenant='sarberki-test';
const claims=value=>{try{return JSON.parse(atob(value.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{return null;}};
function publicKey(key){return typeof key==='string'&&( /^sb_publishable_[A-Za-z0-9_-]{10,200}$/.test(key)||claims(key)?.role==='anon');}
export function createOperatorSession({request=fetch,now=()=>Date.now()}={}){
 let token='',expiry=0,epoch=0;
 const logout=()=>{epoch++;token='';expiry=0;};
 const getAccessToken=()=>{if(!token||now()>=expiry){logout();throw Error('AUTH_REQUIRED');}return token;};
 return Object.freeze({logout,
  async login(email,password){
   logout();const turn=epoch;
   if(typeof email!=='string'||!email.includes('@')||email.length>254||typeof password!=='string'||!password||password.length>1024)throw Error('INVALID_INPUT');
   const response=await request('/.netlify/functions/chatbot-test-config',{method:'GET',cache:'no-store',credentials:'omit',redirect:'error'});
   if(!response.ok)throw Error('SETUP_REQUIRED');const config=await response.json();
   if(config?.enabled!==true||config.syntheticOnly!==true||config.tenantId!==tenant||config.supabaseUrl!==project||!publicKey(config.publishableKey))throw Error('SETUP_REQUIRED');
   if(turn!==epoch)throw Error('SESSION_CHANGED');
   const auth=await request(project+'/auth/v1/token?grant_type=password',{method:'POST',cache:'no-store',credentials:'omit',redirect:'error',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
   if(!auth.ok)throw Error('AUTH_REQUIRED');const body=await auth.json(),jwt=claims(body?.access_token);
   if(turn!==epoch)throw Error('SESSION_CHANGED');
   if(typeof body.access_token!=='string'||jwt?.role!=='authenticated'||!jwt.sub||jwt.sub!==body.user?.id||!Number.isFinite(jwt.exp)||jwt.exp*1000<=now())throw Error('AUTH_REQUIRED');
   token=body.access_token;expiry=jwt.exp*1000;return {authenticated:true,tenantId:tenant};
  },
  async loadCase(caseId){
   const turn=++epoch;if(!isIsolatedReviewCaseId(caseId))throw Error('INVALID_INPUT');getAccessToken();
   const client=createCaseStoreClient({getAccessToken,request:(url,options)=>request(url,{...options,credentials:'omit',redirect:'error'})});
   const record=await client.get(tenant,caseId);if(turn!==epoch)throw Error('SESSION_CHANGED');
   if(record?.tenantId!==tenant||record.caseId!==caseId||record.data?.tenantId!==tenant||record.data.id!==caseId||!Number.isSafeInteger(record.revision)||record.revision<1||!record.data.sender?.endsWith('.invalid'))throw Error('INVALID_DATA');
   const preview=await client.previewDraft(tenant,caseId,record.revision);getAccessToken();if(turn!==epoch)throw Error('SESSION_CHANGED');
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
  }
 });
}
export function initOperatorPanel({documentRef=document,windowRef=typeof window==='undefined'?null:window,request=fetch,now=()=>Date.now()}={}){
 const get=id=>documentRef.getElementById(id),form=get('operator_login');if(!form)return false;
 const session=createOperatorSession({request,now});let epoch=0;
 const clear=()=>{for(const id of ['server_chat_reply','server_operator_hu','server_guest_draft'])get(id).value='';get('server_data_status').textContent='Nincs hitelesített szerveres adat.';};
 const reset=()=>{epoch++;session.logout();clear();get('operator_password').value='';get('operator_status').textContent='Kijelentkezve. A token törölve.';};
 form.addEventListener('submit',async event=>{event.preventDefault();const turn=++epoch;clear();const password=get('operator_password').value;get('operator_password').value='';get('operator_status').textContent='Belépés ellenőrzése…';try{await session.login(get('operator_email').value.trim(),password);if(turn===epoch)get('operator_status').textContent='Hitelesített tesztmunkamenet; a szerver külön ellenőrzi az ügyhozzáférést.';}catch{if(turn===epoch){session.logout();get('operator_status').textContent='Belépés nem igazolt. Ellenőrizze a tesztbeállítást és hozzáférést.';}}});
 get('operator_logout').addEventListener('click',reset);
 get('server_case_id').addEventListener('input',()=>{epoch++;clear();});
 get('server_case_load').addEventListener('click',async()=>{const turn=++epoch;clear();get('server_data_status').textContent='Szintetikus ügy ellenőrzése…';try{const result=await session.loadCase(get('server_case_id').value.trim());if(turn!==epoch)return;get('server_chat_reply').value=result.text;get('server_operator_hu').value=result.operatorReviewText;get('server_guest_draft').value=result.draft;get('server_data_status').textContent=[result.status,'Ügyverzió: '+result.revision,result.capacity,result.price,result.audit,'Csak olvasás; nincs küldés, mentés vagy jóváhagyás.'].join('\n');}catch{if(turn===epoch){clear();get('server_data_status').textContent='Szerveres adat nem igazolt: jogosultság, munkamenet vagy ügyverzió ellenőrzése szükséges.';}}});
 windowRef?.addEventListener('pagehide',reset);
 for(const event of ['isolated-approval-session-changed','sarberki:session-changed'])documentRef.addEventListener?.(event,reset);
 clear();return true;
}
if(typeof document!=='undefined')initOperatorPanel();
