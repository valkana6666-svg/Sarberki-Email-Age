import test from 'node:test';import assert from 'node:assert/strict';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';
import {buildEmailInquiryDraft,buildChatInquiryReply} from '../shared-core/inquiry-channel-adapters.mjs';
const now=new Date('2026-10-11T12:00:00Z');
const cases={hu:'Van szabad Deluxe faház 2026.11.13-15 között 2 felnőtt részére, gyermek nélkül?',de:'Ist ein Deluxe Haus vom 2026-11-13 bis 2026-11-15 für 2 Erwachsene ohne Kinder frei?',en:'Is a Deluxe cabin available from 2026-11-13 to 2026-11-15 for 2 adults and no children?',si:'Ali je Deluxe hiška prosta od 2026-11-13 do 2026-11-15 za 2 odrasli osebi brez otrok?'};
for(const [language,message]of Object.entries(cases))test('email/chat decision and pending safety are identical in '+language,()=>{
 const a=buildEmailInquiryDraft({message,language,now}),b=buildChatInquiryReply({message,language,now});
 assert.deepEqual(a.decision,b.decision);assert.equal(a.channel,'email');assert.equal(b.channel,'chat');
 assert.equal(a.requiresApproval,true);assert.equal(b.decision.safety.bookingCreated,false);assert.equal(b.decision.capacity.verified,false);
});
test('chat remembers known dates and cabin without asking again, reset clears isolated memory',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 const first=chat.reply('Van szabad Deluxe faház 2026.11.13-15 között?');
 assert.equal(first.decision.facts.cabin,'Deluxe');assert.ok(first.decision.missing.includes('adults'));
 const second=chat.reply('2 felnőtt, gyermek nélkül.');
 assert.equal(second.decision.facts.cabin,'Deluxe');assert.equal(second.decision.facts.dates.arrival,'2026-11-13');assert.equal(second.decision.facts.adults,2);
 assert.equal(second.decision.missing.includes('dates'),false);assert.equal(second.decision.missing.includes('accommodation'),false);
 assert.equal(second.decision.capacity.verified,false);
 const copy=chat.snapshot();copy.cabin='VIP';assert.equal(chat.snapshot().cabin,'Deluxe');
 chat.reset();assert.deepEqual(chat.snapshot(),{});
});
test('two chats cannot leak retained facts and input bounds fail closed',()=>{
 const a=createChatInquirySession(),b=createChatInquirySession();a.reply('Van szabad Deluxe faház?');assert.deepEqual(b.snapshot(),{});
 assert.throws(()=>b.reply('x'.repeat(1001)),/CHAT_INPUT_LIMIT/);
});
test('Hungarian ISO dates and separate child-age turn preserve all already known data',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 const first=chat.reply('2026-11-20 és 2026-11-23 között Deluxe faház');
 assert.equal(first.decision.facts.dates.arrival,'2026-11-20');
 chat.reply('2 felnőtt és 2 gyermek');
 const last=chat.reply('A gyermekek 7 és 10 évesek');
 assert.deepEqual(last.decision.facts.child_ages,[7,10]);assert.equal(last.decision.facts.guests,4);assert.equal(last.decision.readyForCapacityCheck,true);assert.deepEqual(last.decision.missing,[]);assert.equal(last.decision.capacity.status,'UNKNOWN');
});
test('separate sibling-age turns fill outstanding ages using the existing booking merge',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 chat.reply('Van szabad Deluxe faház 2026.11.13-15 között 2 felnőtt és 2 gyermek részére?');
 const first=chat.reply('Az egyik 7 éves.');
 assert.deepEqual(first.decision.facts.child_ages,[7]);assert.equal(first.decision.readyForCapacityCheck,false);
 const second=chat.reply('A másik 10 éves.');
 assert.deepEqual(second.decision.facts.child_ages,[7,10]);assert.equal(second.decision.readyForCapacityCheck,true);
 assert.equal(second.decision.facts.guests,4);
 const correction=chat.reply('Javítás: a gyermekek 8 és 11 évesek.');
 assert.deepEqual(correction.decision.facts.child_ages,[8,11]);
});
test('changed child count clears stale ages and recalculates known total, while explicit contradictory total remains flagged',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 chat.reply('Van szabad Deluxe faház 2026.11.13-15 között 2 felnőtt és 2 gyermek részére?');
 chat.reply('A gyermekek 7 és 10 évesek.');
 const changed=chat.reply('Most 3 gyermek jön.');
 assert.deepEqual(changed.decision.facts.child_ages,[]);assert.equal(changed.decision.facts.guests,5);
 assert.ok(changed.decision.missing.includes('child_ages'));assert.equal(changed.decision.readyForCapacityCheck,false);
 const adults=chat.reply('3 felnőtt jön.');assert.equal(adults.decision.facts.guests,6);
 const contradictory=chat.reply('Összesen 9 fő, 3 felnőtt és 3 gyermek.');
 assert.equal(contradictory.decision.facts.guests,9);assert.ok(contradictory.decision.contradictions.some(x=>x.code==='guest_total_mismatch'));
});

