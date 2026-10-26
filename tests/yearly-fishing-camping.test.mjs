import test from 'node:test';
import assert from 'node:assert/strict';
import {TARIFF_2027,fishingTicketPrice,fishingOtherPrice,campingPrice} from '../price-source/yearly-fishing-camping.mjs';
import {fishing as old} from '../fishing-rules.mjs';

test('2027 normal lake adult and child ticket matrix',()=>{
  assert.deepEqual(Object.values(TARIFF_2027.fishing.tickets.normal.adult),[5000,7500,32500,86000,43000,53000]);
  assert.deepEqual(Object.values(TARIFF_2027.fishing.tickets.normal.child),[2500,3750,16250,43000,21500,26500]);
});
test('2027 record lake adult and child ticket matrix',()=>{
  assert.deepEqual(Object.values(TARIFF_2027.fishing.tickets.record.adult),[7500,11250,48750,129000,64500,80000]);
  assert.deepEqual(Object.values(TARIFF_2027.fishing.tickets.record.child),[3750,5650,24500,64500,32250,39750]);
});
test('2027 rental, fish kg and camping matrices',()=>{
  assert.deepEqual(Object.values(TARIFF_2027.fishing.rentalPerItemDay),[600,1000]);
  assert.deepEqual(Object.values(TARIFF_2027.fishing.fishPerKg),[4500,4500,1500,3500,2000,2000,1350,1350]);
  assert.deepEqual(Object.values(TARIFF_2027.camping.perItemDay),[2200,2200,3600,2200,2200,2600]);
  assert.equal(TARIFF_2027.camping.perPersonDay,1850);
  assert.equal(TARIFF_2027.camping.electricCarChargingPer24Hours,26000);
  assert.equal(TARIFF_2027.camping.tourismTaxNotIncluded,true);
});
test('2027 ticket selection respects guest restriction and separates accommodation price',()=>{
  assert.equal(fishingTicketPrice({date:'2027-06-10',lake:'record',person:'child',ticket:'hours24'}).amountHuf,5650);
  assert.equal(fishingTicketPrice({date:'2027-06-10',lake:'normal',person:'adult',ticket:'hours12',stayingGuest:true}).status,'not_allowed_for_staying_guests');
  assert.equal(fishingTicketPrice({date:'2027-06-10',lake:'normal',person:'adult',ticket:'hours24'}).accommodationTotalAffected,false);
});
test('2026 unchanged, 2028 not assumed',()=>{
  const before=JSON.stringify(old.tickets);
  assert.equal(fishingTicketPrice({date:'2026-11-10',lake:'normal',person:'adult',ticket:'hours24'}).amountHuf,7500);
  assert.equal(campingPrice({date:'2026-11-10',item:'tent'}).amountHuf,null);
  assert.equal(fishingTicketPrice({date:'2028-01-01',lake:'record',person:'adult',ticket:'year'}).amountHuf,null);
  assert.equal(JSON.stringify(old.tickets),before);
});
test('2027 camping and fish price results select proper year',()=>{
  assert.equal(campingPrice({date:'2027-05-10',item:'person'}).amountHuf,1850);
  assert.equal(campingPrice({date:'2027-05-10',item:'electricCarCharging'}).amountHuf,26000);
  assert.equal(fishingOtherPrice({date:'2027-05-10',group:'fishPerKg',item:'catfishNonAngler'}).amountHuf,3500);
  assert.equal(fishingOtherPrice({date:'2026-05-10',group:'rentalPerItemDay',item:'cradle'}).amountHuf,1000);
});
test('invalid dates and fee identifiers reject rather than invent',()=>{
  assert.throws(()=>campingPrice({date:'2027-02-30',item:'tent'}),TypeError);
  assert.throws(()=>campingPrice({date:'2027-05-10',item:'unknown'}),TypeError);
  assert.throws(()=>fishingTicketPrice({date:'2027-05-10',lake:'fake',person:'adult',ticket:'week'}),TypeError);
  assert.throws(()=>fishingOtherPrice({date:'2027-05-10',group:'fishPerKg',item:'trout'}),TypeError);
});
