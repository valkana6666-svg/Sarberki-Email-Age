import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperatorSession,initOperatorPanel} from '../sarberki-chatbot-project/operator-session.mjs';
import {createCaseStoreClient} from '../shared-core/case-store-client.mjs';
const at=Date.parse('2026-10-12T10:00:00Z'),id='case-synthetic';
const metadata={authenticated:true,tenantId:'sarberki-test',expiresAt:new Date(at+7*86400000).toISOString(),csrfToken:'a'.repeat(64)};
const decision={facts:{language:'en',guests:2},missing:[],contradictions:[],requiresHumanReview:false,capacity:{status:'UNKNOWN',verified:false},pricing:{verified:false},safety:{emailSent:false,bookingCreated:false,approval:'pending'}};
function fixture(overrides={}){
 const calls=[],preview={caseId:id,revision:2,approval:'pending',persisted:false,text:'SYNTHETIC',operatorReviewText:'Magyar szintetikus ellenőrző szöveg',decision,readOnlyFreshness:{verified:true,syntheticOnly:true,checkedAt:new Date(at).toISOString(),source:'stored-synthetic-case',tenantId:'sarberki-test',caseId:id,revision:2},...overrides};
 const request=async(url,options)=>{calls.push({url,options});const body=url.includes('operator-session')?metadata:url.includes('preview-draft')?preview:[{tenantId:'sarberki-test',caseId:id,revision:2}];return {ok:true,status:200,json:async()=>url.includes('booking-cases')?{result:body}:body};};
 return {calls,preview,request};
}
test('persistent restore survives new client without login and GETs use cookie and CSRF, never bearer',async()=>{
 const f=fixture();for(let i=0;i<2;i++){const s=createOperatorSession({request:f.request,now:()=>at});await s.restore();const result=await s.loadCase(id);assert.equal(result.fresh,true);assert.match(result.text,/not yet been verified/);assert.match(result.operatorReviewText,/nem igazolt/);}
 assert.equal(f.calls.length,6);for(const c of f.calls){assert.equal(c.options.method,'GET');assert.equal(c.options.credentials,'same-origin');assert.equal(c.options.redirect,'error');assert.equal(c.options.cache,'no-store');assert.equal(c.options.headers.Authorization,undefined);assert.equal(c.options.headers['X-Sarberki-Operator'],'1');assert.equal(c.options.body,undefined);if(c.url.includes('booking-cases'))assert.equal(c.options.headers['X-CSRF-Token'],metadata.csrfToken);}
});
test('login sends password only to same-origin server; logout removes readable metadata immediately',async()=>{
 const f=fixture(),s=createOperatorSession({request:f.request,now:()=>at});await s.login('operator@synthetic.invalid','synthetic-password');assert.equal(f.calls[0].url,'/.netlify/functions/operator-session');assert.equal(f.calls[0].options.method,'POST');assert.equal(JSON.parse(f.calls[0].options.body).action,'login');const logout=s.logout();await assert.rejects(s.loadCase(id),/AUTH_REQUIRED|SESSION_CHANGED/);await logout;assert.equal(JSON.parse(f.calls[2].options.body).action,'logout');assert.equal(f.calls[2].options.headers['X-CSRF-Token'],metadata.csrfToken);
});
test('coalesced restore and case reads serialize refresh-cookie rotation',async()=>{
 const f=fixture();let release,active=0,max=0;const s=createOperatorSession({now:()=>at,request:async(url,options)=>{active++;max=Math.max(max,active);if(url.includes('operator-session'))await new Promise(r=>release=r);const result=await f.request(url,options);active--;return result;}});const a=s.restore(),b=s.restore(),c=s.loadCase(id);await new Promise(r=>setImmediate(r));release();await Promise.all([a,b,c]);assert.equal(max,1);assert.equal(f.calls.length,3);
});
test('invalid session metadata, expired sessions, server token exposure and foreign tenant never allow reads',async()=>{
 for(const change of [{tenantId:'other'},{expiresAt:new Date(at).toISOString()},{expiresAt:new Date(at+8*86400000).toISOString()},{csrfToken:'invalid'},{authenticated:false},{access_token:'synthetic-token'}]){let calls=0;const s=createOperatorSession({now:()=>at,request:async()=>{calls++;return {ok:true,json:async()=>({...metadata,...change})};}});await assert.rejects(s.restore(),/INVALID_SESSION/);await assert.rejects(s.loadCase(id),/AUTH_REQUIRED/);assert.equal(calls,1);}
});
test('logout suppresses late restore/login/case responses',async()=>{
 for(const operation of ['restore','login']){const f=fixture();let release;const s=createOperatorSession({now:()=>at,request:async(url,options)=>options.method!=='POST'||JSON.parse(options.body).action==='login'?new Promise(r=>release=()=>r({ok:true,json:async()=>metadata})):f.request(url,options)});const pending=operation==='restore'?s.restore():s.login('operator@synthetic.invalid','synthetic');await new Promise(r=>setImmediate(r));const logout=s.logout();release();await assert.rejects(pending,/SESSION_CHANGED/);await logout;assert.equal(f.calls[0].options.headers['X-CSRF-Token'],metadata.csrfToken);await assert.rejects(s.loadCase(id),/AUTH_REQUIRED/);}
 const f=fixture();let release;const s=createOperatorSession({now:()=>at,request:async(url,options)=>url.includes('preview-draft')?new Promise(r=>release=()=>r({ok:true,json:async()=>({result:f.preview})})):f.request(url,options)});await s.restore();const pending=s.loadCase(id);await new Promise(r=>setImmediate(r));const logout=s.logout();release();await assert.rejects(pending,/SESSION_CHANGED/);await logout;
});
test('expiry and forbidden case response clear local readability; restore failure never logs out cookie',async()=>{
 const f=fixture();let time=at;const s=createOperatorSession({request:f.request,now:()=>time});await s.restore();time+=7*86400000;await assert.rejects(s.loadCase(id),/AUTH_REQUIRED/);assert.equal(f.calls.length,1);
 for(const status of [401,403,503]){const g=fixture(),reader=createOperatorSession({now:()=>at,request:async(url,options)=>url.includes('booking-cases')?{ok:false,status,json:async()=>({error:'FORBIDDEN'})}:g.request(url,options)});await reader.restore();await assert.rejects(reader.loadCase(id));await assert.rejects(reader.loadCase(id),/AUTH_REQUIRED/);assert.equal(g.calls.filter(c=>c.options.method==='POST').length,0);}
});
test('cookie read-only client denies draft, ingest and approvals while bearer compatibility stays intact',async()=>{
 const f=fixture(),c=createCaseStoreClient({cookieReadOnly:true,getCsrfToken:()=>metadata.csrfToken,request:f.request,isolatedApproval:true,approvalTarget:'https://isolated-approval.supabase.co'});await assert.rejects(c.ingest({}),/READ_ONLY/);await assert.rejects(c.draft('sarberki-test',id,1),/READ_ONLY/);await assert.rejects(c.approve('sarberki-test',id,1,'a'.repeat(64)),/READ_ONLY/);assert.equal(f.calls.length,0);const bearer=createCaseStoreClient({getAccessToken:()=> 'synthetic-bearer',request:f.request});await bearer.get('sarberki-test',id);assert.equal(f.calls[0].options.headers.Authorization,'Bearer synthetic-bearer');
});
function dom(){const events={},data=new Map();for(const key of ['operator_login','operator_email','operator_password','operator_status','operator_logout','server_case_id','server_case_load','server_data_status','server_chat_reply','server_operator_hu','server_guest_draft'])data.set(key,{value:'',textContent:'',listeners:{},addEventListener(event,callback){this.listeners[event]=callback;}});data.get('operator_email').value='operator@synthetic.invalid';data.get('operator_password').value='synthetic';data.get('server_case_id').value=id;return {getElementById:key=>data.get(key),data,addEventListener:(event,callback)=>events[event]=callback,events};}
const settle=()=>new Promise(r=>setImmediate(r));
test('panel autorestores; pagehide clears private UI without deleting session and pageshow restores',async()=>{const f=fixture(),d=dom(),events={};initOperatorPanel({documentRef:d,windowRef:{addEventListener:(event,callback)=>events[event]=callback},request:f.request,now:()=>at,setTimer:null});await settle();await d.data.get('server_case_load').listeners.click();assert.match(d.data.get('server_chat_reply').value,/not yet been verified/);events.pagehide();assert.equal(d.data.get('server_chat_reply').value,'');assert.equal(f.calls.filter(c=>c.options.method==='POST').length,0);await events.pageshow();await settle();await d.data.get('server_case_load').listeners.click();assert.match(d.data.get('server_chat_reply').value,/not yet been verified/);});
test('panel clears password immediately; network failure hides data, offers retry and never revokes cookie',async()=>{const f=fixture(),d=dom();let offline=false;initOperatorPanel({documentRef:d,windowRef:null,now:()=>at,setTimer:null,request:async(url,options)=>{if(offline)throw Error('offline');return f.request(url,options);}});await settle();const login=d.data.get('operator_login').listeners.submit({preventDefault(){}});assert.equal(d.data.get('operator_password').value,'');await login;await d.data.get('server_case_load').listeners.click();offline=true;d.visibilityState='visible';await d.events.visibilitychange();await settle();assert.equal(d.data.get('server_chat_reply').value,'');assert.match(d.data.get('operator_status').textContent,/nem ellenőrizhető/);assert.equal(f.calls.filter(c=>c.options.body&&JSON.parse(c.options.body).action==='logout').length,0);});
test('panel case change suppresses late readback',async()=>{const f=fixture(),d=dom();let release;initOperatorPanel({documentRef:d,windowRef:null,now:()=>at,setTimer:null,request:async(url,options)=>url.includes('preview-draft')?new Promise(r=>release=()=>r({ok:true,json:async()=>({result:f.preview})})):f.request(url,options)});await settle();const pending=d.data.get('server_case_load').listeners.click();await settle();d.data.get('server_case_id').listeners.input();release();await pending;assert.equal(d.data.get('server_chat_reply').value,'');});
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

