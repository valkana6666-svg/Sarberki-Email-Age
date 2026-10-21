import test from 'node:test';
import assert from 'node:assert/strict';
import {BUSINESS} from '../business-config.mjs';
import {depositPolicyForBooking,depositReceiptDeadline,depositPercentForGuestCount,buildReplyDraft,shortNoticeCancellationAssessment} from '../sarberki-core.mjs';
import {depositPercentForGuests} from '../booking-confirmation.mjs';
import {composeGuestReply} from '../guest-reply/public-answer-renderer.mjs';
import {PUBLIC_REPLY_DATA} from '../guest-reply/public-answer-data.mjs';
import {createCaseState,deriveCaseView} from '../case-state.mjs';
import {renderChatbotIntent} from '../chatbot-v1.mjs';

const bookingAt='2026-10-21T10:00:00+02:00';
test('one approved configuration controls the public data, simulation and calculation at 14/15/16 guests',()=>{
 assert.equal(PUBLIC_REPLY_DATA.booking,BUSINESS.bookingRules);
 for(const [guestCount,pct] of [[1,50],[14,50],[15,80],[16,80]]){
  assert.equal(depositPercentForGuestCount(guestCount),pct);
  assert.equal(depositPercentForGuests(guestCount),pct);
  assert.equal(depositPolicyForBooking({guestCount,bookingAt,arrivalDate:'2026-11-06'}).depositPct,pct);
 }
});
test('13 and 15 calendar-day lead times select 24 and 168 elapsed hours, independently of group size',()=>{
 for(const guestCount of [14,15,16])for(const [arrivalDate,hours,deadline]of [['2026-11-03',24,'2026-10-22T08:00:00.000Z'],['2026-11-05',168,'2026-10-28T08:00:00.000Z']]){
  const result=depositReceiptDeadline({guestCount,bookingAt,arrivalDate});
  assert.equal(result.status,'calculated');assert.equal(result.paymentWindowHours,hours);assert.equal(result.receiptDeadlineUtc,deadline);
 }
});
test('exact 14-day lead time cannot invent a deadline or non-refundable policy for any group',()=>{
 for(const guestCount of [14,15,16]){
  const result=depositReceiptDeadline({guestCount,bookingAt,arrivalDate:'2026-11-04'});
  assert.equal(result.status,'manual_review');assert.equal(result.requiresHumanReview,true);
  assert.equal(result.receiptDeadlineUtc,undefined);assert.equal(result.paymentWindowHours,undefined);
 }
 assert.equal(shortNoticeCancellationAssessment({bookingDate:'2026-10-21',arrivalDate:'2026-11-04',cancellationDate:'2026-10-22',depositPct:80}).status,'manual_review');
});
test('invalid quantities and missing source facts cannot calculate deposit terms',()=>{
 for(const n of [0,-1,1.5,NaN,Infinity,null])assert.equal(depositPercentForGuestCount(n),null);
 assert.equal(depositPolicyForBooking({guestCount:15,arrivalDate:'2026-11-05'}).status,'unverified');
 assert.equal(depositPolicyForBooking({guestCount:15,bookingAt,arrivalDate:'2026-02-30'}).status,'unverified');
 assert.equal(depositPolicyForBooking({guestCount:15,bookingAt,arrivalDate:'2026-10-20'}).status,'unverified');
 assert.equal(depositPolicyForBooking({guestCount:15,bookingAt:'2026-10-21T99:00:00+02:00',arrivalDate:'2026-11-05'}).status,'unverified');
 assert.equal(depositPolicyForBooking({guestCount:15,bookingAt:'2026-02-30T10:00:00+01:00',arrivalDate:'2026-11-05'}).status,'unverified');
});
test('the calendar-day threshold uses Hungary time rather than the sender offset or server clock',()=>{
 // 23:30Z on Oct21 is Oct22 in Hungary: Nov5 is exactly14 local days away.
 const result=depositReceiptDeadline({guestCount:15,bookingAt:'2026-10-21T23:30:00Z',arrivalDate:'2026-11-05'});
 assert.equal(result.status,'manual_review');assert.equal(result.daysUntilArrival,14);assert.equal(result.receiptDeadlineUtc,undefined);
 const sameInstant=depositReceiptDeadline({guestCount:15,bookingAt:'2026-10-22T01:30:00+02:00',arrivalDate:'2026-11-05'});
 assert.deepEqual(result,sameInstant);
});
test('HU DE EN SI main-config drafts and public replies never reinstate the obsolete ten-day deadline or cancellation promise',()=>{
 for(const language of ['hu','de','en','si']){
  const draft=buildReplyDraft({language,original:'booking terms foglalási feltételek',arrival:'2026-11-06',departure:'2026-11-08',guests:15,adults:15,children:0,cabin:'Deluxe',bookingRules:BUSINESS.bookingRules});
  const reply=composeGuestReply({facts:{language,guests:15},topics:['booking_terms']});
  for(const text of [draft,reply]){
   assert.match(text,/80%/u);
   assert.doesNotMatch(text,/10 (?:nap|days|Tagen|dneh)|cancellation deadline is|Stornierungsfrist beträgt|rok za odpoved je|lemondási határidő az érkezés előtt/iu);
   assert.match(text,/14/u);
  }
 }
});
test('approved payment context still cannot override the disputed exact 14-day boundary',()=>{
 const draft=buildReplyDraft({language:'en',original:'When is the deposit due?',arrival:'2026-11-04',departure:'2026-11-06',guests:15,adults:15,children:0,cabin:'Deluxe',bookingRules:BUSINESS.bookingRules,approvedPaymentContext:{operatorApproved:true,bookingConfirmed:true,bookingAt}});
 assert.doesNotMatch(draft,/Approved payment information:/u);assert.match(draft,/exact 14-day boundary/u);
});
test('informational chatbot also defers contextual deadlines in all four languages',()=>{
 for(const language of ['hu','de','en','si']){
  const text=renderChatbotIntent('deposit',language);
  assert.doesNotMatch(text,/10 (?:nap|days|Tagen|dneh)/u);assert.match(text,/14/u);
 }
});
test('a case at the disputed boundary remains critical until explicit human term verification',()=>{
 const state=createCaseState({now:bookingAt,original:'Előleg és lemondás?',values:{arrival:'2026-11-04',departure:'2026-11-06',guests:'15',adults:'15',children:'0',unit:'Deluxe',phone:'synthetic-contact'}});
 const result=deriveCaseView(state);
 assert.equal(result.untilArrival,14);assert.equal(result.closeArrival,true);assert.equal(result.critical,true);
 assert.ok(result.warnings.some(w=>w.code==='close_arrival'));assert.ok(result.warnings.some(w=>w.code==='deposit_review'));
});
