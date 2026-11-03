import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createCaseHandler} from '../netlify/functions/booking-cases.mjs';
import {createOperatorSessionHandler} from '../netlify/functions/operator-session.mjs';

// Real booking-cases handler + operator cookie session + PostgreSQL semantics (PGlite) on the hosted TEST
// layer stack. Supabase Auth/REST and the Gmail API are synthetic; fictional data only; no send.
const origin='https://leafy-chimera-2403e5.netlify.app',project='https://mojnqizbcaczstguikpv.supabase.co',KEY='a1'.repeat(32);
const actors={writer:'11111111-1111-4111-8111-111111111111',reader:'22222222-2222-4222-8222-222222222222',approver:'33333333-3333-4333-8333-333333333333',both:'44444444-4444-4444-8444-444444444444'};
const sessions={writer:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',reader:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',approver:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',both:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'};
const grants={writer:[true,true,false],reader:[true,false,false],approver:[true,false,true],both:[true,true,true]};
const baseEnv={URL:origin,SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_ACCEPTANCE_20261101',CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',
 CASE_APPROVAL_ENABLED:'sarberki-test-synthetic-only',ISOLATED_APPROVAL_ATTESTATION_KEY:KEY,SARBERKI_OPERATOR_SESSION_KEY:'b2'.repeat(32)};
const enabledEnv={...baseEnv,CASE_TEST_MAILBOX_INGEST_ENABLED:'sarberki-test-fictional-only'};
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const GMAIL_TOKEN='ya29.SYNTHETIC_TEST_ONLY_TOKEN_0123456789',ID='18f2a0b1c2d3e4f5',b64=t=>Buffer.from(t).toString('base64url');
const TEXT='Jó napot! Deluxe faházat szeretnénk foglalni 2027-05-14 és 2027-05-16 között 2 felnőtt, 0 gyermek számára.';

