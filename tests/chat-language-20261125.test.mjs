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
 for(const t of ['Mennyi lesz összesen?','How much is it in total?','Was kostet das insgesamt?','Koliko bo skupaj?','Wie viel kostet das?']){const r=s.reply(t);assert.ok(r.decision,'a price question in an active stay is a booking turn (the page shows the offer again): '+t);}
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

// E-mail channel: the server's own chain (extraction → case store follow-up merge → shared engine draft).
import {createBookingCaseStore} from '../booking-cases.mjs';
import {extractServerMessage} from '../shared-core/server-message-extraction.mjs';
import {scope} from '../shared-core/server-test-mailbox-case.mjs';
import {runEmail} from '../scripts/email-language-e2e.mjs';
function thread(letters){
 let current=null;const caseId='tm-aaaaaaaaaaaa0001';
 for(const [n,text] of letters.entries()){
  const at=`2026-11-25T1${n}:00:00Z`,env={sender:'g@example.test',text,mailbox_id:'m',message_id:'x'+n,thread_id:'t',rfc_message_id:`<x${n}@e>`,references:[],received_at:at};
  let saved;const store=createBookingCaseStore({storage:{getItem:()=>JSON.stringify(current?[current]:[]),setItem:(_,v)=>{saved=JSON.parse(v);}},tenantId:'sarberki-test',clock:()=>at,id:()=>caseId});
  store.ingest(scope(env),extractServerMessage(env,current?{previous:current.state.values}:undefined),{approvedCaseId:current?caseId:null});
  current=saved.find(c=>c.id===caseId);
 }
 return current.state.values;
}
test('e-mail follow-ups: a correction next to a tub wish is applied; a tub party never rewrites the stay; children survive an adults-only change',()=>{
 const first='Dober dan, želimo družinsko hiško od 19. do 21. julija 2027, 2 odrasla in 2 otroka (5 in 8 let).\n\nLep pozdrav,\nTestni Gost';
 let v=thread([first,'Oprostite, raje od 22. do 24. julija.\nRadi bi najeli tudi masažno kad.\n\nLep pozdrav,\nTestni Gost']);
 assert.equal(v.arrival,'2027-07-22');assert.equal(v.departure,'2027-07-24');assert.equal(v.children,'2');assert.ok(v.request);
 v=thread([first,'Vseeno nas bo 3 odraslih.\n\nLep pozdrav,\nTestni Gost']);
 assert.equal(v.adults,'3');assert.equal(v.children,'2','children kept');assert.equal(String(v.child_ages).replace(/\s/g,''),'5,8');
 v=thread([first,'Masažno kad bi radi za 6 oseb, prosimo.\n\nLep pozdrav,\nTestni Gost']);
 assert.equal(v.adults,'2','a tub party is not the stay party');assert.equal(v.arrival,'2027-07-19');
 v=thread(['Jó napot! 2027.07.17-07.20, 4 felnőtt.\n\nÜdvözlettel:\nTeszt Vendég','Lenne VIP apartman? És van-e dézsa?\n\nÜdvözlettel:\nTeszt Vendég']);
 assert.equal(v.unit,'VIP','a missing cabin type is filled next to a tub question');
 v=thread(['Jó napot! 2027.07.17-07.20, 4 felnőtt, Deluxe faház.\n\nÜdvözlettel:\nTeszt Vendég','A VIP-hez is van dézsa?\n\nÜdvözlettel:\nTeszt Vendég']);
 assert.equal(v.unit,'Deluxe','a known cabin is not rewritten by a tub question');
 v=thread([first,'Csak felnőttek jönnek, 3 felnőtt.\n\nÜdvözlettel']);
 assert.equal(v.children,'0','"only adults" still clears the children');
});
test('100 e-mail threads (25 per language, same scenarios): facts, language, approval gate, no re-asking',async()=>{
 const res=await runEmail(buildConversations());
 assert.equal(res.length,100);assert.ok(res.reduce((s,r)=>s+r.letters,0)>=350);
 assert.deepEqual(res.filter(r=>!r.ok).map(r=>r.id+': '+[...r.factIssues,...r.issues].join('; ')),[]);
});

// Owner chat test 2026-11-27: a price question about a cabin without dates asks for the dates and guests (all four languages).
test('price question about a cabin, no dates yet → asks for dates and guests, not the cabin list',async()=>{
 const {chatbotReply}=await import('../chatbot-v1.mjs');
 for(const [msg,lang] of [['Mennyibe kerül egy éjszakára a delux fahaz?','hu'],['Was kostet das Deluxe Haus pro Nacht?','de'],['How much is the deluxe cabin per night?','en'],['Koliko stane deluxe hiška na noč?','si']]){
  const r=chatbotReply({message:msg,language:lang});assert.equal(r.intent,'price',msg);
 }
 assert.notEqual(chatbotReply({message:'Mennyibe kerül a dézsa a faháznál?',language:'hu'}).intent,'price');
 assert.notEqual(chatbotReply({message:'Faházvendégként mennyibe kerül a horgászjegy?',language:'hu'}).intent,'price');
});

// Owner 2026-11-27: every cabin type, every language – the price question gets the signed 2027 price per night, the
// included guests, the per-guest extra and the maximum; „all cabins” lists every type.
test('price answer per cabin type and language (2027 tariff), all types when none is named',async()=>{
 const {chatbotReply}=await import('../chatbot-v1.mjs');
 const Q={hu:{deluxe:'Mennyibe kerül a delux fahaz?',vip:'Mennyi a VIP ház ára egy éjszakára?',family:'Mennyibe kerül a családi faház?',apart:'Mennyibe kerül az apartman?',small:'Mennyibe kerül a különálló 2 fős ház?',all:'Mennyibe kerülnek a faházak?'},
  de:{deluxe:'Was kostet das Deluxe Haus pro Nacht?',vip:'Was kostet das VIP Haus?',family:'Was kostet das Familienhaus?',apart:'Was kostet die Wohnung?',all:'Was kosten die Ferienhäuser?'},
  en:{deluxe:'How much is the deluxe cabin per night?',vip:'What is the price of the VIP cabin?',family:'How much does the family cabin cost?',apart:'How much is the apartment?',all:'How much are the cabins?'},
  si:{deluxe:'Koliko stane deluxe hiška na noč?',vip:'Kakšna je cena VIP hiške?',family:'Koliko stane družinska hiška?',apart:'Koliko stane apartma?',all:'Koliko stanejo hiške?'}};
 const has={deluxe:['63 000','10 000',' 6 '],vip:['63 000','10 000',' 7 '],family:['55 000','10 000',' 8 '],apart:['46 000','24 000'],small:['31 500','5 000']};
 for(const [lang,qs] of Object.entries(Q))for(const [k,msg] of Object.entries(qs)){
  const r=chatbotReply({message:msg,language:lang});assert.equal(r.intent,'price',lang+' '+msg);
  for(const x of k==='all'?['63 000','55 000','46 000','24 000','31 500']:has[k])assert.ok(r.reply.includes(x.trim()),lang+' '+msg+' → '+x);
  if(k!=='all'&&k!=='apart')assert.ok(!r.reply.includes(k==='family'?'63 000':'55 000'),'only the named type: '+msg);
  assert.match(r.reply,/550/,'tourist tax');assert.match(r.reply,/\+10%/);assert.match(r.reply,/\+20%/);
 }
});
