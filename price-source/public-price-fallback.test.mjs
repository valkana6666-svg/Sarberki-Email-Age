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
