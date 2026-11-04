import test from 'node:test';
import assert from 'node:assert/strict';
import {createBookingCaseStore} from '../booking-cases.mjs';
import {extractServerMessage} from '../shared-core/server-message-extraction.mjs';
import {serverInquiryOptions} from '../shared-core/server-inquiry-options.mjs';
import {buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';
import {languageFromText} from '../sarberki-core.mjs';

// The owner's fictional test mails of 2026-11-03 (sarberkito@gmail.com -> test mailbox), on the same
// server path as sc_tm_create ingestion: extraction -> case store -> shared decision -> e-mail draft.
function draft(n,text){
 const caseId='tm-quality'+n;let saved;
 const store=createBookingCaseStore({storage:{getItem:()=>'[]',setItem:(_,v)=>{saved=JSON.parse(v);}},tenantId:'sarberki-test',clock:()=>'2026-11-03T20:00:00.000Z',id:()=>caseId});
 const env={sender:'guest@example.test',text,mailbox_id:'m',message_id:'q'+n,thread_id:'q'+n,rfc_message_id:'<q'+n+'@example.test>',references:[],received_at:'2026-11-03T20:00:00.000Z'};
 store.ingest({...env,message_id:'m:q'+n,thread_id:'m:q'+n},extractServerMessage(env),{approvedCaseId:null});
 const data=saved.find(c=>c.id===caseId);data.sender=env.sender;
 return buildEmailInquiryDraft(serverInquiryOptions({tenantId:'sarberki-test',caseId,data},new Date('2026-11-03T20:00:00Z')));
}

test('Hungarian cancellation without listed keywords is answered in Hungarian, not German',()=>{
 const text='Jó napot! Sajnos le kell mondanunk a 2027. június 3–6. közötti foglalásunkat, mert közbejött valami. Kérem, erősítsék meg a lemondást.\nKöszönöm: Tóth Gábor';
 assert.equal(languageFromText(text),'hu');
 const plan=draft(6,text);
 assert.match(plan.text,/lemondási kérelmét/u);assert.doesNotMatch(plan.text,/Guten Tag|Stornierung/u);
 // German stays German, and ö/ü alone still counts as German when nothing Hungarian is present.
 assert.equal(languageFromText('Guten Tag, wir möchten ein Haus für 2 Erwachsene buchen.'),'de');
 assert.equal(languageFromText('Grüße aus München, schöne Häuser'),'de');
});

test('five adults asking for one cabin: whole houses only to the guest, split only as operator note',()=>{
 const plan=draft(5,'Hello, we are 5 adults and would like to stay from 20 to 23 September 2027. Do you have a cabin for all of us? What would the price be?\nBest regards, John Smith');
 assert.match(plan.text,/Deluxe, Family cabin, VIP\./u);
 assert.doesNotMatch(plan.text,/A\+C|B\+C|split|Kezelői/iu);
 assert.match(plan.operatorReviewText,/Kezelői megjegyzés \(a vendég nem látja\).*A\+C vagy B\+C.*csak igazolt foglalhatatlanság után/u);
 // Up to four guests: no split note.
 assert.doesNotMatch(draft(1,'Jó napot! 2027. május 14-től 16-ig szeretnénk egy faházat 2 felnőtt részére.').operatorReviewText,/Kezelői megjegyzés/u);
});

test('a 12-person group is told one house is not enough and asked to accept several, never asked to pick an offered type',()=>{
 const plan=draft(7,'Jó napot! Egy 12 fős baráti társaság vagyunk, 2027. október 8. és 10. között jönnénk. Hogyan tudnánk elférni, és mennyi lenne az ár?\nÜdv: Szabó Márk');
 assert.match(plan.text,/12 fő egy házban nem fér el; több ház együttes foglalásával/u);
 assert.doesNotMatch(plan.text,/jöhetnek szóba: több ház|melyik felajánlott faháztípust/u);
});

test('a family signature keeps the full family name in the greeting',()=>{
 const de=draft(4,'Guten Tag, wir möchten vom 5. bis 9. August 2027 ein Haus für 2 Erwachsene und 1 Kind (7 Jahre) buchen. Ist etwas frei und was kostet es?\nMit freundlichen Grüßen, Familie Müller');
 assert.match(de.text,/^Guten Tag, Familie Müller!/u);
 const hu=draft(2,'Jó napot! 2027. július 10. és 14. között jönnénk 2 felnőtt és 2 gyerek (6 és 9 évesek), és hoznánk egy kis kutyát is.\nÜdvözlettel: Nagy család');
 assert.match(hu.text,/^Kedves Nagy család!/u);
 assert.match(draft(1,'Jó napot! 2027. május 14-től 16-ig szeretnénk egy faházat 2 felnőtt részére.\nKöszönettel: Kiss Anna').text,/^Kedves Anna!/u);
});

test('the Hungarian operator copy of a foreign letter greets with the given name, not the family name',()=>{
 const en=draft(5,'Hello, we are 5 adults and would like to stay from 20 to 23 September 2027. Do you have a cabin for all of us?\nBest regards, John Smith');
 assert.match(en.text,/^Dear John,/u);assert.match(en.operatorReviewText,/^Kedves John!/u);
 const hu=draft(1,'Jó napot! 2027. május 14-től 16-ig szeretnénk egy faházat 2 felnőtt részére.\nKöszönettel: Kiss Anna');
 assert.match(hu.operatorReviewText,/^Kedves Anna!/u,'Hungarian order unchanged for a Hungarian guest');
});
