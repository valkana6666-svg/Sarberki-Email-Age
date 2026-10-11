import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

export async function runBrowserApprovalChain({handlerFactory,auth,rest,sql,sign,password,id,approver,call,wt,at,evidence,hash,setCapacity,ready,step}){
 const assets=new Map(['isolated-approval.html','isolated-approval-session.mjs','isolated-approval-panel.mjs','shared-core/case-store-client.mjs','shared-core/isolated-approval-review.mjs'].map(p=>['/'+p,readFileSync(p)]));
 let expiredLogin=false,server,browser,page,origin;
 const unchanged=revision=>{
  assert.equal(sql(`select revision from sc_cases where case_id='${id}';`),String(revision));
  assert.equal(sql(`select data->'state'->>'approval' from sc_cases where case_id='${id}';`),'pending');
  assert.equal(sql("select count(*) from sc_audit where kind='approve_isolated_synthetic';"),'0');
 };
 async function host(port=0){
  const handler=handlerFactory();
  server=createServer(async(req,res)=>{
   const send=(code,body,type='application/json')=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",'X-Content-Type-Options':'nosniff'});res.end(typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body));};
   try{
    const expected='127.0.0.1:'+server.address().port;
    if(req.headers.host!==expected||(req.headers.origin&&req.headers.origin!=='http://'+expected))return send(403,{error:'FORBIDDEN'});
    const u=new URL(req.url,'http://'+expected);
    let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>32768)return send(413,{error:'INVALID_INPUT'});}
    if(req.method==='GET'&&assets.has(u.pathname))return send(200,assets.get(u.pathname),u.pathname.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');
    if(req.method==='GET'&&u.pathname==='/isolated-config')return send(200,{enabled:true,syntheticOnly:true,target:'https://isolated-approval.supabase.co'});
    if(req.method==='POST'&&u.pathname==='/isolated-auth/login'){
     const input=JSON.parse(body);
     if(!/^approval-(operator|writer|foreign)@synthetic\.invalid$/.test(input.email)||typeof input.password!=='string')return send(403,{error:'FORBIDDEN'});
     const r=await fetch(auth+'/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:input.email,password:input.password})});
     if(!r.ok)return send(403,{error:'AUTH_REQUIRED'});
     const result=await r.json();let access_token=result.access_token;
     if(expiredLogin){const claims=JSON.parse(Buffer.from(access_token.split('.')[1],'base64url'));access_token=sign({...claims,exp:Math.floor(Date.now()/1000)-10});}
     return send(200,{access_token}); // No refresh token, password or admin key enters the browser.
    }
    if(u.pathname==='/.netlify/functions/booking-cases'&&['GET','POST'].includes(req.method)){
     const r=await handler({httpMethod:req.method,headers:req.headers,body,queryStringParameters:Object.fromEntries(u.searchParams)});return send(r.statusCode,r.body);
    }
    if(req.method==='GET'&&u.pathname==='/isolated-audit'){
     const caseId=u.searchParams.get('caseId');if(!/^case-[A-Za-z0-9_-]{1,120}$/.test(caseId||''))return send(400,{error:'INVALID_INPUT'});
     const r=await fetch(rest+'/sc_audit?'+new URLSearchParams({tenant_id:'eq.sarberki-test',case_id:'eq.'+caseId,kind:'eq.approve_isolated_synthetic',select:'revision,actor,kind,data_hash'}),{headers:{Authorization:req.headers.authorization||''}});
     return send(r.status,await r.text());
    }
    return send(404,{error:'NOT_FOUND'});
   }catch{return send(503,{error:'SERVICE_UNAVAILABLE'});}
  });
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
 }
 const status=()=>page.locator('#isolated_approval_status');
 async function signIn(role='operator'){
  await page.goto(origin+'/isolated-approval.html');
  await page.locator('#auth_status').filter({hasText:'bejelentkezés szükséges'}).waitFor();
  await page.locator('#email').fill('approval-'+role+'@synthetic.invalid');await page.locator('#password').fill(password);await page.locator('#signin').click();
  await page.locator('#auth_status').filter({hasText:'Hitelesített tesztmunkamenet'}).waitFor();
 }
 async function load(){await page.locator('#isolated_approval_case_id').fill(id);await page.locator('#isolated_approval_load').click();await status().filter({hasText:'Tárolt tervezet betöltve'}).waitFor();}
 async function approve(expected){await page.locator('#isolated_approval_confirm').check();await page.locator('#isolated_approval_submit').click();await status().filter({hasText:expected}).waitFor();}
 try{
  await host();browser=await chromium.launch({headless:true});let context=await browser.newContext();
  const restrict=async ctx=>{await ctx.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());};
  await restrict(context);page=await context.newPage();
  await step('browser_unauthenticated_access_denied',async()=>{
   await page.goto(origin+'/isolated-approval.html');assert.equal(await page.locator('#isolated_approval_load').isDisabled(),true);
   assert.equal(await page.evaluate(async id=>(await fetch('/.netlify/functions/booking-cases?'+new URLSearchParams({tenantId:'sarberki-test',caseId:id}))).status,id),401);unchanged(2);
  });
  await step('direct_operator_rpc_cannot_forge_capacity_or_read_key',async()=>{
   const headers={Authorization:'Bearer '+at,'Content-Type':'application/json'};
   const keyRead=await fetch(rest+'/sc_isolated_approval_key?select=key_hex',{headers});assert.ok([403,404].includes(keyRead.status));
   for(const proof of [evidence,{...evidence,attestation:'0'.repeat(64)}]){const r=await fetch(rest+'/rpc/sc_approve_case',{method:'POST',headers,body:JSON.stringify({p_tenant:'sarberki-test',p_case:id,p_expected:2,p_draft_hash:hash,p_evidence:proof})});assert.equal(r.status,403);}
   unchanged(2);
  });
  await step('browser_writer_cannot_approve',async()=>{await signIn('writer');await load();await approve('FORBIDDEN');unchanged(2);});
  await step('browser_foreign_tenant_cannot_read',async()=>{await signIn('foreign');await page.locator('#isolated_approval_case_id').fill(id);await page.locator('#isolated_approval_load').click();await status().filter({hasText:'FORBIDDEN'}).waitFor();unchanged(2);});
  await step('browser_expired_signed_token_denied',async()=>{expiredLogin=true;await signIn();await page.locator('#isolated_approval_case_id').fill(id);await page.locator('#isolated_approval_load').click();await status().filter({hasText:'FORBIDDEN'}).waitFor();expiredLogin=false;unchanged(2);});
  await step('browser_confirmation_and_session_reset',async()=>{
   await signIn();await load();assert.equal(await page.locator('#isolated_approval_submit').isDisabled(),true);
   await page.locator('#isolated_approval_confirm').check();await page.locator('#logout').click();assert.equal(await page.locator('#isolated_approval_text').inputValue(),'');assert.equal(await page.locator('#isolated_approval_submit').isDisabled(),true);unchanged(2);
  });
  await step('browser_stale_stored_revision_conflict',async()=>{
   await signIn();await load();await call(wt,{action:'review-draft',caseId:id,expectedRevision:2});await approve('CASE_CONFLICT');unchanged(3);
  });
  await step('browser_unknown_capacity_blocks_without_audit',async()=>{await load();setCapacity('unknown');await approve('REVIEW_NOT_READY');setCapacity('available');unchanged(3);});
  await step('browser_audit_failure_rolls_back_approval',async()=>{
   sql("create function block_browser_audit() returns trigger language plpgsql as $$begin if new.kind='approve_isolated_synthetic' then raise exception 'synthetic audit failure';end if;return new;end$$;create trigger block_browser_audit before insert on sc_audit for each row execute function block_browser_audit();");
   await load();await approve('SERVICE_UNAVAILABLE');unchanged(3);sql('drop trigger block_browser_audit on sc_audit;drop function block_browser_audit();');
  });
  let persisted;
  await step('browser_operator_approval_and_authenticated_audit',async()=>{
   await load();await approve('jóváhagyás mentve; új verzió: 4');await page.locator('#readback').click();await page.locator('#readback_status').filter({hasText:'internally_approved'}).waitFor();
   persisted=JSON.parse(await page.locator('#readback_status').innerText());assert.equal(persisted.revision,4);assert.equal(persisted.audit.length,1);assert.equal(persisted.audit[0].actor,approver);assert.equal(persisted.audit[0].revision,4);assert.equal(persisted.serverApproval.reviewedRevision,3);
   assert.equal(sql(`select count(*) from sc_audit a join sc_cases c using(tenant_id,case_id,revision) where a.kind='approve_isolated_synthetic' and a.actor='${approver}' and a.data_hash=encode(sha256(convert_to(c.data::text,'UTF8')),'hex');`),'1');
  });
  await step('browser_api_auth_database_restart_and_readback',async()=>{
   await context.close();const port=server.address().port;await new Promise(resolve=>server.close(resolve));
   execFileSync('docker',['restart',process.env.ISOLATED_APPROVAL_POSTGRES,process.env.ISOLATED_APPROVAL_AUTH,process.env.ISOLATED_APPROVAL_REST],{stdio:['ignore','pipe','pipe']});await ready(auth+'/health');await ready(rest+'/');
   await host(port);context=await browser.newContext();await restrict(context);page=await context.newPage();await signIn();await page.locator('#isolated_approval_case_id').fill(id);await page.locator('#readback').click();await page.locator('#readback_status').filter({hasText:'internally_approved'}).waitFor();
   assert.deepEqual(JSON.parse(await page.locator('#readback_status').innerText()),persisted);
  });
 }finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
