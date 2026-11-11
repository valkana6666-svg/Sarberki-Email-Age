#!/usr/bin/env node
// Saturday demo preflight (2026-11-14), READ-ONLY: TEST site version, Previo 73521 identity, free-unit read, price
// suggester vs price list, chatbot conversations in four languages. No Previo write, no e-mail, no DB write.
// Usage: NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/demo-preflight.mjs
// (the browser smoke stays separate: CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/live-test-readonly-smoke.mjs)
import {readPrevioFreeCapacity} from '../shared-core/server-previo-rest-read.mjs';
import {readPrevioPrice} from '../shared-core/server-previo-price-check.mjs';
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';
import {createChatInquirySession} from '../sarberki-chatbot-project/chat-session.mjs';
import {execFileSync} from 'node:child_process';

const KEY=process.env.PREVIO_DEMO_KEY||'PROXY_REPLACES_THIS';
const MAP={vip:1012895,family:1012897,deluxe:1012899,small:1012901,splitA:1012903,splitB:1012903,splitC:1012905};
const results=[];const check=async(name,fn)=>{try{const detail=await fn();results.push({name,ok:true,detail});}catch(e){results.push({name,ok:false,detail:e.code||e.message});}};

await check('TEST site version = branch HEAD',async()=>{
 const head=execFileSync('git',['rev-parse','origin/gmail-test-subject-allowlist'],{encoding:'utf8'}).trim();
 const live=(await (await fetch('https://leafy-chimera-2403e5.netlify.app/build-info.mjs')).text()).match(/[0-9a-f]{40}/)?.[0];
 const released=execFileSync('git',['log','-1','--format=%H','--grep=^\\[netlify-test-release\\]','origin/gmail-test-subject-allowlist'],{encoding:'utf8'}).trim();
 if(live!==released)throw Error(`live ${live?.slice(0,7)} ≠ last release ${released.slice(0,7)}`);
 return `live ${live.slice(0,7)} (HEAD ${head.slice(0,7)})`;
});
await check('Previo 73521 identity (Hotel.get)',async()=>{
 const t=await (await fetch('https://api.previo.app/x1/hotel/get',{method:'POST',headers:{Authorization:'ApiKey '+KEY,'Content-Type':'application/xml'},body:'<request><hotId>73521</hotId><lanId>1</lanId></request>'})).text();
 if(!/<hotId>73521<\/hotId>/.test(t)||!/API\s*TES[ZT]/i.test(t))throw Error('NOT_73521_TEST');return '73521 API TESZT';
});
await check('Previo free units (calendar)',async()=>{
 const r=await readPrevioFreeCapacity({apiKey:KEY,hotelId:'73521',ratePlanId:385033,mapping:MAP,cabins:['deluxe','family','vip','splitC'],arrival:'2027-06-24',departure:'2027-06-26'});
 if(!r.complete)throw Error('INCOMPLETE');return JSON.stringify(r.freeByCabin);
});
await check('Previo price = price list (Deluxe 2 nights, 2 adults)',async()=>{
 const values={arrival:'2027-06-24',departure:'2027-06-26',adults:'2',children:'0'};
 const p=await readPrevioPrice({apiKey:KEY,values,cabin:'deluxe'});
 const ours=fetchPublicPriceReference({arrival:values.arrival,departure:values.departure,cabin:'deluxe',adults:2,children:[]}).total;
 if(p.status!=='read'||p.total!==ours)throw Error(`Previo ${p.total} ≠ ${ours}`);return `${ours} Ft`;
});
await check('Chatbot HU/DE/EN/SI booking conversation + pet answer',async()=>{
 const clock=()=>new Date();
 const cases=[['Szia! 2027. július 5-től 8-ig jönnénk 2 felnőtt és 2 gyerek (5 és 9 évesek).',/2027\.07\.05\./],
  ['Guten Tag, wir möchten vom 15. bis 17. Juni 2027 kommen, 2 Erwachsene, keine Kinder.',/15\.06\.2027/],
  ['Hello, we are 3 adults, no children, 25 to 28 August 2027.',/25 August 2027/],
  ['Pozdravljeni, prišli bi od 20. do 22. junija 2027, 4 odrasli, brez otrok.',/20\.06\.2027/],['Lehet kutyát hozni?',/Háziállat hozható/]];
 for(const [m,re] of cases)if(!re.test(createChatInquirySession({clock}).reply(m).text))throw Error('CHAT_FAIL: '+m.slice(0,30));
 return '5/5';
});
for(const r of results)console.log(`${r.ok?'PASS':'FAIL'}  ${r.name}: ${r.detail}`);
console.log(results.every(r=>r.ok)?'DEMO PREFLIGHT: PASS':'DEMO PREFLIGHT: FAIL');
process.exitCode=results.every(r=>r.ok)?0:1;
