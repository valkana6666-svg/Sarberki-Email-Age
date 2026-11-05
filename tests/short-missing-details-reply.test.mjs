import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';

const now=new Date('2026-11-04T09:00:00Z');
const draft=(message,language)=>buildEmailInquiryDraft({message,now,...(language?{language}:{}),
 facts:{language:language||'hu'}}).text;
const isShort=text=>/^– /m.test(text)&&!/Foglalás állapota|Reservierungsstatus|Booking status|Status rezervacije/.test(text);

test('missing dates, nothing else: short direct request (HU)',()=>{
 const t=draft('Szia! Nyáron szeretnénk jönni 4 fővel. Mikor van szabad hely, és mennyibe kerül?\nPéter');
 assert.equal(isShort(t),true,t);
 assert.match(t,/^Kedves Péter!\n\nKöszönjük érdeklődését\. Hogy pontos ajánlatot és árat tudjunk küldeni, kérjük, írja meg:\n– a pontos érkezési és távozási dátumot,/);
 assert.match(t,/– egy telefonszámot, amelyen elérhetjük\.\n\nEzek alapján ellenőrizzük a szabad helyet, és küldjük az ajánlatot\.\n\nÜdvözlettel:\nSárberki Horgásztó$/);
 assert.doesNotMatch(t,/Szállás\n|Ár és díjak|elérhetőséget külön/);
});

test('short request in German, English and Slovene',()=>{
 const de=draft('Guten Tag, ist im Sommer etwas frei für 4 Personen? Was kostet es?\nMit freundlichen Grüßen, Anna Schmidt','de');
 assert.equal(isShort(de),true,de);assert.match(de,/teilen Sie uns bitte mit:\n– das genaue An- und Abreisedatum,/);
 const en=draft('Hello, is anything available in summer for 4 people? How much is it?\nKind regards, John Smith','en');
 assert.equal(isShort(en),true,en);assert.match(en,/please let us know:\n– your exact arrival and departure dates,/);
 const si=draft('Pozdravljeni, ali je poleti kaj prostega za 4 osebe? Koliko stane?\nLep pozdrav, Ana Novak','si');
 assert.equal(isShort(si),true,si);assert.match(si,/sporočite:\n– točen datum prihoda in odhoda,/);
});

test('full letter stays when the guest asked something else',()=>{
 for(const m of [
  'Szia! Nyáron jönnénk 4 fővel. Hánytól lehet érkezni?\nPéter'
 ]){const t=draft(m);assert.equal(isShort(t),false,m+'\n---\n'+t);assert.match(t,/14:00-tól/);}
});

test('dates known: one short paragraph plus what is still needed (DE family, HU large group, EN, SI)',()=>{
 const de=draft('Guten Tag, wir möchten vom 5. bis 9. August 2027 ein Haus für 2\nErwachsene und 1 Kind (7 Jahre) buchen. Ist etwas frei und was kostet\nes?\nMit freundlichen Grüßen, Familie Müller','de');
 assert.match(de,/^Guten Tag, Familie Müller!\n\nVielen Dank für Ihre Anfrage\. Sie möchten vom 05\.08\.2027 bis 09\.08\.2027 mit 3 Personen .* Für Sie kommen diese Häuser infrage: Deluxe, Familienhaus oder VIP\.\n\nBitte teilen Sie uns mit:\n– welchen Haustyp Sie wählen,\n– eine Telefonnummer, unter der wir Sie erreichen können\.\n\nDanach prüfen wir die Verfügbarkeit und senden Ihnen das Angebot mit Preis\./s);
 assert.doesNotMatch(de,/Reservierungsstatus|Unterkunft\n|nicht verifiziert/);
 const hu=draft('Jó napot! Egy 12 fős baráti társaság vagyunk, 2027. október 8. és 10.\nközött jönnénk. Hogyan tudnánk elférni, és mennyi lenne az ár?\nÜdv: Szabó Márk');
 assert.match(hu,/12 fő egy házban nem fér el, de több ház együttes foglalásával el tudjuk helyezni Önöket\.\n\nKérjük, írja meg:\n– megfelel-e a több házas elhelyezés,/);
 assert.doesNotMatch(hu,/Foglalás állapota|Szállás\n/);
 const si=draft('Pozdravljeni, od 5. do 9. avgusta 2027 bi prišli 2 odrasli osebi. Je kaj prostega?\nLep pozdrav, Ana Novak','si');
 assert.match(si,/Prosimo, sporočite nam:\n– kateri tip hiške želite: .*samostojna hiška za 2 osebi,/);
});