test('test-mailbox-ingest: default off; only a cookie Writer with CSRF and a Gmail token header can store a marked fictional test mail',async t=>{
 const db=new PGlite(),tokens=new Map(),cookies=new Map(),csrf=new Map();let gmailCalls=0,subject='Sárberki élő teszt – AI előnézet',fromHeader='Teszt <sender@example.test>';const gmailSends=[];
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(await read('supabase/migrations/202610090001_case_store.sql'));
  await db.query("select set_config('sarberki.approval_install_project_ref','mojnqizbcaczstguikpv',false),set_config('sarberki.approval_backup_sha256',$1,false),set_config('sarberki.receipt_install_project_ref','mojnqizbcaczstguikpv',false),set_config('sarberki.receipt_backup_sha256',$1,false),set_config('sarberki.tm_install_project_ref','mojnqizbcaczstguikpv',false),set_config('sarberki.tm_backup_sha256',$1,false)",['b'.repeat(64)]);
  await db.exec("insert into sc_tenants values('sarberki-test','Fictional',true),('demo-test','Other',true)");
  for(const file of ['deployment/cloud-approval/install.sql','deployment/cloud-approval/separate-approver-permission.sql','deployment/exact-receipt/install.sql'])await db.exec(await read(file));
  await db.query('insert into sc_isolated_approval_key(key_hex) values($1)',[KEY]);
  await db.exec(await read('deployment/test-mailbox/install.sql'));await db.exec('update sc_test_mailbox_config set enabled=true');
  for(const [role,id] of Object.entries(actors)){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into auth.sessions values($1,$2,null)',[sessions[role],id]);
   await db.query("insert into sc_memberships values('sarberki-test',$1,$2,$3,$4)",[id,...grants[role]]);}
  const fetchImpl=async(raw,options={})=>{
   const url=new URL(raw);
   if(url.origin==='https://gmail.googleapis.com'){
    gmailCalls++;assert.equal(options.headers.Authorization,'Bearer '+GMAIL_TOKEN);
    if(url.pathname.endsWith('/profile'))return new Response(JSON.stringify({emailAddress:'sarberkiprojecttest@gmail.com'}));
    if(url.pathname.includes('/threads/'))return new Response(JSON.stringify({messages:[]}));
    if(url.pathname.endsWith('/messages/send')){gmailSends.push(JSON.parse(options.body));return new Response(JSON.stringify({id:'synthetic-sent'}));}
    const id=url.pathname.endsWith('/profile')?ID:url.pathname.split('/').at(-1);
    return new Response(JSON.stringify({id,threadId:id,labelIds:['INBOX'],internalDate:String(Date.parse('2026-10-31T10:00:00Z')),payload:{mimeType:'multipart/alternative',
     headers:[{name:'Subject',value:subject},{name:'From',value:fromHeader},{name:'To',value:'sarberkiprojecttest@gmail.com'},{name:'Message-ID',value:'<f1@example.test>'}],
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
    else if(url.pathname==='/rest/v1/sc_cases'){const id=url.searchParams.get('case_id')?.slice(3),tenant=url.searchParams.get('tenant_id').slice(3);
     result=(await db.query('select * from sc_cases where tenant_id=$1'+(id?' and case_id=$2':''),id?[tenant,id]:[tenant])).rows;}
    else if(url.pathname.endsWith('/rpc/sc_tm_create'))result=(await db.query('select sc_tm_create($1,$2,$3,$4) r',[body.p_tenant,body.p_case,JSON.stringify(body.p_data),JSON.stringify(body.p_proof)])).rows[0].r;
    else if(url.pathname.endsWith('/rpc/sc_tm_redraft'))result=(await db.query('select sc_tm_redraft($1,$2,$3,$4) r',[body.p_tenant,body.p_case,body.p_expected,JSON.stringify(body.p_draft)])).rows[0].r;
    else if(url.pathname.endsWith('/rpc/sc_tm_decide'))result=(await db.query('select sc_tm_decide($1,$2,$3,$4,$5,$6) r',[body.p_tenant,body.p_case,body.p_expected,body.p_draft_hash,body.p_decision,body.p_reason])).rows[0].r;
    else throw Object.assign(Error('unexpected '+url.pathname),{code:'XX'});
    return {ok:true,json:async()=>result};
   }catch(error){return {ok:false,status:error.code==='42501'?403:400};}finally{await db.exec('reset role');}
  };
  const call=async(role,env,input,{headers={},status,method='POST'}={})=>{
   const event={httpMethod:method,...(method==='GET'?{}:{}),headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','x-sarberki-operator':'1','Content-Type':'application/json',
    ...(cookies.has(role)?{cookie:cookies.get(role)}:{}),...(csrf.has(role)?{'x-csrf-token':csrf.get(role)}:{}),...headers},body:method==='GET'?'':JSON.stringify(input),queryStringParameters:method==='GET'?input:{}};
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
  const caseId='tm-'+ID,sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
  const latest=async id=>(await db.query('select revision,data from sc_cases where case_id=$1',[id])).rows[0];
  const hashOf=async id=>sha((await latest(id)).data.drafts.at(-1).text);
  const decide=(role,body,options)=>call(role,enabledEnv,{tenantId:'sarberki-test',action:'test-mailbox-decide',caseId,...body},options);
  const redraft=(role,body,options)=>call(role,enabledEnv,{tenantId:'sarberki-test',action:'test-mailbox-redraft',caseId,...body},options);
  await t.test('decide/redraft are off without the switch and refuse malformed, Bearer or CSRF-less requests',async()=>{
   const h=await hashOf(caseId);
   await call('approver',baseEnv,{tenantId:'sarberki-test',action:'test-mailbox-decide',caseId,expectedRevision:1,reviewedDraftHash:h,decision:'approve'},{status:403});
   await call('writer',baseEnv,{tenantId:'sarberki-test',action:'test-mailbox-redraft',caseId,expectedRevision:1,draftText:'x'},{status:403});
   await decide('approver',{expectedRevision:1,reviewedDraftHash:h,decision:'approve',extra:1},{status:403});
   await decide('approver',{expectedRevision:1,reviewedDraftHash:h,decision:'publish'},{status:400});
   await decide('approver',{expectedRevision:1,reviewedDraftHash:'zz',decision:'approve'},{status:400});
   await decide('approver',{expectedRevision:1,reviewedDraftHash:h,decision:'reject',reason:'a\nb'},{status:400});
   await decide('approver',{caseId:'synthetic-case',expectedRevision:1,reviewedDraftHash:h,decision:'approve'},{status:400});
   await redraft('writer',{expectedRevision:1,draftText:'   '},{status:400});
   await decide('approver',{expectedRevision:1,reviewedDraftHash:h,decision:'approve'},{headers:{'x-csrf-token':''},status:403});
   const bearer=await createCaseHandler({env:enabledEnv,fetchImpl})({httpMethod:'POST',headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','x-sarberki-operator':'1','Content-Type':'application/json',
    cookie:cookies.get('approver'),'x-csrf-token':csrf.get('approver'),authorization:'Bearer '+'x'.repeat(40)},body:JSON.stringify({tenantId:'sarberki-test',action:'test-mailbox-decide',caseId,expectedRevision:1,reviewedDraftHash:h,decision:'approve'}),queryStringParameters:{}});
   assert.equal(bearer.statusCode,403);
   assert.equal(Number((await latest(caseId)).revision),1,'nothing changed');
  });
  await t.test('only an Approver decides; return requires a changed Writer draft; stale revision and wrong hash conflict; final approval is single',async()=>{
   const h1=await hashOf(caseId);
   for(const role of ['writer','reader'])await decide(role,{expectedRevision:1,reviewedDraftHash:h1,decision:'approve'},{status:403});
   assert.deepEqual((await decide('approver',{expectedRevision:1,reviewedDraftHash:h1,decision:'return',reason:'Pontosítsa a létszámot.'},{status:200})).json,{result:{caseId,revision:2,approval:'returned_for_edit'}});
   await decide('approver',{expectedRevision:2,reviewedDraftHash:h1,decision:'approve'},{status:409});
   await redraft('reader',{expectedRevision:2,draftText:'Javított'},{status:403});
   await redraft('approver',{expectedRevision:2,draftText:'Javított'},{status:403});
   await redraft('writer',{expectedRevision:2,draftText:(await latest(caseId)).data.drafts.at(-1).text},{status:409});
   assert.deepEqual((await redraft('writer',{expectedRevision:1,draftText:'Elavult'},{status:409})).json,{error:'CASE_CONFLICT'});
   assert.deepEqual((await redraft('writer',{expectedRevision:2,draftText:'Javított, kitalált tervezet.'},{status:200})).json,{result:{caseId,revision:3,approval:'pending'}});
   await decide('approver',{expectedRevision:3,reviewedDraftHash:h1,decision:'approve'},{status:409});
   const h2=await hashOf(caseId);
   assert.deepEqual((await decide('approver',{expectedRevision:3,reviewedDraftHash:h2,decision:'approve'},{status:200})).json,{result:{caseId,revision:4,approval:'approved_internal'}});
   for(const decision of ['approve','return','reject'])await decide('approver',{expectedRevision:4,reviewedDraftHash:h2,decision},{status:409});
   const data=(await latest(caseId)).data;
   assert.deepEqual(data.decisions.map(x=>x.decision),['return','approve']);assert.equal(data.internalApproval.scope,'test-mailbox-v1');
   assert.equal(data.internalApproval.sendAllowed,false);assert.equal(data.internalApproval.bookingAllowed,false);
   assert.deepEqual((await db.query('select kind from sc_audit where case_id=$1 order by revision',[caseId])).rows.map(r=>r.kind),['tm_create','tm_return','tm_redraft','tm_approve']);
  });
  await t.test('send: off without its own switch; only an Approver; only approved; only the fixed test recipient; exactly one send',async()=>{
   const sendEnv={...enabledEnv,CASE_TEST_MAILBOX_SEND_ENABLED:'sarberki-test-pair-only'};
   const send=(role,env,id,revision,options)=>call(role,env,{tenantId:'sarberki-test',action:'test-mailbox-send',caseId:id,expectedRevision:revision},{headers:gmail,...options});
   // caseId is approved (revision 4) but its sender is not the allowed test recipient.
   assert.deepEqual((await send('approver',enabledEnv,caseId,4,{status:403})).json,{error:'FORBIDDEN'},'separate send switch, default off');
   await send('writer',sendEnv,caseId,4,{status:403});
   await send('approver',sendEnv,caseId,3,{status:409});
   assert.deepEqual((await send('approver',sendEnv,caseId,4,{status:403})).json,{error:'RECIPIENT_NOT_ALLOWED'});
   assert.equal(gmailSends.length,0);
   // A fictional mail from the owner's test sender: store, approve independently, then send once.
   fromHeader='László Kovács <sarberkito@gmail.com>';
   try{
    const id2='18f2a0b1c2d3e4a9',case3='tm-'+id2;
    await call('writer',enabledEnv,{tenantId:'sarberki-test',action:'test-mailbox-ingest',messageId:id2},{headers:gmail,status:200});
    await send('approver',sendEnv,case3,1,{status:409});
    assert.deepEqual((await send('approver',sendEnv,case3,1,{status:409})).json,{error:'NOT_APPROVED'},'pending is never sent');
    await call('approver',enabledEnv,{tenantId:'sarberki-test',action:'test-mailbox-decide',caseId:case3,expectedRevision:1,reviewedDraftHash:await hashOf(case3),decision:'approve'},{status:200});
    assert.deepEqual((await send('approver',sendEnv,case3,2,{status:200})).json,{result:{caseId:case3,status:'sent'}});
    assert.equal(gmailSends.length,1);assert.equal(gmailSends[0].threadId,id2);
    const mime=Buffer.from(gmailSends[0].raw,'base64url').toString('utf8');
    assert.match(mime,/^From: sarberkiprojecttest@gmail\.com\r\nTo: sarberkito@gmail\.com\r\n/);
    const body=Buffer.from(mime.split('\r\n\r\n')[1].replace(/\r\n/g,''),'base64').toString('utf8').replace(/\r\n/g,'\n');
    assert.equal(body,(await latest(case3)).data.drafts.at(-1).text,'exactly the approved stored text');
    assert.equal((await latest(case3)).revision,2,'sending does not change the case');
   }finally{fromHeader='Teszt <sender@example.test>';}
  });
  await t.test('the author of the latest draft cannot approve it even with approve permission; reject and reopen keep history',async()=>{
   const id2='18f2a0b1c2d3e4f6',case2='tm-'+id2;
   await call('both',enabledEnv,{tenantId:'sarberki-test',action:'test-mailbox-ingest',messageId:id2},{headers:gmail,status:200});
   const h=await hashOf(case2);
   await decide('both',{caseId:case2,expectedRevision:1,reviewedDraftHash:h,decision:'approve'},{status:403});
   await decide('approver',{caseId:case2,expectedRevision:1,reviewedDraftHash:h,decision:'reject',reason:'Nem megfelelő.'},{status:200});
   await redraft('writer',{caseId:case2,expectedRevision:2,draftText:'Újranyitott, kitalált tervezet.'},{status:200});
   await decide('both',{caseId:case2,expectedRevision:3,reviewedDraftHash:await hashOf(case2),decision:'approve'},{status:200});
   const data=(await latest(case2)).data;assert.deepEqual(data.decisions.map(x=>x.decision),['reject','approve']);assert.equal(data.drafts.length,2);
  });
  await t.test('daily list shows test-mailbox cases only when enabled; record read gives role-specific edit/decide flags without secrets',async()=>{
   const id3='18f2a0b1c2d3e4f7',case3='tm-'+id3;
   await call('writer',enabledEnv,{tenantId:'sarberki-test',action:'test-mailbox-ingest',messageId:id3},{headers:gmail,status:200});
   const list=(await call('reader',enabledEnv,{tenantId:'sarberki-test',action:'daily-list'},{method:'GET',status:200})).json.result;
   const byId=Object.fromEntries(list.map(row=>[row.caseId,row]));
   assert.deepEqual(byId[case3],{tenantId:'sarberki-test',caseId:case3,revision:1,category:'approval',kind:'test-mailbox'});
   assert.equal(byId[caseId].category,'progress');
   const off=(await call('reader',baseEnv,{tenantId:'sarberki-test',action:'daily-list'},{method:'GET',status:200})).json.result;
   assert.equal(off.some(row=>row.caseId.startsWith('tm-')),false,'hidden while the switch is off');
   const record=role=>call(role,enabledEnv,{tenantId:'sarberki-test',action:'test-mailbox-record',caseId:case3},{method:'GET',status:200}).then(r=>r.json.result);
   const reader=await record('reader');
   assert.deepEqual({e:reader.canEditDraft,d:reader.canDecide,a:reader.approval,r:reader.revision},{e:false,d:false,a:'pending',r:1});
   assert.equal(reader.messages[0].text,TEXT);assert.match(reader.draft.text,/Kedves Vendégünk/);assert.equal(reader.draft.hash,await hashOf(case3));
   assert.deepEqual(reader.decisions,[]);assert.equal(reader.values.arrival,'2027-05-14');
   assert.equal(JSON.stringify(reader).includes(KEY),false);assert.equal('testMailbox' in reader,false);assert.equal('sourceReceipt' in reader,false);
   assert.deepEqual([(await record('writer')).canEditDraft,(await record('writer')).canDecide],[true,false]);
   assert.deepEqual([(await record('approver')).canEditDraft,(await record('approver')).canDecide],[false,true]);
   assert.deepEqual([(await record('both')).canEditDraft,(await record('both')).canDecide],[true,true],'not the author of case3');
   const approved=(await call('approver',enabledEnv,{tenantId:'sarberki-test',action:'test-mailbox-record',caseId},{method:'GET',status:200})).json.result;
   assert.deepEqual([approved.canEditDraft,approved.canDecide,approved.approval],[false,false,'approved_internal']);
   assert.deepEqual(approved.decisions.map(x=>x.decision),['return','approve']);assert.equal(approved.internalApproval.sendAllowed,false);
   const case2=(await call('both',enabledEnv,{tenantId:'sarberki-test',action:'test-mailbox-record',caseId:'tm-18f2a0b1c2d3e4f6'},{method:'GET',status:200})).json.result;
   assert.equal(case2.canDecide,false,'approved case cannot be decided again');
   await call('reader',baseEnv,{tenantId:'sarberki-test',action:'test-mailbox-record',caseId:case3},{method:'GET',status:403});
   await call('reader',enabledEnv,{tenantId:'sarberki-test',action:'test-mailbox-record',caseId:'case-synthetic'},{method:'GET',status:400});
   await call('reader',enabledEnv,{tenantId:'sarberki-test',action:'test-mailbox-record',caseId:case3,extra:'1'},{method:'GET',status:403});
   await call('reader',enabledEnv,{tenantId:'sarberki-test',action:'test-mailbox-record',caseId:case3},{status:403});
   await call('reader',enabledEnv,{tenantId:'sarberki-test',action:'test-mailbox-record',caseId:'tm-aaaaaaaaaaaaaaaa'},{method:'GET',status:404});
  });
  await t.test('record/list security: unique list ids, tenant/Bearer/CSRF refusals, look-alike rows hidden, revoked membership reads nothing',async()=>{
   const case3='tm-18f2a0b1c2d3e4f7',get=(role,input,options)=>call(role,enabledEnv,{tenantId:'sarberki-test',action:'test-mailbox-record',caseId:case3,...input},{method:'GET',...options});
   const ids=(await call('reader',enabledEnv,{tenantId:'sarberki-test',action:'daily-list'},{method:'GET',status:200})).json.result.map(row=>row.caseId);
   assert.equal(new Set(ids).size,ids.length,'a test-mailbox case must not be listed twice');
   await get('reader',{tenantId:'demo-test'},{status:403});
   await get('reader',{},{headers:{'x-csrf-token':''},status:403});
   const bearer=await createCaseHandler({env:enabledEnv,fetchImpl})({httpMethod:'GET',headers:{host:new URL(origin).host,origin,'sec-fetch-site':'same-origin','x-sarberki-operator':'1',
    'Content-Type':'application/json',cookie:cookies.get('reader'),'x-csrf-token':csrf.get('reader'),authorization:'Bearer '+'x'.repeat(40)},body:'',queryStringParameters:{tenantId:'sarberki-test',action:'test-mailbox-record',caseId:case3}});
   assert.equal(bearer.statusCode,403);assert.equal(bearer.body.includes('Kedves'),false);
   // Rows that only look like test-mailbox cases (synthetic .invalid sender, other tenant) are never served by this route.
   const source=(await latest(case3)).data;
   for(const [tenant,id,sender] of [['sarberki-test','tm-'+'c'.repeat(16),'guest@synthetic.invalid'],['demo-test','tm-'+'d'.repeat(16),source.sender]]){
    await db.query('insert into sc_cases(tenant_id,case_id,revision,data,updated_by) values($1,$2,1,$3,$4)',[tenant,id,{...source,id,tenantId:tenant,sender},actors.writer]);
    await get('both',{caseId:id},{status:404});
   }
   const listed=(await call('reader',enabledEnv,{tenantId:'sarberki-test',action:'daily-list'},{method:'GET',status:200})).json.result;
   assert.equal(listed.some(row=>row.caseId==='tm-'+'c'.repeat(16)&&row.kind==='test-mailbox'),false);assert.equal(listed.some(row=>row.caseId==='tm-'+'d'.repeat(16)),false);
   // Revoking the membership after login: the server-side RLS read returns nothing; no case data leaks.
   assert.equal((await get('reader',{},{status:200})).json.result.caseId,case3);
   await db.query("delete from sc_memberships where tenant_id='sarberki-test' and user_id=$1",[actors.reader]);
   const revoked=await get('reader',{});
   assert.notEqual(revoked.status,200);assert.equal(JSON.stringify(revoked.json).includes('Kedves'),false);assert.equal(revoked.json.result,undefined);
  });
 }finally{await db.close();}
});
