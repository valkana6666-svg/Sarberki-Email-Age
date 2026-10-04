import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
test('main analyzer recognizes multilingual explicit cabin vocabulary',()=>{for(const token of ['family','familien','split','geteilte','deljen']) assert.ok(source.toLowerCase().includes(token),token);});
test('main analyzer still blocks ambiguous cabin selection',()=>{assert.match(source,/uncertain_unit/u);assert.match(source,/létszámból nem választható/u);});

test('open multi-unit wording stays uncertain instead of becoming one unit',()=>{
 assert.match(source,/requestedUnitsFromText/u);
 assert.match(source,/több – pontosítandó/u);
 assert.match(source,/pontos darabszám nincs automatikusan feltételezve/u);
});

test('Teszt Elek UI regression guards normalized transfer behavior',()=>{
 assert.match(source,/canonicalCabin\(unit\?\.\[0\]\|\|''\)/u);
 assert.match(source,/child_ages:'Gyermekkorok'/u);
 assert.match(source,/hot_tub_requested:hot/u);
 assert.match(source,/pet_requested:secondary\.includes\('pet_question'\)/u);
 assert.match(source,/price_children/u);
 assert.match(source,/price_child_ages/u);
 assert.match(source,/v\.nights\|\|'\?'\} éjszaka/u);
});


test('guest-facing draft stays relevant and normalized',()=>{
 assert.match(source,/replace\(\/\[\.,;:\]\+\$\/u,''\)/u);
 assert.doesNotMatch(source,/intent==='booking_request'\)\)lines\.push\('','A foglaláshoz 50% előleg/u);
 assert.doesNotMatch(source,/intent==='booking_request'\)\)lines\.push\('','A foglalás érkezés előtt 14 nappal/u);
 assert.match(source,/if\(asks\.electricity\) lines\.push/u);
 assert.doesNotMatch(source,/egy konkrét háztípus, több egység említése nélkül/u);
 assert.match(source,/sarberki:analysis-ready/u);
});


test('guest reply contains useful booking summary and explicit pending checks',()=>{
 assert.match(source,/A kért háztípus:/u);
 assert.match(source,/A vendégek összetétele:/u);
 assert.match(source,/a teljes szállásárat/u);
 assert.match(source,/Pontos árat és elérhetőséget csak hiteles ellenőrzés után írunk meg/u);
 assert.match(source,/A dézsafürdő elérhetőségét is ellenőrizzük/u);
});


test('reply engine answers only actual guest questions while confirming core booking facts',()=>{
 assert.match(source,/const asks=\{/u);
 assert.match(source,/availability:/u);
 assert.match(source,/price:/u);
 assert.match(source,/pet:/u);
 assert.match(source,/hotTub:/u);
 assert.match(source,/amenities:/u);
 assert.match(source,/if\(asks\.pet\)/u);
 assert.match(source,/if\(asks\.hotTub\)/u);
 assert.match(source,/if\(asks\.amenities\)/u);
 assert.match(source,/A kért háztípus:/u);
 assert.match(source,/A vendégek összetétele:/u);
});


test('manual UI and Gmail bridge use the same shared Sarberki core',()=>{
 assert.match(source,/from '\./sarberki-core\.mjs(?:\?v=[^']+)?'/u);
 assert.match(source,/requestedUnitsFromText/u);
 const gmail=fs.readFileSync(new URL('./gmail-readonly.js',import.meta.url),'utf8');
 assert.ok(gmail.includes("import('./sarberki-core.mjs"));
 const alias=fs.readFileSync(new URL('./gmail-normalize.mjs',import.meta.url),'utf8');
 assert.ok(alias.includes("export * from './sarberki-core.mjs'"));
});


test('Gmail bridge remains strictly read-only and exposes no send action',()=>{
 const gmail=fs.readFileSync(new URL('./gmail-readonly.js',import.meta.url),'utf8');
 assert.match(gmail,/https:\/\/www\.googleapis\.com\/auth\/gmail\.readonly/u);
 assert.doesNotMatch(gmail,/https:\/\/www\.googleapis\.com\/auth\/gmail\.send/u);
 assert.doesNotMatch(gmail,/\/messages\/send\b/u);
 assert.doesNotMatch(gmail,/\/drafts\/send\b/u);
});


test('test UI does not overclaim Previo side-effect safety',()=>{
 assert.match(source,/biztonsági kapu feloldása után/u);
 assert.match(source,/átmeneti Previo hold\/zárolás hiánya még nincs igazolva/u);
 assert.doesNotMatch(source,/Előleget vagy foglalást nem hoz létre/u);
});


test('test deployment cache-busts the updated rule modules',()=>{\n assert.ok(source.includes('v0.3.18 TEST'));\n assert.match(source,/sarberki-core\\.mjs\\?v=\\d+/u);\n assert.match(source,/gmail-readonly\\.js\\?v=\\d+/u);\n assert.match(source,/availability-recommend\\.mjs\\?v=\\d+/u);\n});


test('availability integration regenerates the full reply instead of appending to a stale draft',()=>{
 const availability=fs.readFileSync(new URL('./availability-recommend.mjs',import.meta.url),'utf8');
 assert.match(availability,/const fresh=currentReplyBase\(\)/u);
 assert.match(availability,/knowledgeLines:fishing\?\[fishing\.answer\]:\[\]/u);
 assert.doesNotMatch(availability,/replaceCapacityPlaceholder\(draft\.value,sentence,manual\)/u);
});


test('availability block is inserted before the email signature',()=>{
 const availability=fs.readFileSync(new URL('./availability-recommend.mjs',import.meta.url),'utf8');
 assert.match(availability,/Üdvözlettel:/u);
 assert.match(availability,/return draft\.replace\(signature,'\\n\\n'\+combined\+signature\)/u);
});


test('Gmail draft mirrors the unified main reply and availability result',()=>{
 assert.match(source,/gmail_draft'\)\.value=\$\('draft'\)\.value/u);
 const availability=fs.readFileSync(new URL('./availability-recommend.mjs',import.meta.url),'utf8');
 assert.match(availability,/gmailDraft\.value=draft\.value/u);
});


test('analysis waits for the shared rules engine and availability can recover missed events',()=>{
 assert.match(source,/id="analyze" disabled/u);
 assert.match(source,/id="read_gmail" type="button" disabled/u);
 assert.match(source,/SarberkiRulesReady=true/u);
 assert.match(source,/sarberki:rules-ready/u);
 const availability=fs.readFileSync(new URL('./availability-recommend.mjs',import.meta.url),'utf8');
 assert.match(availability,/SarberkiAvailabilityReady=true/u);
 assert.match(availability,/if\(\$\('results'\).*setTimeout\(\(\)=>void enrich\(\),0\)/su);
});


test('availability insertion function is not corrupted',()=>{
 const availability=fs.readFileSync(new URL('./availability-recommend.mjs',import.meta.url),'utf8');
 assert.match(availability,/const signatures=\[/u);
 assert.match(availability,/return draft\.replace\(signature,'\\n\\n'\+combined\+signature\)/u);
 assert.doesNotMatch(availability,/combined\+'function replaceCapacityPlaceholder/u);
});
