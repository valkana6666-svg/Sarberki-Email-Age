// Owner 2026-11-24: Pushover 48 h before a deposit deadline and when it passed. Synthetic only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {depositAlerts} from '../shared-core/server-deposit-alerts.mjs';
import {runDepositAlerts} from '../netlify/functions/deposit-alerts.mjs';

const H=3600000,DL='2026-11-30T21:13:21.000Z',T=Date.parse(DL);
const row={caseId:'tm-aaaaaaaaaaaaaaaa',unit:'Családi',arrival:'2027-07-05',departure:'2027-07-08',deadlineUtc:DL};

test('each alert fires in exactly one hourly slot; text has type, dates, deadline – no guest data',()=>{
 const at=ms=>depositAlerts([row],ms).map(a=>a.kind);
 // Owner 2026-11-25: the first alert at 08:00 Budapest two days before the deadline day (11-28 07:00 UTC in winter).
 const first=Date.parse('2026-11-28T07:00:00Z');
 assert.deepEqual(at(first-60000),[]);assert.deepEqual(at(first),['soon']);assert.deepEqual(at(first+59*60000),['soon']);assert.deepEqual(at(first+H),[]);assert.deepEqual(at(T-48*H),[],'never in the night any more');
 // Deadline 22:13 Budapest → the second alert at 08:00 Budapest the same day (07:00 UTC in winter).
 const morning=Date.parse('2026-11-30T07:00:00Z');
 assert.deepEqual(at(morning-60000),[]);assert.deepEqual(at(morning),['today']);assert.deepEqual(at(morning+59*60000),['today']);assert.deepEqual(at(morning+H),[]);
 assert.deepEqual(at(T),[],'nothing at expiry any more');
 // Hourly runs across the whole window: one "soon" and one "today", never more.
 let soon=0,today=0;for(let m=T-80*H;m<T+5*H;m+=H){for(const a of depositAlerts([row],m+7*60000)){if(a.kind==='soon')soon++;else today++;}}
 assert.equal(soon,1);assert.equal(today,1);
 // A deadline before 09:00 → the day alert 12 h before it (the previous evening).
 const early={...row,deadlineUtc:'2026-11-30T07:30:00Z'};assert.deepEqual(depositAlerts([early],Date.parse('2026-11-29T19:30:00Z')).map(a=>a.kind),['today']);
 const [a]=depositAlerts([row],first);
 assert.match(a.text,/^⏳ A foglaló 2 nap múlva lejár – Családi, 2027\.07\.05\. – 2027\.07\.08\. Határidő: 11\. 30\. 22:13/);
 assert.match(depositAlerts([row],morning)[0].text,/^⚠️ Ma lejár a foglaló határideje \(11\. 30\. 22:13\)/);
 assert.deepEqual(depositAlerts([{...row,deadlineUtc:'x'}],T),[]);assert.deepEqual(depositAlerts(null,T),[]);
});

test('job: off without its switches; signs in with the intake account, calls only sc_deposit_alerts, sends the due alerts',async()=>{
 const env={DEPOSIT_ALERTS:'test-only',INTAKE_NOTIFY:'pushover',SUPABASE_URL:'https://mojnqizbcaczstguikpv.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic',
  INTAKE_ACCOUNT_EMAIL:'intake-test@sarberki.invalid',INTAKE_ACCOUNT_PASSWORD:'synthetic'};
 assert.equal((await runDepositAlerts({env:{...env,DEPOSIT_ALERTS:''}})).status,'off');
 assert.equal((await runDepositAlerts({env:{...env,INTAKE_NOTIFY:''}})).status,'off');
 const calls=[],sent=[];
 const fetchImpl=async(url,o)=>{calls.push(String(url));
  if(String(url).includes('/auth/v1/token'))return new Response(JSON.stringify({access_token:'synthetic-token'}));
  return new Response(JSON.stringify([row,{...row,caseId:'tm-bbbbbbbbbbbbbbbb',deadlineUtc:'2026-12-10T10:00:00Z'}]));};
 const r=await runDepositAlerts({env,fetchImpl,now:()=>Date.parse('2026-11-28T07:07:00Z'),notify:async(e,f,text)=>{sent.push(text);return true;}});
 assert.deepEqual(r,{status:'ran',checked:2,alerts:1,sent:1});
 assert.equal(calls.length,2);assert.match(calls[1],/\/rest\/v1\/rpc\/sc_deposit_alerts$/);
 assert.match(sent[0],/2 nap múlva lejár/);
 assert.equal((await runDepositAlerts({env,fetchImpl:async()=>new Response('{}',{status:400})})).status,'auth_failed');
});
