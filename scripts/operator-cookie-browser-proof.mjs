// Real browser cookie/DOM + actual session/case handlers; synthetic Auth/REST
// and Netlify request-event transport. No live Fetch Metadata proof is claimed.
// Every browser URL is intercepted. No cloud account, real password or DB is used.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createOperatorSessionHandler} from '../netlify/functions/operator-session.mjs';
import {createCaseHandler} from '../netlify/functions/booking-cases.mjs';
import {createBookingCaseStore} from '../booking-cases.mjs';
const origin='https://leafy-chimera-2403e5.netlify.app';
const project='https://mojnqizbcaczstguikpv.supabase.co';
const cookieName='__Host-sarberki-operator';
export async function runOperatorCookieBrowserProof({browser,engine,root,report}){
 const state={login:0,refresh:0,caseReads:0,logout:0,revoked:false,http:[]};
 const store=createBookingCaseStore({tenantId:'sarberki-test',id:()=> 'case-synthetic'});
 const data=store.ingest({sender:'guest@synthetic.invalid',text:'Synthetic Deluxe inquiry',message_id:'synthetic-message',thread_id:'synthetic-thread',mailbox_id:'synthetic-box',received_at:new Date().toISOString()},
  {arrival:'2026-11-26',departure:'2026-11-28',adults:'2',children:'0',guests:'2',child_ages:'',unit:'deluxe',units_requested:'1',language:'en'}).bookingCase;
 const env={URL:origin,CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',SUPABASE_URL:project,
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_COOKIE_PROOF',SARBERKI_OPERATOR_SESSION_KEY:randomBytes(32).toString('hex')};
 const json=body=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
 const fetchImpl=async(url,options={})=>{
  assert.equal(new URL(url).origin,project);
  if(url.includes('/auth/v1/token')){
   if(url.includes('grant_type=password')){state.login++;state.revoked=false;}else{state.refresh++;if(state.revoked)return new Response('{}',{status:401});}
   const access='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role:'authenticated',sub:'synthetic-browser-operator',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.synthetic_signature';
   return json({access_token:access,refresh_token:'synthetic_refresh_'+state.login+'_'+state.refresh,user:{id:'synthetic-browser-operator'}});
  }
  if(url.endsWith('/auth/v1/user'))return json({id:'synthetic-browser-operator'});
  if(url.includes('/rest/v1/sc_memberships'))return json([{tenant_id:'sarberki-test',user_id:'synthetic-browser-operator',can_read:true,can_write:false,can_approve:false}]);
  if(url.includes('/rest/v1/sc_cases')){state.caseReads++;const at=new Date().toISOString();return json([{tenant_id:'sarberki-test',case_id:'case-synthetic',revision:1,data,created_at:at,updated_at:at,updated_by:'synthetic-browser-operator'}]);}
  if(url.includes('/auth/v1/logout')){state.logout++;state.revoked=true;return new Response(null,{status:204});}
  throw Error('UNEXPECTED_SYNTHETIC_TRANSPORT');
 };
 const session=createOperatorSessionHandler({env,fetchImpl}),cases=createCaseHandler({env,fetchImpl});
 const install=async context=>{
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==origin){report.externalRequests++;return route.abort();}
   if(url.pathname.startsWith('/.netlify/functions/')){
    const handler=url.pathname==='/.netlify/functions/operator-session'?session:url.pathname==='/.netlify/functions/booking-cases'?cases:null;
    if(!handler)return route.fulfill({status:404,body:'{}'});
    const headers=await request.allHeaders(),frameOrigin=new URL(request.frame().url()).origin;
    assert.equal(frameOrigin,origin);
    // Playwright intercepts before the network stack finalizes Origin/Fetch
    // Metadata. The synthetic Netlify adapter derives absent fields only from
    // the verified initiating frame; existing supplied fields are preserved.
    const eventHeaders={...headers,host:url.host,'sec-fetch-site':headers['sec-fetch-site']??'same-origin',
     ...(request.method()==='POST'&&headers.origin===undefined?{origin:frameOrigin}:{})};
    const event={httpMethod:request.method(),headers:eventHeaders,body:request.postData()||'',queryStringParameters:Object.fromEntries(url.searchParams)};
    const result=await handler(event);
    state.http.push({path:url.pathname,status:result.statusCode,fetchMetadataFromBrowser:headers['sec-fetch-site']!==undefined,originFromBrowser:headers.origin!==undefined,error:JSON.parse(result.body).error||null});
    return route.fulfill({status:result.statusCode,headers:result.headers,body:result.body});
   }
   if(request.method()!=='GET'||!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:mjs|html|webmanifest|png|json)$/.test(url.pathname))return route.fulfill({status:404,body:''});
   const file=resolve(root,'.'+url.pathname);if(!file.startsWith(root+sep))return route.abort();
   try{const type=url.pathname.endsWith('.mjs')?'text/javascript':url.pathname.endsWith('.html')?'text/html':url.pathname.endsWith('.png')?'image/png':'application/json';
    return route.fulfill({status:200,headers:{'Content-Type':type,'Cache-Control':'no-store'},body:readFileSync(file)});
   }catch{return route.fulfill({status:404,body:''});}
  });
 };
 let context,page;
 const open=async()=>{page=await context.newPage();await page.goto(origin+'/sarberki-chatbot-project/index.html');await page.locator('#operator_panel summary').click();};
 const authenticated=()=>page.locator('#operator_status').filter({hasText:'Hitelesített tartós'}).waitFor();
 const login=async()=>{await page.locator('#operator_email').fill('reader@synthetic.invalid');await page.locator('#operator_password').fill('SYNTHETIC_BROWSER_PASSWORD_NOT_A_REAL_CREDENTIAL');await page.locator('#operator_login button').click();await authenticated();};
 try{
  context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await install(context);await open();await login();
  const cookie=(await context.cookies()).find(c=>c.name===cookieName);assert.ok(cookie);assert.equal(cookie.httpOnly,true);assert.equal(cookie.secure,true);assert.equal(cookie.sameSite,'Strict');assert.ok(cookie.expires>Date.now()/1000);
  assert.equal(await page.evaluate(()=>document.cookie.includes('__Host-sarberki-operator')),false);
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.equal(await page.locator('#operator_password').inputValue(),'');
  report.checks.push({engine,test:'persistent-HttpOnly-Secure-Strict-cookie-no-browser-token-storage',result:'PASS',authTransport:'synthetic',netlifyEventTransport:'synthetic'});
  await page.reload();await page.locator('#operator_panel summary').click();await authenticated();assert.equal(state.login,1);
  const savedState=await context.storageState();await context.close();
  context=await browser.newContext({storageState:savedState,viewport:{width:390,height:844},isMobile:true,hasTouch:true});await install(context);await open();await authenticated();assert.equal(state.login,1);assert.ok(state.refresh>=2);
  report.checks.push({engine,test:'reload-and-new-browser-context-restore-without-password',result:'PASS',actualIPhoneVerified:false});
  await page.locator('#server_case_id').fill('case-synthetic');await page.locator('#server_case_load').click();await page.locator('#server_data_status').filter({hasText:'Friss ügyolvasás'}).waitFor();
  assert.ok(state.caseReads>=2);assert.match(await page.locator('#server_operator_hu').inputValue(),/nem igazolt/);assert.equal(await page.locator('#server_guest_draft').inputValue(),'');
  report.checks.push({engine,test:'cookie-Auth-membership-case-GET-common-preview-unknown-evidence-remains-blocked',result:'PASS',restTransport:'synthetic'});
  state.revoked=true;const reads=state.caseReads;
  await page.reload();await page.locator('#operator_panel summary').click();await page.locator('#operator_status').filter({hasText:'Új bejelentkezés szükséges'}).waitFor();
  await page.locator('#server_case_id').fill('case-synthetic');await page.locator('#server_case_load').click();await page.locator('#server_data_status').filter({hasText:'Szerveres adat nem igazolt'}).waitFor();assert.equal(state.caseReads,reads);
  await login();await page.locator('#operator_logout').click();await page.locator('#operator_status').filter({hasText:'Kijelentkezve.'}).waitFor();assert.equal(state.logout,1);
  assert.equal((await context.cookies()).some(c=>c.name===cookieName),false);
  await page.reload();await page.locator('#operator_panel summary').click();await page.locator('#operator_status').filter({hasText:'Új bejelentkezés szükséges'}).waitFor();
  assert.equal(await page.locator('#server_chat_reply').inputValue(),'');
  report.checks.push({engine,test:'revoked-refresh-and-explicit-logout-prevent-readback-and-reopening',result:'PASS'});
 }catch(error){throw Error(error.message+'; synthetic-boundary-status='+JSON.stringify({login:state.login,refresh:state.refresh,http:state.http.slice(-8)}));}
 finally{await context?.close();}
}
