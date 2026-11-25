// Owner 2026-11-25: browser walk-through of the finance view (Pénzügyi kezelő) on an emulated iPhone.
// The REAL built pages run on the TEST origin, but every request is answered locally: static files from dist/,
// the operator session and booking-cases with FICTIONAL rows. No network, no real login, no real data.
// Usage: COMMIT_REF=<sha> node scripts/build-static.cjs && node scripts/penzugy-browser-proof.mjs [screenshot-dir]
import {chromium,devices} from 'playwright';
import {readFileSync,existsSync} from 'node:fs';
import {join,extname} from 'node:path';
const ORIGIN='https://leafy-chimera-2403e5.netlify.app',DIST='dist',shots=process.argv[2]||null;
const NOW=Date.now(),H=3600000,iso=ms=>new Date(ms).toISOString();
const fin=(deadline,extra={})=>({amount:90750,deadlineUtc:deadline,receivedOn:null,reference:'V2-1',reminders:{first:false,final:false},...extra});
const row=(id,booking,finance,name)=>({tenantId:'sarberki-test',caseId:'tm-'+id.repeat(16),revision:1,category:booking==='deposit_received'?'closed':'progress',kind:'test-mailbox',approval:null,
 summary:{name,email:null,channel:'chat',unit:'Deluxe',arrival:'2027-06-10',departure:'2027-06-13',guests:2,receivedAt:iso(NOW-5*24*H),booking,depositDue:booking==='finalized'?finance.deadlineUtc:null,finance}});
const ROWS=[row('a','finalized',fin(iso(NOW-3*H)),'Teszt Lejárt'),row('b','finalized',fin(iso(NOW+20*H),{reminders:{first:true,final:false}}),'Teszt Hamarosan'),
 row('c','finalized',fin(iso(NOW+5*24*H),{reference:'V2-777',amount:120000}),'Teszt Várakozó'),row('d','deposit_received',fin(null,{receivedOn:'2026-11-24'}),'Teszt Beérkezett'),
 {...row('e',null,null,'Teszt Nyitott'),category:'incoming'}];
const MIME={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const results=[];const check=(name,ok,detail='')=>{results.push({name,ok:!!ok});console.log((ok?'PASS ':'FAIL ')+name+(detail&&!ok?' – '+detail:''));};
let signedIn=false,expire=false,posts=0;const csrf='a'.repeat(64);
const browser=await chromium.launch(existsSync('/opt/pw-browsers/chromium')?{executablePath:'/opt/pw-browsers/chromium'}:{});const ctx=await browser.newContext({...devices['iPhone 13']});
await ctx.route('**/*',async route=>{
 const u=new URL(route.request().url()),m=route.request().method();
 if(u.origin!==ORIGIN)return route.abort();
 if(u.pathname==='/.netlify/functions/operator-session'){
  if(m==='POST'){const b=JSON.parse(route.request().postData()||'{}');if(b.action==='login')signedIn=true;if(b.action==='logout')signedIn=false;}
  return signedIn?route.fulfill({json:{authenticated:true,tenantId:'sarberki-test',csrfToken:csrf,expiresAt:iso(NOW+3*H)}}):route.fulfill({status:401,json:{error:'AUTH_REQUIRED'}});
 }
 if(u.pathname==='/.netlify/functions/booking-cases'){
  if(m!=='GET'){posts++;return route.fulfill({status:403,json:{error:'FORBIDDEN'}});}
  if(expire)return route.fulfill({status:401,json:{error:'AUTH_REQUIRED'}});
  const a=u.searchParams.get('action');
  if(a==='daily-list')return route.fulfill({json:{result:ROWS}});
  if(a==='test-mailbox-payment-hint'){const c=u.searchParams.get('caseId');
   return route.fulfill({json:{result:{caseId:c,line:c==='tm-'+'c'.repeat(16)?'💰 Valószínűleg megjött a foglaló: 120 000 Ft, 2026. 11. 24., számla #11. Ha egyezik, nyomd meg: „Foglaló beérkezett”.':'💰 A Previóban még nincs a foglalóval egyező befizetés.'}}});}
  return route.fulfill({status:403,json:{error:'FORBIDDEN'}});
 }
 let file=join(DIST,decodeURIComponent(u.pathname));if(u.pathname.endsWith('/'))file=join(file,'index.html');
 if(!existsSync(file))return route.fulfill({status:404,body:''});
 return route.fulfill({body:readFileSync(file),contentType:MIME[extname(file)]||'application/octet-stream'});
});
const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e)));
const text=sel=>p.locator(sel).innerText();
const names=async()=>p.locator('#finance-list li strong').allInnerTexts();

