import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyTubRequest,assessTubEligibility} from '../shared-core/tub-request.mjs';
test('synthetic Hungarian tub request extracts date, time and 24-hour duration',()=>{const r=classifyTubRequest('2026-10-23 18:00-tól 24 órára dézsafürdőt kérünk');assert.equal(r.kind,'tub_request');assert.equal(r.startDate,'2026-10-23');assert.equal(r.startTime,'18:00');assert.equal(r.durationHours,24);assert.equal(r.confirmationAllowed,false);});
test('unknown availability and split-house units never confirm',()=>{assert.equal(assessTubEligibility({unitNumber:7,availability:'available'}).status,'not_available');assert.equal(assessTubEligibility({unitNumber:11,availability:'available'}).confirmationAllowed,false);assert.equal(assessTubEligibility({}).status,'unverified');});
test('ordinary booking request is not a tub request',()=>assert.equal(classifyTubRequest('Kérek egy családi faházat').kind,'none'));
