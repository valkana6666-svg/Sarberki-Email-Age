// LIVE-READONLY-SMOKE: write-free live check of the guarded TEST site (leafy-chimera-2403e5) with the real
// Writer/Approver test accounts. Only session login/logout is posted; every booking-cases request is a GET,
// any other method or host is aborted. Credentials come from SARBERKI_TEST_{WRITER,APPROVER}_{EMAIL,PASSWORD}
// and never reach the output: cookies stay in memory, case text is not printed, and the final report is
// checked for credential values before it is written. Exit code 0 only when every check passed.
// Usage: CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/live-test-readonly-smoke.mjs
import {chromium} from 'playwright';

const ORIGIN='https://leafy-chimera-2403e5.netlify.app',TENANT='sarberki-test';
const SESSION='/.netlify/functions/operator-session',CASES='/.netlify/functions/booking-cases';
const ROLES=['WRITER','APPROVER'];
const cred=role=>({email:process.env[`SARBERKI_TEST_${role}_EMAIL`],password:process.env[`SARBERKI_TEST_${role}_PASSWORD`]});
const missing=ROLES.filter(role=>!cred(role).email||!cred(role).password);
if(missing.length){console.error('MISSING_ENV '+missing.join(','));process.exit(2);}

const report={startedAt:new Date().toISOString(),origin:ORIGIN,writes:'session login/logout only',checks:[],blocked:[]};
const check=(name,ok,detail={})=>report.checks.push({name,result:ok?'PASS':'FAIL',...detail});
const browser=await chromium.launch({
 ...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),
 ...(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY}}:{})});

async function page(state){
 const context=await browser.newContext({serviceWorkers:'block',...(state?{storageState:state}:{})});
 await context.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  const allowed=url.origin===ORIGIN&&(url.pathname===SESSION&&['GET','POST'].includes(request.method())||
   url.pathname===CASES&&request.method()==='GET'||
   (!url.pathname.startsWith('/.netlify/')||url.pathname.startsWith('/.netlify/scripts/'))&&request.method()==='GET');
  // External page assets (e.g. the Google sign-in script) are aborted silently; a blocked write or
  // same-origin API call is recorded and fails the run.
  if(!allowed){if(url.origin===ORIGIN||request.method()!=='GET')report.blocked.push(request.method()+' '+url.host+url.pathname);return route.abort();}
  return route.continue();
 });
 const p=await context.newPage();await p.goto(ORIGIN+'/napi-kezelo/',{waitUntil:'domcontentloaded'});
 return {context,page:p};
}
const call=(p,path,{method='GET',csrf=null,operator=true,body}={})=>p.evaluate(async([path,method,csrf,operator,body])=>{
 const headers={'Content-Type':'application/json',...(operator?{'X-Sarberki-Operator':'1'}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})};
 const response=await fetch(path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
 let json=null;try{json=await response.json();}catch{}
 return {status:response.status,json};
},[path,method,csrf,operator,body]);
const casesGet=(p,input,options)=>call(p,CASES+'?'+new URLSearchParams(input),options);
async function login(role){
 const s=await page();const {email,password}=cred(role);
 const res=await call(s.page,SESSION,{method:'POST',body:{action:'login',email,password}});
 const session=await call(s.page,SESSION);
 s.csrf=session.json?.csrfToken;
 check(role+' login and session',res.status===200&&session.status===200&&session.json?.authenticated===true&&
  session.json?.tenantId===TENANT&&/^[a-f0-9]{64}$/.test(s.csrf||''),{status:[res.status,session.status]});
 return s;
}

