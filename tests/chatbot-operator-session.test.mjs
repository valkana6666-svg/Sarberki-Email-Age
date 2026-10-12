import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperatorSession,initOperatorPanel} from '../sarberki-chatbot-project/operator-session.mjs';
const at=Date.parse('2026-10-12T10:00:00Z'),id='case-synthetic';
const jwt=claims=>'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.synthetic';
const token=jwt({role:'authenticated',sub:'synthetic-actor',exp:at/1000+3600});
const config={enabled:true,syntheticOnly:true,tenantId:'sarberki-test',supabaseUrl:'https://mojnqizbcaczstguikpv.supabase.co',publishableKey:'sb_publishable_synthetic123456'};
const decision={facts:{language:'en',guests:2},missing:[],contradictions:[],requiresHumanReview:false,capacity:{status:'UNKNOWN',verified:false},pricing:{verified:false},safety:{emailSent:false,bookingCreated:false,approval:'pending'}};
function fixture(overrides={}){
 const calls=[],preview={caseId:id,revision:2,approval:'pending',persisted:false,text:'SYNTHETIC',operatorReviewText:'Magyar szintetikus ellenőrző szöveg',decision,readOnlyFreshness:{verified:true,syntheticOnly:true,checkedAt:new Date(at).toISOString(),source:'stored-synthetic-case',tenantId:'sarberki-test',caseId:id,revision:2},...overrides};
 const request=async(url,options)=>{calls.push({url,options});const body=url.includes('chatbot-test-config')?config:url.includes('/auth/')?{access_token:token,user:{id:'synthetic-actor'}}:url.includes('preview-draft')?preview:{tenantId:'sarberki-test',caseId:id,revision:2,data:{id,tenantId:'sarberki-test',sender:'synthetic@guest.invalid'}};return {ok:true,json:async()=>body===preview||url.includes('booking-cases')?{result:body}:body};};
 return {calls,preview,request};
}
test('operator explicit login then GET exact stored test case and common planner preview, no writes',async()=>{
 const f=fixture(),session=createOperatorSession({request:f.request,now:()=>at});assert.equal(f.calls.length,0);
 await session.login('operator@synthetic.invalid','not-a-real-password');const result=await session.loadCase(id);
 assert.equal(result.fresh,true);assert.match(result.text,/not yet been verified/);assert.match(result.operatorReviewText,/nem igazolt/);assert.match(result.audit,/NEM IGAZOLT/);
 assert.deepEqual(f.calls.map(x=>x.options.method),['GET','POST','GET','GET']);assert.equal(f.calls[1].url,config.supabaseUrl+'/auth/v1/token?grant_type=password');
 for(const c of f.calls.slice(2)){assert.equal(c.options.body,undefined);assert.equal(c.options.headers.Authorization,'Bearer '+token);assert.equal(c.options.redirect,'error');}
 session.logout();await assert.rejects(session.loadCase(id),/AUTH_REQUIRED/);
});
test('wrong tenant or unsafe config never sends credentials to Auth',async()=>{
 for(const change of [{tenantId:'other'},{syntheticOnly:false},{enabled:false},{supabaseUrl:'https://foreign.supabase.co'},{publishableKey:jwt({role:'service_role'})}]){
  let calls=0;const session=createOperatorSession({now:()=>at,request:async()=>{calls++;return {ok:true,json:async()=>({...config,...change})};}});
  await assert.rejects(session.login('operator@synthetic.invalid','synthetic'),/SETUP_REQUIRED/);assert.equal(calls,1);
 }
});
test('unauthorized, expired token and mismatched Auth actor never acquire a readable session',async()=>{
 for(const body of [{access_token:jwt({role:'authenticated',sub:'synthetic-actor',exp:at/1000-1}),user:{id:'synthetic-actor'}},{access_token:token,user:{id:'wrong-actor'}},{access_token:'invalid',user:{id:'synthetic-actor'}}]){
  const session=createOperatorSession({now:()=>at,request:async url=>({ok:true,json:async()=>url.includes('config')?config:body})});await assert.rejects(session.login('operator@synthetic.invalid','synthetic'),/AUTH_REQUIRED/);await assert.rejects(session.loadCase(id),/AUTH_REQUIRED/);
 }
 const f=fixture(),session=createOperatorSession({now:()=>at,request:async(url,options)=>url.includes('booking-cases')?{ok:false,json:async()=>({error:'FORBIDDEN'})}:f.request(url,options)});await session.login('operator@synthetic.invalid','synthetic');await assert.rejects(session.loadCase(id),/FORBIDDEN/);
});
test('missing, stale, future or wrong scope freshness stays unverified',async()=>{
 for(const readOnlyFreshness of [null,{verified:true}, {...fixture().preview.readOnlyFreshness,checkedAt:new Date(at-120001).toISOString()}, {...fixture().preview.readOnlyFreshness,checkedAt:new Date(at+1).toISOString()},{...fixture().preview.readOnlyFreshness,tenantId:'other'},{...fixture().preview.readOnlyFreshness,revision:3}]){
  const f=fixture({readOnlyFreshness}),session=createOperatorSession({request:f.request,now:()=>at});await session.login('operator@synthetic.invalid','synthetic');assert.equal((await session.loadCase(id)).fresh,false);
 }
});
test('malformed, wrong-tenant record and invalid preview are rejected',async()=>{
 for(const changes of [{revision:3},{approval:'approved'},{persisted:true},{decision:null},{caseId:'case-foreign'}]){
  const f=fixture(changes),session=createOperatorSession({request:f.request,now:()=>at});await session.login('operator@synthetic.invalid','synthetic');await assert.rejects(session.loadCase(id),/INVALID_DATA/);
 }
 const f=fixture(),session=createOperatorSession({now:()=>at,request:async(url,options)=>url.includes('booking-cases')?{ok:true,json:async()=>({result:{tenantId:'other'}})}:f.request(url,options)});await session.login('operator@synthetic.invalid','synthetic');await assert.rejects(session.loadCase(id),/INVALID_DATA/);
});
test('logout prevents pending auth or case response from restoring a session',async()=>{
 const f=fixture();let release;
 const session=createOperatorSession({now:()=>at,request:async(url,options)=>url.includes('/auth/')?new Promise(r=>release=()=>r({ok:true,json:async()=>({access_token:token,user:{id:'synthetic-actor'}})})):f.request(url,options)});
 const login=session.login('operator@synthetic.invalid','synthetic');await new Promise(r=>setImmediate(r));session.logout();release();await assert.rejects(login,/SESSION_CHANGED/);await assert.rejects(session.loadCase(id),/AUTH_REQUIRED/);
 const g=fixture();let finish;const reader=createOperatorSession({now:()=>at,request:async(url,options)=>url.includes('preview-draft')?new Promise(r=>finish=()=>r({ok:true,json:async()=>({result:g.preview})})):g.request(url,options)});await reader.login('operator@synthetic.invalid','synthetic');const load=reader.loadCase(id);await new Promise(r=>setImmediate(r));reader.logout();finish();await assert.rejects(load,/AUTH_REQUIRED|SESSION_CHANGED/);
});
test('token expiry after login prevents case network access',async()=>{
 const f=fixture();let time=at;const session=createOperatorSession({request:f.request,now:()=>time});await session.login('operator@synthetic.invalid','synthetic');time+=3600000;await assert.rejects(session.loadCase(id),/AUTH_REQUIRED/);assert.equal(f.calls.length,2);
});

