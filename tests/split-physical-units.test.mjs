import test from 'node:test';
import assert from 'node:assert/strict';
import {BUSINESS} from '../business-config.mjs';
import {splitRequestFromText,splitCapacityOptions,splitInternalSummary} from '../split-units.mjs';
import {cabinFromText,requestedUnitsFromText,buildReplyDraft} from '../sarberki-core.mjs';

test('physical split inventory is exactly 7A-10C and none has a hot tub',()=>{
  assert.deepEqual(BUSINESS.splitPhysicalUnits.map(x=>x.id),['7A','7B','7C','8A','8B','8C','9A','9B','9C','10A','10B','10C']);
  assert.ok(BUSINESS.splitPhysicalUnits.every(x=>x.hotTub===false));
});
test('one two-person split apartment accepts any A/B unit',()=>{
  const request=splitRequestFromText('1 db 2 fős osztott apartmant szeretnénk');
  const options=splitCapacityOptions(2,{splitAB:{verified:true,availableUnits:4}},request);
  assert.equal(request.requestedAB,1);assert.equal(options[0].request_mode,'single_two_person');
  assert.deepEqual(options[0].candidate_unit_ids,['7A','7B','8A','8B','9A','9B','10A','10B']);
  assert.equal(options[0].availability_verified,true);assert.equal(options[0].pooled_availability_verified,true);
});
test('two two-person split apartments prefer same-house A+B and permit cross-house without proximity',()=>{
  const request=splitRequestFromText('2 db 2 fős osztott apartmant kérünk');
  const options=splitCapacityOptions(4,{splitAB:{verified:true,availableUnits:3}},request);
  assert.equal(request.requestedAB,2);assert.equal(options[0].request_mode,'double_two_person');
  assert.deepEqual(options[0].candidate_combinations,[['7A','7B'],['8A','8B'],['9A','9B'],['10A','10B']]);
  assert.equal(options[0].cross_house_fallback_requires_human_approval,false);
  assert.match(splitInternalSummary(options,request),/azonos házas A\+B/u);
});
test('one four-person split apartment maps to a C unit',()=>{
  const request=splitRequestFromText('4 fős osztott apartmant szeretnék');
  const options=splitCapacityOptions(4,{splitC:{verified:true,availableUnits:2}},request);
  assert.equal(options[0].request_mode,'single_four_person');
  assert.deepEqual(options[0].candidate_unit_ids,['7C','8C','9C','10C']);
});
test('two plus four prefers A+C or B+C in the same physical house',()=>{
  const request=splitRequestFromText('egy 2 fős és egy 4 fős osztott apartmant szeretnénk');
  const options=splitCapacityOptions(6,{splitAB:{verified:true,availableUnits:2},splitC:{verified:true,availableUnits:2}},request);
  assert.equal(options[0].request_mode,'two_plus_four');
  assert.deepEqual(options[0].candidate_combinations.slice(0,4),[['7A','7C'],['7B','7C'],['8A','8C'],['8B','8C']]);
  assert.equal(options[0].business_placement_requires_human_approval,false);
});
test('exact physical unit references are parsed but remain manual mapping',()=>{
  const request=splitRequestFromText('A 9B és 9C egységet szeretnénk');
  const options=splitCapacityOptions(6,{splitAB:{verified:true,availableUnits:4},splitC:{verified:true,availableUnits:4}},request);
  assert.deepEqual(request.exactUnitIds,['9B','9C']);assert.equal(options[0].individual_unit_mapping_verified,false);
});
test('standalone cabin is recognized as a specific type',()=>{
  assert.equal(cabinFromText('Különálló 2 fős faházat szeretnék'),'Különálló 2 fős');
});
test('ambiguous two-person inquiry asks cabin type including standalone instead of auto-recommending',()=>{
  const draft=buildReplyDraft({language:'hu',name:'Teszt',original:'Ketten mennénk 2026. november 6-8. között.',arrival:'2026-11-06',departure:'2026-11-08',guests:2,adults:2,children:0,phone:'+36 30 111 2222',cabin:'? – emberi döntésre vár',intent:'booking_request',brandName:'Sárberki Horgásztó',bookingRules:BUSINESS.bookingRules,operationalRules:BUSINESS.operationalRules,pricingRules:BUSINESS.pricingRules});
  assert.match(draft,/Különálló 2 fős/u);assert.doesNotMatch(draft,/Kapacitás alapján megfelelő lehet/u);
});
test('generic four-person inquiry discovers availability without assuming split C',()=>{
  const draft=buildReplyDraft({language:'hu',name:'Teszt',original:'Négyen mennénk 2026. november 6-8. között.',arrival:'2026-11-06',departure:'2026-11-08',guests:4,adults:4,children:0,phone:'+36 30 111 2222',cabin:'? – emberi döntésre vár',intent:'booking_request',brandName:'Sárberki Horgásztó',bookingRules:BUSINESS.bookingRules,operationalRules:BUSINESS.operationalRules,pricingRules:BUSINESS.pricingRules});
  assert.doesNotMatch(draft,/Melyik háztípust szeretné/u);assert.match(draft,/ténylegesen szabad lehetőségeket/u);
});
test('requested unit count recognizes two two-person split apartments',()=>{
  assert.equal(requestedUnitsFromText('2 db 2 fős osztott apartmant kérünk').count,2);
});
