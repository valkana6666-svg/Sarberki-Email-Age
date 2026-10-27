import test from 'node:test';
import assert from 'node:assert/strict';
import {createOfflineExactGmailReceiptVerifier} from '../shared-core/gmail-send-exact-receipt-offline.mjs';
const id='13c8ecb7-f836-4e2c-9833-d58ee96f2dda';
const record={tenantId:'sarberki-test',caseId:id,data:{tenantId:'sarberki-test',id}};
test('missing private receipt is always rejected',async()=>{
 assert.equal(await createOfflineExactGmailReceiptVerifier(null)(record),false);
});
test('existing matcher accepts exact trusted record only',async()=>{
 const receipt={caseId:id,matchesRecord:r=>r===record};
 const verify=createOfflineExactGmailReceiptVerifier(receipt);
 assert.equal(await verify(record),true);
 assert.equal(await verify({...record}),false);
});
test('wrong tenant, case or browser-supplied fake proof rejected',async()=>{
 const receipt={caseId:id,matchesRecord:()=>true};
 const verify=createOfflineExactGmailReceiptVerifier(receipt);
 assert.equal(await verify({...record,data:{...record.data,tenantId:'foreign'}}),false);
 assert.equal(await verify({...record,data:{...record.data,id:'other'}}),false);
 assert.equal(await createOfflineExactGmailReceiptVerifier({caseId:'other',matchesRecord:()=>true})(record),false);
});
test('a failing receipt matcher denies without throwing',async()=>{
 const verify=createOfflineExactGmailReceiptVerifier({caseId:id,matchesRecord:()=>{throw Error('error')}});
 assert.equal(await verify(record),false);
});
