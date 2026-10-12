import {createHash} from 'node:crypto';
import {createCaseHandler} from '../netlify/functions/booking-cases.mjs';
import {validateIsolatedPersistentConfig} from './isolated-persistent-config.mjs';
import {createPersistentOperatorHandler} from './isolated-persistent-http.mjs';
const auth='http://isolated-auth:9999',rest='http://isolated-rest:3000';
const fail=()=>{throw Error('ISOLATED_RUNTIME_NOT_READY');};

export async function createPersistentRuntime({config,anonymousKey,runtime,assets,fetchImpl=fetch}){
 if(!validateIsolatedPersistentConfig(config).ok||config.databaseHost!=='isolated-postgres'||!runtime||Object.keys(runtime).length!==2||!Object.hasOwn(runtime,'allowedOperatorEmails')||!Array.isArray(runtime.trustedProxyAddresses))fail();
 try{if(JSON.parse(Buffer.from(anonymousKey.split('.')[1],'base64url')).role!=='anon')fail();}catch{fail();}
 // Endpoints are fixed private Compose aliases, never configurable cloud URLs.
 const internal=async(url,options={})=>{
  const u=new URL(url);if(![auth,rest].includes(u.origin))fail();
  return fetchImpl(u.href,{...options,redirect:'error',signal:AbortSignal.timeout(10000)});
 };
 const identity=await internal(rest+'/rpc/sc_isolated_identity',{method:'POST',headers:{Authorization:'Bearer '+anonymousKey,'Content-Type':'application/json'},body:'{}'});
 if(!identity.ok)fail();const proof=await identity.json();
 if(proof.database!=='sc_approval_test'||proof.syntheticOnly!==true||proof.approvalInstalled!==true||proof.attestationFingerprint!==createHash('sha256').update(config.attestationKey).digest('hex'))fail();
 const rewrite=(url,options)=>{
  const u=new URL(url);if(u.origin!=='https://isolated-approval.supabase.co')fail();
  if(u.pathname.startsWith('/auth/v1/'))return internal(auth+'/'+u.pathname.slice(9)+u.search,options);
  if(u.pathname.startsWith('/rest/v1/'))return internal(rest+'/'+u.pathname.slice(9)+u.search,options);
  fail();
 };
 // Only injected fixture evidence is used. Shared modules also import the old
 // Previo fallback definition, but that transport is never invoked here and the
 // app networks have no public egress. No Gmail/Pushover/sending clients are wired.
 const reviewProviders={availability:async q=>({...q,source:'synthetic-fixture',checkedAt:new Date().toISOString(),availability:'available',availableUnits:1}),pricing:async q=>({...q,source:'synthetic-fixture',checkedAt:new Date().toISOString(),tenantId:'sarberki-test',unitId:q.cabin,capacity:6,nightly:100,basis:'per_unit',verified:true})};
 const caseHandler=createCaseHandler({env:{CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',URL:'https://leafy-chimera-2403e5.netlify.app',SUPABASE_URL:'https://isolated-approval.supabase.co',SUPABASE_PUBLISHABLE_KEY:anonymousKey,ISOLATED_APPROVAL_ATTESTATION_KEY:config.attestationKey},fetchImpl:rewrite,isolatedApproval:true,reviewProviders});
 return createPersistentOperatorHandler({config,caseHandler,assets,allowedOperatorEmails:runtime.allowedOperatorEmails,trustedProxyAddresses:runtime.trustedProxyAddresses,
  login:async({email,password})=>{
   const r=await internal(auth+'/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});if(!r.ok)fail();return r.json();
  },audit:async({tenantId,caseId,token})=>{
   const q=new URLSearchParams({tenant_id:'eq.'+tenantId,case_id:'eq.'+caseId,kind:'eq.approve_isolated_synthetic',select:'revision,actor,kind,data_hash'});
   const r=await internal(rest+'/sc_audit?'+q,{headers:{Authorization:'Bearer '+token}});if(!r.ok)fail();return r.json();
  }});
}
