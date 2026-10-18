import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Static UI contract: stored approvals remain read-only, while arbitrary
// synthetic inquiry text can be entered on the existing manual tester.
const approval=readFileSync(new URL('../cloud-approval.html',import.meta.url),'utf8');
const operator=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('readonly approval screen links to the existing manual inquiry tester',()=>{
  assert.match(approval,/href="\.\/index\.html"/u);
  assert.match(approval,/Saját tesztüzenetet írnál vagy illesztenél be\?/u);
  assert.match(approval,/nem ment automatikusan felhős ügyet/u);
});

test('manual inquiry editor stays writable without changing cloud approval access',()=>{
  assert.match(operator,/<textarea id="message"\s+placeholder="Másold ide a vendég érdeklődését"><\/textarea>/u);
  assert.match(operator,/\$\('analyze'\)\.onclick\s*=\s*\(\)\s*=>/u);
  assert.match(approval,/<textarea id="isolated_approval_text"[^>]*readonly><\/textarea>/u);
  assert.match(approval,/<textarea id="isolated_approval_hu"[^>]*readonly><\/textarea>/u);
});