function dom(){
 const events={},data=new Map();for(const id of ['operator_login','operator_email','operator_password','operator_status','operator_logout','server_case_id','server_case_load','server_data_status','server_chat_reply','server_operator_hu','server_guest_draft'])data.set(id,{value:'',textContent:'',listeners:{},addEventListener(event,callback){this.listeners[event]=callback;}});
 data.get('operator_email').value='operator@synthetic.invalid';data.get('operator_password').value='synthetic';data.get('server_case_id').value=id;
 return {getElementById:key=>data.get(key),data,addEventListener:(event,callback)=>events[event]=callback,events};
}
test('operator panel clears password immediately and pagehide/logout clear all server output',async()=>{
 const f=fixture(),documentRef=dom(),windowEvents={};initOperatorPanel({documentRef,windowRef:{addEventListener:(event,callback)=>windowEvents[event]=callback},request:f.request,now:()=>at});
 const login=documentRef.data.get('operator_login').listeners.submit({preventDefault(){}});assert.equal(documentRef.data.get('operator_password').value,'');await login;
 await documentRef.data.get('server_case_load').listeners.click();assert.match(documentRef.data.get('server_chat_reply').value,/not yet been verified/);
 windowEvents.pagehide();for(const field of ['server_chat_reply','server_operator_hu','server_guest_draft'])assert.equal(documentRef.data.get(field).value,'');
 await documentRef.data.get('server_case_load').listeners.click();assert.match(documentRef.data.get('server_data_status').textContent,/nem igazolt/);
});
test('operator panel editing case ID or session change suppresses late readback',async()=>{
 for(const change of ['case','session']){
  const f=fixture(),documentRef=dom();let release;
  initOperatorPanel({documentRef,windowRef:null,now:()=>at,request:async(url,options)=>url.includes('preview-draft')?new Promise(r=>release=()=>r({ok:true,json:async()=>({result:f.preview})})):f.request(url,options)});
  await documentRef.data.get('operator_login').listeners.submit({preventDefault(){}});const load=documentRef.data.get('server_case_load').listeners.click();await new Promise(r=>setImmediate(r));
  if(change==='case')documentRef.data.get('server_case_id').listeners.input();else documentRef.events['isolated-approval-session-changed']();release();await load;
  assert.equal(documentRef.data.get('server_chat_reply').value,'');assert.equal(documentRef.data.get('server_operator_hu').value,'');
 }
});

