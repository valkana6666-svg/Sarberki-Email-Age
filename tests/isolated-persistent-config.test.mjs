import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIsolatedPersistentConfig} from '../shared-core/isolated-persistent-config.mjs';
const configured=()=>({enabled:true,operatorOrigin:'https://operator.isolated.example.invalid',
 expectedOperatorOrigin:'https://operator.isolated.example.invalid',databaseHost:'isolated-approval-db',
 databaseName:'sc_approval_test',syntheticOnly:true,emailSendingEnabled:false,
 pushoverSendingEnabled:false,realBookingsEnabled:false,attestationKey:'ab'.repeat(32)});
const denied=config=>assert.deepEqual(validateIsolatedPersistentConfig(config),
 {ok:false,errors:['ISOLATED_PERSISTENT_CONFIG_REJECTED']});

test('explicit isolated configuration yields frozen secret-free syntax validation',()=>{
 const input=configured(),result=validateIsolatedPersistentConfig(input);
 assert.equal(result.ok,true);assert.deepEqual(result.errors,[]);
 assert.equal(result.validated,true);assert.equal(result.attestationKeyConfigured,true);
 assert.equal(Object.isFrozen(result),true);assert.equal('attestationKey' in result,false);
 assert.equal(JSON.stringify(result).includes(input.attestationKey),false);
 assert.equal(input.attestationKey,'ab'.repeat(32));
});
test('every missing gate and unknown configuration field fails closed',()=>{
 for(const key of Object.keys(configured())){const input=configured();delete input[key];denied(input);}
 for(const value of [undefined,null,[],false,'enabled'])denied(value);
 denied({...configured(),fallback:true});
 for(const key of ['enabled','syntheticOnly'])for(const value of [false,'true',1,null])denied({...configured(),[key]:value});
 for(const key of ['emailSendingEnabled','pushoverSendingEnabled','realBookingsEnabled'])
  for(const value of [true,'false',0,null])denied({...configured(),[key]:value});
});
test('operator origin must be exact pinned canonical HTTPS and isolated',()=>{
 for(const origin of ['http://operator.isolated.example.invalid','https://operator.isolated.example.invalid/',
  'https://operator.isolated.example.invalid/path','https://operator.isolated.example.invalid?x=1',
  'https://operator.isolated.example.invalid#x','https://user:secret@operator.isolated.example.invalid',
  'https://operator.isolated.example.invalid:444','https://OPERATOR.isolated.example.invalid',
  'https://operator.example.invalid','https://production.isolated.example.invalid',
  'https://leafy-chimera-2403e5.netlify.app','https://leafy-chimera-2403e5.isolated.example.invalid',
  'https://mojnqizbcaczstguikpv.supabase.co','https://localhost','https://127.0.0.1'])
  denied({...configured(),operatorOrigin:origin,expectedOperatorOrigin:origin});
 denied({...configured(),expectedOperatorOrigin:'https://other.isolated.example.invalid'});
});
test('database permits only dedicated isolated host and exact disposable database',()=>{
 for(const databaseName of ['postgres','original','sc_approval_test ','SC_APPROVAL_TEST',null])denied({...configured(),databaseName});
 for(const databaseHost of ['mojnqizbcaczstguikpv.supabase.co','mojnqizbcaczstguikpv.isolated.example.invalid',
  'leafy-chimera-2403e5.isolated.example.invalid','production.isolated.example.invalid',
  'prod-db.isolated.example.invalid','db.example.invalid','localhost','127.0.0.1',
  'https://isolated-db.example.invalid','isolated-db:5432','isolated-db..example.invalid',
  '-isolated-db','isolated-db-','ISOLATED-db',null])denied({...configured(),databaseHost});
});
test('missing or malformed attestation secret is rejected without disclosure',()=>{
 for(const attestationKey of ['',null,'ab'.repeat(31),'ab'.repeat(33),'AB'.repeat(32),
  'secret-password','ab'.repeat(32)+'\n'])denied({...configured(),attestationKey});
 const input={...configured(),databaseName:'original'};
 assert.equal(JSON.stringify(validateIsolatedPersistentConfig(input)).includes(input.attestationKey),false);
});
