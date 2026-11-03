import {readFile} from 'node:fs/promises';

// Shared PGlite fixture (not a test file): installs the TEST deployment profile exactly as the
// operator would, so every SQL test runs against the same profile-bound schema.
export const TEST_PROJECT_REF='mojnqizbcaczstguikpv';
export async function installDeploymentProfile(db,environment='test',projectRef=environment==='test'?TEST_PROJECT_REF:'livefictionalrefaaaa'){
 const sql=await readFile(new URL('../deployment/deployment-profile/install.sql',import.meta.url),'utf8');
 await db.exec(`begin;select set_config('sarberki.deployment_environment','${environment}',true);select set_config('sarberki.deployment_project_ref','${projectRef}',true);${sql}commit;`);
}
