// Owner 2026-11-25 („teszteld végig a folyamatot”): one booking's deposit life, simulated hour by hour like the
// scheduled job (minute 7 of every hour). Synthetic only; checks alerts, guest reminders and the finance groups
// stay consistent with each other.
import test from 'node:test';
import assert from 'node:assert/strict';
import {depositAlerts} from '../shared-core/server-deposit-alerts.mjs';
import {reminderKind} from '../shared-core/server-deposit-reminder.mjs';
import {financeGroup} from '../napi-kezelo/penzugy-view.mjs';

const H=3600000,DL='2026-11-30T22:13:00Z',T=Date.parse(DL);
const alertRow={caseId:'tm-'+'a'.repeat(16),unit:'2',arrival:'2027-06-10',departure:'2027-06-13',deadlineUtc:DL};
const listRow=status=>({summary:{booking:status,finance:{amount:90750,deadlineUtc:DL,receivedOn:status==='deposit_received'?'2026-11-29':null,reference:'V2-1',reminders:{first:false,final:false}}}});
const ticks=[];for(let t=Date.parse('2026-11-26T00:07:00Z');t<=Date.parse('2026-12-02T00:07:00Z');t+=H)ticks.push(t);

test('hourly run: exactly one "2 days" alert (08:07 Budapest, two days before) and one deadline-day morning alert (08:07 Budapest)',()=>{
 const fired=ticks.flatMap(t=>depositAlerts([alertRow],t).map(a=>({at:new Date(t).toISOString(),kind:a.kind})));
 assert.deepEqual(fired,[{at:'2026-11-28T07:07:00.000Z',kind:'soon'},{at:'2026-11-30T07:07:00.000Z',kind:'today'}]);
});
test('guest reminders: first in the last 2 days, final on the deadline day; each once; none after +12 h',()=>{
 const b={status:'finalized',deposit:{deadlineUtc:DL}};
 assert.equal(reminderKind(b,T-49*H),null);
 assert.equal(reminderKind(b,T-47*H),'first');
 assert.equal(reminderKind({...b,depositReminder:{sentAt:'x'}},T-30*H),null,'first already sent');
 assert.equal(reminderKind({...b,depositReminder:{sentAt:'x'}},Date.parse('2026-11-30T07:07:00Z')),'final','deadline day (Budapest)');
 assert.equal(reminderKind({...b,depositReminder:{},depositReminderFinal:{}},T-H),null,'final already sent');
 assert.equal(reminderKind(b,T+13*H),null);
 assert.equal(reminderKind({...b,status:'deposit_received'},T-47*H),null,'received: no reminder');
});
test('finance groups follow the clock: waiting → soon (48 h) → overdue; marked received → received at any time',()=>{
 assert.equal(financeGroup(listRow('finalized'),T-49*H),'waiting');
 assert.equal(financeGroup(listRow('finalized'),T-47*H),'soon');
 assert.equal(financeGroup(listRow('finalized'),T+60000),'overdue');
 for(const t of [T-49*H,T-H,T+50*H])assert.equal(financeGroup(listRow('deposit_received'),t),'received');
 // The alert job reads only finalized bookings (sc_deposit_alerts); a received deposit drops out of the input rows.
 assert.equal(financeGroup(listRow('cancelled'),T-H),'cancelled');
});
test('every alert moment falls in the finance group the alert talks about',()=>{
 for(const t of ticks)for(const a of depositAlerts([alertRow],t)){
  const g=financeGroup(listRow('finalized'),t);
  assert.ok(a.kind==='soon'?['waiting','soon'].includes(g):['soon','overdue'].includes(g),`${a.kind} at ${new Date(t).toISOString()} → ${g}`);
 }
});
