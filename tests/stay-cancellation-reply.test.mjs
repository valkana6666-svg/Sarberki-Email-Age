// An explicit stay cancellation gets the existing approved acknowledgement instead of booking questions.
// Questions about cancellation terms, conditions and negations keep the normal inquiry reply.
import test from 'node:test';
import assert from 'node:assert/strict';
import {stayCancellationFromText} from '../sarberki-core.mjs';
import {buildEmailInquiryDraft,buildChatInquiryReply} from '../shared-core/inquiry-channel-adapters.mjs';
import {cases} from './email-stress-cases.mjs';
const now=new Date('2026-11-02T12:00:00Z');
const cancels=[['hu','Le szeretném mondani a 2026.12.20-22 közötti foglalásunkat.',/Megkaptuk a lemondási kérelmét/],['hu','Sajnos le kell mondanunk a foglalást.',/Megkaptuk a lemondási kérelmét/],
 ['en','I would like to cancel my booking for 20-22 December.',/received your cancellation request/],['de','Wir möchten unsere Buchung vom 20. bis 22. Dezember 2026 stornieren.',/Stornierungsanfrage erhalten/],
 ['si','Želimo odpovedati rezervacijo od 1. do 5. avgusta.',/zahtevo za odpovedi/]];
for(const [language,message,ack] of cancels)for(const build of [buildEmailInquiryDraft,buildChatInquiryReply])test(`${language} ${build.name}: cancellation acknowledged – ${message}`,()=>{
 const r=build({message,language,now});
 assert.match(r.text,ack);assert.match(r.operatorReviewText,/Megkaptuk a lemondási kérelmét/);
 assert.doesNotMatch(r.text,/felnőtt|adults|Erwachsene|odrasl|Melyik háztípust|cabin type|Haustyp|vrsto hiške/u);
 assert.equal(r.requiresApproval,true);assert.equal(r.decision.safety.bookingCreated,false);
});
test('not a cancellation: terms questions, conditions, negations, booking requests, stress corpus',()=>{
 for(const text of ['Mik a lemondási feltételek?','Ha le kell mondanunk a foglalást, mi történik az előleggel?','Can we cancel the booking later?','What is your cancellation policy for bookings?',
  'Wie sind die Stornobedingungen für die Buchung?','Nem mondjuk le a foglalást, csak módosítanánk.','We do not want to cancel our booking.','Lahko odpovemo rezervacijo?','Kutyát nem hozunk, és a dézsát lemondjuk.'])
  assert.equal(stayCancellationFromText(text),false,text);
 assert.deepEqual(cases.filter(c=>stayCancellationFromText(c.text)).map(c=>c.id),[]);
 const r=buildEmailInquiryDraft({message:'Mik a lemondási feltételek? 2027.07.10-14, 2 felnőtt.',language:'hu',now});
 assert.doesNotMatch(r.text,/Megkaptuk a lemondási kérelmét/);
});
