import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaseHandler} from '../netlify/functions/booking-cases.mjs';
test('source Supabase URL cannot enable approval even with an injected rehearsal flag',async()=>{
 const handler=createCaseHandler({isolatedApproval:true,env:{CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',URL:'https://leafy-chimera-2403e5.netlify.app',SUPABASE_URL:'https://mojnqizbcaczstguikpv.supabase.co',SUPABASE_PUBLISHABLE_KEY:'synthetic-public-key'},fetchImpl:()=>assert.fail('source network forbidden')});
 const response=await handler({httpMethod:'POST',headers:{authorization:'Bearer synthetic-operator-token-0001'},body:JSON.stringify({tenantId:'sarberki-test',action:'approve',caseId:'case-fixture',expectedRevision:1,reviewedDraftHash:'0'.repeat(64)})});
 assert.equal(response.statusCode,400);
});
