import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const query=fs.readFileSync(new URL('../scripts/pushover-migration-preflight.sql',import.meta.url),'utf8');
async function fixture(){const db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');return db;}
test('clean catalog is schema-ready but never authorizes activation; query works read-only',async()=>{
 const db=await fixture();try{await db.exec('begin read only');const r=(await db.query(query)).rows[0];assert.equal(r.schema_ready,true);assert.equal(r.activation_authorized,false);assert.deepEqual(r.conflicting_objects,[]);await db.exec('rollback');}finally{await db.close();}
});
for(const [name,ddl]of [['table','create table public.sc_pushover_delivery_claims(id int)'],['type',"create type public.sc_pushover_delivery_claims as enum ('synthetic')"],['function',"create function public.sc_pushover_guard_update() returns int language sql as 'select 1'"]])test('preflight rejects existing '+name+' without modifying it',async()=>{
 const db=await fixture();try{await db.exec(ddl);const r=(await db.query(query)).rows[0];assert.equal(r.schema_ready,false);assert.equal(r.conflicting_objects.length,1);assert.deepEqual((await db.query(query)).rows[0],r);}finally{await db.close();}
});
for(const ddl of ['drop role anon','alter role authenticated bypassrls','alter role service_role nobypassrls'])test('preflight rejects unexpected roles: '+ddl,async()=>{
 const db=await fixture();try{await db.exec(ddl);const r=(await db.query(query)).rows[0];assert.equal(r.roles_ready,false);assert.equal(r.schema_ready,false);}finally{await db.close();}
});
