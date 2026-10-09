import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../netlify/functions/supabase-auth-test.mjs';
const now=Date.parse('2026-10-09T12:00:00Z');
const env={CASE_STORE_ENABLED:'disabled',URL:'https://leafy-chimera-2403e5.netlify.app',SUPABASE_URL:'https://mojnqizbcaczstguikpv.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',SUPABASE_AUTH_TEST_UNTIL:'2026-10-09T13:00:00Z'};
for(const [name,changes] of Object.entries({default:{SUPABASE_AUTH_TEST_UNTIL:undefined},expired:{SUPABASE_AUTH_TEST_UNTIL:'2026-10-09T11:00:00Z'},tooLong:{SUPABASE_AUTH_TEST_UNTIL:'2026-10-11T12:00:00Z'},activeApi:{CASE_STORE_ENABLED:'synthetic-only'},wrongSite:{URL:'https://production.invalid'},wrongProject:{SUPABASE_URL:'https://other.supabase.co'},privilegedKey:{SUPABASE_PUBLISHABLE_KEY:'service-role'}})) test('closed gate: '+name,async()=>{
 const h=createHandler({env:{...env,...changes},now:()=>now,fetchImpl:()=>assert.fail('network must remain unused')});
 assert.equal((await h({httpMethod:'GET'})).statusCode,404);
});
test('form is same-origin and contains no script or token',async()=>{const r=await createHandler({env,now:()=>now})({httpMethod:'GET'});assert.equal(r.statusCode,200);assert.equal((r.body.match(/type="password"/g)||[]).length,3);assert.ok(!r.body.includes('<script'));assert.equal(r.headers['Cache-Control'],'no-store');assert.match(r.headers['Content-Security-Policy'],/form-action 'self'/);});
const event={httpMethod:'POST',headers:{origin:env.URL,'content-type':'application/x-www-form-urlencoded'},body:'password0=a&password1=b&password2=c'};
for(const [name,change] of Object.entries({crossOrigin:{headers:{...event.headers,origin:'https://evil.invalid'}},tooLarge:{body:'a'.repeat(8193)},base64:{isBase64Encoded:true},extraField:{body:event.body+'&token=secret'},duplicate:{body:event.body+'&password0=x'}}))test('reject malformed POST: '+name,async()=>{const h=createHandler({env,now:()=>now,fetchImpl:()=>assert.fail('network must remain unused')});assert.equal((await h({...event,...change})).statusCode,400);});
test('authentication failure never reflects passwords or upstream bodies',async()=>{
 const secret='do-not-return-this';const h=createHandler({env,now:()=>now,fetchImpl:async()=>({ok:false,json:async()=>({error:secret})})});
 const r=await h({...event,body:`password0=${secret}&password1=b&password2=c`});assert.equal(r.statusCode,422);assert.ok(!r.body.includes(secret));
});
