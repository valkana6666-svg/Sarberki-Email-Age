import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePrevioTubNote} from '../shared-core/previo-tub-note-parser.mjs';
const parse=duration=>parsePrevioTubNote('12-es ház dézsa 2026-11-14 18:00 '+duration);
for(const [expression,hours] of [['1 óra',1],['3h',3],['24 órára',24],['72 órás',72]])test('whole positive duration: '+expression,()=>{
 const result=parse(expression);assert.equal(result.status,'CANDIDATE');assert.equal(result.durationHours,hours);assert.equal(result.availabilityVerified,false);
});
for(const expression of ['1.5 óra','1,5 óra','-24 óra','+24 óra','−24 óra','–24 óra','—24 óra','±24 óra','1-3 óra','1 – 3 óra','1/2 óra','1:30 óra','0 óra','73 óra','1000 óra','1024 óra','1 024 óra','1 2 óra','1 + 2 óra','.5 óra',',5 óra','--24 óra','24 óra és 3h'])test('ambiguous or invalid duration remains unknown: '+expression,()=>{
 const result=parse(expression);assert.equal(result.status,'UNKNOWN');assert.equal(result.availabilityVerified,false);assert.equal('durationHours' in result,false);
});
