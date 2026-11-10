// Once-only owner-approved 73521 lifecycle R2. No imports cause network activity.
import {appendFileSync} from 'node:fs';
import {buildReservationXml,buildStatusXml,buildVoucherSearchXml,writePrevioReservation} from '../shared-core/server-previo-reservation-write.mjs';
import {checkPrevioUnit} from '../shared-core/server-previo-unit-check.mjs';
import {readPrevioPrice} from '../shared-core/server-previo-price-check.mjs';

const PERMISSION='PERM-20261110-API-LIFECYCLE-R2',VOUCHER='SC-17CAFC194331890A';
const values={arrival:'2027-09-16',departure:'2027-09-18',adults:'2',children:'0'};
const fail=code=>{throw Error(code);};
const ensure=(value,code)=>{if(!value)fail(code);};
const proof=data=>{const line=JSON.stringify(data);console.log(line);if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,line+'\n');};
ensure(process.env.GITHUB_REF==='refs/heads/gmail-test-subject-allowlist','BRANCH_REFUSED');
ensure(process.env.GITHUB_RUN_ATTEMPT==='1','RETRY_REFUSED');
const key=process.env.PREVIO_API_KEY;
ensure(/^[A-Za-z0-9._~+/=-]{16,512}$/.test(key||''),'SECRET_MISSING');
const request=buildReservationXml({tenantId:'sarberki-test',caseId:'codex-api-20261110-r2',values,cabin:'deluxe',unit:'11',contactName:'TESZT CODEX API R2 20261110',totalHuf:128200,optionExpiresUtc:'2026-11-12T12:00:00.000Z'});
ensure(request.voucher===VOUCHER&&request.hotelId==='73521','REQUEST_REFUSED');
ensure(Date.now()<Date.parse('2026-11-12T12:00:00Z'),'PERMISSION_WINDOW_EXPIRED');
let own=null,createAttempt=false,confirmAttempt=false,cancelAttempt=false,cancelled=false,failed=false;
let readCount=0,writeCount=0;
const nativeFetch=globalThis.fetch;
async function transport(url,options={}){
 ensure(options.method==='POST'&&options.redirect==='error','METHOD_REFUSED');
 const body=String(options.body||'');
 const path=new URL(url);
 ensure(path.origin==='https://api.previo.app'&&path.search===''&&path.hash==='','HOST_REFUSED');
 if(path.pathname==='/rest/reservations/accounts/suggester'){
  ensure(new Headers(options.headers).get('X-Previo-Hotel-Id')==='73521','PROPERTY_REFUSED');readCount++;
 }else{
  ensure(body.includes('<hotId>73521</hotId>'),'PROPERTY_REFUSED');
  if(path.pathname==='/x1/hotel/searchReservations'||path.pathname==='/x1/hotel/get')readCount++;
  else if(path.pathname==='/x1/hotel/reservation'){
   if(!createAttempt&&body===request.xml){createAttempt=true;}
   else if(own&&!confirmAttempt&&!cancelAttempt&&body===buildStatusXml({resId:own.resId,status:'confirmed'}).xml){confirmAttempt=true;}
   else if(own&&!cancelAttempt&&body===buildStatusXml({resId:own.resId,status:'cancelled'}).xml){cancelAttempt=true;}
   else fail('WRITE_NOT_IN_APPROVED_SEQUENCE');
   writeCount++;ensure(writeCount<=3,'WRITE_LIMIT');
  }else fail('ROUTE_REFUSED');
 }
 return nativeFetch(url,{...options,signal:AbortSignal.timeout(20000)});
}
async function xmlCall(path,xml){
 const r=await transport('https://api.previo.app'+path,{method:'POST',redirect:'error',headers:{Authorization:'ApiKey '+key,'Content-Type':'application/xml',Accept:'application/xml'},body:xml});
 ensure(r.ok,'HTTP_'+r.status);
 const text=await r.text();ensure(!/<error>/.test(text),'PREVIO_REJECTED');return text;
}
const tag=(text,name)=>text.match(new RegExp('<'+name+'>([^<]*)</'+name+'>'))?.[1]??null;
async function findOwn(){
 const text=await xmlCall('/x1/hotel/searchReservations',buildVoucherSearchXml(request));
 ensure(/<reservations(?:\s|>)/.test(text),'SEARCH_UNVERIFIED');
 return [...text.matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(m=>m[1]).filter(b=>tag(b,'voucher')===VOUCHER).map(b=>{
  const status=tag(b.match(/<statuses>([\s\S]*?)<\/statuses>/)?.[1]||'','cosId')||tag(b,'statusId');
  return {resId:Number(tag(b,'resId')),comId:Number(tag(b,'comId')),status:Number(status),voucher:VOUCHER};
 });
}
async function verify(status){
 const found=await findOwn();ensure(found.length===1,'EXACT_RECORD_REQUIRED');
 const record=found[0];
 ensure(own&&record.resId===own.resId&&record.comId===own.comId&&record.status===status,'STATE_READBACK_FAILED');
 proof({step:'readback',permission:PERMISSION,...record,result:'PASS'});return record;
}
async function cancelOwn(){
 ensure(own&&!cancelAttempt,'CANCEL_NOT_ALLOWED');
 await xmlCall('/x1/hotel/reservation',buildStatusXml({resId:own.resId,status:'cancelled'}).xml);
 await verify(7);cancelled=true;
}
try{
 const identity=await xmlCall('/x1/hotel/get','<request><hotId>73521</hotId><lanId>1</lanId></request>');
 ensure(tag(identity,'hotId')==='73521'&&/API\s*TES[ZT]/i.test(tag(identity,'name')||''),'TEST_IDENTITY_FAILED');
 proof({step:'identity',hotelId:73521,result:'PASS'});
 const unit=await checkPrevioUnit({apiKey:key,unit:'11',arrival:values.arrival,departure:values.departure,previoReference:VOUCHER,fetchImpl:transport});
 ensure(unit.status==='free'&&!unit.referenceFound,'UNIT_NOT_FREE');
 const price=await readPrevioPrice({apiKey:key,values,cabin:'deluxe',fetchImpl:transport});
 ensure(price.status==='read'&&price.total===128200,'PRICE_MISMATCH');
 ensure((await findOwn()).length===0,'VOUCHER_ALREADY_EXISTS');
 proof({step:'preflight',hotelId:73521,unit:'11',totalHuf:price.total,result:'PASS'});
 const created=await writePrevioReservation({env:{PREVIO_WRITE_ENABLED:'sandbox-73521-only',PREVIO_API_KEY:key},permissionId:PERMISSION,request,fetchImpl:transport});
 ensure(created.created===true&&created.voucher===VOUCHER&&Number.isSafeInteger(created.resId)&&created.resId>0&&Number.isSafeInteger(created.comId)&&created.comId>0,'CREATION_UNVERIFIED');
 own={resId:created.resId,comId:created.comId};
 await verify(1);
 await xmlCall('/x1/hotel/reservation',buildStatusXml({resId:own.resId,status:'confirmed'}).xml);
 await verify(2);
 await cancelOwn();
}catch(error){
 failed=true;proof({result:'FAIL',code:/^[A-Z0-9_]+$/.test(error.message||'')?error.message:'UNVERIFIED_FAILURE'});
 if(createAttempt&&!own){
  try{const found=await findOwn();if(found.length===1&&Number.isSafeInteger(found[0].resId)&&found[0].resId>0&&Number.isSafeInteger(found[0].comId)&&found[0].comId>0)own=found[0];}catch{}
 }
 if(createAttempt&&own&&!cancelled){
  try{
   if(cancelAttempt){await verify(7);cancelled=true;}
   else await cancelOwn();
  }catch{proof({result:'URGENT_BLOCKER',code:'CANCELLATION_UNVERIFIED',voucher:VOUCHER,resId:own.resId});}
 }else if(createAttempt&&!own)proof({result:'URGENT_BLOCKER',code:'CREATION_OUTCOME_UNVERIFIED',voucher:VOUCHER});
}
proof({result:!failed&&cancelled?'PASS':'FAIL',permission:PERMISSION,voucher:VOUCHER,resId:own?.resId??null,comId:own?.comId??null,cancelled,readRequests:readCount,writeRequests:writeCount});
if(failed||!cancelled)process.exitCode=1;
