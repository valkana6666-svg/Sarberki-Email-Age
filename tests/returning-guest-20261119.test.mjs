// Owner 2026-11-19: returning-guest 20% discount from Previo past stays (prepared, switch off). Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {returningGuestDecision,applyReturningDiscount,returningGuestLine,normPhone} from '../shared-core/returning-guest.mjs';
import {staysFromXml,guestHistoryXml,previoGuestHistoryChecker} from '../shared-core/server-previo-guest-history.mjs';
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';
import {buildBookingConfirmation} from '../shared-core/booking-confirmation-draft.mjs';

const stays=[{email:'Teszt.Elek@Example.test',phone:'06 30 111 2222',name:'Teszt Elek',lastDay:'2025-08-10'},{email:'mas@example.test',phone:null,name:'Kovács Péter',lastDay:'2026-06-01'}];
test('decision (owner 2026-11-19): name + e-mail + phone all match → eligible; any partial match → operator decides',()=>{
 const ref='2026-11-19';
 const all={name:'Elek Teszt',email:'teszt.elek@example.test',phone:'+36 30 111 2222'};
 const d=returningGuestDecision({guest:all,stays,referenceDay:ref});
 assert.equal(d.status,'eligible');assert.deepEqual([...d.matchedBy],['name','email','phone']);assert.equal(d.lastStay,'2025-08-10');
 const two=returningGuestDecision({guest:{...all,phone:'+36 20 999 9999'},stays,referenceDay:ref});
 assert.equal(two.status,'possible');assert.deepEqual([...two.matchedBy],['name','email'],'two of three: the operator decides');
 assert.equal(returningGuestDecision({guest:{name:'Kovacs  Péter'},stays,referenceDay:ref}).status,'possible','a name never gives the discount automatically');
 assert.equal(returningGuestDecision({guest:{email:'teszt.elek@example.test'},stays,referenceDay:ref}).status,'possible','e-mail alone is not enough');
 assert.equal(returningGuestDecision({guest:all,stays,referenceDay:'2027-08-11'}).status,'none','731 days after the last day');
 assert.equal(returningGuestDecision({guest:all,stays,referenceDay:'2027-08-10'}).status,'eligible','exactly 730 days');
 assert.equal(returningGuestDecision({guest:{name:'Új Vendég',email:'uj@example.test'},stays,referenceDay:ref}).status,'none');
 assert.equal(normPhone('0036 30 111 2222'),normPhone('06-30-111-2222'));
});
test('price: 20% off the accommodation only; IFA unchanged; deposit from the discounted price; letter shows the discount',()=>{
 const q=fetchPublicPriceReference({arrival:'2027-05-14',departure:'2027-05-17',cabin:'family',adults:3,children:[5,6]});
 const d=applyReturningDiscount(q,{status:'eligible',pct:20,lastStay:'2025-08-10'});
 assert.equal(d.accommodation,144000);assert.equal(d.tourismTax,4950);assert.equal(d.total,148950);assert.equal(d.returningDiscount.amount,36000);
 assert.equal(applyReturningDiscount(q,{status:'possible',pct:20}),q,'only a certain match changes the price');
 const c=buildBookingConfirmation({values:{arrival:'2027-05-14',departure:'2027-05-17',adults:'3',children:'2',name:'Teszt Elek'},quote:d,previo:{reference:'V2-1',recordedAt:'2026-11-19T08:00:00Z'},language:'hu'});
 assert.match(c.text,/Szállásdíj: 180 000 Ft − törzsvendég-kedvezmény 20% \(36 000 Ft\) = 144 000 Ft, idegenforgalmi adó: 4 950 Ft, összesen: 148 950 Ft/);
 assert.equal(c.deposit.amount,72000);
 assert.match(c.text,/Törzsvendégként a dézsa bérleti díjából is 20% kedvezmény jár\./,'owner 2026-11-21: the hot tub too');
 assert.match(returningGuestLine({status:'eligible',matchedBy:['name','email','phone'],lastStay:'2025-08-10',pct:20}),/név, e-mail-cím és telefonszám is egyezik.*2025-08-10.*20%/);
 assert.match(returningGuestLine({status:'possible',matchedBy:['name'],lastStay:'2026-06-01',pct:20}),/csak ez egyezik.*: név\. .*a te döntésed/);
});
test('Previo history: checked-out stays only, contacts kept in memory; off unless both switches; TEST only; no data in the result',async()=>{
 const xml='<reservations>'+[[9,'a@example.test','2025-08-10'],[7,'b@example.test','2025-09-01'],[2,'c@example.test','2026-12-01']].map(([st,e,to])=>`<reservation><status><statusId>${st}</statusId></status><term><from>2025-01-01 14:00:00</from><to>${to} 10:00:00</to></term><contactPerson><name>X</name><email>${e}</email></contactPerson></reservation>`).join('')+'</reservations>';
 assert.deepEqual(staysFromXml(xml),[{email:'a@example.test',phone:null,name:'X',lastDay:'2025-08-10'}]);
 assert.match(guestHistoryXml({hotelId:'73521',from:'2024-11-20',to:'2026-11-19'}),/<cosId>9<\/cosId>/);
 const env={RETURNING_GUEST_CHECK:'test-only',PREVIO_READ_API_ENABLED:'sandbox-73521-only',PREVIO_HOTEL_ID:'73521',PREVIO_API_KEY:'k'.repeat(20)};
 assert.equal(previoGuestHistoryChecker({...env,RETURNING_GUEST_CHECK:''}),null);
 assert.equal(previoGuestHistoryChecker({...env,PREVIO_HOTEL_ID:'753011'}),null,'the live property is not wired');
 const r=await previoGuestHistoryChecker(env,async()=>new Response(xml))({guest:{email:'a@example.test'},referenceDay:'2026-11-19'});
 assert.equal(r.status,'possible','e-mail only → operator');assert.equal(JSON.stringify(r).includes('example.test'),false,'no guest data in the result');
 assert.equal((await previoGuestHistoryChecker(env,async()=>new Response('nope',{status:500}))({guest:{},referenceDay:'2026-11-19'})).status,'unknown');
});
