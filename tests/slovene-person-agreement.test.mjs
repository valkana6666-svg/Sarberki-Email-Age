// Slovene guest text uses the dual/plural number forms: 1 oseba, 2 osebi, 3-4 osebe, 5+ oseb.
import test from 'node:test';
import assert from 'node:assert/strict';
import {replySummary} from '../sarberki-core.mjs';
const stay={arrival:'2027-08-01',departure:'2027-08-05'};
test('Slovene total person count agrees with the number',()=>{
 for(const [guests,form] of [[1,'1 oseba'],[2,'2 osebi'],[3,'3 osebe'],[4,'4 osebe'],[5,'5 oseb'],[8,'8 oseb'],[15,'15 oseb']])
  assert.match(replySummary('si',{...stay,guests}),new RegExp(`skupaj ${form}\\.`,'u'),String(guests));
});
test('one child reads "starost otroka", several "starost otrok"',()=>{
 assert.match(replySummary('si',{...stay,guests:3,adults:2,children:1,childAges:[6]}),/skupaj 3 osebe \(2 odrasli osebi in 1 otrok; starost otroka: 6 let\)/u);
 assert.match(replySummary('si',{...stay,guests:4,adults:2,children:2,childAges:[4,9]}),/skupaj 4 osebe \(2 odrasli osebi in 2 otroka; starost otrok: 4 in 9 let\)/u);
});
