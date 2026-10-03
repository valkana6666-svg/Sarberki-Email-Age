import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./price-check.js',import.meta.url),'utf8');
test('pricing flow recognizes explicit cabin words in HU DE EN SI',()=>{assert.match(source,/családi\|family\|familien/u);assert.match(source,/osztott\|split\|geteilte/u);assert.match(source,/deljen/u);});
test('pricing flow keeps missing cabin blocked',()=>{assert.match(source,/found\.length===1 \? found\[0\] : ''/u);assert.match(source,/Faház: \? – emberi döntésre vár/u);});

test('pricing consumes normalized Gmail ISO dates and blocks inferred year auto quote',()=>{assert.match(source,/gmailNormalizedDate/u);assert.match(source,/item\.value\.split\(' – '\)/u);assert.match(source,/gmailDate\?\.arrival/u);assert.match(source,/gmailDate\?\.inferred/u);assert.match(source,/emberi jóváhagyás nélkül automatikus árlekérés nem indul/u);});

test('price checker transfers child counts and ages and requires exact ages for live quote',()=>{
 assert.match(source,/price_children/u);
 assert.match(source,/price_child_ages/u);
 assert.match(source,/fields\.adults\?\.value/u);
 assert.match(source,/fields\.child_ages\?\.value/u);
 assert.match(source,/children:ages/u);
 assert.match(source,/result\.children\)!==JSON\.stringify\(input\.children\)/u);
 const fn=source.slice(source.indexOf('  function childAgesForQuote('),source.indexOf("  $('check_price').onclick"));
 const context={};vm.createContext(context);vm.runInContext(fn+';globalThis.parse=childAgesForQuote;',context);
 assert.deepEqual(Array.from(context.parse(2,'7, 11')),[7,11]);
 for(const [count,ages] of [[2,'7'],[2,'7, 18'],[2,'7, nope'],[2,'7, 11, 12'],[1,''],[-1,'7']]) assert.equal(context.parse(count,ages),null);
 assert.deepEqual(Array.from(context.parse(0,'')),[]);
});

test('price checker auto-fills after manual analysis and loaded records',()=>{
 assert.match(source,/sarberki:analysis-ready/u);
 assert.match(source,/sarberki:record-loaded/u);
 assert.match(source,/prepare\(message\)/u);
});

test('price approval requires a separate human action before draft insertion',()=>{
 assert.match(source,/Ár jóváhagyása és beépítése a levélbe/u);
 assert.match(source,/approvePriceIntoDraft/u);
 assert.match(source,/approvedPrice=null/u);
 assert.match(source,/jóváhagyásra vár/u);
 assert.match(source,/Még nincs a vendégválaszban/u);
 assert.match(source,/E-mail nem lett elküldve/u);
});

test('approved price insertion follows explicit human approval and manual cabin choice',()=>{
 assert.match(source,/const selectedCabin=cabins\[\$\('price_cabin'\)\?\.value\|\|''\]\|\|''/u);
 assert.match(source,/if\(selectedCabin\) v\.unit=selectedCabin/u);
 assert.match(source,/const priceApproved=approvedPrice&&approvedPrice\.fingerprint===quoteFingerprint\(\)/u);
 assert.match(source,/a jóváhagyott adatok alapján/u);
 assert.doesNotMatch(source,/a vendég nem kérdezett árat, ezért nem került a válaszlevélbe/u);
});

test('approved online quote keeps accommodation and IFA breakdown',()=>{
 assert.match(source,/approvedPriceText/u);
 assert.match(source,/Ebből szállás:/u);
 assert.match(source,/IFA:/u);
 assert.match(source,/pendingQuote\?\.raw\?\.accommodation/u);
 assert.match(source,/pendingQuote\?\.raw\?\.tourismTax/u);
});

test('pet and hot-tub wording follows current guest-response rules',()=>{
 assert.match(source,/Háziállat térítés ellenében hozható; a pontos díjat ellenőrizzük\./u);
 assert.match(source,/A dézsa rendelkezésre állását is ellenőrizzük/u);
});

