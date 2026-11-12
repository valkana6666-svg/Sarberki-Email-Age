// Regressions from the 15-letter pitfall sweep (owner request 2026-11-11, fictional letters, real ingest path).
import test from 'node:test';
import assert from 'node:assert/strict';
import {dateRangeFromText,adultCountFromText,childCountFromText,childAgesFromText,requestFlagsFromText,replySummary} from '../sarberki-core.mjs';

test('numeric range "2027.08.01-08.04" keeps the departure month (was 08-08)',()=>{
 assert.deepEqual(dateRangeFromText('2027.08.01-08.04 között'),{arrival:'2027-08-01',departure:'2027-08-04',inferredYear:false});
 assert.deepEqual(dateRangeFromText('2027.08.01-04 között'),{arrival:'2027-08-01',departure:'2027-08-04',inferredYear:false});
 assert.deepEqual(dateRangeFromText('2027.12.30-2028.01.02'),{arrival:'2027-12-30',departure:'2028-01-02',inferredYear:false});
 assert.equal(dateRangeFromText('2027.12.30-01.02'),null,'year change without a stated year is not guessed');
});

test('"4 fő, ebből 2 gyerek" -> 2 adults; children counted, never negative',()=>{
 const t='4 fő, ebből 2 gyerek (3 és 5 évesek)';
 assert.equal(adultCountFromText(t),2);assert.equal(childCountFromText(t),2);assert.deepEqual(childAgesFromText(t),[3,5]);
 assert.equal(adultCountFromText('4 Personen, davon 2 Kinder'),2);
 assert.equal(adultCountFromText('2 fő, ebből 2 gyerek'),null);
 assert.equal(adultCountFromText('3 felnőtt, 4 fő, ebből 1 gyerek'),3,'an explicit adult count wins');
});

test('a baby is a child; stated age kept (months -> 0), unstated age stays unknown',()=>{
 assert.equal(childCountFromText('3 Erwachsene und ein Baby (1 Jahr)'),1);assert.deepEqual(childAgesFromText('3 Erwachsene und ein Baby (1 Jahr)'),[1]);
 const hu='2 felnőtt és 2 gyerek (4 és 9 évesek), meg egy kisbaba (8 hónapos)';
 assert.equal(childCountFromText(hu),3);assert.deepEqual(childAgesFromText(hu),[4,9,0]);
 assert.equal(childCountFromText('2 adults and a baby'),1);assert.deepEqual(childAgesFromText('2 adults and a baby'),[]);
 assert.equal(childCountFromText('Babakocsit hozunk, 2 felnőtt, gyerek nincs'),0,'pram is not a baby');
 assert.equal(childCountFromText('2 Erwachsene und 2 Kinder (4 und 10 Jahre)'),2);
});

test('pet request is read per clause: "gyerek nincs, a kutyánkat is hoznánk" asks for a pet',()=>{
 assert.equal(requestFlagsFromText('2 felnőtt, gyerek nincs, a kutyánkat is hoznánk').petRequested,true);
 assert.equal(requestFlagsFromText('kutyát nem hozunk').petRequested,false);
 assert.equal(requestFlagsFromText('Kutya nélkül jövünk, gyerek is jön').petRequested,false);
});

test('German summary: "im Alter von 1 Jahr" (singular)',()=>{
 const de=replySummary('de',{arrival:'2027-07-14',departure:'2027-07-17',guests:4,adults:3,children:1,childAges:[1]});
 assert.match(JSON.stringify(de),/im Alter von 1 Jahr[^e]/);
});

test('sweep 2: ambiguous US/EU slash date is not guessed; unambiguous ones parse; HU tól/ig with both years',()=>{
 assert.equal(dateRangeFromText('the VIP apartment 07/10/2027 - 07/12/2027 for 2 adults'),null);
 assert.deepEqual(dateRangeFromText('25/07/2027 - 28/07/2027'),{arrival:'2027-07-25',departure:'2027-07-28',inferredYear:false});
 assert.deepEqual(dateRangeFromText('10.07.2027 - 12.07.2027'),{arrival:'2027-07-10',departure:'2027-07-12',inferredYear:false});
 assert.deepEqual(dateRangeFromText('Szilveszterre jönnénk: 2027.12.30-tól 2028.01.02-ig'),{arrival:'2027-12-30',departure:'2028-01-02',inferredYear:false});
 assert.deepEqual(dateRangeFromText('2026.10.09-től 10.13.ig'),{arrival:'2026-10-09',departure:'2026-10-13',inferredYear:false});
});

