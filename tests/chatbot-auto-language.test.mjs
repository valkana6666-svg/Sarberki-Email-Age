import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';
import {languageFromText} from '../sarberki-core.mjs';
import {renderChatbotIntent} from '../chatbot-v1.mjs';
const clock=()=>new Date('2026-10-12T12:00:00Z');
const messages={
 hu:'Van szabad egy Deluxe faház 2026-11-26 és 2026-11-28 között 2 felnőtt részére?',
 de:'Ist ein Deluxe Haus vom 2026-11-26 bis 2026-11-28 für 2 Erwachsene ohne Kinder frei?',
 en:'Is a Deluxe cabin available from 2026-11-26 to 2026-11-28 for 2 adults and no children?',
 si:'Ali je Deluxe hiška prosta od 2026-11-26 do 2026-11-28 za 2 odrasli osebi brez otrok?'
};
for(const [language,message] of Object.entries(messages))test('automatic first inquiry uses '+language,()=>{
 const chat=createChatInquirySession({clock}),result=chat.reply(message);
 assert.equal(chat.language,language);assert.equal(result.response.language,language);
 assert.equal(result.decision.facts.language,language);
 assert.equal(result.decision.facts.adults,2);assert.equal(result.decision.facts.cabin,'Deluxe');
 assert.equal(result.decision.capacity.status,'UNKNOWN');assert.equal(result.decision.pricing.verified,false);
 assert.match(result.operatorReviewText,/kapacitás ellenőrzése még nem igazolt/);
 if(language==='si')assert.doesNotMatch(result.text,/Verfügbarkeit|Willkommen/);
});
test('German to Slovenian during booking preserves dates, party, cabin and one unit',()=>{
 const chat=createChatInquirySession({clock});chat.reply(messages.hu);chat.reply(messages.de);
 const result=chat.reply('Želimo nastanitev, prosimo za ceno.');
 assert.equal(chat.language,'si');assert.equal(result.decision.facts.adults,2);
 assert.equal(result.decision.facts.units_requested,1);assert.equal(result.decision.facts.cabin,'Deluxe');
 assert.deepEqual(result.decision.facts.dates,{arrival:'2026-11-26',departure:'2026-11-28',inferred_year:false});
 assert.equal(result.decision.capacity.status,'UNKNOWN');assert.equal(result.decision.safety.emailSent,false);
 assert.match(result.operatorReviewText,/nem igazolt/);
});
test('short, mixed, neutral and unknown turns cannot switch retained German',()=>{
 const chat=createChatInquirySession({clock});chat.reply(messages.de);
 for(const text of ['OK','2026','Deluxe','telefon','please','ü','ž','Szia, booking please','Želimo nastanitev please booking','xyz']){
  assert.equal(languageFromText(text,{conservative:true}),'unknown');
  const result=chat.reply(text);assert.equal(chat.language,'de');assert.equal(result.response.language,'de');
 }
});
test('uncertain first message uses Hungarian fallback without claiming capacity',()=>{
 const chat=createChatInquirySession({clock}),result=chat.reply('Hello');
 assert.equal(chat.language,'hu');assert.equal(result.response.availabilityVerified,false);
 assert.equal(result.response.bookingCreated,false);assert.equal(result.response.emailSent,false);
});
test('manual override and returning to auto preserve facts and language until clear evidence',()=>{
 const chat=createChatInquirySession({clock});chat.reply(messages.de);const before=chat.snapshot();
 chat.setLanguage('sl');assert.equal(chat.language,'si');assert.deepEqual(chat.snapshot(),before);
 const manual=chat.reply(messages.en);assert.equal(manual.decision.facts.language,'si');
 chat.setLanguage('auto');chat.reply('OK');assert.equal(chat.language,'si');
 const automatic=chat.reply(messages.en);assert.equal(chat.language,'en');assert.equal(automatic.decision.facts.adults,2);
 chat.reset();assert.deepEqual(chat.snapshot(),{});assert.equal(chat.language,'hu');
 chat.setLanguage('sl');chat.reset();assert.equal(chat.language,'si');
});
test('foreign FAQ replies have the exact approved Hungarian operator text',()=>{
 const chat=createChatInquirySession({clock});chat.reply(messages.si);
 const result=chat.reply('Ali je masažna kad na voljo?');
 assert.equal(result.response.language,'si');assert.equal(result.response.intent,'hotTub');
 assert.equal(result.operatorReviewText,renderChatbotIntent('hotTub','hu'));
});

test('real iPhone: German booking to Slovenian hot-tub question switches language and keeps facts',()=>{
 const chat=createChatInquirySession({clock});chat.reply(messages.de);
 const before=chat.snapshot();assert.equal(chat.language,'de');
 const question='Pozdravljeni! Zdaj bi radi nadaljevali v slovenščini. Ali je za družinsko hiško na voljo masažna kad?';
 assert.equal(languageFromText(question,{conservative:true}),'si');
 const result=chat.reply(question);
 assert.equal(chat.language,'si');assert.equal(result.response.language,'si');
 assert.equal(result.response.intent,'hotTub');
 assert.match(result.text,/Masažna kad|masažna kad/iu);
 assert.doesNotMatch(result.text,/Badezuber|Verfügbarkeit|Willkommen/u);
 assert.equal(result.operatorReviewText,renderChatbotIntent('hotTub','hu'));
 assert.deepEqual(chat.snapshot(),before);
 assert.equal(result.response.bookingCreated,false);
 assert.equal(result.response.emailSent,false);
});


test('first automatic German inquiry with shared Telefon token uses existing intake language, not Hungarian fallback',()=>{
 const chat=createChatInquirySession({clock});
 const message='Guten Tag! Wir suchen ein Deluxe Ferienhaus vom 23.10.2026 bis 25.10.2026 für 2 Erwachsene und 0 Kinder. Telefon: +36 30 123 4567.';
 assert.equal(languageFromText(message),'de');assert.equal(languageFromText(message,{conservative:true}),'unknown');
 const reply=chat.reply(message);assert.equal(chat.language,'de');assert.equal(reply.response.language,'de');assert.match(reply.text,/Guten Tag/);assert.doesNotMatch(reply.text,/Kedves Vendég/);
 chat.reply('telefon');assert.equal(chat.language,'de','later switches keep the original conservative contract');
});
test('first-turn shared contact words do not block clear SI/EN messages; ambiguous tie retains Hungarian',()=>{
 for(const [language,message] of [['si','Pozdravljeni! Želimo Deluxe hiško od 2026-11-01 do 2026-11-03 za 2 odrasli brez otrok. Telefon: +36 00 000 0000.'],['en','Please book one Deluxe cabin for 2 adults and no children from 2026-11-01 to 2026-11-03. Telefon: +36 00 000 0000.']]){
  const chat=createChatInquirySession({clock});const reply=chat.reply(message);assert.equal(chat.language,language);assert.equal(reply.response.language,language);
 }
 const ambiguous=createChatInquirySession({clock});ambiguous.reply('Telefon');assert.equal(ambiguous.language,'hu');
 const mixed=createChatInquirySession({clock});mixed.reply('booking Erwachsene');assert.equal(mixed.language,'hu');
});
