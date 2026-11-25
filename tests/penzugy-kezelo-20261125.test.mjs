// Owner 2026-11-25 (#9 7159099524): finance view over the shared case store. Synthetic only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {financeGroup,financeRows,financeTotals,financeRowText,matchesQuery} from '../napi-kezelo/penzugy-view.mjs';
import {notifyPushover} from '../shared-core/operator-notify.mjs';

const NOW=Date.parse('2026-11-25T10:00:00Z'),H=3600000;
const row=(id,booking,finance,extra={})=>({tenantId:'sarberki-test',caseId:'tm-'+id.padEnd(16,'0'),kind:'test-mailbox',revision:1,summary:{name:'Teszt '+id,email:id+'@example.test',unit:'Deluxe',arrival:'2027-06-10',departure:'2027-06-13',booking,finance,...extra}});
const fin=(deadline,extra={})=>({amount:90750,deadlineUtc:deadline,receivedOn:null,reference:'V2-1',reminders:{first:false,final:false},...extra});
const rows=[
 row('a1','finalized',fin(new Date(NOW-3*H).toISOString())),
 row('b2','finalized',fin(new Date(NOW+20*H).toISOString(),{reminders:{first:true,final:false}})),
 row('c3','finalized',fin(new Date(NOW+5*24*H).toISOString(),{reference:'V2-777'})),
 row('d4','deposit_received',fin(null,{receivedOn:'2026-11-24'})),
 row('e5','cancelled',fin(null,{amount:null})),
 row('f6',null,null)];

test('groups: overdue / soon (48 h) / waiting / received / cancelled; open cases without a booking are not finance rows',()=>{
 assert.deepEqual(rows.map(r=>financeGroup(r,NOW)),['overdue','soon','waiting','received','cancelled',null]);
 assert.equal(financeGroup(row('g7','finalized',fin(null)),NOW),'waiting','no deadline recorded is still waiting, never overdue');
});
test('order, filter and search (accent-insensitive; Previo reference and e-mail)',()=>{
 assert.deepEqual(financeRows(rows,{now:NOW}).map(x=>x.group),['overdue','soon','waiting','received','cancelled']);
 assert.deepEqual(financeRows(rows,{now:NOW,group:'soon'}).map(x=>x.row.caseId.slice(3,5)),['b2']);
 assert.deepEqual(financeRows(rows,{now:NOW,query:'v2-777'}).map(x=>x.row.caseId.slice(3,5)),['c3']);
 assert.ok(matchesQuery(row('h8','finalized',fin(null),{name:'Árvíztűrő Éva'}),'arvizturo'));
});
test('totals count amounts; an unknown amount is counted separately, never guessed',()=>{
 const t=financeTotals(rows,NOW);
 assert.deepEqual(t.overdue,{count:1,amount:90750,unknownAmount:0});assert.deepEqual(t.cancelled,{count:1,amount:0,unknownAmount:1});
});
test('row text: amount, Previo reference, deadline in Hungarian time, reminders; received shows the day',()=>{
 const o=financeRowText(rows[0],NOW);assert.match(o.lines.join('\n'),/Foglaló: 90 750 Ft · Previo: V2-1/);assert.match(o.lines.join('\n'),/⚠️ Határidő lejárt: .*\(3 órája\)/);
 assert.match(financeRowText(rows[1],NOW).lines.join('\n'),/⏳ .*\(20 óra múlva\)[\s\S]*első elküldve/);
 assert.match(financeRowText(rows[3],NOW).lines.join('\n'),/✅ Beérkezett: 2026\. 11\. 24\./);
});
test('one navigation on all three pages; finance page is read-only (no deposit write action in its code)',()=>{
 const daily=readFileSync('napi-kezelo/index.html','utf8'),chat=readFileSync('sarberki-chatbot-project/index.html','utf8'),money=readFileSync('napi-kezelo/penzugy.html','utf8');
 for(const html of [daily,money]){assert.match(html,/href="\.\/"/);assert.match(html,/href="\.\.\/sarberki-chatbot-project\/"/);assert.match(html,/href="\.\/penzugy\.html"/);}
 assert.match(chat,/href="\.\.\/napi-kezelo\/"/);assert.match(chat,/href="\.\.\/napi-kezelo\/penzugy\.html"/);assert.match(chat,/aria-current="page">💬 Chatbot/);
 const code=readFileSync('napi-kezelo/penzugy.mjs','utf8');
 assert.doesNotMatch(code,/'POST'|test-mailbox-deposit'|test-mailbox-deposit-reminder/);
 assert.match(code,/action:'daily-list'/);assert.match(code,/\.\/\?case=/);
 assert.match(readFileSync('scripts/build-static.cjs','utf8'),/'penzugy\.html','penzugy\.mjs','penzugy-view\.mjs'/);
});
test('deposit alert Pushover links to the finance view at that case; other notes keep the daily view',async()=>{
 const sent=[];const f=async(u,o)=>{sent.push(JSON.parse(o.body));return new Response('{}');};
 const env={INTAKE_NOTIFY:'pushover',PUSHOVER_API_TOKEN:'t',PUSHOVER_USER_KEY:'u'};
 await notifyPushover(env,f,'x',{caseId:'tm-aaaaaaaaaaaaaaaa',view:'finance'});await notifyPushover(env,f,'y',{caseId:'tm-aaaaaaaaaaaaaaaa'});
 assert.equal(sent[0].url,'https://leafy-chimera-2403e5.netlify.app/napi-kezelo/penzugy.html?case=tm-aaaaaaaaaaaaaaaa');assert.equal(sent[0].url_title,'Pénzügyi kezelő');
 assert.equal(sent[1].url,'https://leafy-chimera-2403e5.netlify.app/napi-kezelo/?case=tm-aaaaaaaaaaaaaaaa');
});