test('sweep 2: "a toddler aged 2" is a child aged 2',()=>{
 const t='We are two couples (4 adults) plus a toddler aged 2, looking for a family cabin';
 assert.equal(childCountFromText(t),1);assert.deepEqual(childAgesFromText(t),[2]);assert.equal(adultCountFromText(t),4);
});

test('sweep 3: party too large for the requested type -> "nem fér el" + fitting types, never the internal pending line',async()=>{
 const {evaluateCentralInquiry}=await import('../shared-core/central-inquiry-decision.mjs');
 const {renderCentralConversation}=await import('../shared-core/inquiry-channel-adapters.mjs');
 const now=new Date('2026-11-12T00:00:00Z');
 const d=t=>evaluateCentralInquiry({message:t,language:'hu',now});
 const six=d('6 felnőtt lennénk, egy Osztott C házat szeretnénk 2027. június 18-tól 20-ig. Gyerek nincs.');
 assert.equal(six.capacity.incompatible,true);
 assert.match(renderCentralConversation(six),/^A kért háztípusba 6 fő nem fér el\. Ennyi főnek ezek a házak felelnek meg: Deluxe, Családi vagy VIP\./);
 const small=d('A különálló 2 fős faházat szeretnénk 2027. június 14-től 16-ig, 3 felnőtt, gyerek nincs.');
 assert.doesNotMatch(renderCentralConversation(small),/kapacitás ellenőrzése még nem igazolt/);
 assert.match(renderCentralConversation(small),/3 fő nem fér el/);
 assert.match(renderCentralConversation(d('Deluxe faházat 2027. június 14-től 16-ig, 9 felnőtt, gyerek nincs.')),/9 fő több ház együttes foglalásával helyezhető el/);
 const five=d('Osztott C házba jönnénk 5 felnőttel 2027. szeptember 3-tól 5-ig, gyerek nincs.');
 assert.notEqual(five.capacity.incompatible,true,'5 fits a split C house');
 assert.match(renderCentralConversation(five),/ötödik fő pótágyon alszik/);
 assert.doesNotMatch(renderCentralConversation(d('Deluxe faházat 2027. június 14-től 16-ig, 2 felnőtt, gyerek nincs.')),/nem fér el|pótágy/);
});

test('sweep 4: past arrival said plainly; an advertisement is flagged for the operator, guest questions are not',async()=>{
 const {buildEmailInquiryDraft,looksLikeNonInquiry}=await import('../shared-core/inquiry-channel-adapters.mjs');
 const now=new Date('2026-11-12T09:00:00Z');
 const past=buildEmailInquiryDraft({message:'Jó napot! Deluxe faházat szeretnénk 2025. június 10-től 12-ig, 2 felnőtt, gyerek nincs.',now});
 assert.match(past.text,/A megadott érkezési időpont már elmúlt\. Kérjük, írja meg, melyik időpontra szeretne érkezni\./);
 assert.doesNotMatch(past.text,/pontosítása vagy emberi ellenőrzése/);
 const ad=buildEmailInquiryDraft({message:'Tisztelt Cégvezető! Weboldal-fejlesztési és SEO szolgáltatásunkat ajánljuk, első hónapban 50% kedvezménnyel.',now});
 assert.equal(ad.nonInquiry,true);assert.match(ad.operatorReviewText,/^FIGYELEM: a levél nem szállásérdeklődésnek tűnik/);
 for(const t of ['Van kedvezmény törzsvendégeknek? Tavaly is voltunk.','Gibt es Rabatt für Stammgäste?','Mennyibe kerül a horgászjegy?','Jó napot! Jövő nyáron jönnénk a családdal.'])assert.equal(looksLikeNonInquiry(t),false,t);
});