test('Hungarian conjunction before a party count cannot manufacture departure date',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 const result=chat.reply('Van szabad Deluxe faház 2026-11-01 és 2 felnőtt részére?');
 assert.ok(result.decision.missing.includes('dates'));assert.equal(result.decision.capacity.verified,false);
});
for(const [language,question] of Object.entries({hu:'Van dézsa?',de:'Kann ich einen Badezuber mieten?',en:'Can I rent a hot tub?',si:'Ali je masažna kad na voljo?'}))test('FAQ detour retains the stay and returns the existing FAQ in '+language,()=>{
 const chat=createChatInquirySession({language,clock:()=>now});
 chat.reply(cases[language]);const before=chat.snapshot();
 const result=chat.reply(question);
 assert.equal(result.response.intent,'hotTub');assert.equal(result.text,result.response.reply);
 assert.equal(result.decision,null);assert.match(result.operatorReviewText,/külön bérelhető/);
 assert.deepEqual(chat.snapshot(),before);
 const next=chat.reply(cases[language]);
 assert.equal(next.decision.facts.dates.arrival,'2026-11-13');assert.equal(next.decision.facts.adults,2);
 assert.deepEqual(next.decision.missing,[]);assert.equal(next.decision.capacity.verified,false);
});
test('empty greeting during an active inquiry does not discard facts or normalize empty input',()=>{
 const chat=createChatInquirySession({clock:()=>now});chat.reply(cases.hu);
 const before=chat.snapshot(),result=chat.reply('');
 assert.equal(result.response.intent,'welcome');assert.deepEqual(chat.snapshot(),before);
});