try{
 const health=await (await fetch(ORIGIN+'/api/health')).json();
 report.deployedCommit=health.deployedCommit;
 check('health: TEST channel, no auto send/booking',health.ok===true&&health.channel==='gmail-test-subject-allowlist'&&
  health.autoSend!==true&&health.autoBookingModification!==true&&/^[a-f0-9]{40}$/.test(health.deployedCommit||''));

 const anon=await page();
 const anonList=await casesGet(anon.page,{tenantId:TENANT,action:'daily-list'});
 check('anonymous daily-list refused',anonList.status===401,{status:anonList.status});
 const anonSession=await call(anon.page,SESSION);
 check('anonymous session refused',anonSession.status===401,{status:anonSession.status});
 await anon.context.close();

 const sessions={};
 for(const role of ROLES)sessions[role]=await login(role);
 const w=sessions.WRITER,a=sessions.APPROVER;
 check('sessions have distinct CSRF tokens',w.csrf!==a.csrf);

 const list=await casesGet(w.page,{tenantId:TENANT,action:'daily-list'},{csrf:w.csrf});
 const rows=Array.isArray(list.json?.result)?list.json.result:[];
 const mailbox=rows.filter(row=>row.kind==='test-mailbox');
 check('writer daily-list',list.status===200&&rows.length>0&&rows.every(row=>row.tenantId===TENANT),{status:list.status,rows:rows.length,testMailbox:mailbox.length});
 report.testMailboxCases=mailbox.map(row=>({caseId:row.caseId,revision:row.revision,category:row.category}));

 for(const row of mailbox){
  const input={tenantId:TENANT,caseId:row.caseId,action:'test-mailbox-record'};
  const byWriter=await casesGet(w.page,input,{csrf:w.csrf}),byApprover=await casesGet(a.page,input,{csrf:a.csrf});
  const rw=byWriter.json?.result,ra=byApprover.json?.result;
  const shape=r=>r?.caseId===row.caseId&&r.revision===row.revision&&/^[a-f0-9]{64}$/.test(r.draft?.hash||'')&&
   Array.isArray(r.decisions)&&r.internalApproval?.sendAllowed!==true&&r.internalApproval?.bookingAllowed!==true;
  check('record '+row.caseId,byWriter.status===200&&byApprover.status===200&&shape(rw)&&shape(ra)&&rw.approval===ra.approval&&rw.draft.hash===ra.draft.hash,
   {revision:rw?.revision,approval:rw?.approval});
  check('writer cannot decide '+row.caseId,rw?.canDecide===false);
  if(ra?.approval!=='pending')check('no decision outside pending '+row.caseId,ra?.canDecide===false);
 }

 const probe={tenantId:TENANT,action:'daily-list'};
 for(const [name,options] of [['missing CSRF',{}],['other session CSRF',{csrf:a.csrf}],['random CSRF',{csrf:'ab'.repeat(32)}],['no operator header',{csrf:w.csrf,operator:false}]]){
  const res=await casesGet(w.page,probe,options);check('CSRF refused: '+name,res.status===403,{status:res.status});
 }
 const foreign=await casesGet(w.page,{tenantId:'other-tenant',action:'daily-list'},{csrf:w.csrf});
 check('foreign tenant refused',foreign.status===403,{status:foreign.status});

 const state=await w.context.storageState();
 for(const role of ROLES){
  const s=sessions[role],out=await call(s.page,SESSION,{method:'POST',csrf:s.csrf,body:{action:'logout'}});
  const after=await casesGet(s.page,probe,{csrf:s.csrf});
  check(role+' logout ends access',out.status===200&&after.status===401,{status:[out.status,after.status]});
 }
 const replay=await page(state);
 const replayed=await casesGet(replay.page,probe,{csrf:w.csrf});
 check('pre-logout cookie replay refused',replayed.status===401,{status:replayed.status});
 await replay.context.close();
}catch(error){check('run completed',false,{error:error.message});}
finally{await browser.close();}

report.endedAt=new Date().toISOString();
report.passed=report.checks.filter(c=>c.result==='PASS').length;report.failed=report.checks.length-report.passed;
const text=JSON.stringify(report,null,1);
for(const role of ROLES)for(const value of Object.values(cred(role)))if(text.includes(value)){console.error('SECRET_IN_OUTPUT');process.exit(3);}
console.log(text);
process.exit(report.failed===0&&report.blocked.length===0?0:1);
