import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createCaseHandler} from '../netlify/functions/booking-cases.mjs';
const writer='11111111-1111-4111-8111-111111111111',approver='22222222-2222-4222-8222-222222222222',foreign='33333333-3333-4333-8333-333333333333';
const session='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tokens={[writer]:'synthetic-writer-token-0001',[approver]:'synthetic-approver-token-0002',[foreign]:'synthetic-foreign-token-0003'};
const env={CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',URL:'https://leafy-chimera-2403e5.netlify.app',SUPABASE_URL:'https://isolated-approval.supabase.co',SUPABASE_PUBLISHABLE_KEY:'synthetic-public-key'};
const fixtureProviders={availability:async q=>({...q,source:'synthetic-fixture',checkedAt:new Date().toISOString(),availability:'available',availableUnits:1}),pricing:async q=>({...q,source:'synthetic-fixture',checkedAt:new Date().toISOString(),tenantId:'sarberki-test',unitId:q.cabin,capacity:6,nightly:100,basis:'per_unit',verified:true})};
test('new isolated approval SQL/API checks only; Auth HTTP simulated, PostgreSQL real',async t=>{
 let db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 await db.exec(await readFile(new URL('../supabase/migrations/202610090001_case_store.sql',import.meta.url),'utf8'));
 const originalSql=await readFile(new URL('../recovery/sql/isolated-approval.sql',import.meta.url),'utf8');
 await t.test('installer rejects the default database',async()=>{await assert.rejects(db.exec(originalSql),/isolated sc_approval_test/);await db.exec('rollback');});
 // PGlite has a fixed database name. Only the database-name expressions are replaced;
 // the separate Docker/Postgres rehearsal executes the original guard unchanged.
 await db.exec(originalSql.replaceAll('current_database()',"'sc_approval_test'"));
 await db.query('insert into auth.users values ($1),($2),($3)',[writer,approver,foreign]);
 await db.query('insert into auth.sessions values ($1,$2,null)',[session,approver]);
 await db.exec("insert into sc_tenants values('sarberki-test','Synthetic',true),('demo-test','Foreign synthetic',true)");
 await db.query("insert into sc_memberships values('sarberki-test',$1,true,true,false),('sarberki-test',$2,true,true,true),('demo-test',$3,true,true,true)",[writer,approver,foreign]);
 let queue=Promise.resolve(),capacity='available';
 const as=(user,fn)=>{const run=queue.then(async()=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,session_id:session})]);try{return await fn();}finally{await db.exec('reset role');}});queue=run.catch(()=>{});return run;};
 const fetchImpl=async(raw,options)=>{
  const u=new URL(raw);assert.equal(u.origin,env.SUPABASE_URL);
  const user=Object.keys(tokens).find(id=>tokens[id]===options.headers.Authorization.slice(7));
  if(!user)return {ok:false,status:401};
  if(u.pathname==='/auth/v1/user')return {ok:true,json:async()=>({id:user})};
  try{const value=await as(user,async()=>{
   if(u.pathname.endsWith('/sc_memberships'))return (await db.query('select * from sc_memberships where user_id=$1',[user])).rows;
   if(u.pathname.endsWith('/sc_write_case')){const b=JSON.parse(options.body);return (await db.query('select sc_write_case($1,$2,$3,$4) ok',[b.p_tenant,b.p_case,b.p_expected,JSON.stringify(b.p_data)])).rows[0].ok;}
   if(u.pathname.endsWith('/sc_approve_case')){const b=JSON.parse(options.body);return (await db.query('select sc_approve_case($1,$2,$3,$4,$5) result',[b.p_tenant,b.p_case,b.p_expected,b.p_draft_hash,JSON.stringify(b.p_evidence)])).rows[0].result;}
   const tenant=u.searchParams.get('tenant_id').slice(3),id=u.searchParams.get('case_id')?.slice(3);
   return (await db.query('select * from sc_cases where tenant_id=$1'+(id?' and case_id=$2':''),id?[tenant,id]:[tenant])).rows;
  });return {ok:true,json:async()=>value};}catch(e){return {ok:false,status:e.code==='42501'?403:400};}
 };
 const handler=createCaseHandler({env,fetchImpl,isolatedApproval:true,reviewProviders:{...fixtureProviders,availability:async q=>({...await fixtureProviders.availability(q),availability:capacity,availableUnits:capacity==='available'?1:0})}});
 const call=(user,input)=>handler({httpMethod:'POST',headers:{authorization:'Bearer '+(tokens[user]||user)},body:JSON.stringify({tenantId:'sarberki-test',...input})});
 const response=async(user,input,status=200)=>{const r=await call(user,input);assert.equal(r.statusCode,status,r.body);return JSON.parse(r.body).result;};
 const created=await response(writer,{action:'ingest',expectedRevision:0,envelope:{sender:'fixture@synthetic.invalid',text:'Please book one Deluxe cabin from 2026-10-23 to 2026-10-25 for 4 adults and no children.',mailbox_id:'isolated',message_id:'approval-fixture',received_at:new Date().toISOString()}});
 const reviewed=await response(writer,{action:'review-draft',caseId:created.record.caseId,expectedRevision:1});
 assert.equal(reviewed.review.status,'internal_review_required');
 const caseId=created.record.caseId,draftHash=createHash('sha256').update(reviewed.record.data.drafts.at(-1).text).digest('hex'),input={action:'approve',caseId,expectedRevision:2,reviewedDraftHash:draftHash};
 const original=JSON.stringify((await db.query('select * from sc_cases')).rows);
 await t.test('writer, foreign tenant, expired or malformed identities are denied',async()=>{await response(writer,input,403);await response(foreign,input,403);await response('expired-synthetic-token-0000',input,403);await response(approver,{...input,actor:writer},400);assert.equal(JSON.stringify((await db.query('select * from sc_cases')).rows),original);});
 await t.test('wrong revision and changed draft cannot approve',async()=>{await response(approver,{...input,expectedRevision:1},409);await response(approver,{...input,reviewedDraftHash:'0'.repeat(64)},400);});
 await t.test('unknown fresh capacity blocks approval',async()=>{capacity='unknown';await response(approver,input,422);capacity='available';});
 await t.test('revoked DB session is rejected',async()=>{await db.query('update auth.sessions set not_after=now()-interval \'1 second\'');await response(approver,input,403);await db.exec('update auth.sessions set not_after=null');});
 await t.test('audit failure rolls back the state and revision',async()=>{
  await db.exec("create function block_approval_audit() returns trigger language plpgsql as $$begin if new.kind='approve_isolated_synthetic' then raise exception 'synthetic audit failure';end if;return new;end$$;create trigger block_audit before insert on sc_audit for each row execute function block_approval_audit();");
  await response(approver,input,503);assert.equal(JSON.stringify((await db.query('select * from sc_cases')).rows),original);
  await db.exec('drop trigger block_audit on sc_audit;drop function block_approval_audit()');
 });
 let approved;
 await t.test('approval commits exact draft, actor, revision and audit atomically',async()=>{
  approved=await response(approver,input);assert.equal(approved.revision,3);assert.equal(approved.updatedBy,approver);assert.equal(approved.data.state.approval,'internally_approved');assert.equal(approved.data.serverApproval.draftHash,draftHash);assert.equal(approved.data.serverApproval.reviewedRevision,2);
  const a=(await db.query("select * from sc_audit where kind='approve_isolated_synthetic'")).rows;assert.equal(a.length,1);assert.equal(a[0].actor,approver);assert.equal(Number(a[0].revision),3);assert.equal(a[0].data_hash,(await db.query("select encode(sha256(convert_to(data::text,'UTF8')),'hex') h from sc_cases")).rows[0].h);
  await response(approver,input,409);
 });
 await t.test('fresh PostgreSQL instance restores approval, RLS and audit',async()=>{const snapshot=await db.dumpDataDir();await db.close();db=new PGlite({loadDataDir:snapshot});const rows=(await as(approver,()=>db.query('select * from sc_cases'))).rows;assert.equal(rows[0].revision,3);assert.deepEqual(rows[0].data,approved.data);assert.equal((await as(foreign,()=>db.query('select * from sc_cases'))).rows.length,0);assert.equal((await db.query("select count(*)::int n from sc_audit where kind='approve_isolated_synthetic'")).rows[0].n,1);});
 await t.test('default handler remains closed for approval even with test store enabled',async()=>{const disabled=createCaseHandler({env,fetchImpl:()=>assert.fail('default gate used network')});const r=await disabled({httpMethod:'POST',headers:{authorization:'Bearer '+tokens[approver]},body:JSON.stringify({tenantId:'sarberki-test',...input})});assert.equal(r.statusCode,400);});
 await db.close();
});