const iphoneInquiry='Jó napot! November 26-tól 28-ig szeretnénk egy Deluxe faházat foglalni 2 felnőtt részére. Van szabad hely?';
test('Hungarian booking date confirmation continues the active iPhone inquiry',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 const first=chat.reply(iphoneInquiry);
 assert.ok(!first.decision.missing.includes('dates_confirmation'),'Owner rule 2026-11-14: a yearless date is the nearest future one; the year is never asked back.');
 const result=chat.reply('2026. november 26-tól 28-ig szeretnénk foglalni.');
 assert.ok(result.decision);
 assert.deepEqual(result.decision.facts.dates,{arrival:'2026-11-26',departure:'2026-11-28',inferred_year:false});
 assert.equal(result.decision.facts.adults,2);
 assert.equal(result.decision.facts.cabin,'Deluxe');
 assert.equal(result.decision.facts.units_requested,1);
 assert.deepEqual(result.decision.missing,[]);
 assert.equal(result.decision.capacity.status,'UNKNOWN');
 assert.equal(result.decision.pricing.verified,false);
 assert.match(result.text,/Az elérhetőséget a kért időszakra a foglalás előtt ellenőrizzük/u);
 assert.equal(result.decision.safety.bookingCreated,false);
 assert.equal(result.decision.safety.emailSent,false);
});
test('booking party correction retains the confirmed stay and one Deluxe unit',()=>{
 const chat=createChatInquirySession({clock:()=>now});
 chat.reply('Van szabad egy Deluxe faház 2026. november 26-tól 28-ig 2 felnőtt részére?');
 const result=chat.reply('3 felnőtt részére szeretnénk foglalni.');
 assert.ok(result.decision);
 assert.equal(result.decision.facts.adults,3);
 assert.equal(result.decision.facts.guests,3);
 assert.equal(result.decision.facts.dates.arrival,'2026-11-26');
 assert.equal(result.decision.facts.cabin,'Deluxe');
 assert.equal(result.decision.facts.units_requested,1);
 assert.equal(result.decision.capacity.status,'UNKNOWN');
});
test('booking FAQ without new stay facts remains informational in an active inquiry',()=>{
 const chat=createChatInquirySession({clock:()=>now});chat.reply(iphoneInquiry);
 const before=chat.snapshot(),result=chat.reply('Hogyan válik érvényessé a foglalás?');
 assert.equal(result.response.intent,'booking');assert.equal(result.decision,null);
 assert.match(result.text,/külön visszaigazolás/u);assert.deepEqual(chat.snapshot(),before);
});
test('standalone booking FAQ and date message do not create an active inquiry',()=>{
 for(const message of ['Hogyan válik érvényessé a foglalás?','2026. november 26-tól 28-ig szeretnénk foglalni.']){
  const chat=createChatInquirySession({clock:()=>now}),result=chat.reply(message);
  assert.equal(result.response.intent,'booking');assert.equal(result.decision,null);
  assert.deepEqual(chat.snapshot(),{});
 }
});

test('demo check 2026-11-11: dates + party in the first message open the booking conversation in all four languages',()=>{
 const clock=()=>new Date('2026-11-11T12:00:00Z');
 const cases=[['Szia! 2027. július 5-től 8-ig jönnénk 2 felnőtt és 2 gyerek (5 és 9 évesek).',/2027\.07\.05\. és 2027\.07\.08\. között 4 fő/],
  ['Guten Tag, wir möchten vom 15. bis 17. Juni 2027 kommen, 2 Erwachsene, keine Kinder.',/vom 15\.06\.2027 bis 17\.06\.2027 mit 2 Personen/],
  ['Hello, we are 3 adults, no children, 25 to 28 August 2027.',/from 25 August 2027 to 28 August 2027 with 3 guests/],
  ['Pozdravljeni, prišli bi od 20. do 22. junija 2027, 4 odrasli, brez otrok.',/od 20\.06\.2027 do 22\.06\.2027, skupaj 4 osebe/]];
 for(const [message,expected] of cases){const chat=createChatInquirySession({clock});const r=chat.reply(message);
  assert.notEqual(r.decision,null,message);assert.match(r.text,expected);}
 // FAQ-only questions keep the FAQ answer.
 const faq=createChatInquirySession({clock}).reply('Van dézsa?');assert.equal(faq.decision,null);
});

test('demo check 2026-11-11: pet question answered with the approved fee in four languages, also inside a booking conversation',()=>{
 const clock=()=>new Date('2026-11-11T12:00:00Z');
 const cases=[['Lehet kutyát hozni?',/Háziállat hozható, díja 2 000 Ft\/nap\/állat/],['Darf ich meinen Hund mitbringen?',/Haustiere sind erlaubt/],
  ['Can we bring our dog?',/Pets are allowed; the fee is 2 000 Ft/],['Lahko pripeljemo psa?',/Hišni ljubljenčki so dovoljeni/]];
 for(const [m,re] of cases)assert.match(createChatInquirySession({clock}).reply(m).text,re,m);
 const chat=createChatInquirySession({clock});chat.reply('Szia! 2027. július 5-től 8-ig jönnénk 2 felnőtt, gyerek nincs.');
 assert.match(chat.reply('És kutyát hozhatunk?').text,/Háziállat hozható/);
});

