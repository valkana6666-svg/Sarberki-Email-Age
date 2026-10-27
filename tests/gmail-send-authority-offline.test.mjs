import test from 'node:test';
import assert from 'node:assert/strict';
import {offlineSendAuthority as check} from '../shared-core/gmail-send-authority-offline.mjs';
const base=()=>({environment:'TEST_ONLY_DISABLED_BY_DEFAULT',authenticated:true,subject:'test-auth-id',tenant:'sarberki-test',caseId:'13c8ecb7-f836-4e2c-9833-d58ee96f2dda',independentSendPermission:true,explicitOperatorConsent:true,csrfVerified:true});
test('offline eligible authority is not a real Gmail authorization',()=>{const r=check(base());assert.equal(r.authorized,true);assert.equal(r.reason,'OFFLINE_SIMULATION_ONLY')});
for(const [name,key,value,reason] of [
 ['default off','environment',undefined,'FEATURE_DISABLED'],
 ['production refused','environment','production','FEATURE_DISABLED'],
 ['anonymous','authenticated',false,'AUTH_REQUIRED'],
 ['other tenant','tenant','other','SCOPE_DENIED'],
 ['other case','caseId','other','SCOPE_DENIED'],
 ['writer-only permission','independentSendPermission',false,'SEND_PERMISSION_REQUIRED'],
 ['missing csrf','csrfVerified',false,'CSRF_REQUIRED'],
 ['missing consent','explicitOperatorConsent',false,'CONSENT_REQUIRED'],
])test(name,()=>{const v=base();v[key]=value;const r=check(v);assert.equal(r.authorized,false);assert.equal(r.reason,reason)});
test('missing input remains disabled',()=>assert.equal(check().reason,'FEATURE_DISABLED'));
