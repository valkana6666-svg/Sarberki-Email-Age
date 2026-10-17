import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReplyDraft,depositPolicyForBooking,depositReceiptDeadline,shortNoticeCancellationAssessment} from '../sarberki-core.mjs';
import {availabilitySentence,requestedAvailabilitySentence} from '../availability-recommend.mjs';

const languages=['hu','de','en','si'];
const request={original:'Synthetic booking inquiry',arrival:'2026-11-05',departure:'2026-11-07',adults:4,guests:4,children:0,phone:'000-TEST',cabin:'Deluxe'};

for(const language of languages){
  test(`V1 language ${language}: confirmed capacity never exposes PMS internals`,()=>{
    const result=availabilitySentence({available_options:[{label:'Deluxe',units:1,availability:'available',availability_verified:true}]},language);
    assert.match(result,/Deluxe/u);
    assert.doesNotMatch(result,/Previo|mapping|pool|7A|10C/iu);
  });
  test(`V1 language ${language}: unknown capacity is not presented as available`,()=>{
    const result=availabilitySentence({available_options:[]},language);
    assert.doesNotMatch(result,/Deluxe/u);
    assert.ok(result.length>10);
    assert.notEqual(result,availabilitySentence({available_options:[{label:'Deluxe',units:1,availability:'available',availability_verified:true}]},language));
  });
  test(`V1 language ${language}: draft retains requested stay and cabin`,()=>{
    const draft=buildReplyDraft({...request,language});
    assert.match(draft,/Deluxe/u);
    // The guest's arrival and departure must survive localized rendering.
    const dateMarkers=language==='en'?['5 November 2026','7 November 2026']:['05.11.2026','07.11.2026'];
    for(const marker of dateMarkers) assert.ok(draft.includes(marker),`${language}: missing stay date ${marker}`);
    assert.ok(draft.length>20);
    assert.doesNotMatch(draft,/7A|10C|\bpool\b|\bmapping\b/iu);
  });
}

for(const language of languages){
  test(`V1 language ${language}: unverified sold-out evidence is never definitive`,()=>{
    const unknown=availabilitySentence({
      available_options:[],
      unavailable_options:[{label:'Deluxe',availability:'unavailable',availability_verified:false}]
    },language);
    const verified=availabilitySentence({
      available_options:[],
      unavailable_options:[{label:'Deluxe',availability:'unavailable',availability_verified:true}]
    },language);
    assert.ok(unknown.length>10);
    assert.notEqual(unknown,verified,'Unverified and verified capacity must produce distinct replies');
  });
}

for(const language of languages){
  test(`V1 language ${language}: requested Deluxe is not declared sold out without verified evidence`,()=>{
    const unknown=requestedAvailabilitySentence({unavailable_options:[{key:'deluxe',label:'Deluxe',availability:'unavailable',availability_verified:false}]},'Deluxe',language);
    const verified=requestedAvailabilitySentence({unavailable_options:[{key:'deluxe',label:'Deluxe',availability:'unavailable',availability_verified:true}]},'Deluxe',language);
    assert.match(unknown,/Deluxe/u);
    assert.notEqual(unknown,verified);
  });
  test(`V1 language ${language}: verified requested Deluxe is distinguished from unknown`,()=>{
    const available=requestedAvailabilitySentence({available_options:[{key:'deluxe',label:'Deluxe',availability:'available',availability_verified:true}]},'Deluxe',language);
    const unknown=requestedAvailabilitySentence({unverified_options:[{key:'deluxe',label:'Deluxe',availability:'unverified',availability_verified:false}]},'Deluxe',language);
    assert.notEqual(available,unknown);
    assert.match(available,/Deluxe/u);
  });
}

