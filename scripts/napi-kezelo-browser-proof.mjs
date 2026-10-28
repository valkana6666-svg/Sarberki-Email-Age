// Isolated, fully synthetic UI proof. No real account, database, mail or PMS.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const origin='https://leafy-chimera-2403e5.netlify.app',root=resolve(process.env.NAPI_PROOF_ROOT||'dist');
const report={syntheticOnly:true,externalRequests:0,bookingCreated:false,emailSent:false,actualIPhoneVerified:false,checks:[]};
let browser;
const check=(engine,name)=>report.checks.push({engine,test:name,result:'PASS'});
try{
 for(const [engine,launcher] of [['chromium',chromium],['webkit',webkit]]){
  browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const state={authenticated:false,revision:1,allowRead:true,caseMethods:[],previewRevisions:[]};
  const session={authenticated:true,tenantId:'sarberki-test',csrfToken:'a'.repeat(64),expiresAt:new Date(Date.now()+3600000).toISOString()};
  await context.addInitScript(()=>{
   const timer=window.setTimeout;window.setTimeout=(fn,ms,...rest)=>timer(fn,ms===30000?1500:ms,...rest);
  });
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==origin){report.externalRequests++;return route.abort();}
   const json=(status,body)=>route.fulfill({status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
   if(url.pathname==='/.netlify/functions/operator-session'){
    if(request.method()==='POST'){
     const body=request.postDataJSON();
     if(body?.action==='login')state.authenticated=true;
     else if(body?.action==='logout'){state.authenticated=false;return json(200,{authenticated:false});}
     else return json(400,{error:'INVALID_INPUT'});
    }
    return state.authenticated?json(200,session):json(401,{error:'AUTH_REQUIRED'});
   }
   if(url.pathname==='/.netlify/functions/booking-cases'){
    state.caseMethods.push(request.method());
    if(!state.authenticated)return json(401,{error:'AUTH_REQUIRED'});
    if(!state.allowRead)return json(403,{error:'FORBIDDEN'});
    if(request.method()!=='GET'||url.searchParams.get('tenantId')!=='sarberki-test')return json(403,{error:'FORBIDDEN'});
    if(url.searchParams.get('action')==='preview-draft'){
     state.previewRevisions.push(Number(url.searchParams.get('expectedRevision')));
     if(Number(url.searchParams.get('expectedRevision'))!==state.revision)return json(409,{error:'CASE_CONFLICT'});
     return json(200,{result:{caseId:'case-synthetic',revision:state.revision,persisted:false,approval:'pending',text:'SYNTHETIC_DRAFT_MUST_NOT_DISPLAY',
     decision:{facts:{dates:{arrival:'2026-11-20',departure:'2026-11-22'},adults:null,children:0,guests:null,child_ages:[],language:'hu'},missing:['adults'],contradictions:[],capacity:{verified:false,status:'UNKNOWN'},pricing:{verified:false},safety:{emailSent:false,bookingCreated:false,approval:'pending'}},
     readOnlyFreshness:{verified:true,syntheticOnly:true,source:'stored-synthetic-case',tenantId:'sarberki-test',caseId:'case-synthetic',revision:state.revision,checkedAt:new Date().toISOString()}}});
    }
    return json(200,{result:[{tenantId:'sarberki-test',caseId:'case-synthetic',revision:state.revision}]});
   }
   if(request.method()!=='GET')return route.abort();
   let path=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
   if(!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:mjs|html|webmanifest|png|svg|css)$/.test(path))return route.abort();
   const file=resolve(root,'.'+path);if(!file.startsWith(root+sep))return route.abort();
   try{const type=path.endsWith('.mjs')?'text/javascript; charset=utf-8':path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':'application/manifest+json';
    return route.fulfill({status:200,headers:{'Content-Type':type,'Cache-Control':'no-store'},body:readFileSync(file)});
   }catch{return route.fulfill({status:404,body:''});}
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/napi-kezelo/');
  await page.locator('#session-status').filter({hasText:'bejelentkezés'}).waitFor();
  assert.equal(await page.locator('#load-cases').isDisabled(),true);
  assert.equal(await page.locator('nav button').count(),4);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByRole('button',{name:/Jóváhagyásra vár/}).click();
  assert.equal(await page.locator('#section-heading').innerText(),'Jóváhagyásra vár');
  assert.match(await page.locator('.section-card').innerText(),/még nem érhető el/);
  check(engine,'navigation-no-fabricated-category-state');
  await page.locator('#email').fill('reader@synthetic.invalid');await page.locator('#password').fill('SYNTHETIC_PASSWORD_ONLY');
  await page.locator('#login button').click();await page.locator('#session-status').filter({hasText:'Bejelentkezve'}).waitFor();
  assert.equal(await page.locator('#password').inputValue(),'');
  await page.locator('#load-cases').click();await page.locator('#case-list button').waitFor();
  assert.match(await page.locator('#list-status').innerText(),/nem szűrik/);
  // The other surface changes the synthetic backing revision after listing.
  // Opening must re-read the shared current revision before requesting preview.
  state.revision=2;
  await page.locator('#case-list button').click();await page.locator('#detail-status').filter({hasText:'Ellenőrzött olvasói előnézet'}).waitFor();
  assert.deepEqual(state.previewRevisions,[2]);
  assert.match(await page.locator('#detail-summary').innerText(),/felnőtt/);
  assert.match(await page.locator('#detail-capacity').innerText(),/NEM IGAZOLT/);
  assert.doesNotMatch(await page.locator('#detail-draft').innerText(),/SYNTHETIC_DRAFT_MUST_NOT_DISPLAY/);
  assert.equal(await page.locator('.unavailable-actions button:disabled').count(),3);
  assert.match(await page.locator('#detail-link').getAttribute('href'),/caseId=case-synthetic/);
  check(engine,'synthetic-cookie-reader-no-unauthorized-actions');
  await page.locator('#list-status').filter({hasText:'frissessége nem igazolt'}).waitFor({timeout:5000});
  assert.equal(await page.locator('#case-detail').isHidden(),true);assert.equal(await page.locator('#case-list li').count(),0);
  check(engine,'stale-data-cleared');
  state.revision=3;await page.locator('#load-cases').click();await page.locator('#case-list button').waitFor();
  await page.locator('#case-list button').click();await page.locator('#detail-status').filter({hasText:'Ellenőrzött olvasói előnézet'}).waitFor();
  assert.deepEqual(state.previewRevisions,[2,3]);
  check(engine,'reloads-synthetic-new-revision');
  await page.reload();await page.locator('#session-status').filter({hasText:'Bejelentkezve'}).waitFor();
  assert.equal(await page.locator('#case-list li').count(),0);assert.equal(await page.locator('#case-detail').isHidden(),true);
  state.allowRead=false;await page.locator('#load-cases').click();await page.locator('#session-status').filter({hasText:'jogosultság'}).waitFor();
  assert.equal(await page.locator('#case-list li').count(),0);assert.equal(await page.locator('#case-detail').isHidden(),true);
  assert.ok(state.caseMethods.every(method=>method==='GET'));
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  assert.deepEqual(errors,[]);check(engine,'reload-denied-reader-no-cache-or-writes');
  await page.goto(origin+'/index.html');assert.equal(await page.locator('body').count(),1);
  check(engine,'existing-test-page-still-served');
  await context.close();await browser.close();browser=null;
 }
 assert.equal(report.externalRequests,0);report.result='PASS';
}catch(error){report.result='FAIL';report.error=String(error?.stack||error);process.exitCode=1;}
finally{if(browser)await browser.close();mkdirSync('/tmp/sarberki-daily-proof',{recursive:true});writeFileSync('/tmp/sarberki-daily-proof/DAILY-PROOF.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
