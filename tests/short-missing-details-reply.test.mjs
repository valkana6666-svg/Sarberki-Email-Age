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

test('full letter stays when dates are known or the guest asked something else',()=>{
 for(const m of [
  'Jó napot! 2027. május 14. és 16. között jönnénk 2 felnőttel. Van szabad hely?\nÜdv: Kiss Anna',
  'Szia! Nyáron jönnénk 4 fővel, kutyát is hoznánk. Van szabad hely?\nPéter'
 ]){const t=draft(m);assert.equal(isShort(t),false,m+'\n---\n'+t);}
 assert.match(draft('Szia! Nyáron jönnénk 4 fővel, kutyát is hoznánk. Van szabad hely?\nPéter'),/Háziállat hozható/);
});
