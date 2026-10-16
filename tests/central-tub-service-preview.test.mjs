import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCentralServicePreview,buildCentralReply} from '../central-reply.mjs';
const input={language:'hu',original:'2026-10-23 18:00-tól 24 órára dézsafürdőt kérünk',unitNumber:7};
test('central preview retains original reply and refuses to confirm tub',()=>{
 const result=buildCentralServicePreview(input);
 assert.deepEqual(result.draft,buildCentralReply(input));
 assert.equal(result.service.kind,'tub_request');
 assert.equal(result.service.eligibility.status,'not_available');
 assert.equal(result.service.confirmationAllowed,false);
 assert.equal(result.service.requiresHumanReview,true);
});
test('ordinary inquiry has no extra service metadata',()=>{
 const result=buildCentralServicePreview({language:'hu',original:'Családi faházat szeretnék'});
 assert.equal(result.service,null);
});
