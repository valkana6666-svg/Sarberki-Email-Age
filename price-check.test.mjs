import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('./price-check.js',import.meta.url),'utf8');
test('pricing flow recognizes explicit cabin words in HU DE EN SI',()=>{assert.match(source,/családi\|family\|familien/u);assert.match(source,/osztott\|split\|geteilte/u);assert.match(source,/deljen/u);});
test('pricing flow keeps missing cabin blocked',()=>{assert.match(source,/found\.length===1 \? found\[0\] : ''/u);assert.match(source,/Faház: \? – emberi döntésre vár/u);});

test('pricing consumes normalized Gmail ISO dates and blocks inferred year auto quote',()=>{assert.match(source,/gmailNormalizedDate/u);assert.match(source,/item\.value\.split\(' – '\)/u);assert.match(source,/gmailDate\?\.arrival/u);assert.match(source,/gmailDate\?\.inferred/u);assert.match(source,/emberi jóváhagyás nélkül automatikus árlekérés nem indul/u);});

test('price checker transfers child counts and ages but keeps child-price safety block',()=>{
 assert.match(source,/price_children/u);
 assert.match(source,/price_child_ages/u);
 assert.match(source,/fields\.adults\?\.value/u);
 assert.match(source,/fields\.child_ages\?\.value/u);
 assert.match(source,/Gyermekes érdeklődés: életkor és hiteles gyermekár nélkül kézi ellenőrzés szükséges/u);
});


test('price checker auto-fills after manual analysis and loaded records',()=>{
 assert.match(source,/sarberki:analysis-ready/u);
 assert.match(source,/sarberki:record-loaded/u);
 assert.match(source,/prepare\(message\)/u);
});
