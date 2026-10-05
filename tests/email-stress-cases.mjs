// Independent expected facts; no network, Gmail writes or PMS calls.
export const NOW=new Date('2026-10-05T15:40:00Z');
const dates={arrival:'2026-10-16',departure:'2026-10-18',nights:2};
const unknown='? – emberi döntésre vár';
export const cases=[];
function add(id,text,expected,reply={},group=id){cases.push({id,text,expected,reply,group});}
const languages={
 hu:'2026. október 16–18. között 2 felnőtt és 2 gyermek, 7 és 11 évesek. Deluxe ház. Telefon: +36 30 555 1234.',
 de:'Guten Tag, vom 16. bis 18. Oktober 2026, 2 Erwachsene und 2 Kinder im Alter von 7 und 11 Jahren. Deluxe Haus. Telefon: +36 30 555 1234.',
 en:'We would like a Deluxe cabin from October 16–18 2026 for 2 adults and 2 children aged 7 and 11. Phone: +36 30 555 1234.',
 si:'Pozdravljeni, od 16. do 18. oktobra 2026, 2 odrasla in 2 otroka, stara 7 in 11 let. Deluxe hiška. Telefon: +36 30 555 1234.'
};
for(const [lang,text] of Object.entries(languages)){
 for(const [variant,transform] of Object.entries({plain:s=>s,lines:s=>s.replaceAll('. ','.\n'),upper:s=>s.toUpperCase(),space:s=>s.replaceAll(' ','  '),long:s=>`${s}\n${'Köszönjük. Thank you. Danke. Hvala. '.repeat(8)}`})){
  add(`${lang}-${variant}`,transform(text),{...dates,guests:4,adults:2,children:2,childAges:[7,11],cabin:'Deluxe',phone:'+36 30 555 1234'},{},'multilingual');
 }
 for(const subject of ['', 'x', 'Számla 2020.01.02. 99 fő', 'Re: Előző levelezés']) add(`${lang}-subject-${subject.length}`,text,{...dates,guests:4,adults:2,children:2,childAges:[7,11],cabin:'Deluxe',phone:'+36 30 555 1234'},{subject},'subject');
}
for(const [i,t] of ['faház','dézsás faház','bungalow','superluxus faház','Deluxe vagy családi, mindegy'].entries()) add(`cabin-${i}`,`2026. október 16-18. 6 fő. ${t}.`,{...dates,cabin:unknown,adults:null,children:null},{contains:/háztípus|accommodation|Unterkunft/,absent:/6 felnőtt/},'ambiguous-cabin');
add('accentless','2026 oktober 16tol 18ig 2 felnott es 2 gyerek, 7 es 11 evesek. csaladi haz. Telefon: +36 30 555 1234.',{...dates,guests:4,adults:2,children:2,childAges:[7,11],cabin:'Családi',phone:'+36 30 555 1234'},{},'multilingual');
add('word-conflict','2026. október 16-18. Deluxe. 2 felnőtt és 2 gyerek, de összesen hárman mennénk.',{...dates,guests:3,adults:2,children:2},{contains:/pontosít|clarif/,absent:/1 felnőtt/},'guest-conflict');
add('digit-conflict','2026. október 16-18. Deluxe. Összesen 3 fő: 2 felnőtt és 2 gyermek, 7 és 11 évesek.',{...dates,guests:3,adults:2,children:2},{contains:/pontosít/,absent:/1 felnőtt/},'guest-conflict');
add('unknown-children','2026. október 16-18. Deluxe. 6 fő.',{...dates,children:null,adults:null,childAges:[]},{contains:/érkezik-e gyermek|gyermekek száma/,absent:/6 felnőtt/},'unknown-children');
add('missing-ages','2026. október 16-18. Deluxe. 6 fő, ebből 3 gyerek.',{...dates,children:3,childAges:[]},{contains:/életkor/},'missing-ages');
add('single-age','2026. október 16-18. Deluxe. 2 felnőtt és 1 gyermek, 7 éves.',{...dates,guests:3,adults:2,children:1,childAges:[7]},{contains:/7 éves/,absent:/7 évesek/},'single-age-grammar');
add('separate-ages','2026. október 16-18. Deluxe. 2 felnőtt és 2 gyerek, az egyik 7 éves, a másik 11 éves.',{...dates,childAges:[7,11]},{},'separate-ages');
add('age-phone','We would like Deluxe October 16-18 2026, 2 adults and 1 child aged 7, phone +36 30 555 1234.',{...dates,childAges:[7],phone:'+36 30 555 1234'},{},'age-contamination');
add('adult-age','2026. október 16-18. Deluxe. 2 felnőtt. Én 42 éves vagyok.',{...dates,childAges:[],children:null},{},'adult-age');
add('date-phone','2026.10.16-2026.10.18. Deluxe. 4 fő.',{...dates,phone:null},{contains:/telefonszám/},'date-phone');
add('booking-phone','Foglalási szám: 2026101618. Deluxe, október 16-18. 4 fő.',{...dates,phone:null},{},'booking-phone');
add('signature-phone','2026.10.16-2026.10.18. Deluxe, 4 fő.\nÜdvözlettel,\nTeszt Elek\n+36 30 555 1234',{...dates,phone:'+36 30 555 1234'},{},'date-phone');
for(const text of ['2026-02-30 – 2026-03-02','2026-10-18 – 2026-10-16','2026-10-16 – 2026-10-16','2026. április 31-32.']) add(`invalid-${cases.length}`,`${text}. Deluxe, 4 fő.`,{arrival:null,departure:null,nights:null},{contains:/pontos.*dátum|érkezési/},'invalid-date');
add('two-ranges','2026. október 16-18. vagy 2026. november 20-22. Deluxe, 4 fő.',{arrival:null,departure:null,nights:null},{contains:/pontos/},'multiple-dates');
add('three-dates','Érkezés 2026-10-16 vagy 2026-10-17, távozás 2026-10-18. Deluxe, 4 fő.',{arrival:null,departure:null,nights:null},{},'multiple-dates');
add('next-year-de','Nächstes Jahr vom 16. bis 18. Oktober, 4 Personen. Deluxe.',{arrival:'2027-10-16',departure:'2027-10-18',nights:2},{},'next-year');
add('next-year-si','Naslednje leto od 16. do 18. oktobra, 4 oseb. Deluxe.',{arrival:'2027-10-16',departure:'2027-10-18',nights:2},{},'next-year');
add('next-year-natural','Jövőre október 16 és 18 között. Deluxe, 4 fő.',{arrival:'2027-10-16',departure:'2027-10-18',nights:2},{},'next-year');
for(const text of ['jövő hétvégén','október végén','next weekend','Ende Oktober','naslednji vikend']) add(`relative-${cases.length}`,`${text}. Deluxe, 4 fő.`,{arrival:null,departure:null,nights:null},{},'relative-date');
add('old-yearless','augusztus 10-12. Deluxe, 4 fő.',{arrival:'2027-08-10',departure:'2027-08-12',nights:2},{},'yearless');
const current='2026. október 16-18. Családi. 2 felnőtt és 1 gyerek, 7 éves. Telefon: +36 30 555 1234.';
for(const quoted of ['\nOn Monday, Guest wrote:\n2025. november 10-12. VIP. 8 fő. Telefon: +36 20 111 2222.', '\n-----Original Message-----\n2025. november 10-12. VIP. 8 fő.', '\n> 2025. november 10-12. VIP. 8 fő.']) add(`quote-${cases.length}`,current+quoted,{...dates,cabin:'Családi',guests:3,children:1,childAges:[7],phone:'+36 30 555 1234'},{},'quoted-history');
add('dog-retracted','2026. október 16-18. Deluxe, 4 fő. Kutyát hoznánk, de mégsem hozunk kutyát.',{...dates,petRequested:false},{absent:/Kutyát is hoznának/},'negated-addons');
add('dog-no-en','October 16-18 2026. Deluxe, 4 guests. We will not bring a dog.',{...dates,petRequested:false},{absent:/bring a dog/},'negated-addons');
add('tub-no','2026. október 16-18. Deluxe, 4 fő. Dézsát nem kérünk.',{...dates,hotTubRequested:false},{absent:/Dézsát is szeretnének/},'negated-addons');
add('multi-house','2026. október 16-18. 12 fő. Két Deluxe házat szeretnénk.',{...dates,unitsRequested:2,cabin:'Deluxe'},{},'multiple-units');
add('open-house','2026. október 16-18. 16 fő. Több ház is megfelelő.',{...dates,unitsRequested:null,cabin:unknown},{},'multiple-units');
add('no-child','2026. október 16-18. Deluxe, 2 felnőtt, gyermek nélkül.',{...dates,children:0},{absent:/érkezik-e gyermek/},'no-children');
add('late-arrival','2026. október 16-18. Deluxe, 4 fő. 22:15-kor érkeznénk.',{...dates},{absent:/18:30-as érkezés/},'arrival-time');
add('policy','2026. október 16-18. Deluxe, 4 fő. Mik a foglalási feltételek?',{...dates},{contains:/50%[\s\S]*10 napon belül[\s\S]*előleg beérkezése.*végleges[\s\S]*14 nap/},'confirmation-policy');
add('known-cabin','2026. október 16-18. Családi. 2 felnőtt és 1 gyerek, 7 éves.',{...dates,cabin:'Családi'},{contains:/Családi/},'cabin-in-reply');
add('special','2026. október 16-18. Deluxe. 4 fő.\nKülön kérés: egymás melletti házak',{...dates,specialRequests:['egymás melletti házak']},{},'special-request');
// Variations retain independent expectations, including shuffled sentence order.
const seeds=[...cases].filter(c=>!c.id.includes('subject'));
for(const c of seeds) add(`${c.id}-newline`,c.text.replaceAll('. ','.\n'),c.expected,c.reply,c.group);
// Reproducible shuffled multi-topic letters with every requested field checked.
const topics={
 hu:['2026. október 16-18. között','2 felnőtt és 2 gyermek, 7 és 11 évesek','Két Deluxe házat szeretnénk','Dézsát szeretnénk','Kutyát hoznánk','Horgásznánk, mik a szabályok?','Parkolás 2 autóval megoldható?','Telefon: +36 30 555 1234','Külön kérés: egymás melletti házak'],
 en:['We would like to stay October 16-18 2026','2 adults and 2 children aged 7 and 11','Two Deluxe cabins please','We would like a hot tub','We will bring a dog','We would like to fish; what are the fishing rules?','Is parking available for 2 cars?','Phone: +36 30 555 1234','Special request: adjacent cabins'],
 de:['Vom 16. bis 18. Oktober 2026 möchten wir buchen','2 Erwachsene und 2 Kinder im Alter von 7 und 11 Jahren','Zwei Deluxe Häuser bitte','Wir möchten ein Badefass','Wir bringen einen Hund mit','Wir möchten angeln; welche Regeln gelten?','Gibt es Parkplätze für 2 Autos?','Telefon: +36 30 555 1234','Besonderer Wunsch: benachbarte Häuser'],
 si:['Želimo bivati od 16. do 18. oktobra 2026','2 odrasla in 2 otroka, stara 7 in 11 let','Dve Deluxe hiški prosim','Želimo masažno kad','S seboj pripeljemo psa','Želeli bi ribolov; kakšna so pravila?','Je parkiranje na parkirišču za 2 vozili mogoče?','Telefon: +36 30 555 1234','Posebna želja: sosednji hiški']
};
for(const [lang,sentences] of Object.entries(topics))for(let variant=0;variant<24;variant++){
 const shuffled=[...sentences];let seed=variant+17;
 for(let i=shuffled.length-1;i>0;i--){seed=(seed*1664525+1013904223)>>>0;const j=seed%(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 const separator=variant%2?'.\n':'. ';
 const text=shuffled.join(separator)+'.';
 add(`mixed-${lang}-${variant}`,text,{...dates,guests:4,adults:2,children:2,childAges:[7,11],cabin:'Deluxe',unitsRequested:2,hotTubRequested:true,petRequested:true,fishingQuestion:true,parking:true,phone:'+36 30 555 1234',specialRequests:[sentences.at(-1).split(': ')[1]]},{},'multi-topic-order');
}
add('arrival-time-changed','2026. október 16-18. Deluxe, 4 fő. Érkezés 22:15-kor.',{...dates},{contains:/22:15/,absent:/18:30/},'arrival-time');
add('age-adult-child','2026. október 16-18. Deluxe. 2 felnőtt és 1 gyerek. Én 42 éves vagyok, a gyermek 7 éves.',{...dates,childAges:[7]},{absent:/42 éves/},'adult-age');
add('fishing-accentless','2026 oktober 16-18. Deluxe, 4 fo. Horgasznank, mik a horgaszati szabalyok? Parkolas van?',{...dates,fishingQuestion:true,parking:true},{contains:/állami horgászjegy[\s\S]*szakáll nélküli[\s\S]*6-os[\s\S]*pontybölcső[\s\S]*merítőháló[\s\S]*sebfertőtlenítő[\s\S]*pontyzsák/},'fishing-accentless');


// Public language-guide patterns, paraphrased into Sárberki-specific realistic inquiries.
add('realistic-hu-email',`Jó napot kívánok!

Érdeklődni szeretnék, hogy 2026. október 16. és 18. között lenne-e szabad Deluxe házuk.
2 felnőtt és 2 gyermek mennénk, a gyerekek 7 és 11 évesek.
Megírnák, kérem, hogy mennyi lenne a teljes ár?

Köszönöm előre is.
Üdvözlettel,
Nagy Péter`,{...dates,guests:4,adults:2,children:2,childAges:[7,11],cabin:'Deluxe'},{contains:/Köszönjük érdeklődését/u},'realistic-public-style');

add('realistic-de-email',`Guten Tag,

hätten Sie vom 16. bis 18. Oktober 2026 noch eine Deluxe-Unterkunft für 2 Erwachsene und 2 Kinder im Alter von 7 und 11 Jahren frei?
Könnten Sie uns bitte auch den Gesamtpreis mitteilen?

Vielen Dank im Voraus.
Mit freundlichen Grüßen
Thomas Berger`,{...dates,guests:4,adults:2,children:2,childAges:[7,11],cabin:'Deluxe'},{contains:/Vielen Dank für Ihre Anfrage/u},'realistic-public-style');

add('realistic-en-email',`Hello,

We are looking for a Deluxe cabin from 16 October to 18 October, 2026 for 2 adults and 2 children aged 7 and 11.
Could you please let us know whether it is available and what the total price would be?

Many thanks,
John Smith`,{...dates,guests:4,adults:2,children:2,childAges:[7,11],cabin:'Deluxe'},{contains:/16 October 2026[\\s\\S]*18 October 2026/u},'realistic-public-style');

add('realistic-si-email',`Pozdravljeni!

Zanima me nastanitev od 16. do 18. oktobra 2026 za 2 odrasla in 2 otroka, stara 7 in 11 let.
Ali je Deluxe hiška prosta in kakšna bi bila skupna cena?

Hvala in lep pozdrav
Janez Novak`,{...dates,guests:4,adults:2,children:2,childAges:[7,11],cabin:'Deluxe'},{contains:/2 odrasli osebi[\\s\\S]*2 otroka/u},'realistic-public-style');
