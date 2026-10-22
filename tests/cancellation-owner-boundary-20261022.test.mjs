import test from 'node:test';
import assert from 'node:assert/strict';
import {BUSINESS} from '../business-config.mjs';
import {shortNoticeCancellationAssessment,buildReplyDraft,cancellationNoticeAuditEvent,verifyCancellationAuditReadback} from '../sarberki-core.mjs';

const context=(days,pct)=>({ownerApproved:true,bookingConfirmed:true,depositReceived:true,bookingDate:'2026-09-01',arrivalDate:'2026-11-15',cancellationDate:`2026-11-${String(15-days).padStart(2,'0')}`,depositPct:pct});
// Cross the month boundary without invalid Nov00 for the 15-day case.
const verified=(days,pct)=>({...context(days,pct),cancellationDate:new Date(Date.UTC(2026,10,15-days)).toISOString().slice(0,10)});
const event=c=>cancellationNoticeAuditEvent({caseId:'synthetic-cancellation',revision:2,approvedBy:'synthetic-owner',approvedAt:'2026-11-03T12:00:00+01:00',context:c});
test('every group uses the same approved 14-day cancellation threshold while automatic application stays disabled',()=>{
 assert.equal(BUSINESS.bookingRules.cancellationDaysUnder15Guests,14);
 assert.equal(BUSINESS.bookingRules.cancellationDaysFrom15Guests,14);
 assert.equal(BUSINESS.bookingRules.cancellationAutomaticPolicyVerified,false);
});
for(const days of [13,14,15])for(const pct of [50,80]){
 test(`cancellation ${days} days before arrival and ${pct}% deposit has the correct non-executing outcome`,()=>{
  const r=shortNoticeCancellationAssessment(verified(days,pct));
  assert.equal(r.status,'policy_applies');assert.equal(r.cancellationLeadDays,days);
  assert.equal(r.depositForfeitedOnCancellation,days<14);assert.equal(r.depositOutcome,days<14?'forfeited':'not_forfeited');
  assert.equal(r.depositPct,pct);assert.equal(r.leadTimeBasis,'cancellation_to_arrival');assert.equal(r.thresholdDays,14);
  assert.equal(r.requiresHumanReview,true);assert.equal(r.refundExecuted,false);assert.equal(r.reservationCancelled,false);
 });
 test(`audit ${days}-day/${pct}% outcome is explicit, versioned and strictly checked`,()=>{
  const prepared=event(verified(days,pct));assert.equal(prepared.status,'ready_for_persistence');
  assert.equal(prepared.event.policyVersion,'cancellation_14_day_v2_20261022');
  assert.equal(prepared.event.cancellationLeadDays,days);assert.equal(prepared.event.depositForfeitedOnCancellation,days<14);
  assert.equal(prepared.event.depositOutcome,days<14?'forfeited':'not_forfeited');assert.equal(prepared.event.refundExecuted,false);
  assert.equal(prepared.event.reservationCancelled,false);assert.equal(prepared.event.emailSent,false);
  assert.equal(verifyCancellationAuditReadback(prepared,{...prepared.event}).status,'matches');
  for(const changed of [{depositOutcome:days<14?'not_forfeited':'forfeited'},{depositForfeitedOnCancellation:days>=14},{refundExecuted:true},{cancellationLeadDays:days+1},{leadTimeBasis:'booking_to_arrival'},{policyVersion:'short_notice_v1'}])assert.equal(verifyCancellationAuditReadback(prepared,{...prepared.event,...changed}).status,'mismatch');
 });
}
test('changing only the booking lead time cannot change cancellation outcome',()=>{
 for(const days of [13,14,15]){
  const c=verified(days,80),a=shortNoticeCancellationAssessment(c),b=shortNoticeCancellationAssessment({...c,bookingDate:c.cancellationDate});
  assert.deepEqual(a,b);
 }
});
test('missing, malformed, reversed or unsupported evidence never decides forfeiture or prepares audit',()=>{
 const good=verified(14,50);
 for(const change of [{bookingDate:null},{arrivalDate:'2026-02-30'},{cancellationDate:'2026-02-30'},{bookingDate:'2026-11-03'},{cancellationDate:'2026-11-16'},{cancellationDate:good.arrivalDate},{depositPct:null},{depositPct:75}]){
  const c={...good,...change},r=shortNoticeCancellationAssessment(c);
  assert.notEqual(r.status,'policy_applies');assert.equal(r.depositForfeitedOnCancellation,undefined);
  assert.equal(event(c).status,'blocked');
 }
});
for(const language of ['hu','de','en','si'])for(const pct of [50,80]){
 test(`${language}/${pct}% owner-approved notice distinguishes forfeiture and nonforfeiture without claiming a refund`,()=>{
  const markers={hu:/előleg nem vész el/u,de:/Anzahlung.*nicht/u,en:/deposit already received is not forfeited/u,si:/predplačilo.*ne zapade/u};
  const executed={hu:/nem igazol végrehajtott visszafizetést/u,de:/bestätigt weder eine ausgeführte Erstattung/u,en:/does not confirm an executed refund/u,si:/ne potrjuje izvedenega vračila/u};
  const forfeiture={hu:/előleg.*nem jár vissza/u,de:/Anzahlung.*nicht erstattet/u,en:/deposit already received is non-refundable/u,si:/predplačilo.*ne vrača/u};
  const make=c=>buildReplyDraft({language,intent:'cancellation_request',approvedCancellationContext:c});
  const refundable=make(verified(14,pct));assert.match(refundable,markers[language]);assert.match(refundable,executed[language]);assert.doesNotMatch(refundable,forfeiture[language]);
  assert.match(make(verified(13,pct)),forfeiture[language]);
  for(const missing of ['ownerApproved','bookingConfirmed','depositReceived'])assert.doesNotMatch(make({...verified(14,pct),[missing]:false}),markers[language]);
 });
}
test('legacy audit without an outcome cannot match the new owner-approved notice',()=>{
 const prepared=event(verified(14,80)),stored={...prepared.event};delete stored.depositOutcome;
 assert.equal(verifyCancellationAuditReadback(prepared,stored).status,'mismatch');
 assert.equal(verifyCancellationAuditReadback(prepared,{...prepared.event,guestEmail:'synthetic@example.invalid'}).status,'mismatch');
});
