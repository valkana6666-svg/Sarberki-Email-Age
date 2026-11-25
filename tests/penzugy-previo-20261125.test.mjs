// Owner 2026-11-25 (#9 7161329077 / 7161371109): the finance view lists every Previo booking (all channels), one item
// per booking, with its origin. Synthetic only: fictional reservations, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFinanceReservations,financeItems,previoFinanceReader,resetPrevioFinanceCache,financeSearchXml} from '../shared-core/server-previo-finance.mjs';
import {mergeFinance,financeRows,financeTotals,financeRowText,financeGroup} from '../napi-kezelo/penzugy-view.mjs';

const FAKE='Kitalált Vendég',MAIL='kitalalt@example.test',PHONE='+36 30 123 4567';
const res=(id,{voucher,status=2,from='2026-12-10',to='2026-12-12',price=99000,partner,opt,obj=2392197})=>`<reservation><resId>${id}</resId>${voucher?`<voucher>${voucher}</voucher>`:''}<status><statusId>${status}</statusId>${opt?`<optionExpiration>${opt}</optionExpiration>`:''}</status><term><from>${from}</from><to>${to}</to></term><created>2026-11-20 10:00:00</created><price>${price}</price><currency><curId>1</curId><code>HUF</code></currency><object><objId>${obj}</objId><name>Ház</name></object><objectKind><obkId>1</obkId><name>Deluxe</name></objectKind>${partner===undefined?'':`<partner>${partner}</partner>`}<guest><name>${FAKE}</name><email>${MAIL}</email><phone>${PHONE}</phone></guest><gNote>titok</gNote><contactPerson><name>${FAKE}</name></contactPerson></reservation>`;
const XML='<reservations>'+[
 res(101,{voucher:'SC-OWN1',price:181500}),                                             // our chat booking (case reference V2-101)
 res(102,{voucher:'BK-9',partner:'<prpId>770</prpId><name>Booking.com XML</name>'}),     // OTA
 res(103,{voucher:'SZ-1',partner:'<prpId>1334</prpId><name>Szallas GROUP</name>'}),      // OTA
 res(104,{voucher:'WEB-1'}),                                                            // no partner → unknown
 res(105,{voucher:'GRP-1',price:50000}),res(106,{voucher:'GRP-1',price:60000,obj:2392199}),  // one booking, two rooms
 res(107,{voucher:'X-7',status:7}),                                                     // cancelled
 res(108,{voucher:'P-1',partner:`<prpId>1</prpId><name>${FAKE}</name>`}),                // partner that is not a channel name
 res(109,{voucher:'OPT-1',status:1,opt:'2026-11-27 10:00:00'}),                          // option
 res(110,{voucher:'GRP-2',price:1}),res(111,{voucher:'GRP-2',status:7,price:2}),          // two rooms, one cancelled
].join('')+'</reservations>';

const ownRow=(caseId,{reference,status='finalized',amount=90750,deadline='2026-11-26T19:00:00Z',channel='chat',name='Teszt Anna'})=>({caseId,tenantId:'sarberki-test',kind:'test-mailbox',
 summary:{name,channel,unit:'Deluxe 11',arrival:'2026-12-10',departure:'2026-12-12',booking:status,finance:{amount,deadlineUtc:deadline,receivedOn:status==='deposit_received'?'2026-11-24':null,reference,reminders:{}}}});
const NOW=Date.parse('2026-11-25T12:00:00Z');

