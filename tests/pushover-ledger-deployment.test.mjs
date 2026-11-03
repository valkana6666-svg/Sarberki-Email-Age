import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {profiledDatabase} from './deployment-profile-fixture.mjs';

// Slice 2c: the Pushover ledger accepts only the deployment profile's own tenant and mailbox.
const sql=fs.readFileSync(new URL('../supabase/migrations/20261025173000_pushover_delivery_ledger.sql',import.meta.url),'utf8');
const TEST="'sarberki-test','sarberkiprojecttest@gmail.com'",LIVE="'sarberki-live','info@sarberkito.hu'";
const claim=(db,pair,id='19abcdef12345')=>db.query(`select public.sc_pushover_claim_once(${pair},'${id}','gmail-new-message') as r`).then(x=>x.rows[0].r);
const code=c=>e=>e.code===c||assert.fail('expected '+c+' got '+e.code+' '+e.message);

test('ledger migration refuses a database without a deployment profile',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  await assert.rejects(db.exec(sql),/deployment profile required/);
 }finally{await db.close();}
});

for(const [env,own,other] of [['test',TEST,LIVE],['live',LIVE,TEST]])test(`ledger on ${env.toUpperCase()} profile: own pair only, fence not callable`,async()=>{
 const db=await profiledDatabase(PGlite,env);try{
  await db.exec(sql);await db.exec('set role service_role');
  try{
   assert.equal((await claim(db,own)).status,'claimed');
   assert.equal((await claim(db,own)).status,'duplicate');
   await assert.rejects(claim(db,other,'19other12345'),code('22023'));
   await assert.rejects(db.query(`insert into public.sc_pushover_delivery_claims(tenant_id,mailbox,gmail_message_id,notification_type) values(${other},'19direct12345','gmail-new-message')`),code('22023'));
   await assert.rejects(claim(db,"'sarberki-live','sarberkiprojecttest@gmail.com'",'19mixed12345'),code('22023'));
   await assert.rejects(db.query('select * from public.sc_deployment_profile'),code('42501'));
   await assert.rejects(db.query('select public.sc_deployment_mailbox()'),code('42501'));
  }finally{await db.exec('reset role');}
  const priv=(await db.query("select has_function_privilege('service_role','public.sc_pushover_identity_fence()','execute') s,has_function_privilege('authenticated','public.sc_pushover_identity_fence()','execute') a")).rows[0];
  assert.deepEqual(priv,{s:false,a:false});
  assert.equal((await db.query('select count(*)::int n from public.sc_pushover_delivery_claims')).rows[0].n,1);
 }finally{await db.close();}
});
