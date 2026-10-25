import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=fs.readFileSync(new URL('../supabase/migrations/20261025173000_pushover_delivery_ledger.sql',import.meta.url),'utf8');
const ddl=migration.match(/-- BEGIN LEDGER DDL[^\n]*\n([\s\S]*?)-- END LEDGER DDL/u)?.[1];
const key=['sarberki-test','sarberkiprojecttest@gmail.com','19abcdef12345','gmail-new-message'];
const insert=`insert into public.sc_pushover_delivery_claims (tenant_id,mailbox,gmail_message_id,notification_type)
 values($1,$2,$3,$4) on conflict (tenant_id,mailbox,gmail_message_id,notification_type) do nothing returning claim_id,status`;

test('migration is source-only and guards all browser roles',()=>{
 assert.ok(ddl?.includes('create table if not exists public.sc_pushover_delivery_claims'));
 assert.match(migration,/enable row level security/u);
 assert.match(migration,/revoke all on public.sc_pushover_delivery_claims from public, anon, authenticated/u);
 assert.match(migration,/security invoker/gu);
 assert.doesNotMatch(migration,/grant .*\b(?:anon|authenticated)\b/u);
 assert.match(migration,/on conflict \(tenant_id,mailbox,gmail_message_id,notification_type\) do nothing/u);
 assert.doesNotMatch(migration,/on conflict[^\n]*do update/iu);
});

test('isolated PostgreSQL ledger persists one unique claim and terminal non-retry states',async()=>{
 const db=new PGlite();
 try{
  await db.exec(ddl);
  const first=await db.query(insert,key),repeat=await db.query(insert,key);
  assert.equal(first.rows.length,1);assert.equal(repeat.rows.length,0);
  const claimId=first.rows[0].claim_id;
  const update=await db.query(
    "update public.sc_pushover_delivery_claims set status='outcome_unknown' where claim_id=$1 and status='sending' returning claim_id",
    [claimId]);
  assert.equal(update.rows.length,1);
  const retry=await db.query(insert,key);
  assert.equal(retry.rows.length,0);
  const illegalTransition=await db.query(
    "update public.sc_pushover_delivery_claims set status='sent' where claim_id=$1 and status='sending' returning claim_id",
    [claimId]);
  assert.equal(illegalTransition.rows.length,0);
  for(const bad of [
   ['other-tenant',key[1],key[2],key[3]],
   [key[0],'personal@example.com',key[2],key[3]],
   [key[0],key[1],key[2],'booking-confirmation'],
   [key[0],key[1],'malformed id !',key[3]]
  ])await assert.rejects(db.query(insert,bad));
  const state=await db.query('select status from public.sc_pushover_delivery_claims');
  assert.deepEqual(state.rows.map(row=>row.status),['outcome_unknown']);
 }finally{await db.close();}
});

test('independent messages may claim once, but completed claims cannot revert',async()=>{
 const db=new PGlite();
 try{
  await db.exec(ddl);
  const a=await db.query(insert,key),b=await db.query(insert,[key[0],key[1],'19abcdef54321',key[3]]);
  assert.equal(a.rows.length,1);assert.equal(b.rows.length,1);
  const claimId=a.rows[0].claim_id;
  const sent=await db.query("update public.sc_pushover_delivery_claims set status='sent' where claim_id=$1 and status='sending' returning claim_id",[claimId]);
  assert.equal(sent.rows.length,1);
  assert.equal((await db.query(insert,key)).rows.length,0);
  assert.equal((await db.query("update public.sc_pushover_delivery_claims set status='outcome_unknown' where claim_id=$1 and status='sending' returning claim_id",[claimId])).rows.length,0);
 }finally{await db.close();}
});
