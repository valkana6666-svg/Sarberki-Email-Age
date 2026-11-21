// Owner 2026-11-19 (PERM-20261119-CHAT-PREFILL, TEST 73521 only): a confirmed chat booking is pre-filled in Previo as a
// 48-hour option; the daily view's approval reuses it (its unit, never blocked by itself) and moves the expiry to the
// deposit deadline. Synthetic only: no network, fictional data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {prefillChatBooking,PREFILL_OPTION_HOURS} from '../shared-core/server-chat-prefill.mjs';
import {findOwnPrevioBooking,unitDecision} from '../shared-core/server-previo-unit-check.mjs';
import {buildModifyXml,voucherFor} from '../shared-core/server-previo-reservation-write.mjs';
import {previoBookingWriter} from '../shared-core/server-previo-booking-sync.mjs';

const facts={arrival:'2027-05-14',departure:'2027-05-17',adults:3,children:2,childAges:[5,6],cabin:'family'};
const NOW=Date.parse('2026-11-19T08:00:00Z');
const fakeWriter=()=>{const calls=[];return {calls,createOption:async a=>{calls.push(a);return {resId:4242,voucher:voucherFor(a),created:true};}};};

test('prefill: off without its own switch; needs a name; picks the first free unit; 48 h option, accommodation price, chat source',async()=>{
 const w=fakeWriter(),check=async({unit})=>({status:unit==='2'?'taken':'free'});
 const base={tenantId:'sarberki-test',caseId:'tm-abcdefabcdefabcdefabcdef',facts,name:'Teszt Elek',email:'valkana6666@gmail.com',phone:'+36 30 000 0000',writer:w,unitCheckFn:check,now:()=>NOW};
 assert.equal((await prefillChatBooking({...base,env:{}})).status,'off');
 assert.equal((await prefillChatBooking({...base,env:{CHAT_PREVIO_PREFILL:'test-only'},name:' '})).reason,'NAME_REQUIRED');
 const r=await prefillChatBooking({...base,env:{CHAT_PREVIO_PREFILL:'test-only'}});
 assert.equal(r.status,'created');assert.equal(r.unit,'3','unit 2 is taken, the next Családi house');
 const a=w.calls[0];
 assert.equal(a.channel,'chat');assert.equal(a.totalHuf,180000,'accommodation only, Previo adds the IFA');
 assert.equal(a.optionExpiresUtc,new Date(NOW+PREFILL_OPTION_HOURS*3600000).toISOString());
 assert.deepEqual(a.values,{arrival:'2027-05-14',departure:'2027-05-17',adults:'3',children:'2',child_ages:'5,6'});
 assert.deepEqual(a.contact,{email:'valkana6666@gmail.com',phone:'+36 30 000 0000'});
 const other=fakeWriter();await prefillChatBooking({...base,writer:other,env:{CHAT_PREVIO_PREFILL:'test-only'},email:'vendeg@example.test'});
 assert.equal(other.calls[0].contact,null,'no real guest contact data on TEST');
 assert.equal((await prefillChatBooking({...base,env:{CHAT_PREVIO_PREFILL:'test-only'},unitCheckFn:async()=>({status:'taken'})})).reason,'NO_FREE_UNIT');
 assert.equal((await prefillChatBooking({...base,env:{CHAT_PREVIO_PREFILL:'test-only'},facts:{...facts,childAges:[5]}})).reason,'FACTS');
 const failing={createOption:async()=>{const e=Error('x');e.code='PREVIO_WRITE_UNCERTAIN';throw e;}};
 assert.deepEqual(await prefillChatBooking({...base,env:{CHAT_PREVIO_PREFILL:'test-only'},writer:failing}),{status:'failed',reason:'PREVIO_WRITE_UNCERTAIN'});
});

const xml=rows=>'<?xml version="1.0"?><reservations>'+rows.map(r=>`<reservation><resId>${r.resId}</resId><voucher>${r.voucher}</voucher><status><statusId>${r.status}</statusId></status><term><from>${r.from} 14:00:00</from><to>${r.to} 10:00:00</to></term><object><objId>${r.objId}</objId></object></reservation>`).join('')+'</reservations>';
test('own Previo booking: found by booking number over a wide window, with its (staff-changed) unit and dates; cancelled ignored',async()=>{
 const v='SC-0123456789ABCDEF';let body='';
 const fetchImpl=async(u,o)=>{body=o.body;return new Response(xml([{resId:1,voucher:v,status:1,from:'2027-05-14',to:'2027-05-17',objId:2392191},{resId:2,voucher:v,status:7,from:'2027-05-14',to:'2027-05-17',objId:2392187},{resId:3,voucher:'SC-FFFFFFFFFFFFFFFF',status:1,from:'2027-05-14',to:'2027-05-17',objId:2392189}]));};
 const r=await findOwnPrevioBooking({apiKey:'k'.repeat(20),voucher:v,arrival:'2027-05-14',departure:'2027-05-17',fetchImpl});
 assert.equal(r.status,'read');assert.deepEqual(r.bookings.map(b=>[b.resId,b.unit,b.from,b.to]),[[1,'4','2027-05-14','2027-05-17']]);
 assert.match(body,/<from>2027-03-15<\/from><to>2027-07-16<\/to>/,'60-day window both sides');
 assert.equal((await findOwnPrevioBooking({apiKey:'k'.repeat(20),voucher:'bad',arrival:'2027-05-14',departure:'2027-05-17',fetchImpl})).status,'unknown');
 // The case's own option never blocks its unit; anyone else's does.
 assert.equal(unitDecision([{objId:9,statusId:1,from:'2027-05-14',to:'2027-05-17',voucher:v}],{objId:9,arrival:'2027-05-14',departure:'2027-05-17',previoReference:v}).status,'free');
 assert.equal(unitDecision([{objId:9,statusId:1,from:'2027-05-14',to:'2027-05-17',voucher:'SC-1111111111111111'}],{objId:9,arrival:'2027-05-14',departure:'2027-05-17',previoReference:v}).status,'taken');
});

