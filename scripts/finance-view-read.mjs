// READ-ONLY (Claude, owner 2026-11-27 „Megadom a hozzáférést a pénzügyi belépéshez … az approverrel”): what the finance
// view (napi-kezelo/penzugy) shows, read exactly like the page does – the approver test account signs in on the TEST
// site, then ONLY two GET requests: daily-list and finance-previo-list. Every other method/path is aborted (as in
// live-test-readonly-smoke.mjs). Output: groups, sources, booking numbers, states, dates, unit, amounts, deadlines,
// payment state – never a guest name, e-mail, phone or message. Credentials only from the environment, never printed.
import {chromium} from 'playwright';
import {mergeFinance,financeGroup,financeTotals,GROUPS,SOURCES,paymentText,previoOptionExpired} from '../napi-kezelo/penzugy-view.mjs';

const ORIGIN='https://leafy-chimera-2403e5.netlify.app',TENANT='sarberki-test';
const SESSION='/.netlify/functions/operator-session',CASES='/.netlify/functions/booking-cases';
const email=process.env.SARBERKI_TEST_APPROVER_EMAIL,password=process.env.SARBERKI_TEST_APPROVER_PASSWORD;
if(!email||!password){console.log('MISSING_ENV SARBERKI_TEST_APPROVER_EMAIL/PASSWORD');process.exit(2);}
const blocked=[];
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try{
 const context=await browser.newContext({serviceWorkers:'block'});
 await context.route('**/*',route=>{
  const r=route.request(),u=new URL(r.url());
  const ok=u.origin===ORIGIN&&(u.pathname===SESSION&&['GET','POST'].includes(r.method())||u.pathname===CASES&&r.method()==='GET'||
   (!u.pathname.startsWith('/.netlify/')||u.pathname.startsWith('/.netlify/scripts/'))&&r.method()==='GET');
  if(!ok){if(u.origin===ORIGIN||r.method()!=='GET')blocked.push(r.method()+' '+u.pathname);return route.abort();}
  return route.continue();
 });
 const page=await context.newPage();await page.goto(ORIGIN+'/napi-kezelo/',{waitUntil:'domcontentloaded'});
 const call=(path,{method='GET',csrf=null,body}={})=>page.evaluate(async([path,method,csrf,body])=>{
  const r=await fetch(path,{method,headers:{'Content-Type':'application/json','X-Sarberki-Operator':'1',...(csrf?{'X-CSRF-Token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let json=null;try{json=await r.json();}catch{}return {status:r.status,json};},[path,method,csrf,body]);
 const login=await call(SESSION,{method:'POST',body:{action:'login',email,password}});
 const s=await call(SESSION);const csrf=s.json?.csrfToken;
 console.log('LOGIN',login.status,s.status,s.json?.authenticated===true?'authenticated':'NOT');
 if(!/^[a-f0-9]{64}$/.test(csrf||''))throw Error('no session');
 const get=input=>call(CASES+'?'+new URLSearchParams(input),{csrf});
 const daily=await get({tenantId:TENANT,action:'daily-list'});
 const prev=await get({tenantId:TENANT,action:'finance-previo-list'});
 console.log('HTTP daily-list',daily.status,'finance-previo-list',prev.status,'previoReason',prev.json?.result?.reason||null);
 const list=Array.isArray(daily.json?.result)?daily.json.result:[];
 const cats={};for(const r of list)cats[r.category]=(cats[r.category]||0)+1;
 console.log('DAILY',list.length,'cases; categories',JSON.stringify(cats));
 const local=list.filter(r=>r?.kind==='test-mailbox'&&r.summary?.finance);
 const rows=mergeFinance(local,prev.json?.result?.items||[]),now=Date.now();
 const tot=financeTotals(rows,now);
 for(const g of Object.keys(GROUPS))console.log('GROUP',GROUPS[g].label,JSON.stringify(tot[g]));
 for(const row of rows){
  const sm=row.summary||{},f=sm.finance||{},g=financeGroup(row,now);
  console.log('ROW',JSON.stringify({group:g?GROUPS[g].label:'(nem jelenik meg)',source:SOURCES[row.source]||row.source,channel:row.channel||null,ref:f.reference||null,
   unit:sm.unit||null,arrival:sm.arrival||null,departure:sm.departure||null,booking:sm.booking||null,previoState:row.previoState||row.previo?.state||null,
   deposit:f.amount??null,deadlineUtc:f.deadlineUtc||null,receivedOn:f.receivedOn||null,price:row.previo?.price??null,optionExpired:previoOptionExpired(row,now),
   payment:row.previo?paymentText(row.previo.payment):null}));
 }
 const out=await call(SESSION,{method:'POST',csrf,body:{action:'logout'}});console.log('LOGOUT',out.status);
 console.log('BLOCKED',JSON.stringify(blocked));
}finally{await browser.close();}
