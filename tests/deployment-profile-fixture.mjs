import {readFile} from 'node:fs/promises';

// Shared PGlite fixture (not a test file): installs the TEST deployment profile exactly as the
// operator would, so every SQL test runs against the same profile-bound schema.
export const TEST_PROJECT_REF='mojnqizbcaczstguikpv';
export async function installDeploymentProfile(db,environment='test',projectRef=environment==='test'?TEST_PROJECT_REF:'livefictionalrefaaaa'){
 const sql=await readFile(new URL('../deployment/deployment-profile/install.sql',import.meta.url),'utf8');
 await db.exec(`begin;select set_config('sarberki.deployment_environment','${environment}',true);select set_config('sarberki.deployment_project_ref','${projectRef}',true);${sql}commit;`);
}

// A fresh PGlite with the Supabase-like roles, the case store and a deployment profile.
export async function profiledDatabase(PGlite,environment='test',projectRef){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;grant usage on schema auth to authenticated,anon;`);
 await db.exec(await readFile(new URL('../supabase/migrations/202610090001_case_store.sql',import.meta.url),'utf8'));
 await installDeploymentProfile(db,environment,projectRef);
 return db;
}
