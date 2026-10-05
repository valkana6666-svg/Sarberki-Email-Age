import test from 'node:test';
import assert from 'node:assert/strict';
import {assessAccommodationInquiry} from '../shared-core/inquiry-assessment.mjs';

test('complete consistent inquiry is ready independently from any PMS',()=>{
  const r=assessAccommodationInquiry({
    arrival:'2027-10-16',
    departure:'2027-10-18',
    accommodation:'Deluxe',
    guests:4,
    adults:2,
    children:2,
    childAges:[7,11]
  });
  assert.deepEqual(r.missing,[]);
  assert.deepEqual(r.contradictions,[]);
  assert.equal(r.human_review_required,false);
  assert.equal(r.ready,true);
});

test('missing child ages block readiness',()=>{
  const r=assessAccommodationInquiry({
    arrival:'2027-10-16',
    departure:'2027-10-18',
    accommodation:'Deluxe',
    guests:4,
    adults:2,
    children:2,
    childAges:[7]
  });
  assert.ok(r.missing.includes('child_ages'));
  assert.equal(r.ready,false);
});

test('guest-count contradiction requires human review',()=>{
  const r=assessAccommodationInquiry({
    arrival:'2027-10-16',
    departure:'2027-10-18',
    accommodation:'Deluxe',
    guests:5,
    adults:2,
    children:2,
    childAges:[7,11]
  });
  assert.equal(r.missing.length,0);
  assert.equal(r.contradictions[0].code,'guest_total_mismatch');
  assert.equal(r.human_review_required,true);
  assert.equal(r.ready,false);
});

test('unknown accommodation and unknown child status stay incomplete',()=>{
  const r=assessAccommodationInquiry({
    arrival:'2027-10-16',
    departure:'2027-10-18',
    accommodation:'? – emberi döntésre vár',
    guests:4,
    adults:4,
    children:null,
    childAges:[]
  });
  assert.ok(r.missing.includes('accommodation'));
  assert.ok(r.missing.includes('children_status'));
  assert.equal(r.ready,false);
});
