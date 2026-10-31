// Server-only credential transport. Supabase Auth and existing DB memberships
// remain the authority; the encrypted cookie is never an authorization grant.
import {randomBytes,createCipheriv,createDecipheriv,createHmac,timingSafeEqual} from 'node:crypto';
import {createSupabaseTransport,createSupabaseAuthority} from './supabase-case-repository.mjs';
import {isPublishableKey} from '../netlify/functions/chatbot-test-config.mjs';
const origin='https://leafy-chimera-2403e5.netlify.app';
const project='https://mojnqizbcaczstguikpv.supabase.co';
const name='__Host-sarberki-operator',ttl=7*24*60*60*1000;
// Inactivity limit, decided only by the server clock inside the encrypted cookie.
// The skew allowance only tolerates clock differences between function instances.
const idle=30*60*1000,skew=60*1000;
const aad=Buffer.from(name+'|'+origin+'|'+project+'|v1');
export const clearOperatorCookie=name+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
export class OperatorSessionError extends Error{
 constructor(status,code,setCookie=null,category=code){super(code);this.status=status;this.code=code;this.setCookie=setCookie;this.category=category;}
}
const fail=(status,code,setCookie=null,category=code)=>{throw new OperatorSessionError(status,code,setCookie,category);};
// Fixed error categories only; no credential/header/configuration values or upstream text.
export const operatorSessionErrorBody=error=>({error:error.code,diagnostic:{category:error.category}});
function header(event,key){
 const values=Object.entries(event.headers||{}).filter(([k])=>k.toLowerCase()===key).map(([,v])=>v);
 const multiEntries=Object.entries(event.multiValueHeaders||{}).filter(([k])=>k.toLowerCase()===key);
 if(multiEntries.some(([,v])=>!Array.isArray(v)))fail(403,'FORBIDDEN');
 const multi=multiEntries.flatMap(([,v])=>v);
 if(values.length>1||values.some(v=>typeof v!=='string'||v.length>8192)||multi.length>1||multi.some(v=>typeof v!=='string'||v.length>8192)||
  (values.length===1&&multi.length===1&&values[0]!==multi[0]))fail(403,'FORBIDDEN');
 return values[0]??multi[0];
}
export function createOperatorCookieSession({env=process.env,fetchImpl=fetch,now=Date.now}={}){
 function setup(){
  if(env.URL!==origin||env.CASE_STORE_ENABLED!=='synthetic-only'||env.CASE_STORE_TEST_TENANTS!=='sarberki-test,demo-test'||
    env.SUPABASE_URL!==project||!isPublishableKey(env.SUPABASE_PUBLISHABLE_KEY)||!/^[a-f0-9]{64}$/.test(env.SARBERKI_OPERATOR_SESSION_KEY||''))fail(503,'SESSION_SETUP_REQUIRED');
  return Buffer.from(env.SARBERKI_OPERATOR_SESSION_KEY,'hex');
 }
 function boundary(event,{post=false}={}){
  setup();
  if(header(event,'host')!==new URL(origin).host||header(event,'x-sarberki-operator')!=='1'||header(event,'sec-fetch-site')!=='same-origin'||
    (header(event,'origin')!==undefined&&header(event,'origin')!==origin)||post&&header(event,'origin')!==origin)fail(403,'FORBIDDEN');
 }
 function encrypt(payload){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',setup(),iv);cipher.setAAD(aad);
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
  return ['v1',iv.toString('base64url'),encrypted.toString('base64url'),cipher.getAuthTag().toString('base64url')].join('.');
 }
 function cookie(payload){
  const remaining=payload.expiresAt-now();if(remaining<=0||remaining>ttl)fail(401,'AUTH_REQUIRED',null);
  const value=encrypt(payload);if(value.length>3800)fail(503,'SESSION_SERVICE_UNAVAILABLE');
  return name+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+Math.ceil(remaining/1000)+'; Expires='+new Date(payload.expiresAt).toUTCString();
 }
 // A denial describes the REQUEST cookie, which may already be stale. Never
 // delete the browser's current cookie on read/login/refresh failure: a later
 // response could otherwise erase a successful login in another tab. Only
 // explicit logout clears it; every failed request still denies access.
 function read(event,{allowIdle=false}={}){
  const raw=header(event,'cookie')||'';if(raw.length>8192)fail(401,'AUTH_REQUIRED',null);
  const found=raw.split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));
  if(found.length!==1)fail(401,'AUTH_REQUIRED',null,found.length?'SESSION_COOKIE_INVALID':'SESSION_COOKIE_MISSING');
  let payload;
  try{
   const parts=found[0].slice(name.length+1).split('.');
   if(parts.length!==4||parts[0]!=='v1'||parts.slice(1).some(x=>! /^[A-Za-z0-9_-]+$/.test(x)))throw Error();
   const iv=Buffer.from(parts[1],'base64url'),tag=Buffer.from(parts[3],'base64url');if(iv.length!==12||tag.length!==16)throw Error();
   const decipher=createDecipheriv('aes-256-gcm',setup(),iv);decipher.setAAD(aad);decipher.setAuthTag(tag);
   payload=JSON.parse(Buffer.concat([decipher.update(Buffer.from(parts[2],'base64url')),decipher.final()]).toString('utf8'));
   if(Number.isSafeInteger(payload?.expiresAt)&&payload.expiresAt<=now())fail(401,'AUTH_REQUIRED',null,'SESSION_EXPIRED');
   if(Object.keys(payload).sort().join(',')!=='csrfToken,expiresAt,idleExpiresAt,refreshToken'||! /^[A-Za-z0-9_-]{10,512}$/.test(payload.refreshToken)||
    ! /^[a-f0-9]{64}$/.test(payload.csrfToken)||!Number.isSafeInteger(payload.expiresAt)||payload.expiresAt<=now()||payload.expiresAt-now()>ttl||
    !Number.isSafeInteger(payload.idleExpiresAt)||payload.idleExpiresAt>payload.expiresAt||payload.idleExpiresAt-now()>idle+skew)throw Error();
  }catch(error){if(error instanceof OperatorSessionError)throw error;fail(401,'AUTH_REQUIRED',null,'SESSION_COOKIE_INVALID');}
  if(!allowIdle&&payload.idleExpiresAt<=now())fail(401,'AUTH_REQUIRED',null,'SESSION_IDLE');
  return payload;
 }
 function csrf(event,payload){
  const value=header(event,'x-csrf-token');
  if(typeof value!=='string'||! /^[a-f0-9]{64}$/.test(value)||!timingSafeEqual(Buffer.from(value,'hex'),Buffer.from(payload.csrfToken,'hex')))fail(403,'FORBIDDEN',null,'CSRF_REJECTED');
 }
 async function auth(path,{body,token,logout=false}={}){
  let response;
  try{response=await fetchImpl(project+'/auth/v1/'+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});}
  catch{fail(503,'SESSION_SERVICE_UNAVAILABLE');}
  if(!response.ok){
   if([400,401,403].includes(response.status))fail(response.status===403?403:401,response.status===403?'FORBIDDEN':'AUTH_REQUIRED',null,path.includes('grant_type=refresh_token')?'AUTH_REFRESH_REJECTED':'AUTH_LOGIN_REJECTED');
   fail(503,'SESSION_SERVICE_UNAVAILABLE');
  }
  if(logout)return;
  try{return await response.json();}catch{fail(503,'SESSION_SERVICE_UNAVAILABLE');}
 }
 function tokens(result){
  let claims;try{claims=JSON.parse(Buffer.from(result.access_token.split('.')[1],'base64url').toString());}catch{}
  if(typeof result?.access_token!=='string'||! /^[A-Za-z0-9._-]{20,8192}$/.test(result.access_token)||claims?.role!=='authenticated'||
    typeof claims.sub!=='string'||!claims.sub||claims.sub!==result.user?.id||!Number.isFinite(claims.exp)||claims.exp*1000<=now()||
    ! /^[A-Za-z0-9_-]{10,512}$/.test(result.refresh_token||''))fail(401,'AUTH_REQUIRED',null);
  return result;
 }
 async function authority(token){
  const transport=createSupabaseTransport({url:project,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,token,fetchImpl});
  let resolved;
  try{resolved=await createSupabaseAuthority(transport)();}
  catch(error){if(error.code==='FORBIDDEN')fail(403,'FORBIDDEN',null,'AUTHORITY_REJECTED');fail(503,'SESSION_SERVICE_UNAVAILABLE');}
  let subject;try{subject=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub;}catch{}
  if(resolved.subject!==subject||!resolved.tenants?.['sarberki-test']?.includes('read'))fail(403,'FORBIDDEN',null,'MEMBERSHIP_DENIED');
  return {authority:resolved,transport};
 }
  // Per-login key for the daily view's encrypted local snapshot. Derived from the server secret and this
 // login's CSRF nonce: obtainable only through an authenticated, non-idle session; never stored in the cookie.
 const stateKey=payload=>createHmac('sha256',setup()).update('napi-state-v1|sarberki-test|'+payload.csrfToken).digest('hex');
 const metadata=payload=>({authenticated:true,tenantId:'sarberki-test',expiresAt:new Date(payload.expiresAt).toISOString(),csrfToken:payload.csrfToken,stateKey:stateKey(payload)});
 async function refreshed(payload){
  const result=tokens(await auth('token?grant_type=refresh_token',{body:{refresh_token:payload.refreshToken}}));
  const verified=await authority(result.access_token);
  const updated={...payload,refreshToken:result.refresh_token,idleExpiresAt:Math.min(now()+idle,payload.expiresAt)};
  return {...verified,metadata:metadata(updated),setCookie:cookie(updated),payload:updated,accessToken:result.access_token};
 }
 return Object.freeze({
  async login(event,input){
   boundary(event,{post:true});
   if(!input||Array.isArray(input)||Object.keys(input).sort().join(',')!=='action,email,password'||input.action!=='login'||
     typeof input.email!=='string'||input.email.length>254||! /^[^@\s]+@[^@\s]+$/.test(input.email)||typeof input.password!=='string'||input.password.length<1||input.password.length>1024)fail(400,'INVALID_INPUT');
   const result=tokens(await auth('token?grant_type=password',{body:{email:input.email,password:input.password}}));
   await authority(result.access_token);
   const expiresAt=now()+ttl,payload={refreshToken:result.refresh_token,csrfToken:randomBytes(32).toString('hex'),expiresAt,idleExpiresAt:Math.min(now()+idle,expiresAt)};
   return {metadata:metadata(payload),setCookie:cookie(payload)};
  },
  async restore(event){boundary(event);return refreshed(read(event));},
  async protectedRead(event){boundary(event);const payload=read(event);csrf(event,payload);return refreshed(payload);},
  async protectedApproval(event){
   boundary(event,{post:true});
   if(event.httpMethod!=='POST')fail(405,'METHOD_NOT_ALLOWED');
   const payload=read(event);csrf(event,payload);
   const verified=await refreshed(payload);
   if(!verified.authority.tenants?.['sarberki-test']?.includes('approve'))fail(403,'FORBIDDEN',verified.setCookie);
   return verified;
  },
  async protectedWrite(event){
   boundary(event,{post:true});
   if(event.httpMethod!=='POST')fail(405,'METHOD_NOT_ALLOWED');
   const payload=read(event);csrf(event,payload);
   const verified=await refreshed(payload);
   // Fresh Auth + DB membership, never a browser role or cookie claim.
   // Preserve the rotated Reader cookie even when this write is denied.
   if(!verified.authority.tenants?.['sarberki-test']?.includes('write'))fail(403,'FORBIDDEN',verified.setCookie);
   return verified;
  },
  async logout(event){
   // An idle-expired cookie must still be able to revoke its own Auth session.
   boundary(event,{post:true});const payload=read(event,{allowIdle:true});csrf(event,payload);
   // Losing DB membership must not prevent revoking one's own Auth session.
   try{const result=tokens(await auth('token?grant_type=refresh_token',{body:{refresh_token:payload.refreshToken}}));await auth('logout?scope=local',{token:result.access_token,logout:true});}
   catch(error){if(error instanceof OperatorSessionError){error.setCookie=clearOperatorCookie;throw error;}fail(503,'SESSION_SERVICE_UNAVAILABLE',clearOperatorCookie);}
   return {metadata:{authenticated:false},setCookie:clearOperatorCookie};
  }
 });
}
