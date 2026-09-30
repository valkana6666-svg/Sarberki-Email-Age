import test from 'node:test';import assert from 'node:assert/strict';
import {cabinFromText,guestCountFromText,childCountFromText,dateRangeFromText,phoneFromText,childAgesFromText,pierPreferenceFromText,languageFromText,replySummary,replyQuestions} from './gmail-normalize.mjs';
const now=new Date('2026-09-28T08:00:00Z');
test('HU parse',()=>{assert.equal(cabinFromText('Deluxe faház'), 'Deluxe');assert.equal(guestCountFromText('5 fő'),5);assert.deepEqual(dateRangeFromText('2026 október 16-19',now),{arrival:'2026-10-16',departure:'2026-10-19',inferredYear:false});});
test('EN parse',()=>{assert.equal(cabinFromText('family cabin'),'Családi');assert.equal(guestCountFromText('4 guests'),4);assert.equal(childCountFromText('2 children'),2);assert.deepEqual(dateRangeFromText('October 16-19 2026',now),{arrival:'2026-10-16',departure:'2026-10-19',inferredYear:false});});
test('DE parse',()=>{assert.equal(cabinFromText('Familien Unterkunft'),'Családi');assert.equal(guestCountFromText('4 Personen'),4);assert.equal(childCountFromText('2 Kinder'),2);assert.deepEqual(dateRangeFromText('Oktober 16-19 2026',now),{arrival:'2026-10-16',departure:'2026-10-19',inferredYear:false});});
test('SI parse',()=>{assert.equal(cabinFromText('Deluxe nastanitev'),'Deluxe');assert.equal(guestCountFromText('4 oseb'),4);assert.equal(childCountFromText('2 otroka'),2);assert.deepEqual(dateRangeFromText('oktober 16-19 2026',now),{arrival:'2026-10-16',departure:'2026-10-19',inferredYear:false});});
test('missing cabin is never inferred from party size',()=>assert.equal(cabinFromText('8 guests'),'? – emberi döntésre vár'));

test('HU repeated month range',()=>assert.deepEqual(dateRangeFromText('2026. október 16-tól október 19-ig',now),{arrival:'2026-10-16',departure:'2026-10-19',inferredYear:false}));
test('past yearless date rolls to next year and requires review',()=>assert.deepEqual(dateRangeFromText('augusztus 10-12',now),{arrival:'2027-08-10',departure:'2027-08-12',inferredYear:true}));
test('next-year wording is explicit inference without review flag',()=>assert.deepEqual(dateRangeFromText('jövőre október 16-19',now),{arrival:'2027-10-16',departure:'2027-10-19',inferredYear:false}));

test('language detection is conservative across HU DE EN SI',()=>{assert.equal(languageFromText('Szeretnénk szállást foglalni 4 fő részére'),'hu');assert.equal(languageFromText('Wir möchten eine Unterkunft für 4 Personen buchen'),'de');assert.equal(languageFromText('We would like accommodation for 4 guests'),'en');assert.equal(languageFromText('Želimo nastanitev za 4 oseb'),'si');assert.equal(languageFromText('Hello'),'unknown');});
test('reply questions follow detected language and only ask missing fields',()=>{assert.deepEqual(replyQuestions('de',{needPhone:true,needCabin:true}),['Bitte teilen Sie uns eine Telefonnummer mit, unter der wir Sie erreichen können.','Welchen Haustyp wünschen Sie: VIP, Családi (Familienhaus), Deluxe oder Osztott (geteiltes Haus)?']);assert.deepEqual(replyQuestions('unknown',{needPhone:true}),[]);});


test('Teszt Elek concrete regression parses all confirmed core fields',()=>{
 const message=`Kedves Sárberki Horgásztó!

Szeretnék érdeklődni szállásfoglalással kapcsolatban 2026. október 16–18. közötti időszakra.

4 fő érkezne: 2 felnőtt és 2 gyermek, 7 és 11 évesek. Deluxe háztípust szeretnénk, lehetőleg dézsával.

Egy kisebb kutyát is vinnénk magunkkal.

Telefonszámom: +36 30 555 1234.

Kérem, írják meg, hogy van-e szabad szállás erre az időpontra, és mennyibe kerülne összesen.

Köszönöm!

Üdvözlettel,
Teszt Elek`;
 assert.deepEqual(dateRangeFromText(message,now),{arrival:'2026-10-16',departure:'2026-10-18',inferredYear:false});
 assert.equal(cabinFromText(message),'Deluxe');
 assert.equal(guestCountFromText(message),4);
 assert.equal(childCountFromText(message),2);
 assert.deepEqual(childAgesFromText(message),[7,11]);
 assert.equal(phoneFromText(message),'+36 30 555 1234');
});
test('HU abbreviated October range',()=>assert.deepEqual(dateRangeFromText('okt. 16-18.',now),{arrival:'2026-10-16',departure:'2026-10-18',inferredYear:true}));


test('colloquial Hungarian without accents still parses core booking facts',()=>{
  const message='szia, oktober 16tol 18ig mennénk, oten lennenk, csaladi haz jo lenne';
  assert.deepEqual(dateRangeFromText(message,now),{arrival:'2026-10-16',departure:'2026-10-18',inferredYear:true});
  assert.equal(guestCountFromText(message),5);
  assert.equal(cabinFromText(message),'Családi');
});

