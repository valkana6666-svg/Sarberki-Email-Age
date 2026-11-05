import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReplyDraft} from '../sarberki-core.mjs';
import {BUSINESS} from '../business-config.mjs';
import {fishingQuestion} from '../fishing-rules.mjs';
// Owner request 2026-11-05: many phrasings, Hungarian slang, missing accents, DE/EN/SI.
const CORPUS={
 deposit:{hu:['Mennyi az előleg?','Mekkora foglalót kell fizetni?','Hány százalék az előleg?','Mennyit kell előre fizetni?','Kell előleget fizetni?','Előre kell fizetni valamennyit?','Mennyi a foglaló?','Előleg mennyi?','Mennyi az eloleg?','Mennyi előleget kértek?','Kell foglalót utalni?','Mennyi előleget kell küldeni?'],
  de:['Wie hoch ist die Anzahlung?','Muss man eine Anzahlung leisten?','Wie viel müssen wir anzahlen?'],en:['How much is the deposit?','Do we need to pay a deposit?','Is there a down payment?'],si:['Koliko je predplačilo?','Ali je treba plačati ara?']},
 deadline:{hu:['Meddig kell utalni az előleget?','Mikorra kell befizetni az előleget?','Hány napunk van kifizetni az előleget?','Mi a határidő az előleg utalására?','Mikor kell utalni a foglalót?','Mennyi idő alatt kell átutalni az előleget?'],
  de:['Bis wann muss die Anzahlung bezahlt werden?'],en:['When do we have to pay the deposit?','What is the deadline for the deposit?'],si:['Do kdaj je treba plačati predplačilo?']},
 cancellation:{hu:['Mik a lemondási feltételek?','Mi van, ha le kell mondanunk?','Lemondható a foglalás?','Ha mégsem tudunk menni, visszakapjuk az előleget?','Visszajár az előleg, ha lemondjuk?','Ingyenes a lemondás?','Mi a helyzet lemondás esetén?','Mennyi idővel előtte lehet lemondani?'],
  de:['Wie sind die Stornobedingungen?','Können wir kostenlos stornieren?'],en:['What is your cancellation policy?','Can we cancel for free?','Do we get the deposit back if we cancel?'],si:['Kakšni so pogoji odpovedi?']},
 pier:{hu:['Van stég a házhoz?','Van saját stég?','Lehet stégről horgászni?','Stég van?','Van steg a hazhoz?','Saját stéggel rendelkezik a ház?'],de:['Gibt es einen Steg am Haus?','Hat das Haus einen eigenen Steg?'],en:['Is there a pier at the cabin?','Does the cabin have its own jetty?'],si:['Ali ima hiška svoj pomol?']},
 adjacent:{hu:['Egymás melletti házakat szeretnénk.','Egymás mellé tudnak tenni minket?','Közel legyenek egymáshoz a házak.','Szomszédos házakat kérnénk.','Egymás mellett lévő faházakat kérünk.','Jó lenne, ha egymás mellett lennénk.'],de:['Wir möchten zwei Häuser nebeneinander.'],en:['We would like two cabins next to each other.','Can we have neighbouring cabins?'],si:['Želimo hiški ena poleg druge.']},
 hotTub:{hu:['Van dézsa?','Lehet dézsát bérelni?','Mennyibe kerül a dézsa?','Dézsa ár?','Jakuzzi van?','Lehet dézsázni?','Van fürdődézsa?','A dezsa mennyi?'],de:['Kann man ein Badefass mieten?','Was kostet der Badezuber?','Gibt es einen Whirlpool?'],en:['Is there a hot tub?','How much is the hot tub?','Do you have a jacuzzi?'],si:['Ali imate masažno kad?','Koliko stane vroča kad?']},
 pet:{hu:['Jöhet a kutya?','Kutyával mehetünk?','Hozhatjuk a kutyust?','Vihetünk háziállatot?','Macskát vihetünk?','Kiskutyánk is jönne.','Négylábú barátunk jöhet?'],de:['Dürfen wir unseren Hund mitbringen?','Sind Haustiere erlaubt?'],en:['Can we bring our dog?','Are pets allowed?'],si:['Ali lahko pripeljemo psa?']},
 tickets:{hu:['Mennyi a horgászjegy?','Mennyibe kerül a napijegy?','Mennyi egy hetijegy?','Mennyiért lehet horgászni?','Horgászengedély ára?','Mennyi a jegy a tóra?','Mibe kerül egy napi horgászat?'],de:['Was kostet die Angelkarte?','Was kostet eine Tageskarte zum Angeln?'],en:['How much is a fishing ticket?','What does a day ticket for fishing cost?'],si:['Koliko stane ribolovna karta?']}
};
const MARK={deposit:/előleg a szállásdíj|Anzahlung beträgt|deposit is \d|Predplačilo znaša/,deadline:/napon belül kell befizetni|innerhalb von \d+ Tagen|due within|v \d+ dneh/,cancellation:/lemondásnál az előleg nem vész el|verfällt die Anzahlung nicht|not forfeited|ne zapade/,
 pier:/saját stég tartozik|eigener Steg|own pier|svoj pomol/,adjacent:/szomszédos elhelyezést|nebeneinander prüfen|adjacent cabins|Sosednjo namestitev/,hotTub:/Dézsa külön bérelhető|Badefass kann separat|hot tub can be rented|kad lahko najamete/,
 pet:/Háziállat hozható|Haustiere sind erlaubt|Pets are allowed|ljubljenčki so dovoljeni/,tickets:/órás|heti|Stunden|Woche|hour|weekly|urna|tedensk/};
