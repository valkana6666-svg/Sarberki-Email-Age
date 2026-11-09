import test from 'node:test';
import assert from 'node:assert/strict';
import {reservationsFromXml,unitDecision,checkPrevioUnit,previoUnitChecker,previoUnitLine,unitSearchXml} from '../shared-core/server-previo-unit-check.mjs';

// Synthetic XML in Previo's documented shape; fictional ids, no personal data, no network.
const res=({resId,objId,from,to,statusId=1,voucher})=>`<reservation><resId>${resId}</resId><voucher>${voucher}</voucher><term><from>${from} 14:00:00</from><to>${to} 10:00:00</to></term><status><statusId>${statusId}</statusId></status><guest><name>X Y</name><email>x@y.invalid</email></guest><object><objId>${objId}</objId><name>7/A</name></object></reservation>`;
const xml=(...r)=>`<?xml version="1.0"?><reservations>${r.join('')}</reservations>`;
const A7=2392207,B7=2392209;

test('parse: ids, dates, status, voucher; no personal fields kept',()=>{
 const [r]=reservationsFromXml(xml(res({resId:1,objId:A7,from:'2027-06-10',to:'2027-06-13',voucher:'20260002'})));
 assert.deepEqual(r,{resId:1,objId:A7,statusId:1,voucher:'20260002',from:'2027-06-10',to:'2027-06-13'});
});
test('decision: another reservation on the unit -> taken; own reference -> found; other unit, storno, no-show, touching days -> free',()=>{
 const list=reservationsFromXml(xml(
  res({resId:1,objId:A7,from:'2027-06-10',to:'2027-06-13',voucher:'OTHER'}),
  res({resId:2,objId:B7,from:'2027-06-10',to:'2027-06-13',voucher:'REF-1'}),
  res({resId:3,objId:B7,from:'2027-06-13',to:'2027-06-15',voucher:'X'}),
  res({resId:4,objId:B7,from:'2027-06-08',to:'2027-06-10',voucher:'Y'}),
  res({resId:5,objId:B7,from:'2027-06-11',to:'2027-06-12',statusId:7,voucher:'Z'}),
  res({resId:6,objId:B7,from:'2027-06-11',to:'2027-06-12',statusId:8,voucher:'W'})));
 const q={arrival:'2027-06-10',departure:'2027-06-13'};
 const a=unitDecision(list,{...q,objId:A7,previoReference:'REF-1'});
 assert.equal(a.status,'taken');assert.deepEqual(a.conflicts.map(c=>c.from),['2027-06-10']);assert.equal(a.referenceFound,false);
 const b=unitDecision(list,{...q,objId:B7,previoReference:'REF-1'});
 assert.equal(b.status,'free');assert.equal(b.referenceFound,true);assert.deepEqual(b.conflicts,[]);
 assert.equal(unitDecision(list,{...q,objId:B7,previoReference:'NOPE'}).referenceFound,false);
 assert.match(unitSearchXml({hotelId:'73521',...q}),/<termType>overlap<\/termType><roomsOnly>1<\/roomsOnly>/);
});
test('check: 73521 only, known unit, read failures -> unknown (never free)',async()=>{
 const key='synthetic-previo-key-0123456789',q={unit:'7/A',arrival:'2027-06-10',departure:'2027-06-13',previoReference:'R'};
 let calls=0;const f=body=>async()=>{calls++;return new Response(body,{status:200});};
 assert.equal((await checkPrevioUnit({...q,apiKey:key,fetchImpl:f(xml(res({resId:1,objId:A7,from:'2027-06-10',to:'2027-06-13',voucher:'O'})))})).status,'taken');
 assert.equal((await checkPrevioUnit({...q,apiKey:key,fetchImpl:f('<error><code>1000</code><message>x</message></error>')})).status,'unknown');
 assert.equal((await checkPrevioUnit({...q,apiKey:key,fetchImpl:f('<html>')})).status,'unknown');
 assert.equal((await checkPrevioUnit({...q,apiKey:key,fetchImpl:async()=>{throw Error('net');}})).status,'unknown');
 assert.equal((await checkPrevioUnit({...q,apiKey:key,fetchImpl:async()=>new Response('',{status:500})})).status,'unknown');
 const before=calls;
 assert.equal((await checkPrevioUnit({...q,unit:'99',apiKey:key,fetchImpl:f('')})).status,'unknown');
 assert.equal((await checkPrevioUnit({...q,apiKey:key,property:{hotelId:'753011',rooms:{'7/A':1}},fetchImpl:f('')})).status,'unknown');
 assert.equal(calls,before,'no request for an unknown unit or the live property');
 assert.equal(previoUnitChecker({},fetch),null);
 assert.equal(typeof previoUnitChecker({PREVIO_READ_API_ENABLED:'sandbox-73521-only',PREVIO_HOTEL_ID:'73521'},fetch),'function');
});
test('operator lines',()=>{
 assert.match(previoUnitLine({status:'free',referenceFound:true},'12','20260003'),/20260003 foglalás megtalálható a\(z\) 12 egységen/);
 assert.match(previoUnitLine({status:'free',referenceFound:false},'12','X'),/NEM található/);
 assert.match(previoUnitLine({status:'unknown'},'12','X'),/kézi Previo-ellenőrzés érvényes/);
});