test('chat + Previo TEST read (operator only): requested type only; free/full sentence; stale turn ignored',async()=>{
 const {buildAvailabilityOptions}=await import('../netlify/functions/availability-options.mjs');
 const mk=availability=>async({arrival,departure,cabin})=>({arrival,departure,cabin,availability,availableUnits:availability==='available'?3:0,checkedAt:new Date().toISOString(),source:'previo-rest-73521'});
 const run=async(free,otherFree=true)=>{
  const chat=createChatInquirySession({clock:()=>new Date()});chat.reply('Szia! 2027. június 10-től 13-ig jönnénk 2 felnőtt, gyerek nincs.');
  const r=chat.reply('Deluxe faházat kérnénk.');assert.deepEqual(Object.keys(r.capacityInput).sort(),['adults','arrival','cabin','departure','guests','units']);
  const src=async q=>q.cabin==='deluxe'?mk(free)(q):mk(otherFree?'available':'unavailable')(q);
  const cap=await buildAvailabilityOptions({...r.capacityInput,fallback:false},src,{tenantId:'sarberki',now:()=>Date.now()});
  return {chat,cap,turn:chat.turn};
 };
 let {chat,cap,turn}=await run('unavailable');
 assert.match(chat.withCapacity(cap,{turn}).text,/sajnos nincs elegendő szabad helyünk ebben a háztípusban/);
 ({chat,cap,turn}=await run('available'));
 assert.match(chat.withCapacity(cap,{turn}).text,/jelenleg van szabad helyünk ebben a háztípusban/);
 chat.reply('Van dézsa?');assert.equal(chat.withCapacity(cap,{turn}),null,'a later message makes the read stale');
 // A capacity built WITH fallback (other types free) must not turn "Deluxe full" into "free".
 const c2=createChatInquirySession({clock:()=>new Date()});c2.reply('Szia! 2027. június 10-től 13-ig jönnénk 2 felnőtt, gyerek nincs.');const r2=c2.reply('Deluxe faházat kérnénk.');
 const withFallback=await buildAvailabilityOptions(r2.capacityInput,async q=>q.cabin==='deluxe'?mk('unavailable')(q):mk('available')(q),{tenantId:'sarberki',now:()=>Date.now()});
 const out=c2.withCapacity(withFallback,{turn:c2.turn});
 assert.ok(out===null||!/van szabad helyünk ebben a háztípusban/.test(out.text));
});
test('chat + Previo: a request without a decided unit count is rebuilt without units (DE live finding 2026-11-11)',async()=>{
 const {buildAvailabilityOptions}=await import('../netlify/functions/availability-options.mjs');
 const chat=createChatInquirySession({clock:()=>new Date()});
 chat.reply('Guten Tag, wir möchten vom 24. bis 26. Juni 2027 kommen, 2 Erwachsene, keine Kinder.');const r=chat.reply('Deluxe-Haus bitte.');
 assert.equal('units' in r.capacityInput,false);
 const src=async({arrival,departure,cabin})=>({arrival,departure,cabin,availability:'available',availableUnits:4,checkedAt:new Date().toISOString(),source:'previo-rest-73521'});
 const cap=await buildAvailabilityOptions({...r.capacityInput,fallback:false},src,{tenantId:'sarberki',now:()=>Date.now()});
 assert.match(chat.withCapacity(cap,{turn:chat.turn}).text,/freie Plätze in diesem Haustyp/);
 const wrong=await buildAvailabilityOptions({...r.capacityInput,units:1,fallback:false},src,{tenantId:'sarberki',now:()=>Date.now()});
 assert.equal(chat.withCapacity(wrong,{turn:chat.turn}),null,'a different input is never accepted');
});
