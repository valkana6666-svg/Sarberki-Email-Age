import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
test('persistent identity SQL rejects default DB and exposes only guarded fingerprint to anon',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create table sc_tenants(tenant_id text,test_only boolean);create table sc_cases(data jsonb);create table sc_isolated_approval_key(singleton boolean,key_hex text);create function sc_approve_case(text,text,bigint,text,jsonb) returns jsonb language sql as $$select '{}'::jsonb$$;");
  const sql=await readFile(new URL('../recovery/sql/isolated-persistent-identity.sql',import.meta.url),'utf8');
  await assert.rejects(db.exec(sql),/isolated database required/);await db.exec('rollback');
  // PGlite has a fixed database name. Only database expressions are replaced;
  // this does not claim the unchanged guard ran against a real named Docker DB.
  await db.exec(sql.replaceAll('current_database()',"'sc_approval_test'"));
  const key='ab'.repeat(32);await db.query('insert into sc_isolated_approval_key values(true,$1)',[key]);
  await db.exec("insert into sc_tenants values('sarberki-test',true),('demo-test',true);insert into sc_cases values('{\"sender\":\"fixture@synthetic.invalid\"}');set role anon;");
  const proof=(await db.query('select sc_isolated_identity() proof')).rows[0].proof;
  assert.deepEqual(proof,{database:'sc_approval_test',syntheticOnly:true,approvalInstalled:true,attestationFingerprint:createHash('sha256').update(key).digest('hex')});
  await assert.rejects(db.query('select key_hex from sc_isolated_approval_key'),/permission denied/);
  await db.exec('reset role;set role authenticated;');
  await assert.rejects(db.query('select sc_isolated_identity()'),/permission denied/);
  await db.exec("reset role;insert into sc_tenants values('other-test',true);set role anon;");
  assert.equal((await db.query('select sc_isolated_identity() proof')).rows[0].proof.syntheticOnly,false);
  await db.exec("reset role;delete from sc_tenants where tenant_id='other-test';update sc_cases set data='{\"sender\":\"real@example.org\"}';set role anon;");
  assert.equal((await db.query('select sc_isolated_identity() proof')).rows[0].proof.syntheticOnly,false);
 }finally{await db.close();}
});
