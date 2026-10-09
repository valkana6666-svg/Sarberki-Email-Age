import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchPublicPriceReference} from './public-price-fallback.mjs';

test('split base reference remains available when no extra-guest rate is needed',()=>{
  const q=fetchPublicPriceReference({
    arrival:'2027-10-01',
    departure:'2027-10-03',
    cabin:'splitC',
    adults:4,
    children:[]
  });
  assert.equal(q.status,'public_reference');
  assert.equal(q.referenceOnly,true);
  assert.equal(q.availability,'not_checked');
  assert.equal(q.accommodation,88000);
  assert.equal(q.tourismTax,4400);
  assert.equal(q.total,92400);
});

test('split reference fails closed when a fifth adult would require the stale extra-person rate',()=>{
  assert.throws(()=>fetchPublicPriceReference({
    arrival:'2027-10-01',
    departure:'2027-10-03',
    cabin:'splitC',
    adults:5,
    children:[]
  }),/pótvendég-\/gyermekár.*nem hitelesített/u);
});

test('split reference fails closed when an extra child would require the stale child rate',()=>{
  assert.throws(()=>fetchPublicPriceReference({
    arrival:'2027-10-01',
    departure:'2027-10-03',
    cabin:'splitC',
    adults:4,
    children:[5]
  }),/pótvendég-\/gyermekár.*nem hitelesített/u);
});

test('fixed Deluxe and Family cabin base price is identical for 1, 3 and 4 guests',()=>{
  for(const cabin of ['deluxe','family','vip']){
    const totals=[];
    for(const adults of [1,3,4]){
      const q=fetchPublicPriceReference({arrival:'2027-10-01',departure:'2027-10-03',cabin,adults,children:[]});
      assert.equal(q.status,'public_reference');assert.equal(q.availability,'not_checked');
      totals.push(q.accommodation);
    }
    assert.deepEqual(totals,[totals[0],totals[0],totals[0]]);
  }
});

test('children within included house capacity never create per-child accommodation surcharge',()=>{
  const withoutChildren=fetchPublicPriceReference({arrival:'2027-10-01',departure:'2027-10-03',cabin:'deluxe',adults:2,children:[]});
  const withChildren=fetchPublicPriceReference({arrival:'2027-10-01',departure:'2027-10-03',cabin:'deluxe',adults:2,children:[5,8]});
  assert.equal(withChildren.accommodation,withoutChildren.accommodation);
  assert.equal(withChildren.tourismTax,withoutChildren.tourismTax);
  assert.equal(withChildren.total,withoutChildren.total);
  assert.equal(withChildren.availability,'not_checked');
});

test('multiple full-price units have separate per-unit totals',()=>{
  const q=fetchPublicPriceReference({arrival:'2027-10-01',departure:'2027-10-03',cabin:'deluxe',adults:4,children:[5,8,11,12],units:2});
  assert.equal(q.unitBreakdown.length,2);
  assert.equal(q.accommodation,240000);
  assert.equal(q.tourismTax,4400);
  assert.equal(q.total,244400);
  assert.equal(q.unitBreakdown.reduce((s,u)=>s+u.total,0),q.total);
});

test('no invented total when guests require unverified extra-person charges',()=>{
  assert.throws(()=>fetchPublicPriceReference({arrival:'2027-10-01',departure:'2027-10-03',cabin:'deluxe',adults:5,children:[]}),/pótvendég-\/gyermekár/u);
});