const reply=(lang,q)=>buildReplyDraft({language:lang,original:q,arrival:'2027-07-10',departure:'2027-07-14',guests:4,adults:4,children:0,phone:'+36 30 555 1234',cabin:'Deluxe',bookingRules:BUSINESS.bookingRules,operationalRules:BUSINESS.operationalRules});
test('every phrasing variant gets the matching approved answer',()=>{
 const miss=[];
 for(const [topic,langs] of Object.entries(CORPUS))for(const [lang,list] of Object.entries(langs))for(const q of list){
  const text=topic==='tickets'?(fishingQuestion(q,lang)?.answer||''):reply(lang,q);
  if(!MARK[topic].test(text))miss.push(topic+'/'+lang+': '+q);
 }
 assert.deepEqual(miss,[]);
});
test('sentences that do not ask get no extra answer (no false positives)',()=>{
 const NEG=[['hu','Mennyi a ház ára?'],['hu','Mennyi lenne az ár 4 főre?'],['hu','Kell parkolóhely?'],['hu','Mikor lehet érkezni?'],['hu','Nem kérünk dézsát.'],['hu','Dézsát is szeretnénk.'],['hu','Nem hozunk kutyát.'],['hu','Le szeretnénk foglalni egy házat.'],['hu','Kérjük, foglaljanak le nekünk egy Deluxe házat.'],['hu','Mennyi időre lehet foglalni?'],['hu','Ha lehet, csendes helyet kérünk.'],['hu','Fizetni kártyával lehet?'],['de','Was kostet das Haus?'],['en','What is the price for 4 people?'],['en','We will arrive in the afternoon.'],['si','Koliko stane hiška?'],['hu','Mekkora a ház?'],['hu','Visszajövünk jövőre is.']];
 const bad=[];
 for(const [lang,q] of NEG){const t=reply(lang,q);const hit=Object.entries(MARK).filter(([k,r])=>k!=='tickets'&&r.test(t)).map(([k])=>k);if(hit.length||fishingQuestion(q,lang))bad.push(q+' → '+hit.join(','));}
 assert.deepEqual(bad,[]);
});

import {extractServerMessage} from '../shared-core/server-message-extraction.mjs';
import {guestCountFromText} from '../sarberki-core.mjs';
const ex=t=>extractServerMessage({sender:'g@example.test',text:t,mailbox_id:'m',message_id:'x',thread_id:'x',rfc_message_id:'<x>',references:[],received_at:'2026-11-05T10:00:00.000Z'});
test('colloquial party sizes and date formats are understood',()=>{
 const P=[['Ketten jönnénk 2027. július 10-től 14-ig.',2],['Négyen lennénk 2027. július 10-14.',4],['2+2 fő, 2027. július 10-14.',4],['Két felnőtt és két gyerek jönne 2027. július 10-14.',4],['3 felnőtt + 1 gyerek, 2027. július 10-14.',4],['Egyedül jönnék 2027. július 10-14.',1],['Öten vagyunk, 2027. július 10-14.',5],['Hatan jönnénk 2027. július 10-14.',6],['5-en lennénk 2027. július 10-14.',5],['Párommal jönnék 2027. július 10-14.',2],['Két család, 4 felnőtt és 3 gyerek, 2027. július 10-14.',7]];
 for(const [t,n] of P)assert.equal(Number(ex(t).guests),n,t);
 const D=['2027. július 10-től 14-ig jönnénk 2 fővel.','2027. júl. 10–14. között 2 fő.','2027.07.10-14. 2 fő.','2027.07.10 - 2027.07.14, 2 fő.','2027. július 10. és 14. között 2 fő.','10-14 July 2027, 2 adults.','Vom 10. bis 14. Juli 2027 zu zweit.','Od 10. do 14. julija 2027, 2 osebi.'];
 for(const t of D){const v=ex(t);assert.deepEqual([v.arrival,v.departure],['2027-07-10','2027-07-14'],t);}
});
test('colloquial party forms do not invent a party size',()=>{
 assert.equal(guestCountFromText('Július 10-én érkeznénk.'),null);
 assert.equal(guestCountFromText('A párommal és két gyerekkel jönnék.')===2,false);
 assert.equal(guestCountFromText('Nem egyedül jönnék, hanem hárman.'),3);
 assert.equal(guestCountFromText('4 fős házat keresünk.'),null);
});
