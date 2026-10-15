import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const core=readFileSync(new URL('../sarberki-core.mjs',import.meta.url),'utf8');
test('shared reply builder does not request child status when adult count is known',()=>{
 assert.match(core,/const needChildStatus=!childStatusKnown && needAdults;/u);
 assert.match(core,/const needChildAge=childStatusKnown&&Number\(children\)>0&&childAges\.length<Number\(children\);/u);
});
