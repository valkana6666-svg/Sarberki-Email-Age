import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createPersistentRuntime} from '../shared-core/isolated-persistent-runtime.mjs';
const config={enabled:true,operatorOrigin:'https://operator.isolated.example.invalid',expectedOperatorOrigin:'https://operator.isolated.example.invalid',databaseHost:'isolated-postgres',databaseName:'sc_approval_test',syntheticOnly:true,emailSendingEnabled:false,pushoverSendingEnabled:false,realBookingsEnabled:false,attestationKey:'ab'.repeat(32)};
const anon='e30.'+Buffer.from(JSON.stringify({role:'anon'})).toString('base64url')+'.test';
const runtime={allowedOperatorEmails:['approval-operator@synthetic.invalid'],trustedProxyAddresses:['127.0.0.1']};
const identity={database:'sc_approval_test',syntheticOnly:true,approvalInstalled:true,attestationFingerprint:createHash('sha256').update(config.attestationKey).digest('hex')};
test('runtime refuses wrong DB, nonsynthetic state, absent approval or mismatched signing key',async()=>{
 for(const proof of [{...identity,database:'postgres'},{...identity,syntheticOnly:false},{...identity,approvalInstalled:false},{...identity,attestationFingerprint:'bad'}]){
  await assert.rejects(createPersistentRuntime({config,runtime,anonymousKey:anon,fetchImpl:async()=>({ok:true,json:async()=>proof})}),/ISOLATED_RUNTIME_NOT_READY/);
 }
});
test('runtime uses only fixed isolated identity endpoint and returns handler after proof',async()=>{
 const seen=[];const h=await createPersistentRuntime({config,runtime,anonymousKey:anon,fetchImpl:async(u,o)=>{seen.push([u,o]);return {ok:true,json:async()=>identity};}});
 assert.equal(typeof h,'function');assert.equal(seen.length,1);assert.equal(seen[0][0],'http://isolated-rest:3000/rpc/sc_isolated_identity');assert.equal(seen[0][1].redirect,'error');
});
test('runtime rejects privileged credentials and unexpected DB hosts before networking',async()=>{
 let count=0;const fetchImpl=async()=>{count++;throw Error();};
 for(const c of [{...config,databaseHost:'isolated-other'},config])await assert.rejects(createPersistentRuntime({config:c,runtime,anonymousKey:'e30.'+Buffer.from('{"role":"service_role"}').toString('base64url')+'.test',fetchImpl}),/ISOLATED_RUNTIME_NOT_READY/);
 assert.equal(count,0);
});