for(const language of languages){
  test(`V1 language ${language}: contradictory capacity evidence never becomes a definitive offer`,()=>{
    const contradictory=availabilitySentence({
      available_options:[{label:'Deluxe',units:1,availability:'available',availability_verified:false}],
      unavailable_options:[{label:'Deluxe',availability:'unavailable',availability_verified:false}]
    },language);
    const confirmed=availabilitySentence({
      available_options:[{label:'Deluxe',units:1,availability:'available',availability_verified:true}],
      unavailable_options:[]
    },language);
    assert.notEqual(contradictory,confirmed);
    assert.doesNotMatch(contradictory,/Deluxe/u);
  });
}

for(const language of languages){
  for(const intent of ['cancellation_request','modification_request']){
    test(`V1 language ${language}: ${intent} is only acknowledged, never confirmed`,()=>{
      const draft=buildReplyDraft({...request,language,intent});
      assert.ok(draft.length>20);
      assert.doesNotMatch(draft,/Previo|7A|10C|\bpool\b|\bmapping\b/iu);
      const reviewMarkers={
        hu:/Megkaptuk.*kérelmét.*Hamarosan/iu,
        de:/erhalten.*prüfen/iu,
        en:/received.*request.*review/iu,
        si:/Prejeli.*zahtevo.*preverili/iu
      };
      assert.match(draft,reviewMarkers[language]);
    });
  }
}

for(const language of languages){
  test(`V1 language ${language}: missing dates and contact do not become invented booking details`,()=>{
    const draft=buildReplyDraft({...request,language,arrival:null,departure:null,phone:null});
    assert.ok(draft.length>20);
    assert.doesNotMatch(draft,/05\.11\.2026|07\.11\.2026|5 November 2026|7 November 2026|000-TEST/u);
    assert.doesNotMatch(draft,/7A|10C|\bpool\b|\bmapping\b/iu);
  });
  test(`V1 language ${language}: contradictory guest totals require clarification`,()=>{
    const draft=buildReplyDraft({...request,language,guests:5,adults:4,children:0});
    const markers={
      hu:/összlétszám eltér/iu,
      de:/Gesamtzahl stimmt nicht/iu,
      en:/total differs/iu,
      si:/skupno število se ne ujema/iu
    };
    assert.match(draft,markers[language]);
  });
}

for(const language of languages){
  for(const guests of [14,15,16]){
    test(`V1 language ${language}: ${guests}-guest deposit respects over-15 threshold`,()=>{
      const draft=buildReplyDraft({...request,language,guests,adults:guests,original:'booking terms',bookingRules:{depositPctUnder15Guests:50,depositPctFrom15Guests:80}});
      const expected=guests>15?'80%':'50%';
      assert.match(draft,new RegExp(expected.replace('%','%'),'u'));
      assert.doesNotMatch(draft,new RegExp(guests>15?'50%':'80%','u'));
    });
  }
}

for(const [days,expectedHours] of [[1,24],[3,24],[14,24],[15,168],[30,168]]){
  test(`V1 deposit policy: ${days} days before arrival requires ${expectedHours} hour receipt window`,()=>{
    const bookingAt='2026-10-17T09:00:00';
    const arrivalDate=new Date(Date.UTC(2026,9,17+days)).toISOString().slice(0,10);
    const result=depositPolicyForBooking({guestCount:4,bookingAt,arrivalDate});
    assert.equal(result.status,'calculated');
    assert.equal(result.paymentWindowHours,expectedHours);
    assert.equal(result.paymentMustBeReceived,true);
  });
}
for(const [guestCount,expectedPct] of [[14,50],[15,50],[16,80]]){
  test(`V1 deposit policy: ${guestCount} guests require ${expectedPct}%`,()=>{
    const result=depositPolicyForBooking({guestCount,bookingAt:'2026-10-17T09:00:00',arrivalDate:'2026-11-10'});
    assert.equal(result.depositPct,expectedPct);
  });
}
test('V1 deposit policy: missing booking timestamp must not invent deadline',()=>{
  assert.equal(depositPolicyForBooking({guestCount:4,arrivalDate:'2026-11-10'}).status,'unverified');
});

