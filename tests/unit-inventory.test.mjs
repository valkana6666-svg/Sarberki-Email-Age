import test from 'node:test';
import assert from 'node:assert/strict';
import {UNITS,unitsOfType,overlaps,conflictsFor,freeUnits,freeSameHousePairs,reserveSynthetic,cancelSynthetic} from '../shared-core/unit-inventory.mjs';

test('23 units derived from business-config, Previo room names, split houses per part',()=>{
 assert.equal(UNITS.length,23);
 assert.deepEqual(UNITS.map(u=>u.id),['1','2','3','4','5','6','7/A','7/B','7/C','8/A','8/B','8/C','9/A','9/B','9/C','10/A','10/B','10/C','11','12','13','14','15']);
 assert.deepEqual(unitsOfType('splitA').map(u=>u.id),['7/A','8/A','9/A','10/A']);
 assert.deepEqual(unitsOfType('deluxe').map(u=>u.id),['11','12','13','14']);
});

test('half-open stays: departure day is free for a new arrival; one shared night collides',()=>{
 const a={arrival:'2027-06-10',departure:'2027-06-13'};
 assert.equal(overlaps(a,{arrival:'2027-06-13',departure:'2027-06-15'}),false);
 assert.equal(overlaps(a,{arrival:'2027-06-07',departure:'2027-06-10'}),false);
 assert.equal(overlaps(a,{arrival:'2027-06-12',departure:'2027-06-14'}),true);
 assert.equal(overlaps(a,{arrival:'2027-06-09',departure:'2027-06-11'}),true);
 assert.equal(overlaps(a,{arrival:'2027-06-11',departure:'2027-06-12'}),true);
});

test('7/A and 7/B are separate units; a booking on 7/A never blocks 7/B',()=>{
 let r=reserveSynthetic([],{key:'syn-0001',unit:'7/A',arrival:'2027-06-10',departure:'2027-06-13',guests:2});
 const free=freeUnits(r.bookings,{cabin:'splitA',arrival:'2027-06-11',departure:'2027-06-12',source:'synthetic'});
 assert.deepEqual(free.free,['8/A','9/A','10/A']);
 assert.deepEqual(freeUnits(r.bookings,{cabin:'splitB',arrival:'2027-06-11',departure:'2027-06-12',source:'synthetic'}).free,['7/B','8/B','9/B','10/B']);
 assert.deepEqual(freeSameHousePairs(r.bookings,{arrival:'2027-06-11',departure:'2027-06-12',source:'synthetic'}).map(p=>p.join('+')),['8/A+8/B','9/A+9/B','10/A+10/B']);
});

test('double booking refused; idempotent retry returns the same booking; key reuse for another stay refused',()=>{
 const first=reserveSynthetic([],{key:'syn-0002',unit:'11',arrival:'2027-07-01',departure:'2027-07-05',guests:4});
 assert.equal(first.created,true);
 const again=reserveSynthetic(first.bookings,{key:'syn-0002',unit:'11',arrival:'2027-07-01',departure:'2027-07-05',guests:4});
 assert.equal(again.created,false);assert.equal(again.bookings.length,1);
 assert.throws(()=>reserveSynthetic(first.bookings,{key:'syn-0003',unit:'11',arrival:'2027-07-04',departure:'2027-07-06',guests:2}),/DOUBLE_BOOKING/);
 assert.throws(()=>reserveSynthetic(first.bookings,{key:'syn-0002',unit:'12',arrival:'2027-07-01',departure:'2027-07-05',guests:4}),/IDEMPOTENCY_KEY_REUSED/);
 const next=reserveSynthetic(first.bookings,{key:'syn-0004',unit:'11',arrival:'2027-07-05',departure:'2027-07-08',guests:2});
 assert.equal(next.created,true,'arrival on the departure day is allowed');
 assert.equal(first.bookings.length,1,'input list not mutated');
});

test('capacity per unit type; cancel releases the unit and keeps the record',()=>{
 assert.throws(()=>reserveSynthetic([],{key:'syn-0005',unit:'7/C',arrival:'2027-08-01',departure:'2027-08-03',guests:6}),/CAPACITY_EXCEEDED/);
 assert.equal(reserveSynthetic([],{key:'syn-0006',unit:'7/C',arrival:'2027-08-01',departure:'2027-08-03',guests:5}).created,true);
 const r=reserveSynthetic([],{key:'syn-0007',unit:'15',arrival:'2027-08-01',departure:'2027-08-03',guests:2});
 const cancelled=cancelSynthetic(r.bookings,'syn-0007');
 assert.equal(cancelled[0].status,'cancelled');
 assert.equal(conflictsFor(cancelled,{unit:'15',arrival:'2027-08-01',departure:'2027-08-03'}).length,0);
});

test('synthetic evidence is never guest-verifiable; sources are not mixed; invalid input refused',()=>{
 const synthetic=[{key:'s1',unit:'1',arrival:'2027-09-01',departure:'2027-09-03',source:'synthetic',status:'confirmed'}];
 const previo=[{key:'p1',unit:'1',arrival:'2027-09-01',departure:'2027-09-03',source:'previo-73521',status:'confirmed'}];
 const a=freeUnits(synthetic,{cabin:'vip',arrival:'2027-09-01',departure:'2027-09-02',source:'synthetic'});
 assert.equal(a.guestVerifiable,false);assert.equal(a.status,'UNAVAILABLE');
 const b=freeUnits(synthetic,{cabin:'vip',arrival:'2027-09-01',departure:'2027-09-02',source:'previo-73521'});
 assert.deepEqual(b.free,['1'],'a synthetic booking never affects the Previo view');assert.equal(b.guestVerifiable,true);
 assert.equal(freeUnits(previo,{cabin:'vip',arrival:'2027-09-01',departure:'2027-09-02',source:'previo-73521'}).status,'UNAVAILABLE');
 assert.throws(()=>freeUnits([],{cabin:'vip',arrival:'2027-09-03',departure:'2027-09-01',source:'synthetic'}),/INVALID_DATES/);
 assert.throws(()=>freeUnits([],{cabin:'tent',arrival:'2027-09-01',departure:'2027-09-02',source:'synthetic'}),/UNKNOWN_CABIN/);
 assert.throws(()=>conflictsFor([{key:'x',unit:'99',arrival:'2027-09-01',departure:'2027-09-02',source:'synthetic'}],{unit:'1',arrival:'2027-09-01',departure:'2027-09-02'}),/UNKNOWN_UNIT/);
 assert.throws(()=>reserveSynthetic([],{key:'x',unit:'1',arrival:'2027-09-01',departure:'2027-09-02',guests:2}),/IDEMPOTENCY_KEY_REQUIRED/);
});