await p.goto(ORIGIN+'/napi-kezelo/penzugy.html');await p.waitForTimeout(400);
check('1 signed out: login form visible, no rows',await p.locator('#login').isVisible()&&(await names()).length===0);
await p.fill('#email','teszt@example.test');await p.fill('#password','x');await p.click('#login button[type=submit]');await p.waitForTimeout(700);
check('2 sign-in: login form hidden, signed in',!(await p.locator('#login').isVisible())&&/Bejelentkezve/.test(await text('#session-status')));
const n=await names();
check('3 groups in order (overdue, soon, waiting, received); open case without booking left out',n.map(x=>x.split(' · ')[0]).join('|')==='Teszt Lejárt|Teszt Hamarosan|Teszt Várakozó|Teszt Beérkezett',n.join(' / '));
check('4 tile totals (count + amount)',/1 db · 90 750 Ft/.test(await text('[data-group="overdue"] .number'))&&/1 db · 120 000 Ft/.test(await text('[data-group="waiting"] .number')));
const all=await text('#finance-list');
check('5 row facts: deadline passed, hours left, reminder state, received day',/⚠️ Határidő lejárt: .*\(3 órája\)/.test(all)&&/⏳ Határidő: .*\(20 óra múlva\)/.test(all)&&/Emlékeztető: első elküldve/.test(all)&&/✅ Beérkezett: 2026\. 11\. 24\./.test(all));
check('6 payment suggestion on the matching row only',/Teszt Várakozó[\s\S]*💰 Valószínűleg megjött a foglaló: 120 000 Ft/.test(all)&&(all.match(/Valószínűleg megjött/g)||[]).length===1);
await p.click('[data-group="overdue"]');await p.waitForTimeout(100);
check('7 filter: Lejárt shows only the overdue row',(await names()).join('|')==='Teszt Lejárt · Deluxe · 2027. 06. 10. – 2027. 06. 13.');
await p.click('[data-group="overdue"]');await p.fill('#search','v2-777');await p.waitForTimeout(100);
check('8 search by Previo number',(await names()).length===1&&(await names())[0].startsWith('Teszt Várakozó'));
await p.fill('#search','');
const href=await p.locator('#case-'+'tm-'+'a'.repeat(16)+' a').getAttribute('href');
check('9 row link opens the case in the daily view (deposit button lives there)',href==='./?case=tm-'+'a'.repeat(16));
const m1=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
check('10 iPhone width: no horizontal scroll',m1.sw<=m1.cw,JSON.stringify(m1));
if(shots)await p.screenshot({path:join(shots,'penzugy-iphone.png'),fullPage:true});
check('11 finance page sent no write request',posts===0,'posts='+posts);
await p.goto(ORIGIN+'/napi-kezelo/penzugy.html?case=tm-'+'b'.repeat(16));await p.waitForTimeout(700);
check('12 Pushover deep link: the case is highlighted, session kept',await p.locator('#case-tm-'+'b'.repeat(16)).evaluate(e=>e.classList.contains('fin-linked'))&&!(await p.locator('#login').isVisible()));
await p.click('nav[aria-label="Felületek"] a:has-text("Napi")');await p.waitForLoadState();
check('13 nav → daily view',p.url()===ORIGIN+'/napi-kezelo/'&&/Napi kezelő/.test(await text('h1')));
await p.click('nav[aria-label="Felületek"] a:has-text("Chatbot")');await p.waitForLoadState();
check('14 nav → chatbot',p.url()===ORIGIN+'/sarberki-chatbot-project/');
await p.click('nav[aria-label="Felületek"] a:has-text("Pénzügy")');await p.waitForLoadState();await p.waitForTimeout(600);
check('15 nav → finance; still signed in, list reloaded',p.url()===ORIGIN+'/napi-kezelo/penzugy.html'&&(await names()).length===4);
expire=true;await p.click('#reload');await p.waitForTimeout(500);
check('16 expired session: list cleared, sign-in asked again',(await names()).length===0&&/bejelentkezés szükséges/i.test(await text('#session-status')));
check('17 no page errors',errors.length===0,errors.join(' | '));
await browser.close();
const failed=results.filter(r=>!r.ok).length;console.log(`\n${results.length-failed}/${results.length} PASS`);process.exit(failed?1:0);
