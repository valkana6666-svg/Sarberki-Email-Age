import test from 'node:test';
import assert from 'node:assert/strict';
import {nameFromText,stayCancellationFromText,buildReplyDraft} from '../sarberki-core.mjs';

test('signed names: Köszönöm/Üdv sign-offs, single given names, family names',()=>{
 assert.equal(nameFromText('Kérem, erősítsék meg a\nlemondást.\nKöszönöm: Tóth Gábor'),'Tóth Gábor');
 assert.equal(nameFromText('Mennyibe kerül egy hét?\nPéter'),'Péter');
 assert.equal(nameFromText('Jó napot!\nÜdv: Péter'),'Péter');
 assert.equal(nameFromText('Mennyi az ár?\nÜdv: Szabó Márk'),'Szabó Márk');
 assert.equal(nameFromText('Was kostet es?\nVielen Dank, Anna Schmidt'),'Anna Schmidt');
 assert.equal(nameFromText('Is it free?\nThanks, John'),'John');
});

test('no false names: greetings, thanks and one-line letters stay unnamed',()=>{
 for(const t of ['Mennyibe kerül?\nKöszönöm','Van szabad hely?\nSzia','Is it free?\nThanks','Mennyibe kerül?\nÜdvözlettel','Péter','Van hely?\nköszi','Hvala\nLp'])
  assert.equal(nameFromText(t),null,JSON.stringify(t));
});

test('a soft-wrapped cancellation is still a cancellation; wrapped conditions and questions are not',()=>{
 assert.equal(stayCancellationFromText('Jó napot! Sajnos le kell mondanunk a 2027. június 3–6. közötti\nfoglalásunkat, mert közbejött valami.'),true);
 assert.equal(stayCancellationFromText('We have to cancel our\nbooking for June.'),true);
 assert.equal(stayCancellationFromText('Ha le kell mondanunk a\nfoglalást, mennyi az előleg?'),false);
 assert.equal(stayCancellationFromText('Milyen lemondási\nfeltételek vannak a foglalásra?'),false);
 assert.equal(stayCancellationFromText('Nem mondjuk le a\nfoglalást.'),false);
 // A blank line still separates paragraphs.
 assert.equal(stayCancellationFromText('Le kell mondanunk\n\na foglalást'),false);
});

test('availability line: "requested cabin" only when a cabin was named',()=>{
 const none=buildReplyDraft({language:'hu',original:'Mikor van szabad hely 4 főre?'});
 assert.match(none,/Az elérhetőséget külön ellenőrizzük és visszaigazoljuk\./);
 assert.doesNotMatch(none,/A kért faház/);
 const named=buildReplyDraft({language:'hu',original:'Van szabad hely a Deluxe házban?',cabin:'Deluxe'});
 assert.doesNotMatch(named,/Az elérhetőséget külön ellenőrizzük/);
 const de=buildReplyDraft({language:'de',original:'Ist etwas frei?'});
 assert.match(de,/Die Verfügbarkeit prüfen und bestätigen wir gesondert\./);
});
