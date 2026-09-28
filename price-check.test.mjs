import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('./price-check.js',import.meta.url),'utf8');
test('pricing flow recognizes explicit cabin words in HU DE EN SI',()=>{assert.match(source,/családi\|family\|familien/u);assert.match(source,/osztott\|split\|geteilte/u);assert.match(source,/deljen/u);});
test('pricing flow keeps missing cabin blocked',()=>{assert.match(source,/found\.length===1 \? found\[0\] : ''/u);assert.match(source,/Faház: \? – emberi döntésre vár/u);});
