// Server-only adapter preparation. Does not listen, fetch, provision or deploy.
// The injected Auth/audit transports must target separately verified isolated services.
import {isIP} from 'node:net';
import {validateIsolatedPersistentConfig} from './isolated-persistent-config.mjs';
import {isIsolatedReviewCaseId} from './isolated-review-case-id.mjs';
const staticPaths=new Set(['/isolated-persistent.html','/isolated-persistent-session.mjs',
 '/isolated-approval-panel.mjs','/isolated-persistent.css','/isolated-persistent-policy.mjs','/shared-core/case-store-client.mjs',
 '/shared-core/isolated-approval-review.mjs','/shared-core/isolated-review-case-id.mjs']);
const bearer=value=>typeof value==='string'&&/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(value);
const failure=(status,error)=>Object.assign(new Error(error),{status,error});
const headers={
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
 'Referrer-Policy':'no-referrer','Strict-Transport-Security':'max-age=31536000'
};
const syntheticEmail=value=>typeof value==='string'&&
 /^[a-z0-9][a-z0-9._+-]{0,127}@synthetic\.invalid$/.test(value);

export function createPersistentOperatorHandler({config,caseHandler,login,audit,
 assets=new Map(),allowedOperatorEmails=[],trustedProxyAddresses=['127.0.0.1','::1','::ffff:127.0.0.1'],
 clock=Date.now}={}){
 const validated=validateIsolatedPersistentConfig(config);
 if(!validated.ok||![caseHandler,login,audit,clock].every(fn=>typeof fn==='function')||
  !(assets instanceof Map)||!Array.isArray(allowedOperatorEmails)||!allowedOperatorEmails.length||
  allowedOperatorEmails.length>32||!allowedOperatorEmails.every(syntheticEmail)||
  !Array.isArray(trustedProxyAddresses)||!trustedProxyAddresses.length||trustedProxyAddresses.length>16||
  !trustedProxyAddresses.every(ip=>typeof ip==='string'&&isIP(ip)))throw Error('ISOLATED_HTTP_SETUP_REQUIRED');
 const pinnedOrigin=validated.operatorOrigin,pinnedHost=new URL(pinnedOrigin).host;
 const proxies=new Set(trustedProxyAddresses),emails=new Set(allowedOperatorEmails);
 const publicAssets=new Map([...assets].filter(([path,value])=>staticPaths.has(path)&&
  (typeof value==='string'||Buffer.isBuffer(value))));
 const buckets=new Map();let globalBucket={at:0,count:0};
 function allowLogin(peer){
  const now=clock();
  if(!Number.isFinite(now))return false;
  if(now<globalBucket.at||now-globalBucket.at>=60000)globalBucket={at:now,count:0};
  let bucket=buckets.get(peer);
  if(!bucket||now<bucket.at||now-bucket.at>=60000)bucket={at:now,count:0};
  buckets.set(peer,bucket);
  if(globalBucket.count>=20||bucket.count>=8)return false;
  globalBucket.count++;bucket.count++;return true;
 }
 async function boundedBody(req){
  if(req.headers['content-encoding']!==undefined||
   (req.headers['content-length']!==undefined&&!/^\d+$/.test(req.headers['content-length'])))throw failure(400,'INVALID_INPUT');
  if(Number(req.headers['content-length']||0)>32768)throw failure(413,'INVALID_INPUT');
  const chunks=[];let size=0;
  for await(const chunk of req.iterator({destroyOnReturn:false})){size+=Buffer.byteLength(chunk);if(size>32768)throw failure(413,'INVALID_INPUT');chunks.push(Buffer.from(chunk));}
  return Buffer.concat(chunks).toString('utf8');
 }
 return async(req,res)=>{
  const send=(status,body,type='application/json')=>{
   res.writeHead(status,{...headers,'Content-Type':type,'Connection':'close'});
   res.end(typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body));
  };
  try{
   const peer=req.socket?.remoteAddress,h=req.headers;
   const sensitive=['host','origin','x-forwarded-proto','x-forwarded-host','sec-fetch-site','authorization','content-type'];
   for(const name of sensitive){
    if(Array.isArray(h[name]))throw failure(403,'FORBIDDEN');
    if(Array.isArray(req.rawHeaders)&&req.rawHeaders.filter((value,i)=>i%2===0&&value.toLowerCase()===name).length>1)throw failure(403,'FORBIDDEN');
   }
   if(!proxies.has(peer)||h.host!==pinnedHost||h['x-forwarded-proto']!=='https'||
    (h['x-forwarded-host']!==undefined&&h['x-forwarded-host']!==pinnedHost)||
    (h.origin!==undefined&&h.origin!==pinnedOrigin))throw failure(403,'FORBIDDEN');
   if(!['GET','POST'].includes(req.method))throw failure(405,'METHOD_NOT_ALLOWED');
   if(typeof req.url!=='string'||!req.url.startsWith('/')||req.url.startsWith('//'))throw failure(400,'INVALID_INPUT');
   const url=new URL(req.url,pinnedOrigin);
   if(url.origin!==pinnedOrigin||url.username||url.password||url.hash)throw failure(400,'INVALID_INPUT');
   const isStatic=staticPaths.has(url.pathname);
   if(req.method==='POST'&&(h.origin!==pinnedOrigin||h['sec-fetch-site']!=='same-origin'))throw failure(403,'FORBIDDEN');
   if(req.method==='GET'&&h['sec-fetch-site']!=='same-origin'&&
    !(isStatic&&h['sec-fetch-site']==='none'&&h['sec-fetch-mode']==='navigate'&&h['sec-fetch-dest']==='document'))throw failure(403,'FORBIDDEN');
   if(req.method==='POST'&&!/^application\/json(?:;\s*charset=utf-8)?$/i.test(h['content-type']||''))throw failure(400,'INVALID_INPUT');
   if(req.method==='POST'&&url.pathname==='/isolated-auth/login'&&!allowLogin(peer))throw failure(429,'RATE_LIMITED');
   const body=await boundedBody(req);
   if(req.method==='GET'&&body)throw failure(400,'INVALID_INPUT');
   if(req.method==='GET'&&publicAssets.has(url.pathname))return send(200,publicAssets.get(url.pathname),url.pathname.endsWith('.html')?'text/html; charset=utf-8':url.pathname.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');
   if(req.method==='GET'&&url.pathname==='/isolated-config')return send(200,{
    enabled:true,syntheticOnly:true,deploymentMode:'persistent-isolated',operatorOrigin:pinnedOrigin,
    target:'https://isolated-approval.supabase.co'});
   if(req.method==='POST'&&url.pathname==='/isolated-auth/login'){
    let input;try{input=JSON.parse(body);}catch{throw failure(400,'INVALID_INPUT');}
    if(!input||Array.isArray(input)||Object.keys(input).length!==2||!Object.hasOwn(input,'email')||
     !Object.hasOwn(input,'password')||!emails.has(input.email)||typeof input.password!=='string'||
     input.password.length<1||input.password.length>1024)throw failure(403,'AUTH_REQUIRED');
    let result;try{result=await login({email:input.email,password:input.password});}catch{throw failure(403,'AUTH_REQUIRED');}
    if(typeof result?.access_token!=='string'||!bearer('Bearer '+result.access_token))throw failure(403,'AUTH_REQUIRED');
    return send(200,{access_token:result.access_token});
   }
   if(url.pathname==='/.netlify/functions/booking-cases'){
    if(!bearer(h.authorization))throw failure(401,'AUTH_REQUIRED');
    let input;try{input=req.method==='GET'?Object.fromEntries(url.searchParams):JSON.parse(body);}catch{throw failure(400,'INVALID_INPUT');}
    if(input?.tenantId!=='sarberki-test')throw failure(403,'FORBIDDEN');
    const result=await caseHandler({httpMethod:req.method,headers:{authorization:h.authorization},
     body,queryStringParameters:Object.fromEntries(url.searchParams)});
    if(!Number.isInteger(result?.statusCode)||result.statusCode<200||result.statusCode>599||typeof result.body!=='string')throw failure(503,'SERVICE_UNAVAILABLE');
    return send(result.statusCode,result.body);
   }
   if(req.method==='GET'&&url.pathname==='/isolated-audit'){
    if(!bearer(h.authorization))throw failure(401,'AUTH_REQUIRED');
    const caseId=url.searchParams.get('caseId');
    if(!isIsolatedReviewCaseId(caseId)||[...url.searchParams.keys()].some(k=>k!=='caseId'))throw failure(400,'INVALID_INPUT');
    let records;try{records=await audit({tenantId:'sarberki-test',caseId,token:h.authorization.slice(7)});}catch{throw failure(403,'FORBIDDEN');}
    if(!Array.isArray(records)||records.length>200)throw failure(503,'SERVICE_UNAVAILABLE');
    const safe=records.map(r=>{
     if(!Number.isSafeInteger(r?.revision)||r.revision<1||! /^[a-f0-9-]{36}$/.test(r.actor||'')||
      r.kind!=='approve_isolated_synthetic'||! /^[a-f0-9]{64}$/.test(r.data_hash||''))throw failure(503,'SERVICE_UNAVAILABLE');
     return {revision:r.revision,actor:r.actor,kind:r.kind,data_hash:r.data_hash};
    });
    return send(200,safe);
   }
   return send(404,{error:'NOT_FOUND'});
  }catch(error){return send(error.status||503,{error:error.error||'SERVICE_UNAVAILABLE'});}
 };
}