test('Previo reservations → business facts only, one item per booking, origin from the sales partner',()=>{
 const list=parseFinanceReservations(XML),out=JSON.stringify(list);
 for(const v of [FAKE,MAIL,PHONE,'titok'])assert.ok(!out.includes(v),v);
 assert.equal(list.length,11);assert.deepEqual(list[0].partner,null);assert.equal(list[0].house,'Deluxe');assert.equal(list[0].unit,'11');
 const items=financeItems(list),by=Object.fromEntries(items.map(i=>[i.voucher,i]));
 assert.equal(items.length,9,'GRP-1 and GRP-2 are one booking each');
 assert.deepEqual(by['GRP-1'].resIds,[105,106]);assert.equal(by['GRP-1'].rooms,2);assert.equal(by['GRP-1'].price,110000);assert.equal(by['GRP-1'].unit,null);
 assert.equal(by['GRP-2'].rooms,1);assert.equal(by['GRP-2'].price,1,'a cancelled room is not counted');assert.equal(by['GRP-2'].state,'confirmed');
 assert.deepEqual(by['BK-9'].source,{group:'external',channel:'Booking.com XML'});assert.deepEqual(by['SZ-1'].source,{group:'external',channel:'Szallas GROUP'});
 assert.deepEqual(by['P-1'].source,{group:'external',channel:'Previo-partner #1'},'a non-channel partner name is never shown');
 assert.deepEqual(by['WEB-1'].source,{group:'unknown',channel:null},'no partner: unknown, not guessed');
 assert.equal(by['X-7'].state,'cancelled');assert.equal(by['OPT-1'].optionExpiration,'2026-11-27 10:00:00');assert.equal(by['BK-9'].optionExpiration,null);
});

test('merge: our case and its Previo booking are ONE item; Previo-only bookings get the unknown-payment group',()=>{
 const items=financeItems(parseFinanceReservations(XML));
 const rows=mergeFinance([ownRow('tm-aaaaaaaaaaaa0001',{reference:'V2-101'}),ownRow('tm-aaaaaaaaaaaa0002',{reference:'DEMO-1',channel:'email',name:'Teszt Béla'}),
  ownRow('tm-aaaaaaaaaaaa0003',{reference:'V2-107',channel:'phone',name:'Teszt Cili'})],items);
 assert.equal(rows.length,3+items.length-2,'V2-101 and V2-107 are not listed twice');
 assert.ok(!rows.some(r=>r.caseId==='p-101'||r.caseId==='p-107'));
 const by=Object.fromEntries(rows.map(r=>[r.caseId,r]));
 assert.equal(by['tm-aaaaaaaaaaaa0001'].source,'own');assert.equal(by['tm-aaaaaaaaaaaa0001'].channel,'chatbot');assert.equal(by['tm-aaaaaaaaaaaa0001'].previoState,'confirmed');
 assert.equal(by['tm-aaaaaaaaaaaa0002'].channel,'e-mail');
 // Staff cancelled in Previo, our case still waits for a deposit: the row warns, the case is not silently changed.
 const cili=financeRowText(by['tm-aaaaaaaaaaaa0003'],NOW);assert.ok(cili.lines.some(l=>l.includes('A Previóban lemondva')));assert.equal(financeGroup(by['tm-aaaaaaaaaaaa0003'],NOW),'soon');
 assert.equal(financeGroup(by['p-102'],NOW),'nopay');assert.equal(financeGroup(by['p-109'],NOW),'nopay');
 const bk=financeRowText(by['p-102'],NOW);
 assert.equal(bk.title,'Previo BK-9 · 11 · 2026. 12. 10. – 2026. 12. 12.');
 assert.deepEqual(bk.lines,['Forrás: Rendszeren kívüli – Booking.com XML','Previo-állapot: megerősítve','Foglalás összege (Previo): 99 000 Ft','Foglaló / befizetés: a Previo nem adja meg – NEM IGAZOLT, ellenőrizd a Previóban']);
 assert.ok(financeRowText(by['p-109'],NOW).lines[1].includes('opció lejár: 2026-11-27 10:00:00'));
 assert.equal(financeRowText(by['p-105'],NOW).lines[1],'Previo-állapot: megerősítve · 2 egység');
 assert.equal(financeRowText(by['p-104'],NOW).lines[0],'Forrás: Ismeretlen eredet');
 const x=financeRowText(by['p-107']??{caseId:'none',summary:{}},NOW);assert.ok(x);
 assert.equal(financeRowText(by['tm-aaaaaaaaaaaa0001'],NOW).lines[0],'Forrás: Saját rendszer – chatbot');
});