test('V1 deposit receipt: 24-hour deadline uses timezone offset correctly',()=>{
  const result=depositReceiptDeadline({guestCount:4,bookingAt:'2026-10-17T10:00:00+02:00',arrivalDate:'2026-10-20'});
  assert.equal(result.status,'calculated');
  assert.equal(result.receiptDeadlineUtc,'2026-10-18T08:00:00.000Z');
  assert.equal(result.receiptConfirmed,false);
});
test('V1 deposit receipt: 7-day deadline uses actual 168 hours',()=>{
  const result=depositReceiptDeadline({guestCount:16,bookingAt:'2026-10-17T10:00:00+02:00',arrivalDate:'2026-11-10'});
  assert.equal(result.depositPct,80);
  assert.equal(result.receiptDeadlineUtc,'2026-10-24T08:00:00.000Z');
});
test('V1 deposit receipt: rejects timezone-naive booking timestamps',()=>{
  assert.equal(depositReceiptDeadline({guestCount:4,bookingAt:'2026-10-17T10:00:00',arrivalDate:'2026-11-10'}).status,'unverified');
});
test('V1 deposit receipt: rejects invalid calendar arrival date',()=>{
  assert.equal(depositReceiptDeadline({guestCount:4,bookingAt:'2026-10-17T10:00:00+02:00',arrivalDate:'2026-02-30'}).status,'unverified');
});

for(const language of languages){
  test(`V1 language ${language}: unapproved payment deadline is not added to draft`,()=>{
    const draft=buildReplyDraft({...request,language,approvedPaymentContext:{operatorApproved:false,bookingConfirmed:true,bookingAt:'2026-10-17T10:00:00+02:00'}});
    assert.doesNotMatch(draft,/Jóváhagyott fizetési tájékoztatás|Freigegebene Zahlungsinformation|Approved payment information|Odobreno plačilo/u);
  });
  test(`V1 language ${language}: approved confirmed booking may display verified deposit deadline`,()=>{
    const draft=buildReplyDraft({...request,language,approvedPaymentContext:{operatorApproved:true,bookingConfirmed:true,bookingAt:'2026-10-17T10:00:00+02:00'}});
    assert.match(draft,/50%/u);
    assert.match(draft,/2026|26/u);
  });
}

test('V1 cancellation: booking five days before arrival, cancelling four days before, forfeits deposit',()=>{
  const result=shortNoticeCancellationAssessment({bookingDate:'2026-10-20',arrivalDate:'2026-10-25',cancellationDate:'2026-10-21',depositPct:50});
  assert.equal(result.status,'policy_applies');
  assert.equal(result.depositForfeitedOnCancellation,true);
  assert.equal(result.requiresHumanReview,true);
});
test('V1 cancellation: 14-day short-notice boundary is included',()=>{
  const result=shortNoticeCancellationAssessment({bookingDate:'2026-10-17',arrivalDate:'2026-10-31',cancellationDate:'2026-10-18',depositPct:50});
  assert.equal(result.status,'policy_applies');
});
test('V1 cancellation: bookings more than 14 days ahead need separate policy review',()=>{
  const result=shortNoticeCancellationAssessment({bookingDate:'2026-10-17',arrivalDate:'2026-11-05',cancellationDate:'2026-10-20',depositPct:50});
  assert.equal(result.status,'manual_review');
});
test('V1 cancellation: large group preserves 80% deposit policy',()=>{
  const result=shortNoticeCancellationAssessment({bookingDate:'2026-10-20',arrivalDate:'2026-10-25',cancellationDate:'2026-10-21',depositPct:80});
  assert.equal(result.depositPct,80);
  assert.equal(result.requiresHumanReview,true);
});
test('V1 cancellation: invalid chronology never decides forfeiture',()=>{
  const result=shortNoticeCancellationAssessment({bookingDate:'2026-10-22',arrivalDate:'2026-10-25',cancellationDate:'2026-10-21',depositPct:50});
  assert.equal(result.status,'manual_review');
});
