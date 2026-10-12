import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCloudReadiness,classifyCloudReadiness} from '../scripts/operator-cloud-preflight.mjs';

function fixture({sessionStatus=503,sessionError='SESSION_SETUP_REQUIRED',caseStatus=503,caseError='CASE_STORE_DISABLED'}={}){
 const calls=[];
 const request=async(url,options)=>{
  calls.push({url,options});
  assert.equal(options.method,'GET');
  assert.equal(options.body,undefined);
  assert.equal(options.headers.Authorization,undefined);
  assert.equal(options.headers.Cookie,undefined);
  assert.equal(options.headers.cookie,undefined);
  assert.ok(!JSON.stringify(options).includes('password'));
  const session=url.endsWith('/.netlify/functions/operator-session');
  assert.ok(session||url.includes('/.netlify/functions/booking-cases?tenantId=sarberki-test'));
  return {status:session?sessionStatus:caseStatus,ok:false,json:async()=>({error:session?sessionError:caseError})};
 };
 return {request,calls};
}
test('credential-free cloud probe reports missing test-host setup without using any credentials',async()=>{
 const f=fixture(),result=await inspectCloudReadiness({request:f.request});
 assert.equal(result.session,'BLOCKED_BY_SESSION_CONFIGURATION');
 assert.equal(result.caseStore,'BLOCKED_BY_CASE_STORE_CONFIGURATION');
 assert.equal(result.loginAttempted,false);
 assert.equal(result.actualIPhoneVerified,false);
 assert.equal(result.personalDataRead,false);
 assert.equal(f.calls.length,2);
 assert.equal(f.calls[0].options.headers['Sec-Fetch-Site'],'same-origin');
});
test('read-only anonymous 401 signals configured gates, never an authenticated iPhone proof',async()=>{
 const f=fixture({sessionStatus:401,sessionError:'AUTH_REQUIRED',caseStatus:401,caseError:'AUTH_REQUIRED'});
 const result=await inspectCloudReadiness({request:f.request});
 assert.equal(result.session,'CONFIGURED_BUT_LOGIN_UNVERIFIED');
 assert.equal(result.caseStore,'SYNTHETIC_GATE_CONFIGURED_BUT_AUTH_UNVERIFIED');
 assert.equal(result.actualIPhoneVerified,false);
});
test('unexpected anonymous 200 blocks cloud readiness without exposing response body',async()=>{
 const result=classifyCloudReadiness({operator:{httpStatus:200,error:'UNVERIFIED'},cases:{httpStatus:401,error:'AUTH_REQUIRED'}});
 assert.equal(result.status,'UNSAFE_UNEXPECTED_PUBLIC_200');
});
test('network outage and malformed response cannot be reported as ready',async()=>{
 const result=await inspectCloudReadiness({request:async()=>{throw Error('INTERNAL SECRET SHOULD NOT LEAK')}});
 assert.equal(result.session,'UNVERIFIED');
 assert.equal(result.caseStore,'UNVERIFIED');
 assert.equal(JSON.stringify(result).includes('INTERNAL SECRET'),false);
});
