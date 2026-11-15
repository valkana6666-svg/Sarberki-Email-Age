import test from 'node:test';
import assert from 'node:assert/strict';
import {previoBookingNote,notifyPushover} from '../shared-core/operator-notify.mjs';

// Owner 2026-11-15: a Pushover note whenever a booking was written into the Previo TEST; no personal data.
const saved=(booking,values={})=>({data:{booking,state:{values:{name:'Kitalált Vendég',email:'x@example.test',phone:'+36 30 000 0000',unit:'Deluxe',arrival:'2026-12-12',departure:'2026-12-14',adults:'2',children:'0',...values}}}});
test('note only for a Previo-written booking, without name, e-mail or phone',()=>{
 const n=previoBookingNote(saved({status:'finalized',previo:{reference:'V2-118229075'}}));
 assert.equal(n,'Foglalás beíródott a Previo-tesztbe: Deluxe, 2026.12.12.–2026.12.14., 2 fő.');
 assert.doesNotMatch(n,/Kitalált|example|\+36/);
 assert.equal(previoBookingNote(saved({status:'finalized',previo:{reference:'P-123'}})),null,'manual reference: no note');
 assert.equal(previoBookingNote(saved({status:'cancelled',previo:{reference:'V2-1'}})),null);
 assert.equal(previoBookingNote(null),null);
});
test('sent once through Pushover only when switched on; failures never throw',async()=>{
 const env={INTAKE_NOTIFY:'pushover',PUSHOVER_API_TOKEN:'t'.repeat(30),PUSHOVER_USER_KEY:'u'.repeat(30)};
 const calls=[];const ok=async(url,o)=>{calls.push({url,body:JSON.parse(o.body)});return new Response('{}');};
 assert.equal(await notifyPushover(env,ok,'Foglalás beíródott a Previo-tesztbe.'),true);
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.pushover.net/1/messages.json');assert.match(calls[0].body.url,/\/napi-kezelo\/$/);
 assert.equal(await notifyPushover({},ok,'x'),false);assert.equal(await notifyPushover(env,ok,null),false);assert.equal(calls.length,1);
 assert.equal(await notifyPushover(env,async()=>{throw Error('down');},'x'),false);
});
