import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyTubRequest,assessTubEligibility} from '../shared-core/tub-request.mjs';
test('synthetic Hungarian tub request extracts date, time and 24-hour duration',()=>{const r=classifyTubRequest('2026-10-23 18:00-tól 24 órára dézsafürdőt kérünk');assert.equal(r.kind,'tub_request');assert.equal(r.startDate,'2026-10-23');assert.equal(r.startTime,'18:00');assert.equal(r.durationHours,24);assert.equal(r.confirmationAllowed,false);});
test('unknown availability and split-house units never confirm',()=>{assert.equal(assessTubEligibility({unitNumber:7,availability:'available'}).status,'not_available');assert.equal(assessTubEligibility({unitNumber:11,availability:'available'}).confirmationAllowed,false);assert.equal(assessTubEligibility({}).status,'unverified');});
test('ordinary booking request is not a tub request',()=>assert.equal(classifyTubRequest('Kérek egy családi faházat').kind,'none'));

test('negated tub request is not treated as a new service request',()=>{
 assert.equal(classifyTubRequest('Nem kérünk dézsát.').kind,'none');
});
test('quoted old tub request is ignored when current reply has no request',()=>{
 assert.equal(classifyTubRequest('Köszönöm, rendben.\\nFrom: vendeg@example.invalid\\nSent: 2026-10-15\\nSubject: foglalás\\nDézsát kérek.').kind,'none');
});

test('unsupported numeric duration expressions stay unresolved in all service languages',()=>{
 for(const [request,unit] of [
  ['Dézsát kérünk 2026-11-14 18:00 időpontban','órára'],
  ['Please add a hot tub on 2026-11-14 at 18:00 for','hours'],
  ['Bitte einen Badezuber am 2026-11-14 um 18:00 buchen für','Stunden'],
  ['Prosimo za vročo kad 2026-11-14 ob 18:00 za','ur']
 ])for(const number of ['1.5','1,5','-24','−24','+24','12-24','12 – 24','1/2','1:30','1000']){
  const r=classifyTubRequest(`${request} ${number} ${unit}`);
  assert.equal(r.kind,'tub_request',request);
  assert.equal(r.durationHours,null,`${number} ${unit}`);
  assert.equal(r.confirmationAllowed,false);
  assert.equal(r.requiresHumanReview,true);
 }
});

test('an unsupported duration cannot be hidden by an additional valid duration',()=>{
 for(const expression of ['1.5 hours and 24 hours','24 hours and -12 hours','12 / 24 hours'])
  assert.equal(classifyTubRequest(`Please add a hot tub for ${expression}`).durationHours,null,expression);
});

test('whole-hour and whole-day durations remain supported',()=>{
 for(const [expression,hours] of [['24 hours',24],['2 days',48],['24 órára',24],['2 napra',48],['24 Stunden',24],['2 Tage',48],['24 ur',24],['2 dni',48]])
  assert.equal(classifyTubRequest(`Please add a hot tub for ${expression}`).durationHours,hours,expression);
});
