import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {createPersistentOperatorHandler} from '../shared-core/isolated-persistent-http.mjs';
const origin='https://operator.isolated.example.invalid';
const config=()=>({enabled:true,operatorOrigin:origin,expectedOperatorOrigin:origin,
 databaseHost:'isolated-approval-db',databaseName:'sc_approval_test',syntheticOnly:true,
 emailSendingEnabled:false,pushoverSendingEnabled:false,realBookingsEnabled:false,attestationKey:'ab'.repeat(32)});
const token='synthetic-operator-token-for-tests-only';
const caseId='8b9597a1-c72d-4fde-9ef4-610d6865a3a3';
async function fixture(t,extra={}){
 const calls={login:[],api:[],audit:[]};
 const handler=createPersistentOperatorHandler({config:config(),allowedOperatorEmails:['approval-operator@synthetic.invalid','approval-writer@synthetic.invalid'],
  assets:new Map([['/isolated-persistent.html','<h1>Synthetic</h1>'],['/isolated-persistent.css','body{}'],['/isolated-persistent-policy.mjs','export const enabled=false;'],['/private-key.json','SECRET']]),
  login:async input=>{calls.login.push(input);return {access_token:token,refresh_token:'DO-NOT-OUTPUT',password:'DO-NOT-OUTPUT'};},
  caseHandler:async input=>{calls.api.push(input);return {statusCode:200,body:JSON.stringify({result:{caseId}})};},
  audit:async input=>{calls.audit.push(input);return [{revision:3,actor:caseId,kind:'approve_isolated_synthetic',data_hash:'cd'.repeat(32),secret:'DO-NOT-OUTPUT'}];},...extra});
 const server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 async function call(path,{method='GET',headers={},body='',chunked=false}={}){
  return new Promise((resolve,reject)=>{
   const req=request({host:'127.0.0.1',port:server.address().port,path,method,headers:{Host:new URL(origin).host,'X-Forwarded-Proto':'https','Sec-Fetch-Site':'same-origin',...(method==='POST'?{Origin:origin,'Content-Type':'application/json'}:{}),...headers}},res=>{
    const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:Buffer.concat(chunks).toString()}));
   });req.on('error',reject);if(chunked){req.write(body.slice(0,10000));req.end(body.slice(10000));}else req.end(body);
  });
 }
 return {calls,call};
}
test('invalid config, source origin, untrusted proxy or nonsynthetic email setup stays closed',()=>{
 const base={config:config(),login:()=>{},audit:()=>{},caseHandler:()=>{},allowedOperatorEmails:['operator@synthetic.invalid']};
 for(const changed of [{config:{...config(),enabled:false}},{allowedOperatorEmails:['guest@example.com']},{trustedProxyAddresses:['*']},{allowedOperatorEmails:[]}])assert.throws(()=>createPersistentOperatorHandler({...base,...changed}),/ISOLATED_HTTP_SETUP_REQUIRED/);
});
test('exact proxy HTTPS and same-origin gates precede all transports',async t=>{
 const {call,calls}=await fixture(t);
 for(const headers of [{Host:'leafy-chimera-2403e5.netlify.app'},{'X-Forwarded-Proto':'http'},
  {'X-Forwarded-Host':'attacker.invalid'},{Origin:'https://attacker.invalid'},
  {'Sec-Fetch-Site':'cross-site'},{'Sec-Fetch-Site':''}])assert.equal((await call('/isolated-config',{headers})).status,403);
 const other=await fixture(t,{trustedProxyAddresses:['192.0.2.1']});assert.equal((await other.call('/isolated-config')).status,403);
 assert.deepEqual(calls,{login:[],api:[],audit:[]});
 const response=await call('/isolated-config');assert.equal(response.status,200);
 assert.deepEqual(JSON.parse(response.text),{enabled:true,syntheticOnly:true,deploymentMode:'persistent-isolated',operatorOrigin:origin,target:'https://isolated-approval.supabase.co'});
 assert.equal(response.text.includes(config().attestationKey),false);
});
test('approved assets only, navigation metadata and restrictive response headers',async t=>{
 const {call}=await fixture(t);
 const r=await call('/isolated-persistent.html',{headers:{'Sec-Fetch-Site':'none','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'}});
 assert.equal(r.status,200);assert.match(r.headers['content-security-policy'],/frame-ancestors 'none'/);
 assert.equal(r.headers['cache-control'],'no-store');assert.equal(r.headers['access-control-allow-origin'],undefined);
 assert.equal((await call('/isolated-persistent.css')).headers['content-type'],'text/css; charset=utf-8');
 assert.equal((await call('/isolated-persistent-policy.mjs')).status,200);
 assert.equal((await call('/private-key.json')).status,404);
 assert.equal((await call('/\\attacker.invalid/isolated-config')).status,400);
 assert.equal((await call('/isolated-config',{headers:{'Sec-Fetch-Site':'none','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'}})).status,403);
});
test('login explicit synthetic allowlist, exact JSON and secret-free success/failure',async t=>{
 const {call,calls}=await fixture(t);
 const input={email:'approval-operator@synthetic.invalid',password:'synthetic-test-password'};
 for(const value of [{...input,email:'guest@example.com'},{...input,email:'unknown@synthetic.invalid'},{...input,role:'admin'},null,[]])assert.equal((await call('/isolated-auth/login',{method:'POST',body:JSON.stringify(value)})).status,403);
 const r=await call('/isolated-auth/login',{method:'POST',body:JSON.stringify(input)});
 assert.equal(r.status,200);assert.deepEqual(JSON.parse(r.text),{access_token:token});assert.equal(r.text.includes(input.password),false);
 assert.equal(calls.login.length,1);
 const broken=await fixture(t,{login:async()=>{throw Error('private-password');}});
 const failed=await broken.call('/isolated-auth/login',{method:'POST',body:JSON.stringify(input)});
 assert.equal(failed.status,403);assert.equal(failed.text.includes('private-password'),false);
});
test('POST requires origin and metadata, rejects wrong type and oversized fixed or chunked bodies',async t=>{
 const {call,calls}=await fixture(t);const path='/isolated-auth/login';
 assert.equal((await call(path,{method:'POST',headers:{Origin:''},body:'{}'})).status,403);
 assert.equal((await call(path,{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'})).status,400);
 assert.equal((await call(path,{method:'POST',headers:{'Content-Length':'32769'},body:'x'.repeat(32769)})).status,413);
 assert.equal((await call(path,{method:'POST',body:'x'.repeat(32769),chunked:true})).status,413);
 assert.equal(calls.login.length,0);
});
test('bounded login attempts cannot bypass limiter using forwarded client addresses',async t=>{
 let now=100000;const {call,calls}=await fixture(t,{clock:()=>now});
 const body=JSON.stringify({email:'approval-operator@synthetic.invalid',password:'synthetic-password'});
 for(let i=0;i<8;i++)assert.equal((await call('/isolated-auth/login',{method:'POST',body,headers:{'X-Forwarded-For':'192.0.2.'+i}})).status,200);
 assert.equal((await call('/isolated-auth/login',{method:'POST',body})).status,429);assert.equal(calls.login.length,8);
 now+=60000;assert.equal((await call('/isolated-auth/login',{method:'POST',body})).status,200);
});
test('API preserves bearer identity but limits tenant; audit whitelists fields',async t=>{
 const {call,calls}=await fixture(t);const authorization='Bearer '+token;
 assert.equal((await call('/.netlify/functions/booking-cases?tenantId=sarberki-test&caseId='+caseId)).status,401);
 assert.equal((await call('/.netlify/functions/booking-cases?tenantId=demo-test',{headers:{Authorization:authorization}})).status,403);
 const r=await call('/.netlify/functions/booking-cases?tenantId=sarberki-test&caseId='+caseId,{headers:{Authorization:authorization}});
 assert.equal(r.status,200);assert.equal(calls.api[0].headers.authorization,authorization);
 const audit=await call('/isolated-audit?caseId='+caseId,{headers:{Authorization:authorization}});
 assert.equal(audit.status,200);assert.equal(audit.text.includes('DO-NOT-OUTPUT'),false);
 assert.deepEqual(calls.audit[0],{tenantId:'sarberki-test',caseId,token});
 assert.equal((await call('/isolated-audit?caseId='+caseId+'&tenantId=demo-test',{headers:{Authorization:authorization}})).status,400);
});
