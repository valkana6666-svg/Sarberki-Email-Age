import test from 'node:test';
import assert from 'node:assert/strict';
import {BUSINESS} from '../business-config.mjs';
import {SARBERKI_TARIFF_2027,sarberkiTariffForNight} from '../business/sarberki/tariffs.mjs';
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';
const expected={vip:[60000,4],family:[52000,4],deluxe:[60000,4],splitC:[44000,4],splitA:[23000,2],splitB:[23000,2],small:[30000,2]};
const quote=(cabin,adults,extra={})=>fetchPublicPriceReference({arrival:'2027-05-10',departure:'2027-05-12',cabin,adults,children:[],...extra});
test('2027 approved base rates and included guests are explicit and immutable',()=>{
 assert.equal(SARBERKI_TARIFF_2027.validFrom,'2027-01-01');assert.equal(SARBERKI_TARIFF_2027.validThrough,'2027-12-31');
 for(const [cabin,[nightlyHuf,includedGuests]] of Object.entries(expected)){
  assert.deepEqual(sarberkiTariffForNight('2027-01-01',cabin),{nightlyHuf,includedGuests});
  assert.deepEqual(sarberkiTariffForNight('2027-12-31',cabin),{nightlyHuf,includedGuests});
  assert.equal(Object.isFrozen(SARBERKI_TARIFF_2027.rates[cabin]),true);
 }
 assert.equal(SARBERKI_TARIFF_2027.extraAdultNightlyHuf,null);assert.equal(SARBERKI_TARIFF_2027.extraChildNightlyHuf,null);
});
test('2026 legacy rates and configuration stay unchanged',()=>{
 const before=JSON.stringify(BUSINESS);
 for(const [cabin,[nightlyHuf,includedGuests]] of Object.entries(expected)){
  assert.deepEqual(sarberkiTariffForNight('2026-12-31',cabin),{nightlyHuf,includedGuests});
  const q=quote(cabin,includedGuests,{arrival:'2026-11-10',departure:'2026-11-12'});
  assert.equal(q.accommodation,2*nightlyHuf);
 }
 assert.equal(JSON.stringify(BUSINESS),before);
});
test('2027 reference uses approved house prices for every supported type',()=>{
 for(const [cabin,[nightlyHuf,included]] of Object.entries(expected)){
  const q=quote(cabin,included);
  assert.equal(q.accommodation,nightlyHuf*2);assert.equal(q.referenceOnly,true);assert.equal(q.availability,'not_checked');
 }
});
test('2027 adults/children within the included base do not add invented fees',()=>{
 const q=quote('deluxe',2,{children:[5,8]});assert.equal(q.accommodation,120000);assert.equal(q.tourismTax,2200);
 assert.equal(q.total,122200);assert.equal(q.bookingCompleted,false);
});
test('2027 unapproved extra adult and child rates still block a total',()=>{
 assert.throws(()=>quote('deluxe',5),/pótvendég-\/gyermekár/u);
 assert.throws(()=>quote('deluxe',4,{children:[5]}),/pótvendég-\/gyermekár/u);
 assert.throws(()=>quote('splitC',5),/pótvendég-\/gyermekár/u);
});
test('2027 seasonal and single-night calculation rules remain unchanged',()=>{
 assert.equal(quote('deluxe',4,{arrival:'2027-07-01',departure:'2027-07-03'}).accommodation,132000);
 assert.equal(quote('deluxe',4,{departure:'2027-05-11'}).accommodation,72000);
});
test('occupied nights select the tariff across New Year and exclude departure day',()=>{
 assert.equal(quote('deluxe',4,{arrival:'2026-12-31',departure:'2027-01-02'}).accommodation,120000);
 assert.equal(quote('deluxe',4,{arrival:'2027-12-31',departure:'2028-01-01'}).accommodation,72000);
 assert.throws(()=>quote('deluxe',4,{arrival:'2027-12-31',departure:'2028-01-02'}),/nincs jóváhagyott alapár/u);
});
test('unknown tariff year and invalid tariff date fail closed',()=>{
 assert.throws(()=>quote('deluxe',4,{arrival:'2028-05-10',departure:'2028-05-12'}),/nincs jóváhagyott alapár/u);
 for(const d of ['2027-02-30','2027-1-01','not-a-date'])assert.throws(()=>sarberkiTariffForNight(d,'deluxe'),/tarifa-dátum/u);
});
