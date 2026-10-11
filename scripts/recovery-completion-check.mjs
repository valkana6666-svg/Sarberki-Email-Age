// New, offline recovery checks only. No real OAuth, mail, PMS or DB traffic.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import {fetchPublicBookingAvailability} from '../price-source/sarberki-public-booking.mjs';
import {createReadOnlyPmsAdapter} from '../shared-core/pms-adapter.mjs';
import {SARBERKI_PROFILE} from '../business/sarberki/profile.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const root=resolve(new URL('..',import.meta.url).pathname), out=resolve(root,'reports/recovery-final-2026-10-11');
const report={scope:'NEW_OFFLINE_RECOVERY_CHECKS_ONLY',real_service_mutations:0,real_oauth:'NOT_RUN',original_database:'NOT_CONNECTED',production:'NOT_CONNECTED'};
const server=createServer(async(req,res)=>{
 try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!p.startsWith(root+'/')||!['.html','.mjs','.js','.css','.svg'].includes(extname(p)))throw Error('denied');
  const bytes=await readFile(p);res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(p)]);res.end(bytes);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
let stage='chromium';
const body='Jó napot! 2026. október 23–25. között Deluxe faházat kérünk 4 felnőtt részére, gyermek nélkül. Telefonszám: +36 30 555 0123. Üdvözlettel: Teszt Vendég';
const fixture={id:'recovery-synthetic-message',threadId:'recovery-synthetic-thread',labelIds:['INBOX'],internalDate:String(Date.parse('2026-10-11T10:00:00Z')),payload:{mimeType:'text/plain',body:{data:Buffer.from(body).toString('base64url')},headers:[{name:'From',value:'Recovery Fixture <recovery@synthetic.invalid>'},{name:'Subject',value:'Recovery fixture'},{name:'Message-ID',value:'<recovery@synthetic.invalid>'}]}};
async function session(mode='correct'){
 const context=await browser.newContext();const calls=[];let capacity='available';
 await context.addInitScript(()=>{
  window.__oauthConfigs=[];
  window.google={accounts:{oauth2:{initTokenClient(config){window.__oauthConfigs.push({scope:config.scope,include:config.include_granted_scopes,hint:config.hint});return {requestAccessToken(){config.callback({access_token:'synthetic-memory-only-test-token',expires_in:3600});}};}}}};
 });
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='accounts.google.com')return route.fulfill({contentType:'text/javascript',body:''});
  if(u.hostname==='gmail.googleapis.com'){
   calls.push({path:u.pathname,method:req.method()});assert.equal(req.method(),'GET');
   if(u.pathname.endsWith('/profile'))return route.fulfill({status:mode==='expired'?401:200,json:{emailAddress:mode==='wrong'?'other@synthetic.invalid':'sarberkiprojecttest@gmail.com'}});
   if(u.pathname.endsWith('/messages'))return route.fulfill({json:{messages:[{id:fixture.id}]}});
   return route.fulfill({json:fixture});
  }
  if(u.origin===origin&&u.pathname==='/api/availability-options'){
   const input=req.postDataJSON();const result=await buildAvailabilityOptions(input,async q=>{
    if(capacity==='unknown')throw Error('synthetic unavailable provider');
    return {...q,availability:capacity,availableUnits:capacity==='available'?2:0,source:'RECOVERY-SYNTHETIC',checkedAt:new Date().toISOString()};
   });return route.fulfill({json:result});
  }
  if(u.origin===origin&&u.pathname==='/api/manual-fx')return route.fulfill({json:{status:'available',rateHufPerEur:400,rateDate:'2026-10-09'}});
  if(u.origin===origin&&u.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{error:'OFFLINE_RECOVERY_ONLY'}});
  if(u.origin===origin)return route.continue();
  return route.abort();
 });
 const page=await context.newPage();await page.goto(origin);await page.waitForFunction(()=>window.SarberkiRulesReady&&window.sarberkiGmailTransform);
 return {context,page,calls,setCapacity:x=>{capacity=x;}};
}
try{
 if(process.env.SARBERKI_RECOVERY_STAGE!=='previo-only'){
 browser=await chromium.launch({headless:true});
 stage='gmail-isolated-read-only';
 for(const mode of ['wrong','expired']){
  const s=await session(mode);await s.page.locator('#read_gmail').click();await s.page.waitForFunction(()=>!document.getElementById('read_gmail').disabled);
  assert.equal(s.calls.filter(x=>!x.path.endsWith('/profile')).length,0);assert.equal(await s.page.evaluate(()=>localStorage.getItem('sarberki-booking-cases-v2')),null);
  report['gmail_'+mode+'_blocked']='PASS';await s.context.close();
 }
 const s=await session();await s.page.locator('#read_gmail').click();await s.page.waitForFunction(()=>localStorage.getItem('sarberki-booking-cases-v2'));
 const config=await s.page.evaluate(()=>window.__oauthConfigs[0]);assert.equal(config.scope,'https://www.googleapis.com/auth/gmail.readonly');assert.equal(config.include,false);assert.equal(config.hint,'sarberkiprojecttest@gmail.com');
 const storage=await s.page.evaluate(()=>JSON.stringify({...localStorage}));assert.equal(storage.includes('synthetic-memory-only-test-token'),false);assert.equal(s.calls.length,3);
 report.gmail_read_only_oauth_contract_and_memory_only_token='PASS_SYNTHETIC_GOOGLE_API';
 stage='ui-approval-persistence';
 assert.equal(await s.page.locator('#f_arrival').inputValue(),'2026-10-23');assert.equal(await s.page.locator('#f_adults').inputValue(),'4');
 await s.page.locator('#approved_price_manual').fill('120000');await s.page.locator('#manual_quote_confirmed').check();await s.page.waitForFunction(()=>!document.getElementById('approve_price').disabled);await s.page.locator('#approve_price').click();
 for(let i=0;i<4;i++){
  if(await s.page.locator('#approve').isDisabled()){if(await s.page.locator('#override').isVisible())await s.page.locator('#override').check();}
  await s.page.locator('#approve').click();await s.page.waitForTimeout(250);
  if((await s.page.locator('#status').innerText()).includes('Belső jóváhagyás rögzítve'))break;
 }
 assert.match(await s.page.locator('#status').innerText(),/Belső jóváhagyás rögzítve/);
 assert.match(await s.page.locator('#events').innerText(),/Belső jóváhagyás/);
 const saved=await s.page.evaluate(()=>JSON.parse(localStorage.getItem('sarberki-booking-cases-v2')));
 report.ui_inquiry_interpretation_case_draft='PASS_REAL_CHROMIUM_SYNTHETIC_GMAIL';
 report.ui_internal_approval='PASS_LOCAL_BUTTON_NO_AUTHENTICATED_OPERATOR';
 report.ui_saved_approval=saved[0].state.approval;
 report.ui_approval_persisted=saved[0].state.approval==='internally_approved';
 report.ui_persistent_event_audit=Array.isArray(saved[0].events)&&saved[0].events.some(e=>e.type.includes('Belső jóváhagyás'));
 assert.ok(saved[0].drafts.length>0);
 stage='portable-synthetic-local-export';
 const phrase=randomBytes(24).toString('hex');
 const encrypted=await s.page.evaluate(async phrase=>{
  const m=await import('/local-recovery.mjs');return (await m.verifyLocalExport(localStorage,location.origin,phrase)).encrypted;
 },phrase).catch(()=>null);
 assert.ok(encrypted);report.synthetic_ui_local_export_encrypt_and_readback='PASS_NOT_ACTUAL_LAPTOP_DATA';
 const destContext=await browser.newContext(), dest=await destContext.newPage(), destOrigin=origin.replace('127.0.0.1','localhost');
 await destContext.route('**/*',route=>new URL(route.request().url()).origin===destOrigin?route.continue():route.abort());
 await dest.goto(destOrigin+'/local-backup.html');
 await dest.evaluate(async ({encrypted,phrase})=>{const m=await import('/local-recovery.mjs');const data=await m.decryptLocalState(encrypted,phrase);m.restoreIntoEmptyStore(data,localStorage,{targetOrigin:location.origin,confirmedEmptyTarget:true});},{encrypted,phrase});
 await dest.reload();assert.deepEqual(await dest.evaluate(()=>JSON.parse(localStorage.getItem('sarberki-booking-cases-v2'))),saved);
 report.synthetic_encrypted_local_state_restored_into_new_browser_origin='PASS_NOT_ACTUAL_LAPTOP_DATA';await destContext.close();
 await s.page.reload();await s.page.waitForFunction(()=>window.SarberkiBookingRuntime);
 const after=await s.page.evaluate(()=>window.SarberkiBookingRuntime.cases.list());assert.deepEqual(after,saved);assert.equal(await s.page.evaluate(()=>window.__oauthConfigs.length),0);
 report.ui_case_draft_survives_page_restart='PASS';report.gmail_new_session_requires_new_oauth='PASS_SYNTHETIC';
 stage='ui-unknown-capacity-approval-block';
 s.setCapacity('unknown');await s.page.locator('#read_gmail').click();await s.page.waitForFunction(()=>!document.getElementById('read_gmail').disabled);
 // The stored locally-read ID requires explicit reopening after restart.
 await s.page.locator('#gmail_open_selected').click();
 if(await s.page.locator('#approve').isDisabled())await s.page.locator('#override').check();
 await s.page.locator('#approve').click();await s.page.waitForTimeout(250);assert.match(await s.page.locator('#status').innerText(),/Jóváhagyás tiltva/);
 report.ui_unknown_capacity_approval_blocked='PASS';await s.context.close();
 }
 stage='previo-restored-adapter-offline';
 const query={arrival:'2026-10-23',departure:'2026-10-25',cabin:'deluxe'};
 const rootPms=SARBERKI_PROFILE.bookingProvider.root, hotelId=SARBERKI_PROFILE.bookingProvider.hotelId;
 let free=2,network=[];
 const fake=async(url,options={})=>{
  const u=new URL(url);network.push({path:u.pathname,method:options.method||'GET'});
  let text='',json=null;
  if((options.method||'GET')==='GET')text='<form id="firstStep" action="'+rootPms+'/?hotId='+hotelId+'">';
  else if(u.pathname==='/')text='var PageParams = '+JSON.stringify({HOT_ID:hotelId,CUR_CODE:'HUF',RESERVATION_DETAILS:{from:query.arrival,to:query.departure},OBJECT_KINDS:[{hotelLangName:SARBERKI_PROFILE.accommodationTypes.deluxe.bookingName,obkId:999}]})+' //-->';
  else json={success:true,html:free===null?'missing count':'<div data-numOfFreeRooms="'+free+'">'};
  return {ok:true,status:200,url:String(url),headers:new Headers(),text:async()=>text,json:async()=>json};
 };
 const adapter=createReadOnlyPmsAdapter({id:'previo-recovery-fixture',tenantId:'sarberki',fetchAvailability:async q=>({...await fetchPublicBookingAvailability(q,fake),checkedAt:new Date(Date.now()-1000).toISOString()}),fetchQuote:()=>{throw Error('not used');}});
 const good=await adapter.getVerifiedAvailability(query,{tenantId:'sarberki'});assert.equal(good.status,'AVAILABLE');assert.equal(good.availableUnits,2);
 free=0;assert.equal((await adapter.getVerifiedAvailability(query,{tenantId:'sarberki'})).status,'UNAVAILABLE');
 free=null;const unknown=await adapter.getVerifiedAvailability(query,{tenantId:'sarberki'});assert.equal(unknown.status,'UNKNOWN');assert.equal(unknown.availableUnits,null);
 assert.ok(network.every(x=>['/','/index/get-object-kind-occupancy/'].includes(x.path)));assert.equal(adapter.capabilities.createBooking,false);
 report.previo_restored_http_parser_and_unknown_not_zero='PASS_SYNTHETIC_HTTP_ONLY';report.previo_live='NOT_RUN_SIDE_EFFECT_SAFETY_NOT_VERIFIED';
 report.completed=true;
}catch(error){report.completed=false;report.failed_stage=stage;report.failure_class=error.name;report.failure_detail=error.message;process.exitCode=1;}
finally{await browser?.close();await new Promise(r=>server.close(r));await mkdir(out,{recursive:true});await writeFile(resolve(out,'NEW-CHECKS.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
