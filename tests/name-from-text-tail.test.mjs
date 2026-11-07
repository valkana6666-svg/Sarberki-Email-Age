import test from 'node:test';
import assert from 'node:assert/strict';
import {nameFromText} from '../sarberki-core.mjs';
// Owner live tests 2026-11-06: the signature at the end of the letter on the same line.
test('signature at the end of the letter on the same line is recognised; greetings are not names',()=>{
 for(const [t,n] of [['Jó napot! 2027. június 10-től 13-ig jönnénk ketten, Deluxe faházba. Kiss Anna”','Kiss Anna'],
  ['2 felnőtt menne gyerek nélkül. Telefonszám +36 30 000 0000 Üdv: Kis Anna','Kis Anna'],['Szia! Mennyi? Üdv, Kiss Anna','Kiss Anna'],
  ['Guten Tag, wir kommen. Viele Grüße Hans Müller','Hans Müller'],['Jó napot!\nJönnénk.\nÜdv:\nKis Anna','Kis Anna']])assert.equal(nameFromText(t),n);
 for(const t of ['Jövünk a Balaton Partra.','Szia! Mennyi az ár? Köszönöm.','Megyünk. Szép Napot','Danke. Schönen Tag','Thanks. Good Day','Hvala. Lep Dan','Jó napot! Jövünk ketten. Üdvözlettel'])assert.equal(nameFromText(t),null,t);
});
