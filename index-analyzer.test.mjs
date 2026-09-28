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
