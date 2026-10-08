import test from 'node:test';
import assert from 'node:assert/strict';
import {SPLIT_UNIT_IDS,splitRequestFromText,splitCapacityOptions} from '../split-units.mjs';

const pools={
  splitAB:{verified:true,availability:'available',availableUnits:8},
  splitC:{verified:true,availability:'available',availableUnits:4}
};

test('split unit ids are explicit',()=>{
  assert.deepEqual(SPLIT_UNIT_IDS,['7A','7B','7C','8A','8B','8C','9A','9B','9C','10A','10B','10C']);
});

test('one two-person split request can use any A or B unit',()=>{
  const req=splitRequestFromText('Egy 2 fős osztott apartmant szeretnénk.');
  const [option]=splitCapacityOptions(2,pools,req);
  assert.equal(option.request_mode,'single_two_person');
  assert.deepEqual(option.candidate_unit_ids.sort(),['10A','10B','7A','7B','8A','8B','9A','9B'].sort());
  assert.equal(option.business_placement_requires_human_approval,false);
  assert.equal(option.availability_verified,true);
});

test('two two-person split apartments prefer same-house A+B pairs',()=>{
  const req=splitRequestFromText('Kettő darab kétfős osztott apartmant szeretnénk.');
  const [option]=splitCapacityOptions(4,pools,req);
  assert.equal(option.request_mode,'double_two_person');
  assert.deepEqual(option.candidate_combinations,[['7A','7B'],['8A','8B'],['9A','9B'],['10A','10B']]);
  assert.equal(option.cross_house_fallback_requires_human_approval,false);
});

test('one four-person split request maps to C candidates',()=>{
  const req=splitRequestFromText('Egy 4 fős osztott apartmant szeretnénk.');
  const [option]=splitCapacityOptions(4,pools,req);
  assert.equal(option.request_mode,'single_four_person');
  assert.deepEqual(option.candidate_unit_ids,['7C','8C','9C','10C']);
});

test('mixed split request prefers same-house A+C or B+C',()=>{
  const req={isSplit:true,kind:'mixed',requestedAB:1,requestedC:1,unitCount:2,exactUnitIds:[],sameHousePreferred:true,crossHouseFallbackRequiresApproval:true};
  const [option]=splitCapacityOptions(6,pools,req);
  assert.equal(option.request_mode,'two_plus_four');
  assert.deepEqual(option.candidate_combinations.slice(0,4),[['7A','7C'],['7B','7C'],['8A','8C'],['8B','8C']]);
  assert.equal(option.cross_house_fallback_requires_human_approval,false);
});

test('full split house uses same-house A+B+C candidates',()=>{
  const req={isSplit:true,kind:'mixed',requestedAB:2,requestedC:1,unitCount:3,exactUnitIds:[],sameHousePreferred:true,crossHouseFallbackRequiresApproval:true};
  const [option]=splitCapacityOptions(8,pools,req);
  assert.equal(option.request_mode,'full_split_house');
  assert.deepEqual(option.candidate_combinations,[['7A','7B','7C'],['8A','8B','8C'],['9A','9B','9C'],['10A','10B','10C']]);
});
