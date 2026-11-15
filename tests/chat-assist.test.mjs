import test from 'node:test';
import assert from 'node:assert/strict';
import {askChatAssist,checkAssistAnswer,chatAssistKnowledge,chatAssistConfigured} from '../shared-core/chat-assist.mjs';
import {createChatAssistHandler} from '../netlify/functions/chat-assist.mjs';

// V3-SMALLTALK (owner 2026-11-15). Mocked provider only; fictional messages.
const ORIGIN='https://leafy-chimera-2403e5.netlify.app';
const env={CHAT_ASSIST_ENABLED:'test-only',OPENAI_TRANSLATION_API_KEY:'sk-test-'+'x'.repeat(20),CHAT_ASSIST_MODEL:'test-model'};
const provider=(text,{status=200,capture}={})=>async(url,init)=>{capture?.push({url,body:JSON.parse(init.body)});
 return new Response(JSON.stringify({output_text:text}),{status});};
const req=(body,{origin=ORIGIN,site='same-origin',method='POST'}={})=>new Request(ORIGIN+'/.netlify/functions/chat-assist',
 {method,headers:{origin,'sec-fetch-site':site,'content-type':'application/json'},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});

test('knowledge comes from the approved central facts, without internal house numbers',()=>{
 const kb=chatAssistKnowledge();
 assert.match(kb,/14:00/);assert.match(kb,/horgászjegy/);assert.match(kb,/saját stégje/);
 assert.doesNotMatch(kb,/\b(?:7|8|9|10)\/[ABC]\b/);
});

test('off by default; needs the switch, a key and a model',()=>{
 assert.equal(chatAssistConfigured({}),null);
 assert.equal(chatAssistConfigured({...env,CHAT_ASSIST_ENABLED:'on'}),null);
 assert.equal(chatAssistConfigured({...env,CHAT_ASSIST_MODEL:''}),null);
 assert.ok(chatAssistConfigured(env));
});

test('output guard: unknown, invented numbers, foreign links, house numbers and markup are refused',()=>{
 assert.equal(checkAssistAnswer('UNKNOWN'),null);
 assert.equal(checkAssistAnswer('A szobaár 25000 Ft éjszakánként.'),null);
 assert.equal(checkAssistAnswer('Igen, a 8/A ház szabad.'),null);
 assert.equal(checkAssistAnswer('Nézze meg: https://example.com'),null);
 assert.equal(checkAssistAnswer('<b>Szia</b>'),null);
 assert.equal(checkAssistAnswer('Szívesen! Érkezés 14:00 órától lehetséges.'),'Szívesen! Érkezés 14:00 órától lehetséges.');
 assert.equal(checkAssistAnswer('Foglalási igény: https://sarberkito.hu/foglalas/'),'Foglalási igény: https://sarberkito.hu/foglalas/');
});

test('provider call: closed instructions, no storage, guest text only as user input',async()=>{
 const capture=[];
 const a=await askChatAssist({message:'Van recepció éjjel?',language:'hu'},{env,fetchImpl:provider('Igen, a recepció a nap 24 órájában elérhető.',{capture})});
 assert.equal(a,'Igen, a recepció a nap 24 órájában elérhető.');
 assert.equal(capture[0].url,'https://api.openai.com/v1/responses');
 assert.equal(capture[0].body.store,false);assert.deepEqual(capture[0].body.tools,[]);
 assert.match(capture[0].body.instructions,/ONLY the approved facts/);
 assert.equal(capture[0].body.input[0].content[0].text,'Van recepció éjjel?');
 assert.equal(await askChatAssist({message:'Mennyibe kerül?',language:'hu'},{env,fetchImpl:provider('Az ár 99999 Ft.')}),null);
 await assert.rejects(askChatAssist({message:'x',language:'fr'},{env,fetchImpl:provider('')}),/INVALID_INPUT/);
 await assert.rejects(askChatAssist({message:'x',language:'hu'},{env,fetchImpl:provider('',{status:500})}),/ASSIST_UNAVAILABLE/);
});

test('endpoint: off, same-origin JSON, exact keys, rate limit; provider failure gives answer:null',async()=>{
 assert.equal((await createChatAssistHandler({env:{}})(req({message:'Szia',language:'hu'}))).status,503);
 const h=createChatAssistHandler({env,fetchImpl:provider('Szia! Miben segíthetek?'),perMinute:3});
 assert.equal((await h(req({message:'Szia',language:'hu'},{origin:'https://evil.example'}))).status,403);
 assert.equal((await h(req({message:'Szia',language:'hu'},{site:'cross-site'}))).status,403);
 assert.equal((await h(req({message:'Szia',language:'hu',extra:1}))).status,400);
 assert.equal((await h(req('nem json'))).status,400);
 const ok=await h(req({message:'Szia',language:'hu'}));
 assert.equal(ok.status,200);assert.deepEqual(await ok.json(),{answer:'Szia! Miben segíthetek?'});
 await h(req({message:'Szia',language:'hu'}));await h(req({message:'Szia',language:'hu'}));
 assert.equal((await h(req({message:'Szia',language:'hu'}))).status,429);
 const failing=createChatAssistHandler({env,fetchImpl:async()=>{throw Error('down');}});
 assert.deepEqual(await (await failing(req({message:'Szia',language:'hu'}))).json(),{answer:null});
});
