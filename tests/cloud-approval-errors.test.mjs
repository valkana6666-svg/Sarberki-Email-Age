import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCloudApprovalFailure} from '../shared-core/cloud-approval-errors.mjs';
test('diagnostic separates failed list from failed review without asserting missing Writer rights',()=>{
 assert.equal(formatCloudApprovalFailure(Error('AUTH_REQUIRED'),'review-draft'),'Teszttervezet mentése nem igazolt. Hibakód: AUTH_REQUIRED.');
 assert.equal(formatCloudApprovalFailure(Error('SERVICE_UNAVAILABLE'),'list'),'Ügylista lekérése nem igazolt. Hibakód: SERVICE_UNAVAILABLE.');
 assert.equal(formatCloudApprovalFailure(Error('FORBIDDEN'),'approval-state'),'Jóváhagyás és audit visszaolvasása nem igazolt. Hibakód: FORBIDDEN.');
});
test('untrusted exceptions and stages cannot leak credentials or provider data',()=>{
 const secret='Bearer SYNTHETIC_SECRET_PASSWORD guest@synthetic.invalid';
 const error=Error(secret);error.stack=secret;error.details=secret;
 const rendered=formatCloudApprovalFailure(error,secret);
 assert.equal(rendered,'Ellenőrzés nem igazolt. Hibakód: ELLENORZES_SZUKSEGES.');
 assert.ok(!rendered.includes(secret));
 assert.equal(formatCloudApprovalFailure(error,'constructor'),rendered);
});
test('missing or malformed failures still render a fixed safe code',()=>{
 assert.equal(formatCloudApprovalFailure(null,'case-id'),'Ügyazonosító ellenőrzése nem igazolt. Hibakód: ELLENORZES_SZUKSEGES.');
 assert.match(formatCloudApprovalFailure({message:{token:'synthetic'}},'login'),/ELLENORZES_SZUKSEGES/);
});
