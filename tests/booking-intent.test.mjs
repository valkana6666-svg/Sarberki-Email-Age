import test from 'node:test';
import assert from 'node:assert/strict';
import {bookingAcceptanceFromText,bookingIntentHint} from '../shared-core/booking-intent.mjs';

test('explicit acceptance in HU/DE/EN/SI is recognised',()=>{
 for(const t of ['Rendben, akkor foglaljuk le a Deluxe házat.','Kérjük a foglalást a megadott időpontra.','Szeretnénk lefoglalni a házat június 10–13.','Lefoglalnánk a Deluxe-ot, köszönjük!','Elfogadjuk az ajánlatot.','Mehet a foglalás!',
  'Wir möchten das Ferienhaus verbindlich buchen.','Bitte für uns reservieren.','Wir nehmen das Angebot gerne an.','Buchen wir!',
  "We'd like to book the Deluxe cabin.",'Please book it for us.',"We'll take it.",
  'Rezervirali bi hiško.','Prosimo, rezervirajte za nas.'])
  assert.equal(bookingAcceptanceFromText(t).accepted,true,t);
});

test('questions, interest without acceptance and negations are not acceptance',()=>{
 for(const t of ['Mennyibe kerül a Deluxe ház?','Van szabad hely júniusban?','Még nem foglalnánk le, előbb megbeszéljük.','Wir möchten noch nicht buchen.','We would not like to book yet.',
  'Köszönjük az ajánlatot, átgondoljuk.','Gibt es noch freie Häuser im Juni?'])
  assert.equal(bookingAcceptanceFromText(t).accepted,false,t);
});

test('quoted history (our own offer) is ignored; hint only for a reply on an open booking',()=>{
 const reply='Köszönjük, átgondoljuk.\n\nAm Mo. schrieb Sárberki:\n> Bitte buchen Sie bis Freitag.';
 assert.equal(bookingAcceptanceFromText(reply).accepted,false);
 const msgs=[{text:'Jó napot! Szeretnénk foglalni júniusra.'},{text:'Rendben, foglaljuk le!'}];
 assert.equal(bookingIntentHint([msgs[0]],null),null,'first inquiry is never acceptance');
 assert.match(bookingIntentHint(msgs,null),/foglaljuk le/);
 assert.equal(bookingIntentHint(msgs,'finalized'),null);
});

test('owner 2026-11-13: "Igen, foglaljuk" is an acceptance; a plain thanks or a negated yes is not',()=>{
 for(const t of ['Igen, foglaljuk.','Igen foglaljuk','Igen, akkor foglaljuk!'])assert.equal(bookingAcceptanceFromText(t).accepted,true,t);
 for(const t of ['Igen, köszönjük az ajánlatot','Igen, de még nem foglaljuk','Köszönjük, még gondolkodunk'])assert.equal(bookingAcceptanceFromText(t).accepted,false,t);
});
