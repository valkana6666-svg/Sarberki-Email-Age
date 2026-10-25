import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=fs.readFileSync(new URL('../supabase/migrations/20261025173000_pushover_delivery_ledger.sql',import.meta.url),'utf8');
const args="'sarberki-test','sarberkiprojecttest@gmail.com','19abcdef12345','gmail-new-message'";
async function fixture(){
 const db=new PGlite();
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
 await db.exec(sql);await db.exec('set role service_role');
 const claim=(await db.query(`select public.sc_pushover_claim_once(${args}) as result`)).rows[0].result;
 return {db,claim};
}
for(const [name,assignment] of [
 ['message identity',"gmail_message_id='19abcdef54321'"],
 ['claim identity',"claim_id='12345678-1234-4123-8123-123456789abc'"],
 ['creation timestamp',"created_at=created_at-interval '1 day'"]
])test('service role cannot rewrite '+name,async()=>{
 const {db,claim}=await fixture();try{
  await assert.rejects(db.query(`update public.sc_pushover_delivery_claims set ${assignment} where claim_id=$1`,[claim.claimId]),e=>e.code==='23514');
  assert.equal((await db.query(`select public.sc_pushover_claim_once(${args}) as result`)).rows[0].result.status,'duplicate');
 }finally{await db.close();}
});
for(const terminal of ['sent','outcome_unknown'])test('terminal '+terminal+' is immutable and never reclaims',async()=>{
 const {db,claim}=await fixture();try{
  const rpc=terminal==='sent'?"select public.sc_pushover_mark_sent($1,'synthetic-receipt') as ok":'select public.sc_pushover_mark_unknown($1) as ok';
  assert.equal((await db.query(rpc,[claim.claimId])).rows[0].ok,true);
  for(const assignment of ["status='sending'", "status='"+(terminal==='sent'?'outcome_unknown':'sent')+"'", "provider_request_id='replacement'",'updated_at=clock_timestamp()'])
   await assert.rejects(db.query(`update public.sc_pushover_delivery_claims set ${assignment} where claim_id=$1`,[claim.claimId]),e=>e.code==='23514');
  assert.equal((await db.query(rpc,[claim.claimId])).rows[0].ok,false);
  assert.equal((await db.query(`select public.sc_pushover_claim_once(${args}) as result`)).rows[0].result.status,'duplicate');
  assert.equal((await db.query('select status from public.sc_pushover_delivery_claims')).rows[0].status,terminal);
 }finally{await db.close();}
});
test('service role cannot mutate sending row without terminal transition',async()=>{
 const {db,claim}=await fixture();try{
  await assert.rejects(db.query("update public.sc_pushover_delivery_claims set provider_request_id='premature' where claim_id=$1",[claim.claimId]),e=>e.code==='23514');
  assert.equal((await db.query('select public.sc_pushover_mark_unknown($1) as ok',[claim.claimId])).rows[0].ok,true);
 }finally{await db.close();}
});
