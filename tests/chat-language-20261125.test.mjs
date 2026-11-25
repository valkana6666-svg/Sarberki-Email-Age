// Owner 2026-11-25 (#9 7161417452 / 7162176483): natural four-language chat test. Regressions for the defects the
// 100-conversation run found, and the engine pass of that run itself (fictional data, no network).
import test from 'node:test';
import assert from 'node:assert/strict';
import {dateRangeFromText,languageFromText,childAgesFromText,adultCountFromText,requestFlagsFromText} from '../sarberki-core.mjs';
import {createChatInquirySession,shortTurnKind} from '../sarberki-chatbot-project/chat-session.mjs';
import {buildConversations,runEngine} from '../scripts/chat-language-e2e.mjs';

const NOW=new Date('2026-11-25T12:00:00Z');

test('German / Slovene day.month dates with the year at the end are day-first (were read as month.day)',()=>{
 const r=t=>{const d=dateRangeFromText(t,NOW);return d&&[d.arrival,d.departure];};
 assert.deepEqual(r('05.06.-09.06.2027 3 Erwachsene'),['2027-06-05','2027-06-09']);
 assert.deepEqual(r('8.6.-10.6.2027'),['2027-06-08','2027-06-10']);
 assert.deepEqual(r('30.12.-02.01.2028'),['2027-12-30','2028-01-02']);
 assert.deepEqual(r('2027.06.05-06.09'),['2027-06-05','2027-06-09'],'Hungarian year-first form unchanged');
 assert.deepEqual(r('06.10-06.13'),['2027-06-10','2027-06-13'],'Hungarian month.day without year unchanged');
 assert.equal(r('05.13.-09.06.2027'),null,'month 13: rejected, never guessed');
});

test('language: accented first letters count, everyday short questions are recognised, a bare greeting is not',()=>{
 const l=(t,c=false)=>languageFromText(t,{conservative:c});
 assert.equal(l('Üdv, Hány órától lehet érkezni?'),'hu');assert.equal(l('Van wifi a házakban?',true),'hu');assert.equal(l('Lehet horgászni éjszaka is?',true),'hu');
 assert.equal(l('Servus Was kostet die Angelkarte?'),'de');assert.equal(l('Wir möchten das Familienhaus buchen?',true),'de');assert.equal(l('Ab wann ist Check-in?',true),'de');
 assert.equal(l('Hey there How much is a fishing ticket?'),'en');assert.equal(l('What time is check-in?',true),'en');assert.equal(l("We'd like the VIP apartment?",true),'en');
 assert.equal(l('Dober dan Ali je wifi?'),'si');assert.equal(l('Ali je wifi?',true),'si');
 assert.equal(l('Hello'),'unknown');assert.equal(l('Hi Ab wann ist Check-in?',true),'unknown','mixed: keep the chat language');
});

test('party: "(9 yrs)", ages given later, "4 fő, mind felnőtt"; cabin without accents (SI)',()=>{
 assert.deepEqual(childAgesFromText('2 adults + 1 children (9 yrs)'),[9]);assert.deepEqual(childAgesFromText('The kids are 8 and 5'),[8,5]);
 assert.deepEqual(childAgesFromText('We are 2 adults and 1 kids'),[]);
 assert.equal(adultCountFromText('4 fo, mind felnott'),4);assert.equal(adultCountFromText('4 people, all adults'),4);assert.equal(adultCountFromText('4 fő, mind felnőtt, 1 gyerek'),null,'with a child: not all adults');
 const s=createChatInquirySession({clock:()=>NOW});s.reply('Dober dan Želimo druzinsko hisko 19.7.-21.7.2027, nas je 2 odraslih.');assert.equal(s.snapshot().cabin,'Családi');
});

test('hot tub refusal in English is a refusal ("don\'t need"), a wish stays a wish',()=>{
 assert.equal(requestFlagsFromText("We don't need the hot tub after all").hotTubRequested,false);
 assert.equal(requestFlagsFromText("We'd like to rent the hot tub too").hotTubRequested,true);
});

test('active stay: thanks / hand-over / hot tub refusal get a short reply, facts kept, no model call; an unknown question goes to the model',()=>{
 const s=createChatInquirySession({clock:()=>NOW});s.reply('Deluxe faházat szeretnénk 2027. június 10-től 13-ig, 2 felnőtt.');const before=s.snapshot();
 for(const [t,kind] of [['Köszi, ennyi lenne!','thanks'],['Beszélhetnék egy munkatárssal?','handover'],['A dézsát mégsem kérjük','tubOff']]){
  const r=s.reply(t);assert.equal(r.decision,null,t);assert.equal(r.noAssist,true,t);assert.equal(shortTurnKind(t),kind);assert.ok(r.text.length<160,t);
  assert.deepEqual({...s.snapshot(),originalText:null},{...before,originalText:null},t);
 }
 const q=s.reply('Van helikopter-leszálló?');assert.equal(q.decision,null);assert.notEqual(q.noAssist,true,'the fact-bound model may answer');
 const c=s.reply('Mégis 3 felnőtt leszünk');assert.ok(c.decision,'a change is still a booking update');assert.equal(s.snapshot().adults,3);
 assert.equal(shortTurnKind('Thanks, how much is the deposit?'),null,'a question is never closed as thanks');
 assert.equal(shortTurnKind('Kein Hund, aber den Badezuber bitte'),null);
});

test('100 generated conversations (25 per language): every stay understood, nothing known asked again, reply language right',()=>{
 const convs=buildConversations();assert.equal(convs.length,100);
 for(const l of ['hu','de','en','si'])assert.equal(convs.filter(c=>c.lang===l).length,25);
 assert.ok(convs.filter(c=>c.turns.length>=15).length>=16,'long conversations present');
 const res=runEngine(convs);
 assert.deepEqual(res.filter(r=>r.factIssues.length).map(r=>r.id+': '+r.factIssues.join('; ')),[]);
 assert.deepEqual(res.flatMap(r=>r.issues.filter(i=>/újrakérdezés|házszám|hibás|nyelv/.test(i)).map(i=>r.id+': '+i)),[]);
 // Known rule-only limit (the live page adds the fact-bound model answer): a two-part question where the rules answer one part.
 assert.deepEqual(res.filter(r=>!r.ok).map(r=>r.id),['SI-03']);
});
