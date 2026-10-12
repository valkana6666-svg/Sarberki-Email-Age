import test from 'node:test';import assert from 'node:assert/strict';
import {createChatbotConfigHandler} from '../netlify/functions/chatbot-test-config.mjs';
import {initVersionStatus} from '../sarberki-chatbot-project/version-status.mjs';
const config={URL:'https://leafy-chimera-2403e5.netlify.app',CASE_STORE_ENABLED:'synthetic-only',CASE_STORE_TEST_TENANTS:'sarberki-test,demo-test',SUPABASE_URL:'https://mojnqizbcaczstguikpv.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_'+ 'a'.repeat(32)};
test('test config refuses disabled, wrong-host/project and privileged credentials without exposing configuration',async()=>{
 for(const override of [{CASE_STORE_ENABLED:'disabled'},{URL:'https://other.invalid'},{SUPABASE_URL:'https://other.supabase.co'},{SUPABASE_PUBLISHABLE_KEY:'sb_secret_'+ 'x'.repeat(32)},{SUPABASE_PUBLISHABLE_KEY:['secret']},{SUPABASE_PUBLISHABLE_KEY:'a.'+Buffer.from(JSON.stringify({role:'service_role',ref:'mojnqizbcaczstguikpv'})).toString('base64url')+'.b'}]){
  const r=await createChatbotConfigHandler({env:{...config,...override}})({httpMethod:'GET'});assert.equal(r.statusCode,503);assert.equal(JSON.parse(r.body).publishableKey,undefined);assert.equal(JSON.parse(r.body).supabaseUrl,undefined);
 }
 const r=await createChatbotConfigHandler({env:config})({httpMethod:'GET'});assert.equal(r.statusCode,200);assert.equal(JSON.parse(r.body).syntheticOnly,true);assert.equal(r.headers['Cache-Control'],'no-store');
 assert.equal((await createChatbotConfigHandler({env:config})({httpMethod:'POST'})).statusCode,405);
});
function fixture(request){const listeners={},label={dataset:{}},button={addEventListener:(name,fn)=>listeners.click=fn};let reloads=0;const documentRef={visibilityState:'visible',getElementById:id=>id==='deployed_version'?label:button,addEventListener:(name,fn)=>listeners[name]=fn};const windowRef={addEventListener:(name,fn)=>listeners[name]=fn};const instance=initVersionStatus({request,documentRef,windowRef,bootCommit:'a'.repeat(40),reload:()=>reloads++});return {instance,label,listeners,reloads:()=>reloads};}
test('version freshness is fetched without credentials or cache; newer builds require reload rather than false current status',async()=>{
 let sha='a'.repeat(40);const calls=[];const f=fixture(async(url,options)=>{calls.push({url,options});return {ok:true,text:async()=>`export const deployedCommit = "${sha}";\n`};});
 await f.instance.check();assert.equal(f.label.dataset.versionState,'current');sha='b'.repeat(40);await f.instance.check();assert.equal(f.label.dataset.versionState,'stale');assert.match(f.label.textContent,/korábbi/);
 assert.ok(calls.every(c=>c.url==='/build-info.mjs'&&c.options.cache==='no-store'&&c.options.credentials==='omit'));
 f.listeners.pageshow({persisted:true});f.listeners.click();assert.equal(f.reloads(),1);
});
test('offline or malformed build metadata cannot assert current deployed version',async()=>{
 for(const response of [{ok:false},{ok:true,text:async()=>'<script>unsafe</script>'}]){const f=fixture(async()=>response);await f.instance.check();assert.equal(f.label.dataset.versionState,'unavailable');}
});
