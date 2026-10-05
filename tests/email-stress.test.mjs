import test from 'node:test';
import assert from 'node:assert/strict';
import { cases } from './email-stress-cases.mjs';
import { evaluate } from './email-stress-harness.mjs';
for(const c of cases) test(`stress ${c.id}`,()=>{
 const r=evaluate(c);
 for(const [key,value] of Object.entries(c.expected)) assert.deepEqual(r.actual[key],value,`${c.id}: ${key}`);
 for(const draft of [r.draft,r.ui.draft,r.gmail.reply_draft]){
  if(c.reply.contains)assert.match(draft,c.reply.contains);
  if(c.reply.absent)assert.doesNotMatch(draft,c.reply.absent);
  assert.doesNotMatch(draft,/undefined|NaN|human_approval|Previo-megfeleltetés/u);
 }
 if(c.expected.cabin?.startsWith('?'))assert.ok(!['VIP','Deluxe','Családi','Osztott'].includes(r.ui.values.unit),'UI silently selected a cabin');
 if(c.expected.arrival===null)assert.equal(r.ui.values.arrival,'','UI revived a rejected date');
 const mapping={arrival:r.gmail.normalized.dates?.arrival||null,departure:r.gmail.normalized.dates?.departure||null,nights:r.gmail.normalized.nights,guests:r.gmail.normalized.guests,adults:r.gmail.normalized.adults,children:r.gmail.normalized.children,childAges:r.gmail.normalized.child_ages,cabin:r.gmail.normalized.cabin,phone:r.gmail.normalized.phone,unitsRequested:r.gmail.normalized.units_requested,petRequested:r.gmail.normalized.pet_requested,hotTubRequested:r.gmail.normalized.hot_tub_requested,specialRequests:r.gmail.normalized.special_requests,fishingQuestion:r.gmail.normalized.fishing_question,parking:r.gmail.normalized.parking_question};
 for(const [key,value] of Object.entries(c.expected))if(key in mapping)assert.deepEqual(mapping[key],value,`Gmail ${c.id}: ${key}`);
 assert.equal(r.gmail.original_message,c.text.trim(),'original history must remain reviewable');
 if('petRequested' in c.expected)assert.equal(r.ui.topics.pet_requested,c.expected.petRequested,'UI pet request');
 if('hotTubRequested' in c.expected)assert.equal(r.ui.topics.hot_tub_requested,c.expected.hotTubRequested,'UI hot tub request');
 if(c.expected.parking)assert.ok(r.ui.topics.secondary_intents.includes('parking_question'),'UI parking question');
});
