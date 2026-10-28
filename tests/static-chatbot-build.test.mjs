import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,mkdirSync,existsSync,rmSync,readdirSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,dirname,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const source=fileURLToPath(new URL('../',import.meta.url)),sha='0123456789abcdef0123456789abcdef01234567';
function buildFixture(){
 const root=mkdtempSync(join(tmpdir(),'sarberki-static-chatbot-'));
 cpSync(source,root,{recursive:true,filter:path=>!['node_modules','dist','.git'].some(part=>relative(source,path).split('/').includes(part))});
 for(const dir of ['tests','reports','sarberki-chatbot-project/private','sarberki-chatbot-project/fixtures','napi-kezelo/private'])mkdirSync(join(root,dir),{recursive:true});
 for(const file of ['private.webmanifest','sarberki-chatbot-project/private-key.txt','sarberki-chatbot-project/server-admin.mjs','sarberki-chatbot-project/private/secret.mjs','sarberki-chatbot-project/fixtures/guest.json','napi-kezelo/private/secret.mjs','napi-kezelo/unknown.mjs','tests/private-fixture.mjs','reports/private-report.html'])writeFileSync(join(root,file),'SYNTHETIC_PRIVATE_CANARY');
 symlinkSync(join(root,'sarberki-chatbot-project/private-key.txt'),join(root,'sarberki-chatbot-project/linked-secret.txt'));
 const execution=spawnSync(process.execPath,['scripts/build-static.cjs'],{cwd:root,env:{...process.env,COMMIT_REF:sha,SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_ENV_SECRET_CANARY',SARBERKI_OPERATOR_SESSION_KEY:'SYNTHETIC_ENV_SECRET_CANARY'},encoding:'utf8'});
 assert.equal(execution.status,0,execution.stderr);
 return {root,dist:join(root,'dist')};
}
function dependencies(text,html){
 const refs=[];
 for(const match of text.matchAll(/\b(?:import|export)\s+(?:[^;'"`]*?\s+from\s*)?['"]([^'"]+)['"]/g))refs.push(match[1]);
 for(const match of text.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g))refs.push(match[1]);
 if(html)for(const match of text.matchAll(/<script\b[^>]*\bsrc=['"]([^'"]+)['"]/g))refs.push(match[1]);
 return refs;
}
test('static build publishes existing chatbot and its complete browser module closure, never private/test/server assets',async()=>{
 const {root,dist}=buildFixture();
 try{
  const entry=join(dist,'sarberki-chatbot-project/index.html');assert.equal(readFileSync(entry,'utf8'),readFileSync(join(source,'sarberki-chatbot-project/index.html'),'utf8'));
  assert.match(readFileSync(join(dist,'build-info.mjs'),'utf8'),new RegExp(sha));
  const operator=JSON.parse(readFileSync(join(dist,'operator.webmanifest'),'utf8'));
  assert.match(readFileSync(join(dist,'index.html'),'utf8'),/<link rel="manifest" href="\.\/operator\.webmanifest">/);
  assert.equal(operator.start_url,'/index.html');
  for(const icon of operator.icons)assert.ok(existsSync(resolve(dist,icon.src)),'Missing operator icon: '+icon.src);
  const daily=join(dist,'napi-kezelo/index.html');
  assert.equal(readFileSync(daily,'utf8'),readFileSync(join(source,'napi-kezelo/index.html'),'utf8'));
  assert.equal(JSON.parse(readFileSync(join(dist,'napi-kezelo/manifest.webmanifest'),'utf8')).start_url,'/napi-kezelo/');
  assert.equal(existsSync(join(dist,'napi-kezelo/napi.css')),true);
  const pending=[entry,daily],visited=new Set();
  while(pending.length){
   const file=pending.pop();if(visited.has(file))continue;visited.add(file);assert.ok(existsSync(file),'Missing built dependency: '+relative(dist,file));
   for(const ref of dependencies(readFileSync(file,'utf8'),file.endsWith('.html'))){
    assert.ok(ref.startsWith('.'),'Browser dependency must be local: '+ref);const next=resolve(dirname(file),ref.split('?')[0]);assert.ok(next.startsWith(dist+'/'));pending.push(next);
   }
  }
  for(const required of ['chatbot-v1.mjs','sarberki-chatbot-project/chat-session.mjs','shared-core/central-inquiry-decision.mjs','shared-core/inquiry-channel-adapters.mjs','booking-cases.mjs'])assert.ok(visited.has(join(dist,required)),required);
  for(const forbidden of ['tests','reports','scripts','deployment','recovery','supabase','shared-core/isolated-persistent-http.mjs','shared-core/isolated-persistent-runtime.mjs','shared-core/server-booking-runtime.mjs','shared-core/server-tub-approval.mjs','shared-core/server-tub-availability.mjs','shared-core/operator-cookie-session.mjs','private.webmanifest','sarberki-chatbot-project/private-key.txt','sarberki-chatbot-project/server-admin.mjs','sarberki-chatbot-project/private','sarberki-chatbot-project/fixtures','sarberki-chatbot-project/linked-secret.txt','napi-kezelo/private','napi-kezelo/unknown.mjs'])assert.equal(existsSync(join(dist,forbidden)),false,forbidden);
  function scan(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const file=join(dir,item.name);if(item.isDirectory())scan(file);else assert.doesNotMatch(readFileSync(file,'utf8'),/SYNTHETIC_(?:PRIVATE|ENV_SECRET)_CANARY/);}}scan(dist);
  const {createChatInquirySession}=await import(pathToFileURL(join(dist,'sarberki-chatbot-project/chat-session.mjs')));
  for(const language of ['hu','de','en','si']){
   const session=createChatInquirySession({language,clock:()=>new Date('2026-10-12T08:00:00Z')});
   const first=session.reply('Deluxe cabin from 2026-11-13 to 2026-11-15 for 2 adults and no children.',{language});
   assert.equal(first.decision.facts.adults,2);assert.equal(first.decision.capacity.verified,false);assert.ok(first.operatorReviewText);
   const next=session.reply('Phone: +36123456789',{language});assert.equal(next.decision.facts.dates.arrival,'2026-11-13');assert.equal(next.decision.facts.adults,2);assert.equal(next.decision.capacity.verified,false);
   assert.match(next.operatorReviewText,/kapacitás.*nem igazolt/);
  }
 }finally{rmSync(root,{recursive:true,force:true});}
});
