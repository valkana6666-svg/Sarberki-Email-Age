import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {validateSyntheticMessage} from '../shared-core/server-booking-runtime.mjs';

// Realistic fictional provider IDs; sender/body/mailbox are fictional too.
// No private receipt file, personal sender or actual RFC header is read here.
const envelope={sender:'fictional-sender@example.test',text:'Synthetic inquiry only.',
 mailbox_id:'fictional-mailbox',message_id:'0a00000000000001',
 thread_id:'0a00000000000001',received_at:'2026-10-03T09:23:06.000Z'};

test('unaliased external sender is rejected by the existing runtime boundary',()=>{
 assert.throws(()=>validateSyntheticMessage(envelope,{}),error=>error.code==='INVALID_INPUT');
});

test('existing PostgreSQL Writer rejects external sender atomically, independently of JS guards',async()=>{
 const db=new PGlite();
 const writer='11111111-1111-4111-8111-111111111111';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$
    select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
   $$;grant usage on schema auth to authenticated,anon;
   grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610090001_case_store.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values($1)',[writer]);
  await db.exec("insert into sc_tenants values('sarberki-test','Fictional test',true)");
  await db.query("insert into sc_memberships values('sarberki-test',$1,true,true,false)",[writer]);
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:writer})]);
  const payload={id:'fictional-case',tenantId:'sarberki-test',sender:envelope.sender,
   state:{values:{},approval:'pending'},messages:[envelope],drafts:[]};
  await assert.rejects(db.query('select sc_write_case($1,$2,$3,$4)',[
   'sarberki-test',payload.id,0,JSON.stringify(payload)]),
   error=>error.code==='22023'&&error.message==='synthetic sender required');
  for(const table of ['sc_cases','sc_message_keys','sc_audit']){
   assert.equal((await db.query('select count(*)::int count from '+table)).rows[0].count,0);
  }
  // Positive control proves the failure was sender policy, not malformed payload
  // or missing Writer authority. This is NOT a proposal to alias real mail.
  const synthetic={...payload,sender:'fictional@fixture.invalid',messages:[{...envelope,sender:'fictional@fixture.invalid'}]};
  assert.equal((await db.query('select sc_write_case($1,$2,$3,$4) accepted',[
   'sarberki-test',payload.id,0,JSON.stringify(synthetic)])).rows[0].accepted,true);
 }finally{await db.close();}
});
