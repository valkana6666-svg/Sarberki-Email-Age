import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createCaseHandler} from '../netlify/functions/booking-cases.mjs';
import {createOperatorSessionHandler} from '../netlify/functions/operator-session.mjs';

// Real booking-cases handler + operator cookie session + PostgreSQL semantics (PGlite) on the hosted TEST
// layer stack. Supabase Auth/REST and the Gmail API are synthetic; fictional data only; no send.
const origin='https://leafy-chimera-2403e5.netlify.app',project='https://mojnqizbcaczstguikpv.supabase.co',KEY='a1'.repeat(32);
const actors={writer:'11111111-1111-4111-8111-111111111111',reader:'22222222-2222-4222-8222-222222222222'};
const sessions={writer:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',reader:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};
const baseEnv={URL:origin,SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_ACCEPTANCE_20261101',CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',
 CASE_APPROVAL_ENABLED:'sarberki-test-synthetic-only',ISOLATED_APPROVAL_ATTESTATION_KEY:KEY,SARBERKI_OPERATOR_SESSION_KEY:'b2'.repeat(32)};
const enabledEnv={...baseEnv,CASE_TEST_MAILBOX_INGEST_ENABLED:'sarberki-test-fictional-only'};
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const GMAIL_TOKEN='ya29.SYNTHETIC_TEST_ONLY_TOKEN_0123456789',ID='18f2a0b1c2d3e4f5',b64=t=>Buffer.from(t).toString('base64url');
const TEXT='Jó napot! Deluxe faházat szeretnénk foglalni 2027-05-14 és 2027-05-16 között 2 felnőtt, 0 gyermek számára.';

test('test-mailbox-ingest: default off; only a cookie Writer with CSRF and a Gmail token header can store a marked fictional test mail',async t=>{
 const db=new PGlite(),tokens=new Map(),cookies=new Map(),csrf=new Map();let gmailCalls=0,subject='Sárberki élő teszt – AI előnézet';
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  await db.query("select set_config('sarberki.approval_install_project_ref','mojnqizbcaczstguikpv',false),set_config('sarberki.approval_backup_sha256',$1,false),set_config('sarberki.receipt_install_project_ref','mojnqizbcaczstguikpv',false),set_config('sarberki.receipt_backup_sha256',$1,false),set_config('sarberki.tm_install_project_ref','mojnqizbcaczstguikpv',false),set_config('sarberki.tm_backup_sha256',$1,false)",['b'.repeat(64)]);
  await db.exec("insert into sc_tenants values('sarberki-test','Fictional',true),('demo-test','Other',true)");
  for(const file of ['deployment/cloud-approval/install.sql','deployment/cloud-approval/separate-approver-permission.sql','deployment/exact-receipt/install.sql'])await db.exec(await read(file));
  await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[KEY]);
  await db.exec(await read('deployment/test-mailbox/install.sql'));await db.exec('update sc_test_mailbox_config set enabled=true');
  for(const [role,id] of Object.entries(actors)){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions[role],id]);
   await db.query("insert into sc_memberships values('sarberki-test',$1,true,$2,false)",[id,role==='writer']);}
  const fetchImpl=async(raw,options={})=>{
   const url=new URL(raw);
   if(url.origin==='https://gmail.googleapis.com'){
    gmailCalls++;assert.equal(options.headers.Authorization,'Bearer '+GMAIL_TOKEN);
    if(url.pathname.endsWith('/profile'))return new Response(JSON.stringify({emailAddress:'sarberkiprojecttest@gmail.com'}));
    return new Response(JSON.stringify({id:ID,threadId:ID,labelIds:['INBOX'],internalDate:String(Date.parse('2026-10-31T10:00:00Z')),payload:{mimeType:'multipart/alternative',
     headers:[{name:'Subject',value:subject},{name:'From',value:'Teszt <sender@example.test>'},{name:'To',value:'sarberkiprojecttest@gmail.com'},{name:'Message-ID',value:'<f1@example.test>'}],
     parts:[{mimeType:'text/plain',body:{data:b64(TEXT)}}]}}));
   }
   assert.equal(url.origin,project,'all Auth/REST is synthetic');
   if(url.pathname==='/auth/v1/token'){
    const body=JSON.parse(options.body),role=url.searchParams.get('grant_type')==='password'?body.email.split('@')[0]:body.refresh_token.replace('synthetic_refresh_','');
    const claims={sub:actors[role],role:'authenticated',iss:project+'/auth/v1',exp:Math.floor(Date.now()/1000)+3600,session_id:sessions[role]};
    const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.synthetic_signature';tokens.set(token,{role,claims});
    return {ok:true,json:async()=>({access_token:token,refresh_token:'synthetic_refresh_'+role,user:{id:actors[role]}})};
   }
   const {role,claims}=tokens.get(options.headers.Authorization?.slice(7))||{};assert.ok(role);
   if(url.pathname==='/auth/v1/user')return {ok:true,json:async()=>({id:actors[role]})};
   await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);
   try{
    const body=options.body?JSON.parse(options.body):null;let result;
    if(url.pathname.endsWith('/sc_memberships'))result=(await db.query('select * from sc_memberships where user_id=$1',[actors[role]])).rows;
    else if(url.pathname.endsWith('/rpc/sc_tm_create'))result=(await db.query('select sc_tm_create($1,$2,$3,$4) r',[body.p_tenant,body.p_case,JSON.stringify(body.p_data),JSON.stringify(body.p_proof)])).rows[0].r;
    else throw Object.assign(Error('unexpected '+url.pathname),{code:'XX'});
    return {ok:true,json:async()=>result};
   }catch(error){return {ok:false,status:error.code==='42501'?403:400};}finally{await db.exec('reset role');}
  };
  const call=async(role,env,input,{headers={},status,method='POST'}={})=>{
   const event={httpMethod:method,headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','x-sarberki-operator':'1','Content-Type':'application/json',
    ...(cookies.has(role)?{cookie:cookies.get(role)}:{}),...(csrf.has(role)?{'x-csrf-token':csrf.get(role)}:{}),...headers},body:JSON.stringify(input),queryStringParameters:{}};
   const response=await createCaseHandler({env,fetchImpl})(event);if(response.headers['Set-Cookie'])cookies.set(role,response.headers['Set-Cookie'].split(';')[0]);
   assert.doesNotMatch(response.body,new RegExp(GMAIL_TOKEN.replace('.','\\.')),'token never echoed');
   if(status!==undefined)assert.equal(response.statusCode,status,response.body);return {status:response.statusCode,json:JSON.parse(response.body)};
  };
  for(const role of Object.keys(actors)){const event={httpMethod:'POST',headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','x-sarberki-operator':'1','Content-Type':'application/json'},body:JSON.stringify({action:'login',email:role+'@synthetic.invalid',password:'SYNTHETIC_TEST_PASSWORD'})};
   const r=await createOperatorSessionHandler({env:baseEnv,fetchImpl})(event);cookies.set(role,r.headers['Set-Cookie'].split(';')[0]);csrf.set(role,JSON.parse(r.body).csrfToken);}
  const input={tenantId:'sarberki-test',action:'test-mailbox-ingest',messageId:ID},gmail={'x-sarberki-gmail-token':GMAIL_TOKEN};
  const cases=async()=>(await db.query('select count(*)::int n from sc_cases')).rows[0].n;

  await t.test('disabled by default: no Gmail read, no write',async()=>{
   assert.deepEqual((await call('writer',baseEnv,input,{headers:gmail,status:403})).json,{error:'FORBIDDEN'});
   assert.equal(gmailCalls,0);assert.equal(await cases(),0);
  });
  await t.test('Reader, missing CSRF, foreign tenant, extra fields, GET and missing/duplicate Gmail token are refused before any Gmail read',async()=>{
   await call('reader',enabledEnv,input,{headers:gmail,status:403});
   await call('writer',enabledEnv,input,{headers:{...gmail,'x-csrf-token':''},status:403});
   await call('writer',enabledEnv,{...input,tenantId:'demo-test'},{headers:gmail,status:403});
   await call('writer',enabledEnv,{...input,caseId:'x'},{headers:gmail,status:403});
   await call('writer',enabledEnv,{...input,messageId:'NOT-HEX'},{headers:gmail,status:400});
   await call('writer',enabledEnv,input,{headers:{},status:401});
   await call('writer',enabledEnv,input,{headers:{'x-sarberki-gmail-token':GMAIL_TOKEN,'X-Sarberki-Gmail-Token':GMAIL_TOKEN},status:401});
   assert.equal(gmailCalls,0);assert.equal(await cases(),0);
  });
  await t.test('Bearer (non-cookie) requests cannot use the action',async()=>{
   // Even with a valid Writer cookie and CSRF, an Authorization header switches off cookie mode and must not reach Gmail.
   const response=await createCaseHandler({env:enabledEnv,fetchImpl})({httpMethod:'POST',headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','x-sarberki-operator':'1',
    'Content-Type':'application/json',cookie:cookies.get('writer'),'x-csrf-token':csrf.get('writer'),authorization:'Bearer '+'x'.repeat(40),...gmail},body:JSON.stringify(input),queryStringParameters:{}});
   assert.equal(response.statusCode,403);assert.equal(gmailCalls,0);
  });
  await t.test('an unmarked (Re:) message is refused with a fixed code and nothing is stored',async()=>{
   subject='Re: Sárberki élő teszt';
   assert.deepEqual((await call('writer',enabledEnv,input,{headers:gmail,status:422})).json,{error:'NOT_MARKED_TEST_MESSAGE'});
   subject='Sárberki élő teszt – AI előnézet';assert.equal(await cases(),0);
  });
  await t.test('the database switch still governs: off -> FORBIDDEN',async()=>{
   await db.exec('update sc_test_mailbox_config set enabled=false');
   await call('writer',enabledEnv,input,{headers:gmail,status:403});await db.exec('update sc_test_mailbox_config set enabled=true');
   assert.equal(await cases(),0);
  });
  await t.test('Writer stores the server-read, attested mail as one pending test-mailbox case; duplicate is refused',async()=>{
   const ok=await call('writer',enabledEnv,input,{headers:gmail,status:200});
   assert.deepEqual(ok.json,{result:{caseId:'tm-'+ID,revision:1}});
   const data=(await db.query('select data from sc_cases where case_id=$1',['tm-'+ID])).rows[0].data;
   assert.equal(data.state.approval,'pending');assert.equal(data.drafts[0].createdBy,actors.writer);assert.equal(data.messages[0].text,TEXT);
   for(const secret of [GMAIL_TOKEN,KEY])assert.equal(JSON.stringify(data).includes(secret),false);
   assert.deepEqual((await db.query("select kind from sc_audit where case_id=$1",['tm-'+ID])).rows.map(r=>r.kind),['tm_create']);
   assert.deepEqual((await call('writer',enabledEnv,input,{headers:gmail,status:503})).json,{error:'STORAGE_FAILURE'});
   assert.equal(await cases(),1);
  });
 }finally{await db.close();}
});
