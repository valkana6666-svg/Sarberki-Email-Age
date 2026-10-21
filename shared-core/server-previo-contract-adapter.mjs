// Synthetic contract harness only. No URLs, credentials, fetch, or live dispatch.
// The caller-owned fixture transport must not perform network operations.
import {createHash} from 'node:crypto';
import {assessPrevioApiPreparation,preparePrevioTransactionIntent} from './server-previo-api-preflight.mjs';
import {normalizeAvailability} from './availability-model.mjs';

const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const keys=(x,allowed)=>plain(x)&&Object.keys(x).every(k=>allowed.includes(k));
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
const iso=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(x)&&Number.isFinite(Date.parse(x));
const syntheticId=x=>typeof x==='string'&&/^SYNTHETIC-[A-Za-z0-9_.:-]+$/.test(x);
const frozen=x=>Object.freeze(x);
const failure=code=>frozen({status:'HUMAN_REVIEW',code,syntheticOnly:true,valid:false,liveVerified:false,dispatchEnabled:false,bookingEnabled:false,autoRetry:false});

/**
 * Local executable contract, not a documented Previo wire format.
 * The only supported transport is an explicitly injected synthetic fixture.
 * Provider authentication/endpoint/response parsing must be implemented after
 * official access and contract review; a successful fixture grants no live right.
 */
