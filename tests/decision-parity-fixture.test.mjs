import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDecisionParityHandler} from '../netlify/functions/decision-parity-fixture.mjs';
const origin='https://leafy-chimera-2403e5.netlify.app';
const env={DECISION_PARITY_FIXTURE_ENABLED:'true',URL:origin};
const event=body=>({httpMethod:'POST',headers:{origin},body:JSON.stringify(body)});
const sessionFactory=()=>({protectedRead:async()=>({setCookie:'synthetic-cookie'})});
test('fixed HU/DE/EN/SI fixtures use same central decision without external evidence',async()=>{
 const handler=createDecisionParityHandler({env,sessionFactory,fetchImpl:()=>{throw Error('network forbidden');}});
 for(const language of ['hu','de','en','si']){
  const result=await handler(event({language})),body=JSON.parse(result.body);
  assert.equal(result.statusCode,200);assert.equal(body.decisionsMatch,true);assert.equal(body.capacityStatus,'UNKNOWN');
  assert.equal(body.priceVerified,false);assert.equal(body.requiresApproval,true);
  assert.deepEqual(Object.keys(body).sort(),['capacityStatus','decisionsMatch','fixture','language','priceVerified','requiresApproval']);
 }
});
test('disabled, foreign-origin, malformed and arbitrary messages fail closed',async()=>{
 let calls=0;const factory=()=>({protectedRead:async()=>{calls++;return {setCookie:'synthetic'};}});
 assert.equal((await createDecisionParityHandler({env:{...env,DECISION_PARITY_FIXTURE_ENABLED:'false'},sessionFactory:factory})(event({language:'hu'}))).statusCode,503);
 const handler=createDecisionParityHandler({env,sessionFactory:factory});
 for(const data of [{language:'hu',message:'guest data'},{language:'xx'},[],null])assert.equal((await handler(event(data))).statusCode,400);
 const foreign=event({language:'hu'});foreign.headers.origin='https://example.invalid';assert.equal((await handler(foreign)).statusCode,403);assert.equal(calls,0);
});
test('authentication failure cannot invoke the decision or return internal details',async()=>{
 const handler=createDecisionParityHandler({env,sessionFactory:()=>({protectedRead:async()=>{throw Error('PRIVATE_ERROR');}})});
 const result=await handler(event({language:'hu'}));assert.equal(result.statusCode,503);assert.doesNotMatch(result.body,/PRIVATE_ERROR|decision|rules/);
});
