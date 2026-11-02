// "kids" and the German singular "Kind" are children; their stated ages are read, "no kids" is zero.
import test from 'node:test';
import assert from 'node:assert/strict';
import {guestCountFromText,adultCountFromText,childCountFromText,childAgesFromText} from '../sarberki-core.mjs';
import {buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';
const party=t=>({g:guestCountFromText(t),a:adultCountFromText(t),c:childCountFromText(t),ages:childAgesFromText(t)});
test('kids / Kind are recognised with ages',()=>{
 assert.deepEqual(party('family of 4 (2 adults + 2 kids aged 5 and 8)'),{g:4,a:2,c:2,ages:[5,8]});
 assert.deepEqual(party('2 adults and 1 kid aged 6'),{g:3,a:2,c:1,ages:[6]});
 assert.deepEqual(party('wir sind zu dritt (2 Erwachsene, 1 Kind 7 Jahre)'),{g:3,a:2,c:1,ages:[7]});
 assert.equal(childCountFromText('2 adults, no kids'),0);
});
test('the reply does not ask again for children already given as kids',()=>{
 const r=buildEmailInquiryDraft({message:'Hello, family of 4 (2 adults + 2 kids aged 5 and 8) looking for a family cabin 2027-07-20 to 2027-07-27.',language:'en',now:new Date('2026-11-02T12:00:00Z')});
 assert.doesNotMatch(r.text,/Will any children be staying/u);
 assert.match(r.text,/2 adults and 2 children/u);
});