test('Hungarian guest count words are recognized conservatively',()=>{
  assert.equal(guestCountFromText('hatan mennénk'),6);
  assert.equal(guestCountFromText('negyen jönnénk'),4);
  assert.equal(guestCountFromText('8 fo részére'),8);
});


test('informal Hungarian child count and ages are recognized',()=>{
  const message='szia, ket gyerekkel mennénk, 7 meg 11 evesek';
  assert.equal(childCountFromText(message),2);
  assert.deepEqual(childAgesFromText(message),[7,11]);
  assert.equal(languageFromText(message),'hu');
});

test('accentless Hungarian booking text is detected as Hungarian',()=>{
  assert.equal(languageFromText('szallas erdekelne, 4 fo mennénk, dezsa is kellene'),'hu');
});

test('Hungarian missing-cabin follow-up uses natural wording',()=>{
  assert.deepEqual(replyQuestions('hu',{needCabin:true}),['Melyik háztípust szeretné: VIP, Családi, Deluxe vagy Osztott?']);
});


test('real German Gmail regression parses current test message',()=>{
  const message=`Guten Tag,

wir möchten gerne vom 16. bis 19. Oktober bei Ihnen übernachten.

Wir sind 4 Erwachsene und 2 Kinder im Alter von 6 und 10 Jahren. Wir
möchten gerne wissen, ob in diesem Zeitraum noch eine passende
Unterkunft verfügbar ist und wie hoch der Gesamtpreis wäre.

Wenn möglich, hätten wir gerne ein Haus mit eigenem Steg.

Vielen Dank im Voraus.

Mit freundlichen Grüßen
Thomas Berger`;
  assert.deepEqual(dateRangeFromText(message,now),{arrival:'2026-10-16',departure:'2026-10-19',inferredYear:true});
  assert.equal(guestCountFromText(message),6);
  assert.equal(childCountFromText(message),2);
  assert.deepEqual(childAgesFromText(message),[6,10]);
  assert.equal(languageFromText(message),'de');
});


test('real German inbox regression parses yesterday\'s message',()=>{
  const message=`Guten Tag,

wir möchten gerne vom 16. bis 19. Oktober bei Ihnen übernachten.

Wir sind 4 Erwachsene und 2 Kinder im Alter von 6 und 10 Jahren. Wir
möchten gerne wissen, ob in diesem Zeitraum noch eine passende
Unterkunft verfügbar ist und wie hoch der Gesamtpreis wäre.

Wenn möglich, hätten wir gerne ein Haus mit eigenem Steg.

Vielen Dank im Voraus.

Mit freundlichen Grüßen
Thomas Berger`;
  assert.deepEqual(dateRangeFromText(message,now),{arrival:'2026-10-16',departure:'2026-10-19',inferredYear:true});
  assert.equal(guestCountFromText(message),6);
  assert.equal(childCountFromText(message),2);
  assert.deepEqual(childAgesFromText(message),[6,10]);
  assert.equal(languageFromText(message),'de');
  assert.equal(pierPreferenceFromText(message),true);
  assert.equal(cabinFromText(message),'? – emberi döntésre vár');
});


test('private pier preference is recognized without inferring a cabin type',()=>{
  assert.equal(pierPreferenceFromText('Haus mit eigenem Steg'),true);
  assert.equal(pierPreferenceFromText('private fishing pier please'),true);
  assert.equal(pierPreferenceFromText('saját stéget szeretnénk'),true);
  assert.equal(cabinFromText('Haus mit eigenem Steg'),'? – emberi döntésre vár');
});


test('German reply summary preserves the real inbox facts without inventing a cabin or price',()=>{
  const summary=replySummary('de',{arrival:'2026-10-16',departure:'2026-10-19',guests:6,children:2,childAges:[6,10],pier:true});
  assert.match(summary,/16\.10\.2026/u);
  assert.match(summary,/19\.10\.2026/u);
  assert.match(summary,/6 Personen/u);
  assert.match(summary,/4 Erwachsene/u);
  assert.match(summary,/2 Kinder/u);
  assert.match(summary,/6 und 10 Jahren/u);
  assert.match(summary,/eigenem Steg/u);
  assert.doesNotMatch(summary,/VIP|Családi|Deluxe|Osztott|€|Ft|Preis:/u);
});


test('English reply summary uses the shared facts without inventing a cabin or price',()=>{
  const summary=replySummary('en',{arrival:'2026-10-16',departure:'2026-10-19',guests:6,children:2,childAges:[6,10],pier:true,hotTub:true,dog:true});
  assert.match(summary,/16\.10\.2026/u);
  assert.match(summary,/19\.10\.2026/u);
  assert.match(summary,/6 guests/u);
  assert.match(summary,/4 adults/u);
  assert.match(summary,/2 children/u);
  assert.match(summary,/aged 6 and 10/u);
  assert.match(summary,/own fishing pier/u);
  assert.match(summary,/hot tub/u);
  assert.match(summary,/bring a dog/u);
  assert.doesNotMatch(summary,/VIP|Családi|Deluxe|Osztott|€|Ft|Price:/u);
});
