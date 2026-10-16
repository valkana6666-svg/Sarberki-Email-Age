import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
test('backup v2 requires protected decisions while explicit legacy v1 archive validation remains available',()=>{
 const script=`import importlib.util
spec=importlib.util.spec_from_file_location('backup','scripts/owner-encrypted-backup.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
def toc(tables):
 return '\\n'.join([kind+' public '+name+' owner' for name in tables for kind in ('TABLE','TABLE DATA')]+['TABLE DATA auth users owner','TABLE DATA auth identities owner'])
old=toc(b.LEGACY_REQUIRED)
b.validate_toc(old,schema_version=1)
try:
 b.validate_toc(old)
 raise AssertionError('new export accepted missing decisions')
except RuntimeError:
 pass
b.validate_toc(toc(b.REQUIRED))
print('PASS')
`;
 assert.equal(execFileSync('python',['-c',script],{encoding:'utf8'}).trim(),'PASS');
});
