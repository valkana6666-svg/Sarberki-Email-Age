// Split houses 7-8-9-10 (owner 2026-11-12): same house / neighbouring houses / anywhere, from one read-only
// unit-level Previo read. Synthetic XML only; no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {planSplitPlacement,splitPlacementSentence,readSplitFreeUnits} from '../shared-core/server-previo-split-placement.mjs';
import {withSplitPlacement} from '../shared-core/server-capacity-draft.mjs';
import {buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';
import {splitRequestFromText} from '../split-units.mjs';

const ALL=['7','8','9','10'].flatMap(h=>[h+'/A',h+'/B',h+'/C']);
const freeExcept=(...taken)=>new Set(ALL.filter(id=>!taken.includes(id)));

test('same house A+B: first house with both halves free; none -> unavailable with a cross-house alternative',()=>{
 assert.deepEqual(planSplitPlacement(freeExcept('7/A'),{ab:2,mode:'same-house'}),{status:'available',units:['8/A','8/B'],sameHouse:true});
 const none=planSplitPlacement(freeExcept('7/A','8/B','9/A','10/B'),{ab:2,mode:'same-house'});
 assert.equal(none.status,'unavailable');assert.deepEqual(none.alternative.units,['7/B','8/A']);
 assert.deepEqual(planSplitPlacement(freeExcept(...ALL.filter(id=>!/A|B/.test(id)),'7/A','7/B','8/A','8/B','9/A','9/B','10/A'),{ab:2,mode:'same-house'}),{status:'unavailable',alternative:null});
});

test('neighbouring houses: one house first, else consecutive houses only (7-8-9-10); 7 and 9 are not neighbours',()=>{
 assert.deepEqual(planSplitPlacement(freeExcept('7/C','8/C'),{c:2,mode:'adjacent'}),{status:'available',units:['9/C','10/C'],sameHouse:false});
 const gap=planSplitPlacement(freeExcept('8/C','10/C'),{c:2,mode:'adjacent'});
 assert.equal(gap.status,'unavailable');assert.deepEqual(gap.alternative.units,['7/C','9/C'],'7 and 9 are free but not next to each other');
 assert.deepEqual(planSplitPlacement(freeExcept(),{ab:2,mode:'adjacent'}).sameHouse,true,'same house satisfies "egymás mellett"');
});

test('no proximity requested: any free units',()=>{
 assert.deepEqual(planSplitPlacement(freeExcept('7/A','8/B','9/A','10/B'),{ab:2,mode:'any'}),{status:'available',units:['7/B','8/A'],sameHouse:false});
});

test('guest sentence starts with the standard free line (price anchor) and never names a house; operator note does',()=>{
 const s=splitPlacementSentence({status:'available',units:['8/A','8/B'],sameHouse:true},'hu');
 assert.match(s.guest,/^A kért időszakra jelenleg van szabad helyünk ebben a háztípusban\./);
 assert.match(s.guest,/ugyanabban az osztott faházban/);assert.doesNotMatch(s.guest,/\b8\b/);
 assert.match(s.operator,/8\/A \+ 8\/B \(azonos ház\)/);
 assert.match(splitPlacementSentence({status:'unavailable',alternative:{units:['7/C','9/C']}},'de').guest,/keine freie Unterbringung nebeneinander/);
 assert.match(splitPlacementSentence({status:'unavailable',alternative:null},'en').guest,/not have enough free split units/);
});

test('unit read: active reservations hold their unit, storno (7) frees it; non-73521 or bad dates -> unknown',async()=>{
 const xml=`<reservations><reservation><resId>1</resId><statusId>2</statusId><term><from>2027-05-20</from><to>2027-05-22</to></term><object><objId>2392207</objId></object></reservation>`+
  `<reservation><resId>2</resId><statusId>7</statusId><term><from>2027-05-21</from><to>2027-05-23</to></term><object><objId>2392209</objId></object></reservation></reservations>`;
 let calls=0;const fetchImpl=async(url,o)=>{calls++;assert.match(o.body,/<hotId>73521<\/hotId>/);return new Response(xml);};
 const r=await readSplitFreeUnits({apiKey:'k'.repeat(20),arrival:'2027-05-21',departure:'2027-05-23',fetchImpl});
 assert.equal(calls,1);assert.equal(r.status,'read');assert.equal(r.free.has('7/A'),false);assert.equal(r.free.has('7/B'),true);assert.equal(r.free.size,11);
 assert.equal((await readSplitFreeUnits({apiKey:'k'.repeat(20),arrival:'2027-05-23',departure:'2027-05-21',fetchImpl})).status,'unknown');
 assert.equal((await readSplitFreeUnits({apiKey:'k'.repeat(20),arrival:'2027-05-21',departure:'2027-05-23',property:{hotelId:'753011'},fetchImpl})).status,'unknown');
});

test('draft: pending line replaced in the stay section; unknown read leaves the draft unchanged',async()=>{
 const message='Jó napot! 2027. május 21-től 23-ig jönnénk 4 felnőtt, két Osztott házat kérnénk (A és B) egymás mellett. Gyerek nincs.';
 const draft=buildEmailInquiryDraft({message,language:'hu',now:new Date('2026-11-12T00:00:00Z'),tenantId:'sarberki'});
 assert.match(draft.text,/A kapacitás ellenőrzése még nem igazolt\./);
 const out=await withSplitPlacement(draft,draft.decision,async()=>({status:'read',free:freeExcept('7/A')}));
 assert.doesNotMatch(out.text,/kapacitás ellenőrzése|szomszédos elhelyezést külön/);
 assert.match(out.text,/A kért háztípus: Osztott\.\nA kért időszakra jelenleg van szabad helyünk.*ugyanabban az osztott faházban/);
 assert.match(out.operatorReviewText,/8\/A \+ 8\/B/);assert.doesNotMatch(out.text,/8\/A/);
 assert.equal(await withSplitPlacement(draft,draft.decision,async()=>({status:'unknown'})),draft);
 assert.equal(await withSplitPlacement(draft,draft.decision,async()=>{throw Error('x');}),draft);
});

test('parsing: A+B alone = two units anywhere; with "egymás mellett" or "egy osztott faház" = same house',()=>{
 assert.equal(splitRequestFromText('Osztott A és B kérnénk').sameHouse,false);
 assert.equal(splitRequestFromText('két Osztott házat kérnénk (A és B) egymás mellett').sameHouse,true);
 assert.equal(splitRequestFromText('egy osztott faház A és B apartmanját kérnénk').sameHouse,true);
 const two=splitRequestFromText('két 2 fős osztott apartmant kérnénk egymás mellett');assert.equal(two.requestedAB,2);assert.equal(two.sameHouse,false);assert.equal(two.requiresAdjacent,true);
 assert.equal(splitRequestFromText('két Osztott C apartmant kérnénk egymás mellett').requestedC,2);
});

test('layout sentences (owner 2026-11-12): shared terrace for a same-house A+B pair; C upstairs only with a small child or older guest',async()=>{
 assert.match(splitPlacementSentence({status:'available',units:['8/A','8/B'],sameHouse:true},'hu').guest,/A két földszinti apartman közös terasszal rendelkezik\./);
 assert.doesNotMatch(splitPlacementSentence({status:'available',units:['9/C','10/C'],sameHouse:false},'hu').guest,/terasz/);
 const {evaluateCentralInquiry}=await import('../shared-core/central-inquiry-decision.mjs');
 const {renderCentralConversation}=await import('../shared-core/inquiry-channel-adapters.mjs');
 const r=(t,language='hu')=>renderCentralConversation(evaluateCentralInquiry({message:t,language,now:new Date('2026-11-12T00:00:00Z')}));
 assert.match(r('Osztott C házba jönnénk 2027. szeptember 3-tól 5-ig, 2 felnőtt és 2 gyerek (2 és 7 évesek).'),/A C apartman az emeleten van, csigalépcsőn/);
 assert.match(r('Osztott C házba jönnénk 2027. szeptember 3-tól 5-ig, 4 felnőtt, gyerek nincs, a nagymama is jön.'),/csigalépcsőn/);
 assert.match(r('Hello, we would like split apartment C from 3 to 5 September 2027, 4 adults, no children; our grandma is coming too.','en'),/spiral staircase/);
 assert.doesNotMatch(r('Osztott C házba jönnénk 2027. szeptember 3-tól 5-ig, 4 felnőtt, gyerek nincs.'),/csigalépcső/);
 assert.doesNotMatch(r('Osztott C házba jönnénk 2027. szeptember 3-tól 5-ig, 2 felnőtt és 2 gyerek (8 és 12 évesek).'),/csigalépcső/);
 assert.doesNotMatch(r('Deluxe házba jönnénk 2027. szeptember 3-tól 5-ig, 2 felnőtt és 1 gyerek (2 éves).'),/csigalépcső/);
});
