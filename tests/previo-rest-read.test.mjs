import test from 'node:test';
import assert from 'node:assert/strict';
import {readPrevioFreeCapacity,previoAvailabilityRequest,normalizePrevioAvailability,stayNights,validateRoomKindMapping,capacityDecision} from '../shared-core/server-previo-rest-read.mjs';

// Fictional IDs and key only; no network. Response shape from the public Previo REST docs (2026-11-06).
const KEY='synthetic-previo-key-0123456789';
const MAP={deluxe:'900001',family:'900002',splitA:'900003',splitB:'900003',splitC:'900004'};
const base={apiKey:KEY,hotelId:'73521',ratePlanId:'800001',mapping:MAP,arrival:'2027-05-14',departure:'2027-05-17',clock:()=>'2027-01-01T00:00:00.000Z'};
const body=(nights,overrides={})=>[{ratePlanId:800001,availability:nights.map(date=>({date,roomKinds:[{id:900001,availability:overrides[date]?.deluxe??2},{id:900002,availability:1},{id:900003,availability:3},{id:900004,availability:0}]}))}];
function previo(json,status=200){
 const calls=[];
 return {calls,fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(json),{status});}};
}

test('one GET to the pinned host with ApiKey and hotel headers; nights = arrival..departure-1',async()=>{
 const p=previo(body(['2027-05-14','2027-05-15','2027-05-16']));
 const r=await readPrevioFreeCapacity({...base,cabins:['deluxe','family','splitC'],fetchImpl:p.fetchImpl});
 assert.equal(p.calls.length,1);
 const {url,options}=p.calls[0],u=new URL(url);
 assert.equal(u.origin+u.pathname,'https://api.previo.app/rest/calendar/availability');
 assert.equal(u.searchParams.get('filterFrom'),'2027-05-14');assert.equal(u.searchParams.get('filterTo'),'2027-05-16');
 assert.deepEqual(u.searchParams.getAll('roomKindIds[]'),['900001','900002','900004']);assert.equal(u.searchParams.get('ratePlanId'),'800001');
 assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.body,undefined);
 assert.equal(options.headers.Authorization,'ApiKey '+KEY);assert.equal(options.headers['X-Previo-Hotel-Id'],'73521');
 assert.deepEqual(r.freeByCabin,{deluxe:2,family:1,splitC:0});assert.equal(r.complete,true);assert.equal(r.nights,3);
 assert.equal(JSON.stringify(r).includes(KEY),false,'key never returned');
 assert.deepEqual([r.bookingCreated,r.writeAttempted],[false,false]);
 assert.equal(capacityDecision(r,'deluxe',2),'AVAILABLE');assert.equal(capacityDecision(r,'deluxe',3),'UNAVAILABLE');assert.equal(capacityDecision(r,'splitC'),'UNAVAILABLE');
});
test('minimum over the nights; a missing night or room kind is UNKNOWN, never free',async()=>{
 const p=previo(body(['2027-05-14','2027-05-15','2027-05-16'],{'2027-05-15':{deluxe:0}}));
 const r=await readPrevioFreeCapacity({...base,cabins:['deluxe'],fetchImpl:p.fetchImpl});
 assert.equal(r.freeByCabin.deluxe,0);assert.equal(capacityDecision(r,'deluxe'),'UNAVAILABLE');
 const gap=await readPrevioFreeCapacity({...base,cabins:['deluxe'],fetchImpl:previo(body(['2027-05-14','2027-05-16'])).fetchImpl});
 assert.equal(gap.freeByCabin.deluxe,null);assert.equal(gap.complete,false);assert.equal(capacityDecision(gap,'deluxe'),'UNKNOWN');
 const req=previoAvailabilityRequest({hotelId:'73521',ratePlanId:'800001',roomKindIds:['900001'],arrival:'2027-05-14',departure:'2027-05-15'});
 for(const bad of [{},[],[{ratePlanId:1,availability:[]}],[{ratePlanId:800001,availability:[{date:'2027-05-14',roomKinds:[{id:900001,availability:-1}]}]}],
  [{ratePlanId:800001,availability:[{date:'2027-05-14',roomKinds:[{id:900001,availability:'2'}]}]}],
  [{ratePlanId:800001,availability:[{date:'2027-05-14',roomKinds:[{id:900001,availability:1},{id:900001,availability:5}]}]}]]){
  const n=normalizePrevioAvailability(bad,req);
  assert.ok(n===null||n['900001']===null,JSON.stringify(bad));
 }
});
test('live property 753011 and any non-sandbox hotel are refused before any request',async()=>{
 for(const [hotelId,code] of [['753011',/LIVE_PROPERTY_REFUSED/],['12345',/SANDBOX_ONLY/]]){
  const p=previo([]);
  await assert.rejects(readPrevioFreeCapacity({...base,hotelId,cabins:['deluxe'],fetchImpl:p.fetchImpl}),code);
  assert.equal(p.calls.length,0);
 }
});
test('setup errors fail before the network: key, mapping, cabin, dates, timeout',async()=>{
 const p=previo([]);
 for(const [over,code] of [[{apiKey:''},/PREVIO_KEY_MISSING/],[{mapping:{deluxe:'1',family:'1'}},/MAPPING_UNVERIFIED/],[{mapping:{nope:'1'}},/MAPPING_UNVERIFIED/],
  [{cabins:['vip']},/MAPPING_UNVERIFIED/],[{arrival:'2027-05-17'},/INVALID_DATES/],[{departure:'2027-13-01'},/INVALID_DATES/],[{timeoutMs:60000},/INVALID_TIMEOUT/],[{ratePlanId:'x'},/RATE_PLAN_UNVERIFIED/]])
  await assert.rejects(readPrevioFreeCapacity({...base,cabins:['deluxe'],fetchImpl:p.fetchImpl,...over}),code,JSON.stringify(over));
 assert.equal(p.calls.length,0);
 assert.deepEqual(validateRoomKindMapping({splitA:'5',splitB:'5'}),{splitA:'5',splitB:'5'},'shared A/B pool');
 assert.deepEqual(stayNights('2027-02-27','2027-03-02'),['2027-02-27','2027-02-28','2027-03-01']);
});
test('transport: 401/403, 429, 5xx, network error and timeout map to fixed codes, one attempt',async()=>{
 for(const [status,code] of [[401,/PREVIO_AUTH_REFUSED/],[403,/PREVIO_AUTH_REFUSED/],[429,/PREVIO_RATE_LIMITED/],[500,/PREVIO_UNAVAILABLE/]]){
  const p=previo({},status);
  await assert.rejects(readPrevioFreeCapacity({...base,cabins:['deluxe'],fetchImpl:p.fetchImpl}),code);assert.equal(p.calls.length,1);
 }
 await assert.rejects(readPrevioFreeCapacity({...base,cabins:['deluxe'],fetchImpl:async()=>{throw Error('ECONNRESET '+KEY);}}),error=>error.code==='PREVIO_UNAVAILABLE'&&!error.message.includes(KEY));
 const hang=async(url,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted'))));
 await assert.rejects(readPrevioFreeCapacity({...base,cabins:['deluxe'],fetchImpl:hang,timeoutMs:20}),/PREVIO_TIMEOUT/);
});