test('dates known but extra content: the full letter stays',()=>{
 const t=draft('Jó napot! 2027. május 14. és 16. között jönnénk 2 felnőttel. Hánytól lehet érkezni?\nÜdv: Kiss Anna');
 assert.match(t,/14:00-tól/);assert.match(t,/Foglalás állapota/);
});

test('short letters keep verified answers: fishing tickets, pet fee (server email path)',()=>{
 const fish=draft('Jó napot!\n2027. augusztus 12-től 15-ig jönnénk 5 felnőttel. Milyen horgászjegyek vannak és mennyibe kerülnek?\nKöszönöm: Varga Péter');
 assert.match(fish,/Horgászjegyek \(felnőtt \/ gyermek\):\n– Normál tó: 24 órás 7 500 \/ 3 750 Ft; heti 32 500 \/ 16 250 Ft\.\n– Rekord tó: 24 órás 11 250 \/ 5 650 Ft; heti 48 750 \/ 24 500 Ft\./);
 assert.match(fish,/Faházvendégeknek 12 órás jegy nem váltható/);
 assert.doesNotMatch(fish,/éves|félév|86 000|43 000/);
 assert.match(fish,/Kérjük, írja meg:/);assert.doesNotMatch(fish,/Foglalás állapota/);
 const pet=draft('Jó napot!\n2027. július 10. és 14. között jönnénk 2 felnőtt és 2 gyerek (6 és 9 évesek), egy kis kutyát is hoznánk.\nÜdvözlettel: Nagy Éva');
 assert.match(pet,/Háziállat hozható, díja 2 000 Ft\/nap\/állat\.\n\nKérjük, írja meg:/);
 const day=draft('Jó napot! Mennyi a napi horgászjegy a rekord tóra?\nPéter');
 assert.match(day,/– Rekord tó: 24 órás 11 250 \/ 5 650 Ft\./);assert.doesNotMatch(day,/Normál tó:|heti/);
});

test('owner-approved answers reach the daily-view letter and stay in the short form (pier, adjacent, deposit, cancellation)',()=>{
 const hu=draft('Jó napot!\n2027. augusztus 12-től 15-ig jönnénk 5 felnőttel, egymás melletti házakat szeretnénk. Van stég a házhoz? Mekkora az előleg, és mik a lemondási feltételek?\nKöszönöm: Varga Péter');
 assert.match(hu,/Minden faházhoz saját stég tartozik; az osztott apartmanoknál az emeleti C egységnek saját stégje van, az A és a B egység pedig egy stéget oszt meg\./);
 assert.match(hu,/A szomszédos elhelyezést külön ellenőrizzük\./);
 assert.match(hu,/Az előleg a szállásdíj 50%-a\./);
 assert.match(hu,/Az érkezés előtt legalább 14 nappal történő lemondásnál az előleg nem vész el\./);
 assert.match(hu,/Kérjük, írja meg:/);assert.doesNotMatch(hu,/Foglalás állapota|\b[1-9]\d?\. ház/);
 const de=draft('Guten Tag, wir kommen vom 12. bis 15. August 2027 mit 5 Erwachsenen. Gibt es einen Steg am Haus? Wie hoch ist die Anzahlung?\nMit freundlichen Grüßen, Anna Huber','de');
 assert.match(de,/Zu jedem Haus gehört ein eigener Steg/);assert.match(de,/Die Anzahlung beträgt 50% des Übernachtungspreises\./);
 const noPier=draft('Jó napot!\n2027. augusztus 12-től 15-ig jönnénk 5 felnőttel.\nÜdv: Kiss Anna');
 assert.doesNotMatch(noPier,/stég|szomszédos|előleg/);
});
