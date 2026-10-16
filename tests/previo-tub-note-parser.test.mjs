import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePrevioTubNote as parse} from '../shared-core/previo-tub-note-parser.mjs';
test('house 8 guest can request house 12 fixed tub',()=>{const r=parse('12-es ház dézsa 2026-10-24 18:00 24 órára',{accommodationHouse:8});assert.equal(r.status,'CANDIDATE');assert.equal(r.tubHouse,12);assert.equal(r.accommodationHouse,8);assert.equal(r.availabilityVerified,false);});
test('house 8 has no physical tub',()=>assert.equal(parse('8-as ház dézsa 2026-10-24 18:00 24 órára').status,'UNKNOWN'));
test('guest house is not inferred as tub house',()=>assert.equal(parse('Dézsa 2026-10-24 18:00 24 órára',{accommodationHouse:12}).status,'UNKNOWN'));
test('missing, ambiguous and cancelled note fail closed',()=>{for(const s of ['12-es ház dézsa 2026-10-24 18:00 24 órára, 2026-10-25','12-es ház dézsa 2026-10-24 18:00 és 19:00 24 órára','12-es ház dézsa 2026-10-24 18:00','12-es ház dézsa lemondva 2026-10-24 18:00 24 órára','12-es ház dézsa 2026-02-30 18:00 24 órára'])assert.equal(parse(s).status,'UNKNOWN',s);});
test('candidate is never confirmed availability',()=>assert.equal(parse('11-es ház dézsa 2026-10-24 18:00 24 órára').availabilityVerified,false));