test('approval of a pre-filled option: the expiry moves to the deposit deadline (modify + read-back); unverified → false',async()=>{
 const x=buildModifyXml({resId:5,comId:6,cabin:'family',unit:'3',values:{arrival:'2027-05-14',departure:'2027-05-17'},totalHuf:180000,optionExpiresUtc:'2026-11-26T07:00:00.000Z'}).xml;
 assert.match(x,/<optionExpiration>2026-11-26 08:00:00<\/optionExpiration>/,'hotel-local time');
 assert.doesNotMatch(buildModifyXml({resId:5,comId:6,cabin:'family',unit:'3',values:{arrival:'2027-05-14',departure:'2027-05-17'},totalHuf:180000}).xml,/optionExpiration/);
 const env={PREVIO_WRITE_ENABLED:'sandbox-73521-only',PREVIO_HOTEL_ID:'73521',PREVIO_WRITE_PERMISSION_ID:'PERM-20261119-CHAT-PREFILL',PREVIO_API_KEY:'k'.repeat(20)};
 const tenantId='sarberki-test',caseId='tm-abcdefabcdefabcdefabcdef',voucher=voucherFor({tenantId,caseId});
 let expiry='2026-11-21 09:00:00';const posts=[];
 const block=()=>`<reservations><reservation><resId>77</resId><comId>88</comId><voucher>${voucher}</voucher><optionExpiration>${expiry}</optionExpiration></reservation></reservations>`;
 const fetchImpl=async(u,o)=>{posts.push(String(u));if(String(u).endsWith('/reservation')){if(/<optionExpiration>/.test(o.body))expiry=o.body.match(/<optionExpiration>([^<]+)/)[1];return new Response('<reservations><reservation><resId>77</resId></reservation></reservations>');}return new Response(block());};
 const w=previoBookingWriter(env,fetchImpl);
 const args={tenantId,caseId,resId:77,values:{arrival:'2027-05-14',departure:'2027-05-17'},cabin:'family',unit:'3',totalHuf:180000,optionExpiresUtc:'2026-11-26T07:00:00.000Z'};
 assert.equal(await w.extendOption(args),true);assert.equal(expiry,'2026-11-26 08:00:00');
 const stubborn=previoBookingWriter(env,async(u,o)=>String(u).endsWith('/reservation')?new Response('<reservations><reservation><resId>77</resId></reservation></reservations>'):new Response(block()));
 expiry='2026-11-21 09:00:00';assert.equal(await stubborn.extendOption(args),false,'Previo kept the old expiry → the operator is told');
});

test('#9 7005064928: the pre-fill writes the returning-guest price and a staff note into Previo',async()=>{
 const {prefillNote}=await import('../shared-core/server-chat-prefill.mjs');
 const w=fakeWriter();
 const base={env:{CHAT_PREVIO_PREFILL:'test-only'},tenantId:'sarberki-test',caseId:'tm-abcdefabcdefabcdefabcdef',facts,name:'Teszt Elek',email:'valkana6666@gmail.com',phone:'+36 30 000 0000',writer:w,unitCheckFn:async()=>({status:'free'}),now:()=>NOW};
 let asked=null;
 await prefillChatBooking({...base,historyFn:async a=>{asked=a;return {status:'eligible',matchedBy:['name','email','phone'],lastStay:'2025-08-13',pct:20};}});
 assert.equal(asked.referenceDay,'2027-05-14','owner 2026-11-21: 730 days back from the arrival');
 assert.equal(w.calls[0].totalHuf,144000,'180 000 − 20%');assert.match(w.calls[0].note,/Törzsvendég.*20 százalék kedvezmény beszámítva \(36000 Ft\)/);assert.doesNotMatch(w.calls[0].note,/[,:–]/,'Previo drops these characters');
 const w2=fakeWriter();await prefillChatBooking({...base,writer:w2,historyFn:async()=>({status:'possible',matchedBy:['name'],lastStay:'2025-08-13',pct:20})});
 assert.equal(w2.calls[0].totalHuf,180000,'a partial match never changes the price');assert.match(w2.calls[0].note,/Lehetséges törzsvendég/);
 const w3=fakeWriter();await prefillChatBooking({...base,writer:w3,historyFn:null});
 assert.equal(w3.calls[0].totalHuf,180000);assert.match(w3.calls[0].note,/állítsd megerősítettre\./);assert.doesNotMatch(prefillNote(null),/@/);
 const {buildReservationXml}=await import('../shared-core/server-previo-reservation-write.mjs');
 const x=buildReservationXml({tenantId:'t',caseId:'c',values:{arrival:'2027-06-10',departure:'2027-06-13',adults:'2',children:'0',child_ages:''},cabin:'deluxe',unit:'11',contactName:'A',totalHuf:1,optionExpiresUtc:'2027-01-01T00:00:00Z',note:'Teszt <megjegyzés>\nsor'}).xml;
 assert.match(x,/<gNote>Teszt &lt;megjegyzés&gt; sor<\/gNote>/);
});
