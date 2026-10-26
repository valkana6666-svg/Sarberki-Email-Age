import test from 'node:test';
import assert from 'node:assert/strict';
import {BUSINESS} from '../business-config.mjs';
import {SARBERKI_TARIFF_2027,sarberkiTariffForNight} from '../business/sarberki/tariffs.mjs';
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';
const approved={vip:[63000,4],family:[55000,4],deluxe:[63000,4],splitC:[46000,4],splitA:[24000,2],splitB:[24000,2],small:[31500,2]};
const old={vip:[60000,4],family:[52000,4],deluxe:[60000,4],splitC:[44000,4],splitA:[23000,2],splitB:[23000,2],small:[30000,2]};
const quote=(cabin,adults,extra={})=>fetchPublicPriceReference({arrival:'2027-05-10',departure:'2027-05-12',cabin,adults,children:[],...extra});

test('2027 signed final PDF replaces obsolete 2027 figures without changing 4/2 guest base',()=>{
 assert.equal(SARBERKI_TARIFF_2027.validFrom,'2027-01-01');
 assert.equal(SARBERKI_TARIFF_2027.validThrough,'2027-12-31');
 assert.equal(SARBERKI_TARIFF_2027.extraAdultNightlyHuf,10000);
 assert.equal(SARBERKI_TARIFF_2027.child3to8NightlyHuf,5000);
 for(const [cabin,[nightlyHuf,includedGuests]] of Object.entries(approved)){
  assert.deepEqual(sarberkiTariffForNight('2027-01-01',cabin),{nightlyHuf,includedGuests});
  assert.deepEqual(sarberkiTariffForNight('2027-12-31',cabin),{nightlyHuf,includedGuests});
  assert.equal(Object.isFrozen(SARBERKI_TARIFF_2027.rates[cabin]),true);
 }
});
test('all 2026 legacy accommodation prices and configuration are unchanged',()=>{
 const before=JSON.stringify(BUSINESS);
 for(const [cabin,[nightlyHuf,includedGuests]] of Object.entries(old)){
  assert.deepEqual(sarberkiTariffForNight('2026-12-31',cabin),{nightlyHuf,includedGuests});
  assert.equal(quote(cabin,includedGuests,{arrival:'2026-11-10',departure:'2026-11-12'}).accommodation,2*nightlyHuf);
 }
 assert.equal(JSON.stringify(BUSINESS),before);
});
test('all seven 2027 base accommodation quotes reference approved PDF amounts',()=>{
 for(const [cabin,[nightlyHuf,included]] of Object.entries(approved)){
  const q=quote(cabin,included);
  assert.equal(q.accommodation,nightlyHuf*2);assert.equal(q.referenceOnly,true);
  assert.equal(q.availability,'not_checked');assert.equal(q.bookingCompleted,false);
 }
});
test('2027 adult-only occupancy rows charge exactly 10000 HUF per excess adult per normal night',()=>{
 const samples=[['vip',5,73000],['vip',7,93000],['deluxe',6,83000],
  ['family',8,95000],['splitC',5,56000]];
 for(const [cabin,adults,nightly] of samples)
  assert.equal(quote(cabin,adults).accommodation,nightly*2,cabin);
 assert.throws(()=>quote('small',3),/kapacitását/u);
 assert.throws(()=>quote('splitA',3),/kapacitását/u);
});
test('2027 0–2y children are free; age >=3 is held for explicit child-price clarification',()=>{
 assert.equal(quote('deluxe',2,{children:[0,2]}).accommodation,126000);
 assert.throws(()=>quote('deluxe',2,{children:[3]}),/gyermekár/u);
 assert.throws(()=>quote('deluxe',2,{children:[5,8]}),/gyermekár/u);
 assert.throws(()=>quote('deluxe',2,{children:[12]}),/gyermekár/u);
 assert.throws(()=>quote('deluxe',4,{children:[2]}),/pótvendég-\/gyermekár/u);
});
test('2027 high season until Aug 20, unresolved Aug 21/22 blocked, post-boundary normal',()=>{
 assert.equal(quote('deluxe',4,{arrival:'2027-07-01',departure:'2027-07-03'}).accommodation,138600);
 assert.equal(quote('vip',5,{arrival:'2027-08-20',departure:'2027-08-21'}).accommodation,96360);
 for(const d of ['2027-08-21','2027-08-22'])
  assert.throws(()=>quote('vip',4,{arrival:d,departure:d==='2027-08-21'?'2027-08-22':'2027-08-23'}),/főszezonhatár/u);
 assert.equal(quote('deluxe',4,{arrival:'2027-08-23',departure:'2027-08-24'}).accommodation,75600);
 assert.equal(quote('deluxe',4,{departure:'2027-05-11'}).accommodation,75600);
 assert.equal(quote('deluxe',4,{arrival:'2026-08-21',departure:'2026-08-22'}).accommodation,72000);
});
test('2027 seventh free night requires manual calculation rather than invented total',()=>{
 assert.throws(()=>quote('deluxe',4,{arrival:'2027-05-10',departure:'2027-05-17'}),/hetedik ingyenes/u);
 assert.equal(quote('deluxe',4,{arrival:'2027-05-10',departure:'2027-05-16'}).accommodation,6*63000);
});
test('2026/2027 New Year tariff picks each occupied night; 2028 blocked',()=>{
 assert.equal(quote('deluxe',4,{arrival:'2026-12-31',departure:'2027-01-02'}).accommodation,123000);
 assert.equal(quote('deluxe',4,{arrival:'2027-12-31',departure:'2028-01-01'}).accommodation,75600);
 assert.throws(()=>quote('deluxe',4,{arrival:'2027-12-31',departure:'2028-01-02'}),/nincs jóváhagyott alapár/u);
 assert.throws(()=>quote('deluxe',5,{arrival:'2026-12-31',departure:'2027-01-02'}),/pótvendég/u);
});
test('invalid dates and unapproved years fail closed',()=>{
 assert.throws(()=>quote('deluxe',4,{arrival:'2028-05-10',departure:'2028-05-12'}),/nincs jóváhagyott alapár/u);
 for(const d of ['2027-02-30','2027-1-01','not-a-date'])
  assert.throws(()=>sarberkiTariffForNight(d,'deluxe'),/tarifa-dátum/u);
});