test('stale readback cannot advertise a supplied positive capacity or price as current',async()=>{
 const f=fixture({readOnlyFreshness:null,decision:{...decision,capacity:{status:'AVAILABLE',verified:true},pricing:{verified:true}}}),session=createOperatorSession({request:f.request,now:()=>at});await session.login('operator@synthetic.invalid','synthetic');const result=await session.loadCase(id);assert.equal(result.fresh,false);assert.match(result.text,/not yet been verified/);assert.match(result.capacity,/NEM IGAZOLT/);assert.match(result.price,/NEM IGAZOLT/);
});

function availableDecision(evidenceChange={}){
 const evidence={tenantId:'sarberki-test',unit:'deluxe',arrival:'2026-11-13',departure:'2026-11-15',source:'synthetic-fixture',checkedAt:new Date(at).toISOString(),valid:true,status:'AVAILABLE',availableUnits:1,...evidenceChange};
 return {...decision,facts:{...decision.facts,dates:{arrival:evidence.arrival,departure:evidence.departure}},capacity:{status:'AVAILABLE',verified:true,input:{arrival:'2026-11-13',departure:'2026-11-15',guests:2},selectedOptions:[{key:'deluxe',units:1,evidence}]},pricing:{verified:true}};
}
test('fresh case cannot lend its timestamp to missing/stale/foreign capacity evidence or unsafe draft',async()=>{
 for(const change of [{checkedAt:new Date(at-120001).toISOString()},{checkedAt:new Date(at+1).toISOString()},{tenantId:'other'},{arrival:'2026-11-12'},{source:null},{valid:false},{availableUnits:'1'}]){
  const f=fixture({decision:availableDecision(change),operatorReviewText:'HAMIS IGAZOLT KAPACITÁS',text:'HAMIS FOGLALHATÓSÁG'}),session=createOperatorSession({request:f.request,now:()=>at});await session.login('operator@synthetic.invalid','synthetic');const result=await session.loadCase(id);
  assert.equal(result.fresh,true);assert.match(result.status,/Supabase.*2026-10-12/);assert.match(result.capacity,/idő: NEM IGAZOLT/);assert.match(result.price,/NEM IGAZOLT/);assert.match(result.operatorReviewText,/nem igazolt/);assert.equal(result.draft,'');
 }
});
test('bound current synthetic capacity has separate source/time; unavailable and split without provenance remain unknown',async()=>{
 const priceProof={source:'synthetic-fixture',checkedAt:new Date(at).toISOString(),tenantId:'sarberki-test',arrival:'2026-11-13',departure:'2026-11-15',guests:2,units:1,unitId:'deluxe'};const positive={...availableDecision(),pricing:{verified:true,evidence:priceProof}};
 const f=fixture({decision:positive}),session=createOperatorSession({request:f.request,now:()=>at});await session.login('operator@synthetic.invalid','synthetic');const result=await session.loadCase(id);assert.match(result.capacity,/synthetic-fixture.*2026-10-12/);assert.equal(result.draft,'SYNTHETIC');assert.match(result.price,/nem jóváhagyott vendégár/);
 for(const capacity of [{status:'UNAVAILABLE',verified:true,selectedOptions:[]},{status:'AVAILABLE',verified:true,selectedOptions:[{key:'splitAB',units:1}]}]){
  const g=fixture({decision:{...availableDecision(),capacity}}),reader=createOperatorSession({request:g.request,now:()=>at});await reader.login('operator@synthetic.invalid','synthetic');const r=await reader.loadCase(id);assert.match(r.capacity,/NEM IGAZOLT/);assert.equal(r.draft,'');
 }
});

test('current capacity cannot lend its timestamp to absent/stale/wrong scope price evidence',async()=>{
 const price={source:'synthetic-fixture',checkedAt:new Date(at).toISOString(),tenantId:'sarberki-test',arrival:'2026-11-13',departure:'2026-11-15',guests:2,units:1,unitId:'deluxe'};
 for(const evidence of [null,{...price,checkedAt:new Date(at-120001).toISOString()},{...price,guests:3},{...price,units:2},{...price,tenantId:'other'},{...price,source:null}]){
  const f=fixture({decision:{...availableDecision(),pricing:{verified:true,evidence}},operatorReviewText:'HAMIS IGAZOLT ÁR',text:'HAMIS VENDÉGÁR'}),session=createOperatorSession({request:f.request,now:()=>at});await session.login('operator@synthetic.invalid','synthetic');const result=await session.loadCase(id);
  assert.match(result.capacity,/synthetic-fixture/);assert.match(result.price,/idő: NEM IGAZOLT/);assert.doesNotMatch(result.text,/verified price/);assert.doesNotMatch(result.operatorReviewText,/HAMIS|ellenőrzött ár/);assert.equal(result.draft,'');
 }
});
