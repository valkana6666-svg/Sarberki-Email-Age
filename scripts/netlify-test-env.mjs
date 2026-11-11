#!/usr/bin/env node
// Owner decision 2026-11-09 (minimise Work): Claude sets TEST-site switches through the Netlify API with a
// token the owner enters in the session's secure form (the proxy adds "Authorization: Bearer <token>" for
// api.netlify.com; the token is never in this file, a log or the chat). Hard limits:
//  - ONLY the TEST site leafy-chimera-2403e5 (any other site is refused, the live site above all);
//  - ONLY allow-listed, non-secret switches; secret variables (keys, passwords) are never read or written;
//  - every change needs the owner's prior permission recorded in docs/V1-ALLAPOT.md, then a TEST release.
// Usage: NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/netlify-test-env.mjs get
//        ... set PREVIO_READ_API_ENABLED sandbox-73521-only --owner-approved
export const SITE='leafy-chimera-2403e5';
export const API='https://api.netlify.com/api/v1';
export const ALLOWED=Object.freeze({
 PREVIO_READ_API_ENABLED:v=>v==='sandbox-73521-only'||v==='',
 PREVIO_HOTEL_ID:v=>v==='73521',
 PREVIO_RATE_PLAN_ID:v=>/^\d{1,9}$/.test(v),
 PREVIO_ROOM_KIND_MAP:v=>{try{const m=JSON.parse(v);return m&&typeof m==='object'&&!Array.isArray(m);}catch{return false;}},
 PREVIO_WRITE_ENABLED:v=>v==='sandbox-73521-only'||v==='',
 PREVIO_SEND_GUEST_CONTACT:v=>v==='test-pair-only'||v==='',
 PREVIO_WRITE_PERMISSION_ID:v=>/^PERM-\d{8}-[A-Z0-9-]{2,40}$/.test(v)||v==='',
 CASE_TEST_MAILBOX_SEND_LEDGER:v=>v==='required'||v===''
});
const fail=code=>{const e=Error(code);e.code=code;throw e;};
const auth={Authorization:'Bearer PROXY_REPLACES_THIS',Accept:'application/json'};

async function site(fetchImpl){
 const r=await fetchImpl(`${API}/sites/${SITE}.netlify.app`,{headers:auth,redirect:'error'});
 if(!r.ok)fail('NETLIFY_HTTP_'+r.status);
 const s=await r.json();
 if(s?.name!==SITE||typeof s.account_id!=='string'||typeof s.id!=='string')fail('NOT_THE_TEST_SITE');
 return s;
}

// Names and non-secret values of the allow-listed switches only.
export async function getSwitches({fetchImpl=fetch}={}){
 const s=await site(fetchImpl);
 const r=await fetchImpl(`${API}/accounts/${s.account_id}/env?site_id=${s.id}`,{headers:auth,redirect:'error'});
 if(!r.ok)fail('NETLIFY_HTTP_'+r.status);
 const list=await r.json();
 return Object.fromEntries(Object.keys(ALLOWED).map(k=>{const v=(list||[]).find(e=>e.key===k);
  return [k,v?(v.is_secret?'(secret – nem olvasható)':(v.values||[]).map(x=>`${x.context}=${x.value}`).join('; ')):'(nincs beállítva)'];}));
}

export async function setSwitch({key,value,ownerApproved,fetchImpl=fetch}={}){
 if(ownerApproved!==true)fail('OWNER_APPROVAL_REQUIRED');
 if(!Object.hasOwn(ALLOWED,key))fail('KEY_NOT_ALLOWED');
 if(typeof value!=='string'||!ALLOWED[key](value))fail('VALUE_NOT_ALLOWED');
 const s=await site(fetchImpl);
 const body={key,scopes:['builds','functions','runtime','post-processing'],values:[{value,context:'all'}],is_secret:false};
 const r=await fetchImpl(`${API}/accounts/${s.account_id}/env/${encodeURIComponent(key)}?site_id=${s.id}`,
  {method:'PUT',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error'});
 if(!r.ok)fail('NETLIFY_HTTP_'+r.status);
 return {key,set:true,note:'Érvényesüléshez TEST-kiadás kell.'};
}

if(import.meta.url===`file://${process.argv[1]}`){
 const [cmd,key,value]=process.argv.slice(2);
 const run=cmd==='get'?getSwitches():cmd==='set'?setSwitch({key,value,ownerApproved:process.argv.includes('--owner-approved')}):Promise.reject(Object.assign(Error('USAGE'),{code:'USAGE'}));
 run.then(r=>console.log(JSON.stringify(r,null,1))).catch(e=>{console.log('BLOCKED',e.code||e.message);process.exit(1);});
}
