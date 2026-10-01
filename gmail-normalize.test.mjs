import test from 'node:test';import assert from 'node:assert/strict';
import {cabinFromText,guestCountFromText,childCountFromText,dateRangeFromText,phoneFromText,childAgesFromText,pierPreferenceFromText,languageFromText,replySummary,replyQuestions,buildReplyDraft} from './sarberki-core.mjs';
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

test('adult plus child counts produce total guests in HU EN DE SI',()=>{
  assert.equal(guestCountFromText('2 felnőtt és 2 gyermek'),4);
  assert.equal(guestCountFromText('2 adults and 2 children'),4);
  assert.equal(guestCountFromText('2 Erwachsene und 2 Kinder'),4);
  assert.equal(guestCountFromText('2 odrasla in 2 otroka'),4);
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


test('English full inquiry regression uses the shared multilingual core',()=>{
  const message=`Hello,

I would like to inquire about accommodation from October 16 to 18, 2026.

There will be 4 guests: 2 adults and 2 children, aged 7 and 11.
We would like a Deluxe cabin, preferably with a hot tub.

We would also like to bring a small dog.

My phone number is +36 30 555 1234.

Could you please let us know whether accommodation is available and what the total price would be?

Thank you,
John Test`;
  assert.deepEqual(dateRangeFromText(message,now),{arrival:'2026-10-16',departure:'2026-10-18',inferredYear:false});
  assert.equal(cabinFromText(message),'Deluxe');
  assert.equal(guestCountFromText(message),4);
  assert.equal(childCountFromText(message),2);
  assert.deepEqual(childAgesFromText(message),[7,11]);
  assert.equal(phoneFromText(message),'+36 30 555 1234');
  assert.equal(languageFromText(message),'en');
  const summary=replySummary('en',{arrival:'2026-10-16',departure:'2026-10-18',guests:4,children:2,childAges:[7,11],hotTub:true,dog:true});
  assert.match(summary,/4 guests/u);
  assert.match(summary,/2 adults/u);
  assert.match(summary,/2 children/u);
  assert.match(summary,/aged 7 and 11/u);
  assert.match(summary,/hot tub/u);
  assert.match(summary,/bring a dog/u);
});


test('German orthography markers are recognized',()=>{
  assert.equal(languageFromText('Wir möchten für März eine Unterkunft. Grüße aus München!'),'de');
  assert.equal(languageFromText('Wir haetten gerne eine Unterkunft im Maerz.'),'de');
});

test('Slovenian orthography markers are recognized',()=>{
  assert.equal(languageFromText('Želimo hiško z lastnim pomolom. Prosim, sporočite, če je prosto.'),'si');
  assert.equal(languageFromText('Čez vikend bi želeli nastanitev za 4 osebe. Hvala in lep pozdrav.'),'si');
});

test('English aged child syntax is recognized',()=>{
  assert.deepEqual(childAgesFromText('2 children, aged 7 and 11'),[7,11]);
});

test('labelled child age lists parse all ages in DE EN SI',()=>{
  assert.deepEqual(childAgesFromText('3 Kinder: 4, 9 und 13 Jahre alt'),[4,9,13]);
  assert.deepEqual(childAgesFromText('3 children: 4, 9 and 13 years old'),[4,9,13]);
  assert.deepEqual(childAgesFromText('3 otroci: 4, 9 in 13 let'),[4,9,13]);
});


test('varied real-world DE SI EN inquiry regressions',()=>{
  const de=`Guten Abend,

für unseren Familienausflug suchen wir vom 7. bis 10. November 2026 eine Unterkunft.
Wir wären insgesamt 5 Personen: 3 Erwachsene und 2 Kinder im Alter von 8 und 12 Jahren.
Am liebsten hätten wir ein Deluxe-Haus mit Badefass. Einen kleinen Hund würden wir ebenfalls mitbringen.
Sie erreichen mich unter +43 660 123 4567.

Könnten Sie uns bitte mitteilen, ob etwas frei ist und wie hoch der Gesamtpreis wäre?

Viele Grüße
Anna Müller`;
  assert.equal(languageFromText(de),'de');
  assert.deepEqual(dateRangeFromText(de,now),{arrival:'2026-11-07',departure:'2026-11-10',inferredYear:false});
  assert.equal(cabinFromText(de),'Deluxe');
  assert.equal(guestCountFromText(de),5);
  assert.equal(childCountFromText(de),2);
  assert.deepEqual(childAgesFromText(de),[8,12]);
  assert.equal(phoneFromText(de),'+43 660 123 4567');

  const si=`Pozdravljeni,

novembra bi z družino radi preživeli nekaj dni pri vas. Zanimajo nas datumi od 20. do 23. novembra 2026.
Prišli bi 4: dva odrasla in dva otroka, stara 5 in 9 let.
Če je mogoče, bi želeli Deluxe hiško in vročo kad. S seboj bi pripeljali tudi manjšega psa.
Moja telefonska številka je +386 41 234 567.

Prosim, sporočite, ali je termin prost in kakšna bi bila skupna cena.

Hvala in lep pozdrav,
Maja Kovačič`;
  assert.equal(languageFromText(si),'si');
  assert.deepEqual(dateRangeFromText(si,now),{arrival:'2026-11-20',departure:'2026-11-23',inferredYear:false});
  assert.equal(cabinFromText(si),'Deluxe');
  assert.equal(guestCountFromText(si),4);
  assert.equal(childCountFromText(si),2);
  assert.deepEqual(childAgesFromText(si),[5,9]);
  assert.equal(phoneFromText(si),'+386 41 234 567');

  const en=`Hi there,

We're planning a short break and are looking at December 4-7, 2026.
Our group has 6 guests: 4 adults plus 2 children, aged 6 and 13.
A Deluxe cabin would be our first choice, and we'd also like a hot tub if one is available.
We'll be travelling with a small dog. You can reach me on +44 7700 900123.

Could you let me know if you have availability and the total cost?

Best regards,
Emily Carter`;
  assert.equal(languageFromText(en),'en');
  assert.deepEqual(dateRangeFromText(en,now),{arrival:'2026-12-04',departure:'2026-12-07',inferredYear:false});
  assert.equal(cabinFromText(en),'Deluxe');
  assert.equal(guestCountFromText(en),6);
  assert.equal(childCountFromText(en),2);
  assert.deepEqual(childAgesFromText(en),[6,13]);
  assert.equal(phoneFromText(en),'+44 7700 900123');
});


test('real Gmail comprehensive English end-to-end regression',()=>{
  const message=`Hello,

We are planning a family fishing holiday and would like to stay from
November 12 to November 16, 2026.

There would be 8 guests altogether: 5 adults and 3 children, aged 4, 9
and 13. We would prefer a Deluxe cabin, but if one cabin is not
suitable for our group, we would also be interested in two separate
accommodation units.

If available, we would like accommodation with a private fishing pier
and a hot tub. We will also bring one small dog.

We are travelling with three cars, so please let us know whether
parking for all three vehicles is available.

Is electricity included in the accommodation price, or is consumption
charged separately according to the meter?
Is firewood available, and if so, is there an additional charge?
Would it be possible to arrive at approximately 6:30 PM?
What time do we need to leave the accommodation on the day of departure?

Could you please tell us the total accommodation price, including any
applicable seasonal surcharge, tourist tax and hot-tub charge?

We have stayed at Sárberki before, approximately one year ago. Please
also check whether we may qualify for a returning-guest discount.

Could you also let us know how much deposit is required, when it must
be paid, and what the cancellation conditions would be for a group of
this size?

If the Deluxe option is not available for these dates, please suggest
another suitable cabin type or a combination of units for eight
people.

We are also interested in fishing. Could you tell us the price of a
24-hour adult ticket for the Normal lake, whether children need a
separate ticket, and whether barbed hooks are allowed? We would also
like to know whether there are minimum fish sizes or separate prices
for fish that may be taken away.

My phone number is +44 7700 912345.

Thank you very much. We look forward to your reply.

Best regards,
Michael Thompson`;
  assert.equal(languageFromText(message),'en');
  assert.deepEqual(dateRangeFromText(message,now),{arrival:'2026-11-12',departure:'2026-11-16',inferredYear:false});
  assert.equal(cabinFromText(message),'Deluxe');
  assert.equal(guestCountFromText(message),8);
  assert.equal(childCountFromText(message),3);
  assert.deepEqual(childAgesFromText(message),[4,9,13]);
  assert.equal(phoneFromText(message),'+44 7700 912345');
  assert.equal(pierPreferenceFromText(message),true);
});


test('family holiday wording does not invent Family cabin',()=>{
  assert.equal(cabinFromText('We are planning a family fishing holiday. We would prefer a Deluxe cabin.'),'Deluxe');
  assert.equal(cabinFromText('We would like a Family cabin.'),'Családi');
  assert.equal(cabinFromText('Wir planen einen Familienurlaub und möchten eine Deluxe Unterkunft.'),'Deluxe');
});


test('English multiple-cabin regression from iPhone screen recording',()=>{
  const message=`Hello,

We would like to stay at Sárberki Fishing Lake from 16 October 2026 to 18 October 2026.

There will be 8 people in total: 6 adults and 2 children, aged 7 and 11. We would like to book two cabins, preferably Deluxe cabins with hot tubs.

We are also bringing one dog.

Could you please let us know the availability and the price for each cabin separately, as well as the total price?

Phone: +36 30 555 1234

Kind regards,
John Smith`;
  assert.deepEqual(dateRangeFromText(message,now),{arrival:'2026-10-16',departure:'2026-10-18',inferredYear:false});
  assert.equal(languageFromText(message),'en');
  assert.equal(cabinFromText(message),'Deluxe');
  assert.equal(guestCountFromText(message),8);
  assert.equal(childCountFromText(message),2);
  assert.deepEqual(childAgesFromText(message),[7,11]);
  assert.equal(phoneFromText(message),'+36 30 555 1234');
});


test('shared reply builder keeps manual and Gmail drafts identical for the same normalized facts',()=>{
  const facts={
    name:'Teszt Elek',
    original:'2026 október 16-18, 4 fő, 2 gyermek 7 és 11 éves, Deluxe, dézsa, kutya. Mennyi a teljes ár?',
    arrival:'2026-10-16',
    departure:'2026-10-18',
    guests:4,
    children:2,
    childAges:[7,11],
    phone:'+36 30 555 1234',
    cabin:'Deluxe',
    hotTub:true,
    dog:true,
    intent:'booking_request'
  };
  for(const language of ['hu','de','en','si']){
    const manual=buildReplyDraft({language,...facts});
    const gmail=buildReplyDraft({language,...facts});
    assert.equal(manual,gmail,language);
    assert.match(manual,/Sárberki Horgásztó/u);
    assert.doesNotMatch(manual,/122[ .]?200|128[ .]?000/u);
  }
});

test('shared reply builder asks only shared missing-data questions',()=>{
  const draft=buildReplyDraft({
    language:'hu',
    original:'október 16-18, 4 fő, 2 gyermek',
    arrival:'2026-10-16',
    departure:'2026-10-18',
    guests:4,
    children:2,
    childAges:[],
    phone:null,
    cabin:'? – emberi döntésre vár',
    intent:'booking_request'
  });
  assert.match(draft,/gyermek életkorát/u);
  assert.match(draft,/telefonszámot/u);
  assert.match(draft,/Melyik háztípust/u);
});


test('custom business timezone is supported',()=>{
  const instant=new Date('2026-10-01T22:30:00Z');
  assert.deepEqual(dateRangeFromText('október 1-2',instant,'Pacific/Honolulu'),{arrival:'2026-10-01',departure:'2026-10-02',inferredYear:true});
  assert.deepEqual(dateRangeFromText('október 1-2',instant,'Europe/Budapest'),{arrival:'2027-10-01',departure:'2027-10-02',inferredYear:true});
});


test("HU natural 'és ... között' range regression",()=>{
  assert.deepEqual(
    dateRangeFromText('2026. október 23. és 26. között szeretnénk megszállni',new Date('2026-10-01T12:00:00Z')),
    {arrival:'2026-10-23',departure:'2026-10-26',inferredYear:false}
  );
});

test('booking subquestions return only the relevant known policy details',()=>{
  const base={
    language:'hu',
    arrival:'2026-10-23',
    departure:'2026-10-26',
    guests:8,
    children:3,
    childAges:[4,9,13],
    phone:'+36 30 555 1234',
    cabin:'Osztott',
    intent:'booking_request',
    bookingRules:{depositPct:50,depositDueDays:10,cancellationDaysUnder15Guests:14,cancellationDaysFrom15Guests:30}
  };
  const deadlineOnly=buildReplyDraft({...base,original:'Mennyi időn belül kell befizetni az előleget?'});
  assert.match(deadlineOnly,/10 napon belül/u);
  assert.match(deadlineOnly,/foglalást töröljük/u);
  assert.doesNotMatch(deadlineOnly,/A foglaláshoz 50% előleg szükséges/u);
  assert.doesNotMatch(deadlineOnly,/lemondási határidő/u);

  const general=buildReplyDraft({...base,original:'Mik a foglalási feltételek és a lemondási szabályok?'});
  assert.match(general,/50% előleg/u);
  assert.match(general,/10 napon belül/u);
  assert.match(general,/14 nap/u);
});

test('dense HU inquiry keeps dates and answers booking conditions together',()=>{
  const message=`Tisztelt Sárberki Horgásztó!

2026. október 23. és 26. között szeretnénk Önöknél megszállni, összesen 3 éjszakára.
Összesen 8 fő érkezne: 5 felnőtt és 3 gyermek. A gyermekek 4, 9 és 13 évesek.
Osztott szállást szeretnénk két egységben, dézsával és egy kis kutyával.
Kérem írják meg, mennyi előleget kell fizetni, hány napon belül kell átutalni, és mik a lemondási feltételek.`;
  const range=dateRangeFromText(message,new Date('2026-10-01T12:00:00Z'));
  assert.deepEqual(range,{arrival:'2026-10-23',departure:'2026-10-26',inferredYear:false});
  const draft=buildReplyDraft({
    language:'hu',original:message,arrival:range.arrival,departure:range.departure,
    guests:8,children:3,childAges:[4,9,13],phone:'+36 30 555 1234',cabin:'Osztott',
    hotTub:true,dog:true,intent:'booking_request',
    bookingRules:{depositPct:50,depositDueDays:10,cancellationDaysUnder15Guests:14,cancellationDaysFrom15Guests:30}
  });
  assert.match(draft,/23\.10\.2026/u);
  assert.match(draft,/26\.10\.2026/u);
  assert.match(draft,/8 fő/u);
  assert.match(draft,/50% előleg/u);
  assert.match(draft,/10 napon belül/u);
  assert.match(draft,/14 nap/u);
});


test('booking policy answers stay equivalent in DE EN SI',()=>{
  const rules={
    depositPct:50,
    depositDueDays:10,
    cancellationDaysUnder15Guests:14,
    cancellationDaysFrom15Guests:30
  };
  const cases=[
    ['de','Wie hoch ist die Anzahlung, wann muss sie bezahlt werden und was sind die Stornierungsbedingungen?',8,/50%.*10 Tagen.*14 Tage/su],
    ['en','How much deposit is required, when must it be paid, and what are the cancellation conditions?',8,/50%.*10 days.*14 days/su],
    ['si','Kolikšno predplačilo je potrebno, kdaj ga moramo plačati in kakšni so pogoji odpovedi?',8,/50%.*10 dneh.*14 dni/su]
  ];
  for(const [language,original,guests,pattern] of cases){
    const draft=buildReplyDraft({
      language,
      original,
      arrival:'2026-11-12',
      departure:'2026-11-16',
      guests,
      children:0,
      childAges:[],
      phone:'+36 30 555 1234',
      cabin:'Deluxe',
      intent:'booking_request',
      bookingRules:rules
    });
    assert.match(draft,pattern,language);
  }
});

test('15+ guest cancellation threshold is localized consistently',()=>{
  const rules={
    depositPct:80,
    depositDueDays:10,
    cancellationDaysUnder15Guests:14,
    cancellationDaysFrom15Guests:30
  };
  for(const language of ['hu','de','en','si']){
    const original={
      hu:'Mik a foglalási feltételek és a lemondási szabályok?',
      de:'Was sind die Buchungsbedingungen und Stornierungsbedingungen?',
      en:'What are the booking conditions and cancellation terms?',
      si:'Kakšni so rezervacijski pogoji in pogoji odpovedi?'
    }[language];
    const draft=buildReplyDraft({
      language,original,arrival:'2026-11-12',departure:'2026-11-16',
      guests:15,children:0,childAges:[],phone:'+36 30 555 1234',
      cabin:'Deluxe',intent:'booking_request',bookingRules:rules
    });
    assert.match(draft,/30 (?:nap|Tage|days|dni)/u,language);
  }
});


test('dense operational questions are answered from verified config',()=>{
  const operationalRules={
    reception24h:true,
    confirmedLateArrivalExample:'18:30',
    checkoutBy:'10:00',
    electricitySettlement:'metered_separate',
    parking:'available_large_group_review',
    firewood:'surcharge_price_unverified',
    returningGuestDiscountPct:20,
    returningGuestLookbackDays:730,
    returningGuestRequiresHistoryCheck:true
  };
  const draft=buildReplyDraft({
    language:'en',
    original:'We have three cars. Is electricity included or charged by the meter? Is firewood available and is there an extra charge? Can we arrive at 6:30 PM? What time do we need to leave? We stayed about one year ago; please check the returning-guest discount.',
    arrival:'2026-11-12',departure:'2026-11-16',guests:8,children:0,childAges:[],
    phone:'+44 7700 912345',cabin:'Deluxe',intent:'booking_request',
    operationalRules
  });
  assert.match(draft,/Electricity is charged separately/u);
  assert.match(draft,/Firewood is available/u);
  assert.match(draft,/Parking is available/u);
  assert.match(draft,/18:30/u);
  assert.match(draft,/10:00/u);
  assert.match(draft,/20%/u);
  assert.match(draft,/730 days/u);
  assert.match(draft,/not applied automatically/u);
});

test('deposit percentage changes at 15 guests and unknown group size stays explicit',()=>{
  const rules={depositPctUnder15Guests:50,depositPctFrom15Guests:80,depositDueDays:10,cancellationDaysUnder15Guests:14,cancellationDaysFrom15Guests:30};
  const under=buildReplyDraft({language:'hu',original:'Mekkora előleg kell?',guests:14,phone:'x',cabin:'Deluxe',bookingRules:rules});
  const over=buildReplyDraft({language:'hu',original:'Mekkora előleg kell?',guests:15,phone:'x',cabin:'Deluxe',bookingRules:rules});
  const unknown=buildReplyDraft({language:'hu',original:'Mekkora előleg kell?',guests:null,phone:'x',cabin:'Deluxe',bookingRules:rules});
  assert.match(under,/50%/u);
  assert.match(over,/80%/u);
  assert.match(unknown,/15 fő alatt 50%.*15 főtől 80%/su);
});


test('pricing subquestions acknowledge season tax and alternatives',()=>{
  const pricingRules={highSeasonSurchargePct:10,highSeasonStart:'07-01',highSeasonEnd:'08-20',tourismTaxAdultNightlyHuf:550};
  const outside=buildReplyDraft({
    language:'en',
    original:'Please include any seasonal surcharge and tourist tax. If Deluxe is not available, suggest another suitable cabin type or a combination of units.',
    arrival:'2026-11-12',departure:'2026-11-16',guests:8,phone:'x',cabin:'Deluxe',pricingRules
  });
  assert.match(outside,/outside the period with the 10% high-season surcharge/u);
  assert.match(outside,/550 HUF per adult per night/u);
  assert.match(outside,/another suitable cabin type or a combination of units/u);

  const inside=buildReplyDraft({
    language:'hu',
    original:'Van szezonfelár?',
    arrival:'2027-07-10',departure:'2027-07-13',guests:4,phone:'x',cabin:'Deluxe',pricingRules
  });
  assert.match(inside,/10%-os főszezoni felár/u);
  assert.match(inside,/szállásdíjra vonatkozik, a dézsára nem/u);
});


test('dense guest letter keeps every verified answer in one final draft',async()=>{
  const {BUSINESS}=await import('./business-config.mjs');
  const {fishingQuestion}=await import('./fishing-rules.mjs');
  const original=`Hello,

We are planning a family fishing holiday and would like to stay from November 12 to November 16, 2026.
There would be 8 guests altogether: 5 adults and 3 children, aged 4, 9 and 13. We would prefer a Deluxe cabin, but if it is not available, please suggest another suitable cabin type or a combination of units.
If available, we would like a private fishing pier and a hot tub. We will also bring one small dog.
We are travelling with three cars.
Is electricity included or charged separately according to the meter?
Is firewood available and is there an additional charge?
Would it be possible to arrive at approximately 6:30 PM?
What time do we need to leave on departure day?
Please include any applicable seasonal surcharge, tourist tax and hot-tub charge.
We stayed about one year ago. Please check whether we may qualify for a returning-guest discount.
How much deposit is required, when must it be paid, and what are the cancellation conditions?
For fishing: what is the price of a 24-hour adult ticket for the Normal lake, do children need a separate ticket, are barbed hooks allowed, what are the minimum fish sizes, and what are the take-away fish prices?
Phone: +44 7700 912345.`;

  const fishingInfo=fishingQuestion(original,'en');
  const draft=buildReplyDraft({
    language:'en',original,arrival:'2026-11-12',departure:'2026-11-16',
    guests:8,children:3,childAges:[4,9,13],phone:'+44 7700 912345',
    cabin:'Deluxe',pier:true,hotTub:true,dog:true,intent:'booking_request',
    bookingRules:BUSINESS.bookingRules,operationalRules:BUSINESS.operationalRules,
    pricingRules:BUSINESS.pricingRules,knowledgeLines:fishingInfo?[fishingInfo.answer]:[]
  });

  assert.match(draft,/50% deposit/u);
  assert.match(draft,/within 10 days/u);
  assert.match(draft,/14 days before arrival/u);
  assert.match(draft,/Electricity is charged separately/u);
  assert.match(draft,/Firewood is available/u);
  assert.match(draft,/Parking is available/u);
  assert.match(draft,/18:30/u);
  assert.match(draft,/10:00/u);
  assert.match(draft,/20%/u);
  assert.match(draft,/730 days/u);
  assert.match(draft,/Pets are allowed for an additional charge/u);
  assert.match(draft,/Hot-tub availability and its charge are checked separately/u);
  assert.match(draft,/outside the period with the 10% high-season surcharge/u);
  assert.match(draft,/550 HUF per adult per night/u);
  assert.match(draft,/another suitable cabin type or a combination of units/u);
  assert.match(draft,/7,500 HUF/u);
  assert.match(draft,/3,750 HUF/u);
  assert.match(draft,/Barbed hooks are not allowed/u);
  assert.match(draft,/zander 30 cm/u);
  assert.match(draft,/Take-away fish prices per kg/u);
  assert.match(draft,/only confirm them after a verified check/u);
  assert.doesNotMatch(draft,/122[ .]?200|244[ .]?400/u);
});

test('explicit total guest count overrides conflicting component wording',()=>{
  assert.equal(guestCountFromText('There will be 8 guests in total: 5 adults and 2 children.'),8);
  assert.equal(guestCountFromText('Összesen 8 fő érkezik: 5 felnőtt és 2 gyermek.'),8);
  assert.equal(guestCountFromText('Wir sind 8 Personen: 5 Erwachsene und 2 Kinder.'),8);
  assert.equal(guestCountFromText('Skupaj 8 oseb: 5 odraslih in 2 otroka.'),8);
});

test('adult plus child pairs still infer total when no explicit total is present',()=>{
  assert.equal(guestCountFromText('5 felnőtt és 3 gyermek érkezne.'),8);
  assert.equal(guestCountFromText('5 adults and 3 children would stay.'),8);
  assert.equal(guestCountFromText('5 Erwachsene und 3 Kinder kommen.'),8);
  assert.equal(guestCountFromText('5 odraslih in 3 otroci bi prišli.'),8);
});

test('cross-month ranges keep both months in EN DE SI and year rollover',()=>{
  const now=new Date('2026-10-01T12:00:00Z');
  assert.deepEqual(dateRangeFromText('October 30 to November 2, 2026',now),{arrival:'2026-10-30',departure:'2026-11-02',inferredYear:false});
  assert.deepEqual(dateRangeFromText('30. Oktober bis 2. November 2026',now),{arrival:'2026-10-30',departure:'2026-11-02',inferredYear:false});
  assert.deepEqual(dateRangeFromText('od 30. oktobra do 2. novembra 2026',now),{arrival:'2026-10-30',departure:'2026-11-02',inferredYear:false});
  assert.deepEqual(dateRangeFromText('December 30 to January 2, 2027',now),{arrival:'2026-12-30',departure:'2027-01-02',inferredYear:false});
});

test('Slovenian family cabin wording maps to Családi',()=>{
  assert.equal(cabinFromText('Želeli bi družinsko hiško.'),'Családi');
  assert.equal(cabinFromText('Zanima nas družinska nastanitev.'),'Családi');
});


test('short guest emails keep the correct reply language',()=>{
  assert.equal(languageFromText('Hi, 2 adults, Deluxe, 2 nights. Price please?'),'en');
  assert.equal(languageFromText('Hallo, 2 Erwachsene, Deluxe, 2 Nächte. Preis bitte?'),'de');
  assert.equal(languageFromText('Pozdravljeni, 2 odrasla, Deluxe, 2 noči. Cena?'),'si');
  assert.equal(languageFromText('Szia, 2 felnőtt, Deluxe, 2 éjszaka. Mennyi az ára?'),'hu');
});


test('explicit total guest count beats earlier per-unit wording',()=>{
  assert.equal(guestCountFromText('We need two cabins for 4 people each, 8 guests in total.'),8);
  assert.equal(guestCountFromText('Két házban 4 fő lenne házanként, összesen 8 fő.'),8);
  assert.equal(guestCountFromText('Pro Haus 4 Personen, insgesamt 8 Personen.'),8);
  assert.equal(guestCountFromText('V vsaki hiški 4 osebe, skupaj 8 oseb.'),8);
});