test('source filter, totals and search across both groups and the unknown origin',()=>{
 const items=financeItems(parseFinanceReservations(XML));
 const rows=mergeFinance([ownRow('tm-aaaaaaaaaaaa0001',{reference:'V2-101'}),ownRow('tm-aaaaaaaaaaaa0004',{reference:'DEMO-4',status:'deposit_received'})],items);
 const keys=o=>financeRows(rows,{now:NOW,...o}).map(x=>x.row.caseId);
 assert.deepEqual(keys({source:'own'}),['tm-aaaaaaaaaaaa0001','tm-aaaaaaaaaaaa0004']);
 assert.deepEqual(keys({source:'external'}).sort(),['p-102','p-103','p-108']);
 assert.deepEqual(keys({source:'unknown'}).sort(),['p-104','p-105','p-107','p-109','p-110']);
 assert.deepEqual(keys({query:'booking'}),['p-102']);assert.deepEqual(keys({query:'szallas'}),['p-103']);assert.deepEqual(keys({query:'ismeretlen eredet'}).length,5);
 assert.deepEqual(keys({group:'cancelled'}),['p-107']);
 const t=financeTotals(rows,NOW),te=financeTotals(rows,NOW,'external');
 assert.equal(t.soon.count,1);assert.equal(t.soon.amount,90750);assert.equal(t.received.count,1);assert.equal(t.nopay.count,7);assert.equal(t.nopay.amount,0,'no deposit amount is guessed for a Previo-only booking');
 assert.equal(te.nopay.count,3);assert.equal(te.soon.count,0);
 // Order: deadline groups first, the Previo-only bookings by arrival, cancelled last.
 const order=financeRows(rows,{now:NOW}).map(x=>x.group);assert.deepEqual([...new Set(order)],['soon','received','nopay','cancelled']);
 // Previo unreadable → only our cases, nothing invented.
 assert.equal(mergeFinance(rows.filter(r=>r.kind!=='previo'),null).length,2);
});

test('reader: switch and hotel gate, one read, cache, failure is an error (never an empty list)',async()=>{
 resetPrevioFinanceCache();
 const key='synthetic-previo-test-key-0123456789';let reads=0,body='';
 const ok=async(url,o)=>{reads++;body=o.body;assert.equal(url,'https://api.previo.app/x1/hotel/searchReservations');assert.equal(o.method,'POST');return new Response(XML);};
 assert.equal(previoFinanceReader({},ok),null);assert.equal(previoFinanceReader({PREVIO_PAYMENT_HINT:'test-only',PREVIO_HOTEL_ID:'753011',PREVIO_API_KEY:key},ok),null,'never the live hotel');
 let t=NOW;const r=previoFinanceReader({PREVIO_PAYMENT_HINT:'test-only',PREVIO_HOTEL_ID:'73521',PREVIO_API_KEY:key},ok,{now:()=>t});
 const v=await r();assert.equal(v.items.length,9);assert.deepEqual(v.window,{from:'2026-10-26',to:'2027-11-25'});assert.match(body,/<hotId>73521<\/hotId>/);assert.match(body,/<cosId>7<\/cosId>/);
 await r();assert.equal(reads,1,'cached');t+=11*60000;await r();assert.equal(reads,2);
 resetPrevioFinanceCache();
 const bad=previoFinanceReader({PREVIO_PAYMENT_HINT:'test-only',PREVIO_HOTEL_ID:'73521',PREVIO_API_KEY:key},async()=>new Response('<error><message>x</message></error>'));
 await assert.rejects(bad(),e=>e.code==='PREVIO_UNAVAILABLE');
 resetPrevioFinanceCache();
 assert.match(financeSearchXml({from:'2026-01-01',to:'2026-02-01'}),/<termType>overlap<\/termType>/);
});
