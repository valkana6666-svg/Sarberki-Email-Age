// V3-1 intake endpoint: off by default, signed requests only, fixed codes, intake account login, no secrets echoed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createIntakeHandler} from '../netlify/functions/intake.mjs';
import {signIntake} from '../shared-core/server-intake.mjs';

const KEY='ab'.repeat(32),NOW=Date.parse('2026-11-12T10:00:00Z');
const env={INTAKE_ENABLED:'test-only',SUPABASE_URL:'https://mojnqizbcaczstguikpv.supabase.co',INTAKE_HMAC_KEY:KEY,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',
 INTAKE_ACCOUNT_EMAIL:'intake@example.test',INTAKE_ACCOUNT_PASSWORD:'not-a-real-secret',ISOLATED_APPROVAL_ATTESTATION_KEY:'e5'.repeat(32)};
const req=(body,{key=KEY,t=Math.floor(NOW/1000),method='POST'}={})=>{const raw=JSON.stringify(body);
 return new Request('https://x/.netlify/functions/intake',{method,body:method==='POST'?raw:undefined,headers:{'x-sarberki-signature':signIntake(key,raw,t)}});};
const facts={arrival:'2027-06-24',departure:'2027-06-26',adults:6,children:0,cabin:'small',language:'hu'};

test('off by default, POST only, signature required',async()=>{
 assert.equal((await createIntakeHandler({env:{},now:()=>NOW})(req({action:'check_availability',facts}))).status,503);
 assert.equal((await createIntakeHandler({env:{...env,SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co'},now:()=>NOW})(req({action:'check_availability',facts}))).status,503,'never another project');
 const h=createIntakeHandler({env,now:()=>NOW});
 assert.equal((await h(req({action:'check_availability',facts},{method:'GET'}))).status,405);
 assert.equal((await h(req({action:'check_availability',facts},{key:'cd'.repeat(32)}))).status,401);
 assert.equal((await h(req({action:'check_availability',facts},{t:Math.floor(NOW/1000)-600}))).status,401,'replay older than 5 minutes');
 assert.equal((await h(req({action:'nope',facts}))).status,400);
});

test('check_availability: central decision, guest sentence, no price, no Previo when the read switch is off',async()=>{
 let calls=0;const h=createIntakeHandler({env,now:()=>NOW,fetchImpl:async()=>{calls++;return new Response('{}');}});
 const r=await h(req({action:'check_availability',facts}));
 assert.equal(r.status,200);const body=await r.json();
 assert.equal(body.status,'too_many');assert.match(body.say,/6 fő nem fér el/);assert.equal(calls,0);
 assert.doesNotMatch(JSON.stringify(body),/Ft|price|ár:/i);
});

test('create_booking_request: intake account login; failures give fixed codes without upstream text',async()=>{
 const seen=[];
 const fetchImpl=async(url,o={})=>{seen.push(String(url));
  if(String(url).includes('/auth/v1/token'))return new Response(JSON.stringify({access_token:'jwt-intake'}),{status:200});
  return new Response('{"message":"internal detail that must not leak"}',{status:500});};
 const h=createIntakeHandler({env,now:()=>NOW,fetchImpl});
 const r=await h(req({action:'create_booking_request',channel:'phone',externalId:'call_test_000002',facts:{...facts,adults:2,cabin:'deluxe'},summary:'Teszt hívás összefoglaló.'}));
 const body=await r.json();
 assert.equal(r.status,502);assert.deepEqual(body,{error:'STORAGE_FAILURE'});
 assert.ok(seen[0].endsWith('/auth/v1/token?grant_type=password'));assert.ok(seen.some(u=>u.endsWith('/rest/v1/rpc/sc_intake_create')));
 const bad=await createIntakeHandler({env,now:()=>NOW,fetchImpl:async()=>new Response('no',{status:400})})(req({action:'create_booking_request',channel:'phone',externalId:'call_test_000003',facts,summary:'x'}));
 assert.equal(bad.status,503);assert.deepEqual(await bad.json(),{error:'INTAKE_AUTH_FAILED'});
 const missing=await createIntakeHandler({env:{...env,INTAKE_ACCOUNT_PASSWORD:''},now:()=>NOW})(req({action:'create_booking_request',channel:'phone',externalId:'call_test_000004',facts,summary:'x'}));
 assert.equal(missing.status,503);
 const invalid=await createIntakeHandler({env,now:()=>NOW,fetchImpl:async()=>new Response(JSON.stringify({access_token:'j'}))})(req({action:'create_booking_request',channel:'fax',externalId:'x',facts,summary:'x'}));
 assert.equal(invalid.status,400);assert.deepEqual(await invalid.json(),{error:'INVALID_INPUT'});
});

test('V3-4 operator note: off by default; when on, one Pushover call without personal data',async()=>{
 const {notifyOperator}=await import('../netlify/functions/intake.mjs');
 let calls=[];const fetchImpl=async(url,o)=>{calls.push({url,body:JSON.parse(o.body)});return new Response('{}');};
 assert.equal(await notifyOperator({PUSHOVER_API_TOKEN:'t',PUSHOVER_USER_KEY:'u'},fetchImpl,'phone'),false);assert.equal(calls.length,0);
 assert.equal(await notifyOperator({INTAKE_NOTIFY:'pushover'},fetchImpl,'phone'),false,'no keys -> nothing');
 assert.equal(await notifyOperator({INTAKE_NOTIFY:'pushover',PUSHOVER_API_TOKEN:'t',PUSHOVER_USER_KEY:'u'},fetchImpl,'phone'),true);
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.pushover.net/1/messages.json');
 assert.equal(calls[0].body.message,'Új telefonos foglalási igény érkezett a napi kezelőbe.');
 assert.doesNotMatch(JSON.stringify(calls[0].body),/\+36|@|Teszt|2027/);
 assert.equal(await notifyOperator({INTAKE_NOTIFY:'pushover',PUSHOVER_API_TOKEN:'t',PUSHOVER_USER_KEY:'u'},async()=>{throw Error('down');},'chat'),false,'best effort');
});

test('a quote-like phrase in the summary does not empty the request (2026-11-12)',async()=>{
 const {createIntakeRequest}=await import('../shared-core/server-intake.mjs');
 let sent;const transport=async(_,{body})=>{sent=body;return {revision:1};};
 await createIntakeRequest({channel:'phone',externalId:'call_test_quote01',facts:{arrival:'2027-07-12',departure:'2027-07-15',adults:2,children:0,cabin:'deluxe',language:'hu'},
  summary:'A vendég ezt írta: Deluxe faházat kér július 12–15. On Monday the guest wrote: two adults.',transport,attestationKey:'e5'.repeat(32),tenantId:'sarberki-test'});
 assert.match(sent.p_data.messages[0].text,/Deluxe faházat kér/);assert.match(sent.p_data.messages[0].text,/two adults/);
});