test('malformed case, foreign tenant, mismatched revision and already persisted preview remain rejected',async()=>{
 for(const changes of [{revision:3},{approval:'approved'},{persisted:true},{decision:null},{caseId:'case-foreign'}]){const f=fixture(changes),s=createOperatorSession({request:f.request,now:()=>at});await s.restore();await assert.rejects(s.loadCase(id),/INVALID_DATA/);}
 const f=fixture(),s=createOperatorSession({now:()=>at,request:async(url,options)=>url.includes('booking-cases')?{ok:true,status:200,json:async()=>({result:{tenantId:'other'}})}:f.request(url,options)});await s.restore();await assert.rejects(s.loadCase(id),/INVALID_DATA/);
});
test('restore distinguishes invalid authentication from setup/outage, preserving cookies for later retry',async()=>{
 for(const status of [401,403,503]){const f=fixture();let fail=true;const s=createOperatorSession({now:()=>at,request:async(url,options)=>fail?{ok:false,status,json:async()=>({error:'synthetic-error'})}:f.request(url,options)});await assert.rejects(s.restore(),status===503?/SESSION_SETUP_REQUIRED/:status===403?/FORBIDDEN/:/AUTH_REQUIRED/);fail=false;await s.restore();assert.equal((await s.loadCase(id)).fresh,true);assert.equal(f.calls.filter(c=>c.options.method==='POST').length,0);}
});
test('bounded refresh timer stops on explicit logout and failed revocation is never reported as success',async()=>{
 const f=fixture(),d=dom();let callback,delay,stopped=0;initOperatorPanel({documentRef:d,windowRef:null,now:()=>at,setTimer:(cb,ms)=>{callback=cb;delay=ms;return 1;},clearTimer:()=>stopped++,request:async(url,options)=>options.body&&JSON.parse(options.body).action==='logout'?{ok:false,status:503}:f.request(url,options)});await settle();assert.equal(delay,300000);await callback();assert.equal(f.calls.filter(c=>c.url.includes('operator-session')).length,2);await d.data.get('operator_logout').listeners.click();assert.ok(stopped>0);assert.match(d.data.get('operator_status').textContent,/NEM IGAZOLT/);await d.data.get('server_case_load').listeners.click();assert.equal(d.data.get('server_chat_reply').value,'');
});