export function createSyntheticPrevioContractAdapter({preparation,syntheticOnly=false,transport,timeoutMs=1000,now=()=>Date.now()}={}){
 if(!syntheticOnly||!plain(transport)||!keys(transport,['kind','request'])||transport.kind!=='synthetic-fixture'||typeof transport.request!=='function'||typeof now!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw new TypeError('INVALID_SYNTHETIC_PREVIO_ADAPTER');
 let config;
 try{config=structuredClone(preparation);}catch{throw new TypeError('INVALID_SYNTHETIC_PREVIO_PREPARATION');}
 if(assessPrevioApiPreparation(config).status!=='READY_FOR_SANDBOX_READ_REVIEW'||!syntheticId(config.propertyId)||!config.mapping.units.every(u=>syntheticId(u.roomId)&&syntheticId(u.roomKindId))||timeoutMs>config.operational.timeoutMs)throw new TypeError('INVALID_SYNTHETIC_PREVIO_PREPARATION');
 const fixtureRequest=transport.request;
 const mapped=new Map(config.mapping.units.map(u=>[u.localUnitId,frozen({...u})]));
 const inFlight=new Map();

 const requestFor=(operation,input)=>{
  const permitted=['tenantId','propertyId','caseId','caseRevision','draftHash','approvalReference','arrival','departure','localUnitIds'];
  if(!keys(input,permitted)||!syntheticId(input.caseId)||!syntheticId(input.approvalReference)||input.tenantId!==config.tenantId||input.propertyId!==config.propertyId||!day(input.arrival)||!day(input.departure)||input.departure<=input.arrival||!Array.isArray(input.localUnitIds)||input.localUnitIds.length===0||input.localUnitIds.length>23||new Set(input.localUnitIds).size!==input.localUnitIds.length||input.localUnitIds.some(id=>!mapped.has(id)))throw new TypeError('INVALID_SYNTHETIC_PREVIO_QUERY');
  const intent=preparePrevioTransactionIntent(Object.fromEntries(['tenantId','propertyId','caseId','caseRevision','draftHash','approvalReference'].map(k=>[k,input[k]]).concat([['operation',operation]])));
  const query=frozen({tenantId:config.tenantId,propertyId:config.propertyId,operation,arrival:input.arrival,departure:input.departure,units:frozen([...input.localUnitIds].sort().map(id=>mapped.get(id))),ratePlanId:config.mapping.ratePlanId,currency:config.mapping.currency,timezone:config.mapping.timezone,caseId:input.caseId,caseRevision:input.caseRevision,intentId:intent.intentId});
  const requestFingerprint=digest(query);
  return frozen({...query,requestFingerprint,syntheticOnly:true});
 };
 const validResponse=(response,request)=>{
  const allowed=['tenantId','propertyId','operation','requestFingerprint','arrival','departure','checkedAt','reference','units','currency','totalMinor'];
  if(!keys(response,allowed)||response.tenantId!==request.tenantId||response.propertyId!==request.propertyId||response.operation!==request.operation||response.requestFingerprint!==request.requestFingerprint||response.arrival!==request.arrival||response.departure!==request.departure||!iso(response.checkedAt)||!syntheticId(response.reference))return false;
  const age=now()-Date.parse(response.checkedAt);
  if(!Number.isFinite(age)||age<0||age>120000||!Array.isArray(response.units)||response.units.length!==request.units.length)return false;
  const seen=new Set();
  for(const u of response.units){
   if(!keys(u,['roomId','available'])||!request.units.some(r=>r.roomId===u.roomId)||seen.has(u.roomId)||typeof u.available!=='boolean')return false;
   seen.add(u.roomId);
  }
  if(request.operation==='read_quote')return response.currency===request.currency&&Number.isSafeInteger(response.totalMinor)&&response.totalMinor>=0&&response.units.every(u=>u.available);
  return response.currency===undefined&&response.totalMinor===undefined;
 };
 const read=async(operation,input)=>{
  let request;try{request=requestFor(operation,input);}catch{return failure('INVALID_QUERY');}
  if(inFlight.has(request.requestFingerprint))return inFlight.get(request.requestFingerprint);
  const run=(async()=>{
   const controller=new AbortController();let timer;
   try{
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('SYNTHETIC_DEADLINE'));},timeoutMs);});
    // Signal is separate from the immutable, secret-free contract request.
    const response=await Promise.race([Promise.resolve().then(()=>fixtureRequest(request,{signal:controller.signal})),deadline]);
    if(!validResponse(response,request))return failure('INVALID_RESPONSE');
    return frozen({status:'SYNTHETIC_CONTRACT_ACCEPTED',syntheticOnly:true,valid:false,liveVerified:false,dispatchEnabled:false,bookingEnabled:false,autoRetry:false,
     requestFingerprint:request.requestFingerprint,intentId:request.intentId,
     fixtureEvidence:frozen({reference:response.reference,checkedAt:response.checkedAt,units:frozen(response.units.map(u=>frozen({...u}))),...(operation==='read_quote'?{currency:response.currency,totalMinor:response.totalMinor}:{})}),
     auditCandidate:frozen({tenantId:request.tenantId,caseId:request.caseId,caseRevision:request.caseRevision,event:'previo_synthetic_contract_review',operation,requestFingerprint:request.requestFingerprint,reference:response.reference,requiresExistingRepositoryPersistence:true}),requiresDurableJournal:true});
   }catch{return failure(controller.signal.aborted?'TIMEOUT':'TRANSPORT_FAILURE');}
   finally{clearTimeout(timer);}
  })();
  inFlight.set(request.requestFingerprint,run);
  try{return await run;}finally{inFlight.delete(request.requestFingerprint);}
 };
 return frozen({id:'previo-synthetic-contract',tenantId:config.tenantId,authenticationStatus:'NOT_CONNECTED',
  capabilities:frozen({readAvailability:true,readQuote:true,syntheticOnly:true,createBooking:false,modifyBooking:false,cancelBooking:false,finalizeBooking:false}),
  getAvailability:input=>read('read_availability',input),getQuote:input=>read('read_quote',input),
  // A fixture result must never become a valid capacity proof in the shared core.
  async getVerifiedAvailability(query,{tenantId,now:at}={}){return normalizeAvailability({error:'SYNTHETIC_NOT_LIVE_EVIDENCE'},query,{tenantId,now:at??now()});},
  async createBooking(){return failure('WRITE_DISABLED');},async finalizeBooking(){return failure('WRITE_DISABLED');}
 });
}
