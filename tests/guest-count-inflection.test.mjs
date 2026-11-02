// Inflected party sizes are the same party size as the bare form; a cabin size is not a party size.
import test from 'node:test';
import assert from 'node:assert/strict';
import {guestCountFromText} from '../sarberki-core.mjs';
import {buildEmailInquiryDraft} from '../shared-core/inquiry-channel-adapters.mjs';
const now=new Date('2026-11-02T12:00:00Z');
test('inflected Hungarian and Slovene party sizes are recognised',()=>{
 for(const [text,expected] of [['Van szabad 6 főre C házatok?',6],['2 főre VIP ház',2],['4 főnek',4],['2 személyre',2],['15 fős baráti társaság vagyunk',15],['6 fős család',6],['10 fős csapat',10],['za 4 osebe bi želeli hiško',4],['2 osebi',2],['3 fő',3]])
  assert.equal(guestCountFromText(text),expected,text);
});
test('a cabin size or an unknown child count is not turned into a party size',()=>{
 assert.equal(guestCountFromText('4 fős faházat szeretnénk'),null);
 assert.equal(guestCountFromText('2 felnőtt, 4 fős házat kérünk'),null);
});
test('the inflected form yields the same capacity decision as the bare form (1–15 guests)',()=>{
 for(const n of [1,2,3,4,5,6,8,15])for(const form of [n+' főre',n+' főnek',n+' fős baráti társaság']){
  const bare=buildEmailInquiryDraft({message:`Van szabad faház ${n} fő 2027.07.01-03 között?`,language:'hu',now});
  const inflected=buildEmailInquiryDraft({message:`Van szabad faház ${form} 2027.07.01-03 között?`,language:'hu',now});
  assert.equal(inflected.decision.facts.guests,n);
  assert.deepEqual(inflected.decision.capacity,bare.decision.capacity);
  assert.equal(inflected.decision.capacity.verified,false);
 }
});
