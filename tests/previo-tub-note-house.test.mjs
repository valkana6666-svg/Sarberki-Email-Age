import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePrevioTubNote} from '../shared-core/previo-tub-note-parser.mjs';
const parse=house=>parsePrevioTubNote(house+' 2026-11-14 18:00 24 órára');
for(const n of [1,2,3,4,5,6,11,12,13,14,15])for(const text of [`${n}-es ház dézsa`,`dézsa a ${n}-es ház`])test('fixed physical house: '+text,()=>{
 const r=parse(text);assert.equal(r.status,'CANDIDATE');assert.equal(r.tubHouse,n);assert.equal(r.durationHours,24);assert.equal(r.availabilityVerified,false);
});
for(const n of [7,8,9,10])test('house without fixed tub remains unknown: '+n,()=>assert.equal(parse(`${n}-es ház dézsa`).status,'UNKNOWN'));
for(const token of ['112','-12','+12','−12','12.5','12,5','A12','12A','1/12','1-12','11-12','11/12','1 - 12','1 12','012','0'])for(const text of [`${token}-es ház dézsa`,`dézsa a ${token}-es ház`])test('malformed whole house token remains unknown: '+text,()=>{
 const r=parse(text);assert.equal(r.status,'UNKNOWN');assert.equal(r.availabilityVerified,false);assert.equal('tubHouse' in r,false);
});
for(const text of ['112-es ház dézsa és 12-es ház dézsa','112-es ház dézsa; 12-es ház dézsa','dézsa a A12-es ház; dézsa a 12-es ház','12.5-ös ház dézsa; 11-es ház dézsa','-12-es ház dézsa; dézsa a 11-es ház'])test('malformed and valid house is not silently resolved: '+text,()=>assert.equal(parse(text).status,'UNKNOWN'));

test('long malformed numeric house cannot become a suffix house',()=>assert.equal(parse('1'.repeat(1000)+'12-es ház dézsa').status,'UNKNOWN'));
for(const house of ['12-es ház dézsa','dézsa a 12-es ház'])for(const text of [`2026-11-14 18:00 ${house} 24 órára`,`24 órára ${house} 2026-11-14 18:00`])test('date/time/duration placement does not become house token: '+text,()=>{
 const r=parsePrevioTubNote(text);assert.equal(r.status,'CANDIDATE');assert.equal(r.tubHouse,12);assert.equal(r.startLocal,'2026-11-14T18:00');assert.equal(r.durationHours,24);
});

for(const text of ['11:12-es ház dézsa; 12-es ház dézsa','2026-11-14-es ház dézsa; 12-es ház dézsa'])test('date/time-shaped invalid house cannot be masked beside valid house: '+text,()=>assert.equal(parse(text).status,'UNKNOWN'));

for(const intent of ['lemondás','lemondani','törlés','törölni','nem kérjük','nem kérem','nem kell','mégsem kérjük','visszamondás'])test('cancellation or negative tub intent requires human review: '+intent,()=>{
 const r=parse('12-es ház dézsa '+intent);
 assert.equal(r.status,'UNKNOWN');
 assert.equal(r.reason,'CANCELLATION_OR_CHANGE_REQUIRES_REVIEW');
 assert.equal(r.availabilityVerified,false);
 assert.equal('tubHouse' in r,false);
});
for(const note of ['12-es ház dézsa','dézsa a 12-es ház'])test('positive tub note remains only candidate: '+note,()=>{
 const r=parse(note);
 assert.equal(r.status,'CANDIDATE');
 assert.equal(r.tubHouse,12);
 assert.equal(r.availabilityVerified,false);
});
