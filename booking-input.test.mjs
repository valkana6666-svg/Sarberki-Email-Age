import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBookingInput,BOOKING_CHANNELS} from './booking-input.mjs';

const text='2026. október 23-25. között Deluxe házat szeretnénk 2 felnőtt és 2 gyermek részére. A gyerekek 6 és 10 évesek. Telefon: +36 30 555 1234.';

test('email web form and phone AI produce the same booking facts',()=>{
  const records=BOOKING_CHANNELS.slice(0,3).map(channel=>normalizeBookingInput({channel,text,now:new Date('2026-10-03T10:00:00Z')}));
  for(const r of records){
    assert.equal(r.booking.arrival,'2026-10-23');
    assert.equal(r.booking.departure,'2026-10-25');
    assert.equal(r.booking.cabin,'Deluxe');
    assert.equal(r.booking.guests,4);
    assert.equal(r.booking.adults,2);
    assert.equal(r.booking.children,2);
    assert.deepEqual(r.booking.childAges,[6,10]);
    assert.equal(r.readyForPrice,true);
  }
  assert.deepEqual(records[0].booking,records[1].booking);
  assert.deepEqual(records[1].booking,records[2].booking);
});

test('total-only guest count is not treated as adult count',()=>{
  const r=normalizeBookingInput({channel:'phone_ai',text:'Skupaj 5 oseb. Želimo Deluxe nastanitev od 20. do 23. novembra 2026.',now:new Date('2026-10-03T10:00:00Z')});
  assert.equal(r.booking.guests,5);
  assert.equal(r.booking.adults,null);
  assert.equal(r.booking.children,null);
  assert.ok(r.missing.includes('adults'));
  assert.ok(r.missing.includes('children_status'));
  assert.equal(r.readyForPrice,false);
});

test('explicit no-children statement makes child status known',()=>{
  const r=normalizeBookingInput({channel:'phone_ai',text:'2026. november 20-23. között Deluxe ház, 4 felnőtt, gyermek nélkül.',now:new Date('2026-10-03T10:00:00Z')});
  assert.equal(r.booking.adults,4);
  assert.equal(r.booking.children,0);
  assert.ok(!r.missing.includes('children_status'));
});

test('unknown channel is rejected',()=>{
  assert.throws(()=>normalizeBookingInput({channel:'fax',text:'teszt'}),/Nem támogatott/u);
});
