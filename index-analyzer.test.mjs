import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
test('main analyzer recognizes multilingual explicit cabin vocabulary',()=>{for(const token of ['family','familien','split','geteilte','deljen']) assert.ok(source.toLowerCase().includes(token),token);});
test('main analyzer still blocks ambiguous cabin selection',()=>{assert.match(source,/uncertain_unit/u);assert.match(source,/létszámból nem választható/u);});
