import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=fs.readFileSync(new URL('../supabase/migrations/20261025173000_pushover_delivery_ledger.sql',import.meta.url),'utf8');
const args="'sarberki-test','sarberkiprojecttest@gmail.com','19abcdef12345','gmail-new-message'";
async function fixture(){const db=new PGlite();await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');await db.exec(sql);return db;}
test('complete migration denies browser roles table and RPC access',async()=>{
 const db=await fixture();try{
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   for(const query of ['select * from public.sc_pushover_delivery_claims',`select public.sc_pushover_claim_once(${args})`])await assert.rejects(db.query(query),e=>e.code==='42501');
   await db.exec('reset role');
  }
 }finally{await db.close();}
});
test('service RPC claims once and rejects cross-tenant or cross-mailbox keys',async()=>{
 const db=await fixture();try{
  await db.exec('set role service_role');
  const first=(await db.query(`select public.sc_pushover_claim_once(${args}) as result`)).rows[0].result;
  assert.equal(first.status,'claimed');
  assert.equal((await db.query(`select public.sc_pushover_claim_once(${args}) as result`)).rows[0].result.status,'duplicate');
  for(const bad of [args.replace('sarberki-test','other-tenant'),args.replace('sarberkiprojecttest@gmail.com','other@synthetic.invalid')])await assert.rejects(db.query(`select public.sc_pushover_claim_once(${bad})`),e=>e.code==='22023');
  assert.equal((await db.query('select public.sc_pushover_mark_unknown($1) as ok',[first.claimId])).rows[0].ok,true);
  assert.equal((await db.query("select public.sc_pushover_mark_sent($1,'synthetic-provider-ack') as ok",[first.claimId])).rows[0].ok,false);
  assert.equal((await db.query(`select public.sc_pushover_claim_once(${args}) as result`)).rows[0].result.status,'duplicate');
 }finally{await db.close();}
});
