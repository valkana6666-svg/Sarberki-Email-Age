import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReplyDraft} from '../sarberki-core.mjs';

const base={original:'Szeretnénk szállást kérni.',arrival:'2026-11-13',departure:'2026-11-15',guests:4,adults:4,children:0,phone:'+36301234567'};
for(const [language,selection,status] of [
 ['hu',/melyik felajánlott faháztípust választja/u,/még nem visszaigazolt foglalás/u],
 ['de',/welchen der angebotenen Haustypen/u,/noch keine bestätigte Buchung/u],
 ['en',/which of the offered cabin types/u,/not a confirmed booking/u],
 ['si',/katero od ponujenih vrst hišk/u,/še ni potrjena rezervacija/u]
]){
 test(`unselected cabin asks for guest decision and states booking status: ${language}`,()=>{
  const draft=buildReplyDraft({...base,language,cabin:'? – emberi döntésre vár'});
  assert.match(draft,selection);
  assert.match(draft,status);
 });
 test(`selected cabin does not ask for cabin choice again: ${language}`,()=>{
  const draft=buildReplyDraft({...base,language,cabin:'Deluxe'});
  assert.doesNotMatch(draft,selection);
  assert.match(draft,status);
 });
}
test('missing phone is requested alongside cabin choice',()=>{
 const draft=buildReplyDraft({...base,phone:null,language:'hu',cabin:'? – emberi döntésre vár'});
 assert.match(draft,/telefonszámot/u);
 assert.match(draft,/melyik felajánlott faháztípust/u);
});