test('changing quote inputs invalidates previous price approval',()=>{
 assert.match(source,/price_arrival','price_departure','price_cabin','price_adults','price_children','price_child_ages/u);
 assert.match(source,/az árat újra ellenőrizni és jóváhagyni kell/u);
});

test('Teszt Elek reply retains known facts without inventing a price or pet fee',()=>{
 const replyCode=source.slice(source.indexOf('  function huAskedTopics('),source.indexOf('  function applyFocusedReply('));
 const fields={name:'Teszt Elek',arrival:'2026-10-16',departure:'2026-10-18',nights:'2',guests:'4',adults:'2',children:'2',child_ages:'7, 11',unit:'Deluxe',language:'HU'};
 const extract=()=>({fields:Object.fromEntries(Object.entries(fields).map(([k,value])=>[k,{value}])),intent:'booking_request',topics:{secondary_intents:[],requested_addons:['hot_tub']},warning_codes:[]});
 const context={extract,accommodationPlan:()=>({specific:true}),approvedPrice:null,quoteFingerprint:()=>'',Number,cabins:{deluxe:'Deluxe',family:'Családi',vip:'VIP',small:'Különálló 2 fős',splitA:'Osztott A',splitB:'Osztott B',splitC:'Osztott C'},$:(id)=>id==='price_cabin'?{value:'deluxe'}:null};
 vm.createContext(context);vm.runInContext(replyCode+';globalThis.makeReply=focusedReply;',context);
 const message='2026. október 16–18. között 2 felnőtt és 2 gyermek (7 és 11 éves) érkezne Deluxe házba, dézsával és kisebb kutyával. Telefonszámom: +36 30 555 1234. Van szabad hely, és mennyibe kerül?';
 const reply=context.makeReply(message);
 for(const known of ['2026-10-16','2026-10-18','2 éjszakára','4 fő','2 felnőtt','2 gyermek','7, 11','Deluxe','dézsa','kuty']) assert.match(reply,new RegExp(known,'iu'));
 assert.doesNotMatch(reply,/telefonszám|házszám|2 000 Ft|jóváhagyott teljes szállásár/iu);
 assert.match(reply,/aktuális teljes árról/u);
});


test('split cabin requires A B C choice before pricing',()=>{
 assert.match(source,/explicitSplitUnit/u);
 assert.match(source,/askedSplit&&!explicitSplitUnit\(message\)/u);
 assert.match(source,/Kérjük pontosítani: A, B vagy C egység/u);
});


test('split capacities are wired and explicit A B C units can reach pricing',()=>{
 assert.match(source,/splitA:'Osztott A'/u);
 assert.match(source,/splitB:'Osztott B'/u);
 assert.match(source,/splitC:'Osztott C'/u);
 assert.match(source,/splitA:2,splitB:2,splitC:5/u);
 assert.match(source,/splitUnit \? `split\$\{splitUnit\}`/u);
});


test('Slovenian family cabin wording reaches pricing',()=>{
  assert.match(source,/družinsk\\w\*\\s\+\(\?:hišk/u);
  assert.match(source,/koč\\w\*/u);
});


test('Gmail normalized facts override weaker UI extraction and contradiction review blocks auto quote',()=>{
 assert.match(source,/function gmailNormalizedRecord\(\)/u);
 assert.match(source,/const normalized=gmailRecord\?\.normalized\|\|\{\}/u);
 assert.match(source,/normalized\.dates\?\.arrival/u);
 assert.match(source,/normalized\.adults/u);
 assert.match(source,/normalized\.child_ages/u);
 assert.match(source,/gmailRecord\?\.human_review/u);
 assert.match(source,/gmailConflict/u);
});


test('multilingual approved price survives draft rewrite',()=>{
 assert.match(source,/function foreignFocusedReply/u);
 assert.match(source,/The .*selected for your stay/u);
 assert.match(source,/approved total price/u);
 assert.match(source,/Der von Ihnen ausgewählte Haustyp/u);
 assert.match(source,/Cena za izbrano nastanitev/u);
 assert.match(source,/if\(replyLanguage!=='HU'\) return foreignFocusedReply/u);
});
