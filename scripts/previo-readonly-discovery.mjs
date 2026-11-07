#!/usr/bin/env node
// First Previo REST read (owner/ChatGPT 2026-11-06; run ONLY after the owner approves this exact call).
// Three listing GETs against the API TEST property 73521 – no calendar, no availability, no reservation,
// no guest data, nothing written or held:
//   GET /rest/rate-plan          (privilege Hotel.getRates)          -> rate plan ids/names
//   GET /rest/premise/kind?obtId=1 (Hotel.getObjectKinds)            -> accommodation room kinds
//   GET /rest/rooms              (Rooms)                             -> rooms with roomKindId
// The key is NOT in this script: the session's network proxy adds "Authorization: ApiKey <key>" for
// api.previo.app (the placeholder below is replaced there). Output: ids, names, counts only.
// The live property 753011 is refused. Usage (Node fetch must use the session proxy):
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/previo-readonly-discovery.mjs --approved-73521
// First run 2026-11-06 (owner-approved): 3x HTTP 200; 1 rate plan, 1 room kind ('Apartmanok', 4), 5 rooms –
// the API TEST property is a generic template, NOT the Sárberki 23-unit layout.
export const ORIGIN='https://api.previo.app',HOTEL='73521',LIVE=['753011'];
export const CALLS=Object.freeze([
 {name:'ratePlans',path:'/rest/rate-plan'},
 {name:'roomKinds',path:'/rest/premise/kind?obtId=1'},
 {name:'rooms',path:'/rest/rooms'}]);
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o&&o[k]!==undefined).map(k=>[k,o[k]]));
const SAFE={ratePlans:['ratePlanId','name','isBasePlan'],roomKinds:['prkId','roomKindId','id','name','capacity','extraBeds'],rooms:['roomId','name','roomKindId','isActive','active']};

// Live scope check (prepared 2026-11-07, run only after the owner's recorded approval): ONE listing GET
// /rest/rooms on 753011 – room names/ids only, no calendar, reservation or guest data. 403 means no live access.
export async function discover({fetchImpl=fetch,hotelId=HOTEL,liveRoomsOnly=false}={}){
 const live=liveRoomsOnly===true&&String(hotelId)==='753011';
 if(!live&&(String(hotelId)!==HOTEL||LIVE.includes(String(hotelId))))throw Error('ONLY_TEST_PROPERTY_73521');
 const hotel=live?'753011':HOTEL,calls=live?CALLS.filter(c=>c.name==='rooms'):CALLS;
 const report={hotelId:hotel,calls:[]};
 for(const call of calls){
  let status=null,items=null,error=null;
  try{
   const response=await fetchImpl(ORIGIN+call.path,{method:'GET',redirect:'error',cache:'no-store',
    headers:{Authorization:'ApiKey PROXY_REPLACES_THIS',Accept:'application/json','X-Previo-Hotel-Id':hotel,'X-Previo-Language-Id':'2'}});
   status=response.status;
   if(response.ok){const body=await response.json();const list=Array.isArray(body)?body:Array.isArray(body?.data)?body.data:null;
    items=list?list.slice(0,200).map(x=>pick(x,SAFE[call.name])):null;if(!list)error='UNEXPECTED_SHAPE';}
   else error='HTTP_'+status;
  }catch(e){error='TRANSPORT';}
  report.calls.push({call:call.name,method:'GET',path:call.path,status,count:items?.length??null,items,error});
 }
 return report;
}

if(import.meta.url===`file://${process.argv[1]}`){
 const liveRooms=process.argv.includes('--approved-753011-rooms-only');
 if(!process.argv.includes('--approved-73521')&&!liveRooms){console.log('Refused: run only after the owner approved this exact read (flag --approved-73521 or --approved-753011-rooms-only).');process.exit(2);}
 discover(liveRooms?{hotelId:'753011',liveRoomsOnly:true}:{}).then(r=>console.log(JSON.stringify(r,null,1))).catch(e=>{console.log('BLOCKED',e.message);process.exit(1);});
}