test('hidden panels never poll or render private data until visible again',async()=>{
 const f=fixture(),d=dom();d.visibilityState='hidden';let timerCount=0;initOperatorPanel({documentRef:d,windowRef:null,now:()=>at,setTimer:()=>{timerCount++;return 1;},clearTimer:()=>{},request:f.request});await settle();assert.equal(f.calls.length,0);assert.equal(timerCount,0);d.visibilityState='visible';await d.events.visibilitychange();await settle();assert.equal(f.calls.length,1);assert.equal(timerCount,1);d.visibilityState='hidden';d.events.visibilitychange();assert.equal(d.data.get('server_chat_reply').value,'');
});
test('successful password response without accepted cookie cannot establish a chatbot session',async()=>{
 const f=fixture();let calls=0;
 const session=createOperatorSession({now:()=>at,request:async(url,options)=>{
  calls++;assert.equal(options.credentials,'same-origin');
  return options.method==='POST'?f.request(url,options):{ok:false,status:401,json:async()=>({error:'AUTH_REQUIRED'})};
 }});
 await assert.rejects(session.login('operator@synthetic.invalid','synthetic'),/AUTH_REQUIRED/);
 await assert.rejects(session.loadCase(id),/AUTH_REQUIRED/);assert.equal(calls,2);
});
test('synthetic server chat uses existing session and rejects malformed or stale response',async()=>{
 const f=fixture();let mode='good';let calls=0;
 const s=createOperatorSession({now:()=>at,request:async(url,options)=>{
  if(!url.includes('decision-parity-fixture'))return f.request(url,options);
  calls++;assert.equal(options.headers['X-CSRF-Token'],metadata.csrfToken);assert.equal(options.credentials,'same-origin');
  const body=JSON.parse(options.body);assert.deepEqual(body,{language:'hu',scenario:'chat-step',step:2});
  return {ok:true,status:200,json:async()=>({fixture:'fixed-synthetic-chat',step:mode==='good'?2:1,language:'hu',text:'SYNTHETIC'})};
 }});
 await assert.rejects(s.syntheticChat(2),/AUTH_REQUIRED/);await s.restore();
 assert.equal(await s.syntheticChat(2),'SYNTHETIC');mode='bad';await assert.rejects(s.syntheticChat(2),/INVALID_DATA/);
 await assert.rejects(s.syntheticChat(3),/INVALID_INPUT/);assert.equal(calls,2);
});
test('operator client and real server fixture complete both synthetic turns',async()=>{
 const {createDecisionParityHandler}=await import('../netlify/functions/decision-parity-fixture.mjs');
 const f=fixture(),origin='https://leafy-chimera-2403e5.netlify.app';let checked=0;
 const handler=createDecisionParityHandler({env:{URL:origin,DECISION_PARITY_FIXTURE_ENABLED:'true'},sessionFactory:()=>({protectedRead:async event=>{assert.equal(event.headers['x-csrf-token'],metadata.csrfToken);checked++;return {setCookie:'synthetic'};}})});
 const s=createOperatorSession({now:()=>at,request:async(url,options)=>{
  if(!url.includes('decision-parity-fixture'))return f.request(url,options);
  const headers=Object.fromEntries(Object.entries(options.headers).map(([k,v])=>[k.toLowerCase(),v]));headers.origin=origin;
  const result=await handler({httpMethod:options.method,headers,body:options.body});return {ok:result.statusCode===200,status:result.statusCode,json:async()=>JSON.parse(result.body)};
 }});
 await s.restore();const first=await s.syntheticChat(1),second=await s.syntheticChat(2);assert.equal(checked,2);assert.notEqual(first,second);
});
test('operator preview form sends a bounded synthetic multi-turn chat to server and resets history',async()=>{
 const {createServerChatPreview}=await import('../netlify/functions/server-chat-preview.mjs');
 const f=fixture(),d=dom(),origin='https://leafy-chimera-2403e5.netlify.app';let sent=[];
 for(const key of ['server_live_preview_form','server_live_preview_input','server_live_preview_output','server_live_preview_reset'])d.data.set(key,{value:'',textContent:'',listeners:{},addEventListener(event,callback){this.listeners[event]=callback;}});
 const server=createServerChatPreview({env:{URL:origin,SERVER_CHAT_SYNTHETIC_ONLY:'true'},clock:()=>new Date('2026-10-29T12:00:00Z'),sessionFactory:()=>({protectedRead:async event=>{assert.equal(event.headers['x-csrf-token'],metadata.csrfToken);return {setCookie:'synthetic-cookie'};}})});
 initOperatorPanel({documentRef:d,windowRef:null,now:()=>at,setTimer:null,request:async(url,options)=>{
  if(!url.includes('server-chat-preview'))return f.request(url,options);
  sent.push(JSON.parse(options.body));return server(new Request(origin+url,{...options,headers:{...options.headers,origin}}));
 }});
 await settle();const input=d.data.get('server_live_preview_input'),form=d.data.get('server_live_preview_form'),output=d.data.get('server_live_preview_output');
 input.value='Van szabad Deluxe faház 2027.06.10-12 között?';await form.listeners.submit({preventDefault(){}});assert.ok(output.textContent.length);
 input.value='2 felnőtt, gyermek nélkül.';await form.listeners.submit({preventDefault(){}});assert.equal(sent[1].messages.length,2);assert.ok(output.textContent.length);
 d.data.get('server_live_preview_reset').listeners.click();input.value='2 felnőtt, gyermek nélkül.';await form.listeners.submit({preventDefault(){}});assert.equal(sent[2].messages.length,1);
});
