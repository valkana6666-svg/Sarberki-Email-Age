// Owner chat test 2026-11-24: the hot tub wish is priced in the offer; a question about it is not a wish.
import test from 'node:test';
import assert from 'node:assert/strict';
import {hotTubWished} from '../sarberki-chatbot-project/chat-view.mjs';
import {hotTubLine,buildChatOffer} from '../shared-core/server-chat-offer.mjs';

test('wish vs question vs refusal – the latest decision counts',()=>{
 assert.equal(hotTubWished(['Van dézsa? Mennyibe kerül?']),false,'a question is not a wish');
 assert.equal(hotTubWished(['Van dézsa? Mennyibe kerül?','Hárman jönnénk.','És dézsát is szeretnénk arra az időre.']),true);
 assert.equal(hotTubWished(['Dézsát is szeretnénk.','Mennyi a dézsa?']),true,'a later question does not cancel');
 assert.equal(hotTubWished(['Dézsát is szeretnénk.','Dézsát mégsem kérünk.']),false,'a later refusal does');
 assert.equal(hotTubWished(['Wir möchten auch einen Badezuber.']),true);assert.equal(hotTubWished(['Is there a hot tub?']),false);
});

test('offer: hot tub price for a house that has one; "not available" for the split apartments',async()=>{
 assert.match(hotTubLine('hu','family'),/^Dézsa: 30 000 Ft \/ 24 óra \(legfeljebb 6 főig, efölött \+4 000 Ft\/fő\)/);
 assert.equal(hotTubLine('hu','splitA'),'Dézsa ehhez a háztípushoz nem bérelhető.');
 assert.match(hotTubLine('de','deluxe'),/Badezuber: 30 000 Ft/,'same currency label as the German price line');
 const capacityFn=async()=>({freeByCabin:{family:2},complete:true,bookingCreated:false,writeAttempted:false});
 const quoteFn=async()=>({status:'public_reference',cabin:'family',accommodation:181500,tourismTax:3300,total:184800});
 const facts={arrival:'2027-07-12',departure:'2027-07-15',adults:2,children:1,childAges:[7],cabin:'family'};
 const plain=await buildChatOffer({facts,language:'hu',capacityFn,quoteFn,cancellationDays:14,alternatives:false});
 const tub=await buildChatOffer({facts:{...facts,hotTub:true},language:'hu',capacityFn,quoteFn,cancellationDays:14,alternatives:false});
 assert.equal(plain.status,'AVAILABLE');assert.doesNotMatch(plain.text,/Dézsa: 30 000/);assert.match(tub.text,/Dézsa: 30 000 Ft \/ 24 óra/);
 assert.equal(tub.total,plain.total,'the stay total is unchanged; the tub is added in the confirmation');
 assert.doesNotMatch(tub.text,/A dézsát és más szolgáltatást külön egyeztetjük/,'no repeat');assert.match(tub.text,/törzsvendég-kedvezményt/);
 assert.match(plain.text,/A dézsát és más szolgáltatást külön egyeztetjük/);
});

test('the chat drops the phone bullet (the form below asks for it) and keeps the list tidy',async()=>{
 const {withoutPhoneQuestion}=await import('../sarberki-chatbot-project/chat-view.mjs');
 const t='Kérjük, írja meg:\n– melyik háztípust választja,\n– egy telefonszámot, amelyen elérhetjük.\nEzután ellenőrizzük a szabad helyet.';
 assert.equal(withoutPhoneQuestion(t,'hu'),'Kérjük, írja meg:\n– melyik háztípust választja.\nEzután ellenőrizzük a szabad helyet.');
 assert.equal(withoutPhoneQuestion('– your exact dates,\n– a phone number where we can reach you.','en'),'– your exact dates.');
 assert.equal(withoutPhoneQuestion('Nincs benne.','hu'),'Nincs benne.');
});

test('chat test 2026-11-24 (DE): number words for the party, and the cabin named together with a tub wish updates the stay',async()=>{
 const {createChatInquirySession}=await import('../sarberki-chatbot-project/chat-session.mjs');
 const chat=createChatInquirySession({clock:()=>new Date('2026-11-24T12:00:00Z')});
 chat.reply('Wir möchten vom 12. bis 15. Juli 2027 kommen, zwei Erwachsene und zwei Kinder.');
 let s=chat.snapshot();assert.equal(s.adults,2);assert.equal(s.children,2);
 chat.reply('Die Kinder sind 4 und 10 Jahre alt.');
 const r=chat.reply('Ein Familienhaus bitte, und wir hätten gern auch einen Badezuber.');
 s=chat.snapshot();assert.equal(s.cabin,'Családi');assert.deepEqual(s.child_ages,[4,10]);assert.ok(r.decision,'a booking reply, not the hot tub FAQ');
 const en=createChatInquirySession({clock:()=>new Date('2026-11-24T12:00:00Z')});
 en.reply('We would like to stay from 12 to 15 July 2027, two adults and one child.');
 assert.equal(en.snapshot().adults,2);assert.equal(en.snapshot().children,1);
});
