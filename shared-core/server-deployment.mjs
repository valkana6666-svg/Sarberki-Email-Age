// Server-only (excluded from dist by the server- prefix). Live store slice 2, JS side: ONE place that decides
// which site, Supabase project, tenant and mailbox this function runs for. Mirrors the database deployment
// profile (deployment/deployment-profile/install.sql).
// - TEST (default, SARBERKI_DEPLOYMENT unset or 'test'): exactly the existing TEST values; nothing changes.
// - LIVE ('live'): its own origin and Supabase project (never the TEST ones), tenant sarberki-live, mailbox
//   info@sarberkito.hu. Fails closed while the live mailbox profile is disabled (server-mailbox-profiles.mjs):
//   enabling it needs the data controller's consent and a separate owner approval (AGENTS.md).
import {MAILBOX_PROFILES} from './server-mailbox-profiles.mjs';

export const TEST_DEPLOYMENT=Object.freeze({environment:'test',tenantId:'sarberki-test',origin:'https://leafy-chimera-2403e5.netlify.app',
 projectRef:'mojnqizbcaczstguikpv',supabaseUrl:'https://mojnqizbcaczstguikpv.supabase.co',mailbox:MAILBOX_PROFILES['sarberki-test']});
const fail=code=>{const error=Error(code);error.code=code;throw error;};

export function serverDeployment(env=process.env,{profiles=MAILBOX_PROFILES}={}){
 const mode=env.SARBERKI_DEPLOYMENT;
 if(mode===undefined||mode===''||mode==='test')return TEST_DEPLOYMENT;
 if(mode!=='live')fail('DEPLOYMENT_SETUP_REQUIRED');
 const origin=env.SARBERKI_LIVE_ORIGIN,supabaseUrl=env.SARBERKI_LIVE_SUPABASE_URL;
 const ref=/^https:\/\/([a-z]{20})\.supabase\.co$/.exec(String(supabaseUrl||''))?.[1];
 if(!/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(String(origin||''))||origin===TEST_DEPLOYMENT.origin||!ref||ref===TEST_DEPLOYMENT.projectRef)fail('DEPLOYMENT_SETUP_REQUIRED');
 const mailbox=profiles['sarberki-live'];
 if(mailbox?.enabled!==true)fail('LIVE_MAILBOX_DISABLED');
 return Object.freeze({environment:'live',tenantId:'sarberki-live',origin,projectRef:ref,supabaseUrl,mailbox});
}
