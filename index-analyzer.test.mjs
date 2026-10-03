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
 assert.match(source,/from '\.\/sarberki-core\.mjs'/u);
 assert.match(source,/requestedUnitsFromText/u);
 const gmail=fs.readFileSync(new URL('./gmail-readonly.js',import.meta.url),'utf8');
 assert.match(gmail,/import\('\.\/sarberki-core\.mjs'\)/u);
 const alias=fs.readFileSync(new URL('./gmail-normalize.mjs',import.meta.url),'utf8');
 assert.match(alias,/export \* from '\.\/sarberki-core\.mjs'/u);
});


test('test header logo uses the committed crowned fish SVG asset and has a visible fallback',()=>{
 assert.match(source,/class="brand-logo"[^>]+src="\.\/sarberki-logo-crownfish-orange\.svg\?v=20261003-1010"/u);
 assert.match(source,/alt="Sárberki Horgásztó · Lenti logó"/u);
 assert.match(source,/brand-logo-fallback/u);
 assert.match(source,/logo-failed/u);
 const logo=fs.readFileSync(new URL('./sarberki-logo-crownfish-orange.svg',import.meta.url),'utf8');
 assert.match(logo,/^<svg\b/u);
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


test('test deployment cache-busts the updated rule modules',()=>{
 assert.match(source,/v0\.3\.12 TEST/u);
 assert.match(source,/sarberki-core\.mjs\?v=20261003-1525/u);
 assert.match(source,/gmail-readonly\.js\?v=20261003-1525/u);
 assert.match(source,/availability-recommend\.mjs\?v=20261003-1525/u);
});
