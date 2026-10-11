import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
test('direct SQL RPC rejects forged or revoked authority even when API is bypassed',async()=>{
 const db=new PGlite(),writer='11111111-1111-4111-8111-111111111111',operator='22222222-2222-4222-8222-222222222222',sid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610090001_case_store.sql',import.meta.url),'utf8'));
  await db.exec((await readFile(new URL('../recovery/sql/isolated-approval.sql',import.meta.url),'utf8')).replaceAll('current_database()',"'sc_approval_test'"));
  await db.query('insert into auth.users values($1),($2)',[writer,operator]);await db.query('insert into auth.sessions values($1,$2,null)',[sid,operator]);await db.exec("insert into sc_tenants values('sarberki-test','Fixture',true)");await db.query("insert into sc_memberships values('sarberki-test',$1,true,true,false),('sarberki-test',$2,true,true,true)",[writer,operator]);
  const text='Synthetic review only',hash=createHash('sha256').update(text).digest('hex'),values={arrival:'2026-10-23',departure:'2026-10-25',unit:'Deluxe',units_requested:'1'};
  const data={id:'case-boundary',tenantId:'sarberki-test',sender:'fixture@synthetic.invalid',state:{values,approval:'pending'},messages:[],drafts:[{text,synthetic:true,reviewStatus:'internal_review_required'}]};
  await db.query('insert into sc_cases(tenant_id,case_id,revision,data,updated_by) values($1,$2,1,$3,$4)',['sarberki-test',data.id,JSON.stringify(data),writer]);
  const evidence={tenantId:'sarberki-test',source:'synthetic-fixture',status:'AVAILABLE',unit:values.unit,arrival:values.arrival,departure:values.departure,availableUnits:1,checkedAt:new Date().toISOString()};
  const denied=async(user,claims,body=evidence)=>{
   await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,role:'authenticated',session_id:sid,exp:Math.floor(Date.now()/1000)+3600,...claims})]);
   try{await assert.rejects(db.query('select sc_approve_case($1,$2,1,$3,$4)',['sarberki-test',data.id,hash,JSON.stringify(body)]));}finally{await db.exec('reset role');}
  };
  await denied(writer,{}); // Raw RPC cannot bypass DB membership checks.
  await denied(operator,{exp:Math.floor(Date.now()/1000)-1});
  await denied(operator,{role:'service_role'});
  await denied(operator,{session_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'});
  await denied(operator,{}, {...evidence,availableUnits:0});
  await denied(operator,{}, {...evidence,departure:'2026-10-26'});
  await denied(operator,{}, {...evidence,checkedAt:'2020-01-01T00:00:00Z'});
  await db.exec('update sc_memberships set can_approve=false');await denied(operator,{});
  assert.equal((await db.query('select revision,data from sc_cases')).rows[0].revision,1);assert.equal((await db.query('select count(*)::int n from sc_audit')).rows[0].n,0);
 }finally{await db.close();}
});
