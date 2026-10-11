import test from 'node:test';
import assert from 'node:assert/strict';
import {runPreflight} from '../scripts/isolated-persistent-preflight.mjs';

test('preflight requires explicit config and does not attempt reads without it', async () => {
 let reads=0, output;
 assert.equal(await runPreflight([], {read:async()=>{reads++;},write:x=>output=JSON.parse(x)}),2);
 assert.equal(reads,0); assert.equal(output.activated,false);
});
test('invalid secret-bearing JSON does not leak input or filesystem errors', async () => {
 const secret='not-a-real-secret-but-sensitive'; let output;
 assert.equal(await runPreflight(['--config','private.json'], {read:async()=>'{'+secret,write:x=>output=x}),2);
 assert.equal(output.includes(secret),false);
 assert.equal(JSON.parse(output).status,'BLOCKED');
});
test('missing isolation configuration is blocked and does not activate runtime', async () => {
 let output;
 assert.equal(await runPreflight(['--config','private.json'],{read:async()=> '{}',write:x=>output=JSON.parse(x)}),1);
 assert.equal(output.status,'BLOCKED'); assert.equal(output.activated,false);
});
test('valid preflight reports preparation only and does not disclose the signing key', async () => {
 const config={enabled:true,operatorOrigin:'https://operator.isolated.example.invalid',
  expectedOperatorOrigin:'https://operator.isolated.example.invalid',databaseHost:'isolated-approval-db',
  databaseName:'sc_approval_test',syntheticOnly:true,emailSendingEnabled:false,
  pushoverSendingEnabled:false,realBookingsEnabled:false,attestationKey:'ab'.repeat(32)};
 let output;
 assert.equal(await runPreflight(['--config','private.json'],{read:async()=>JSON.stringify(config),write:x=>output=x}),0);
 assert.equal(output.includes(config.attestationKey),false);
 const result=JSON.parse(output);
 assert.equal(result.status,'CONFIG_VALID'); assert.equal(result.activated,false);
 assert.equal(result.deploymentVerified,false); assert.equal(result.persistenceVerified,false);
});
