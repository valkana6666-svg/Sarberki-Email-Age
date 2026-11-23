// #9 7005064928: Previo is the source of the staff-managed booking state; read-only view. Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {caseBookingsFromXml,previoCaseView,previoStatusLine,statusSearchXml,readPrevioCaseStatus} from '../shared-core/server-previo-status.mjs';

const V='SC-8F65A04D94AB1A5A';
const block=(st,from,to,obj,extra='')=>`<reservation><resId>9${st}</resId><voucher>${V}</voucher><status><statusId>${st}</statusId></status><term><from>${from} 14:00:00</from><to>${to} 10:00:00</to></term><object><objId>${obj}</objId></object><price>189000.00</price>${extra}</reservation>`;
test('state from Previo: option with expiry, staff-confirmed, cancelled; staff changes to dates/unit are reported, Previo wins',()=>{
 const opt=caseBookingsFromXml('<reservations>'+block(1,'2027-09-03','2027-09-06',2392197,'<optionExpiration>2026-11-21 10:07:00</optionExpiration>')+'</reservations>',V);
 assert.deepEqual({...opt[0]},{resId:91,state:'option',unit:'11',from:'2027-09-03',to:'2027-09-06',price:189000,optionExpiration:'2026-11-21 10:07:00'});
 const v=previoCaseView(opt,{arrival:'2027-09-03',departure:'2027-09-06'});assert.equal(v.state,'option');assert.deepEqual(v.changes,[]);
 assert.match(previoStatusLine(v),/opció \(még nincs jóváhagyva\) · 11\. egység · 2027-09-03 → 2027-09-06 · 189 000 Ft · opció lejár: 2026\. 11\. 21\. 10:07/);
 const moved=previoCaseView(caseBookingsFromXml(block(2,'2027-09-04','2027-09-07',2392199),V),{arrival:'2027-09-03',departure:'2027-09-06',unit:'11'});
 assert.equal(moved.state,'confirmed');assert.deepEqual(moved.changes,['DATES','UNIT']);assert.match(previoStatusLine(moved),/megerősítve.*\n⚠️ A Previóban módosították: dátum, egység – a Previo az irányadó/);
 assert.equal(previoCaseView(caseBookingsFromXml(block(7,'2027-09-03','2027-09-06',2392197),V),{arrival:'2027-09-03',departure:'2027-09-06'}).state,'cancelled');
 assert.equal(previoCaseView([],{arrival:'2027-09-03',departure:'2027-09-06'}).state,'missing');
 assert.equal(previoCaseView(caseBookingsFromXml(block(1,'2027-09-03','2027-09-06',2392197)+block(1,'2027-09-03','2027-09-06',2392199),V),{}).state,'multiple');
 assert.equal(caseBookingsFromXml(block(1,'2027-09-03','2027-09-06',2392197).replace(V,'SC-0000000000000000'),V).length,0,'another case is ignored');
});
test('a failed read is UNKNOWN, never cancelled; every status is searched; TEST only',async()=>{
 assert.match(statusSearchXml({hotelId:'73521',from:'a',to:'b'}),/<cosId>1<\/cosId>.*<cosId>7<\/cosId>.*<cosId>9<\/cosId>/s);
 assert.equal(await readPrevioCaseStatus({apiKey:'k'.repeat(20),voucher:V,arrival:'2027-09-03',departure:'2027-09-06',fetchImpl:async()=>new Response('x',{status:500})}),null);
 assert.equal(await readPrevioCaseStatus({apiKey:'k'.repeat(20),voucher:V,arrival:'2027-09-03',departure:'2027-09-06',property:{hotelId:'753011'}}),null);
 assert.match(previoStatusLine({state:'unknown',changes:[]}),/ez NEM lemondás/);
});

test('owner 2026-11-22/23: the option expiry is readable and, with auto-cancel on, the staff are told the system cancels it',async()=>{
 const {localExpiry}=await import('../shared-core/server-previo-status.mjs');
 assert.equal(localExpiry('2026-11-24T12:47:17'),'2026. 11. 24. 12:47');assert.equal(localExpiry('2026-11-24 08:05:00'),'2026. 11. 24. 08:05');assert.equal(localExpiry('x'),null);
 const v={state:'option',changes:[],booking:{unit:'3',from:'2027-08-02',to:'2027-08-05',price:181500,optionExpiration:'2026-11-24T12:47:17'}};
 assert.match(previoStatusLine(v),/opció lejár: 2026\. 11\. 24\. 12:47$/);
 assert.match(previoStatusLine(v,{autoCancel:true}),/opció lejár: 2026\. 11\. 24\. 12:47 \(ha addig nem erősítitek meg, a rendszer lemondja\)/);
 assert.match(previoStatusLine({state:'cancelled',changes:[],booking:{unit:'3'}}),/lemondva · 3\. egység/);
});
