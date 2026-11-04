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
  'Szia! Nyáron jönnénk 4 fővel, kutyát is hoznánk. Van szabad hely?\nPéter'
 ]){const t=draft(m);assert.equal(isShort(t),false,m+'\n---\n'+t);}
 assert.match(draft('Szia! Nyáron jönnénk 4 fővel, kutyát is hoznánk. Van szabad hely?\nPéter'),/Háziállat hozható/);
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
 const t=draft('Jó napot! 2027. május 14. és 16. között jönnénk 2 felnőttel, kutyát is hoznánk. Van szabad hely?\nÜdv: Kiss Anna');
 assert.match(t,/Háziállat hozható/);assert.match(t,/Foglalás állapota/);
});
