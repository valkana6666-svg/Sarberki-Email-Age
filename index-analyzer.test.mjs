import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
test('main analyzer recognizes multilingual explicit cabin vocabulary',()=>{for(const token of ['family','familien','split','geteilte','deljen']) assert.ok(source.toLowerCase().includes(token),token);});
test('main analyzer still blocks ambiguous cabin selection',()=>{assert.match(source,/uncertain_unit/u);assert.match(source,/létszámból nem választható/u);});

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
 assert.match(source,/from '\.\/sarberki-core\.mjs'/u);
 const gmail=fs.readFileSync(new URL('./gmail-readonly.js',import.meta.url),'utf8');
 assert.match(gmail,/import\('\.\/sarberki-core\.mjs'\)/u);
 const alias=fs.readFileSync(new URL('./gmail-normalize.mjs',import.meta.url),'utf8');
 assert.match(alias,/export \* from '\.\/sarberki-core\.mjs'/u);
});
