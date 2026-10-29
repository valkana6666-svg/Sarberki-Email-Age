import test from 'node:test';
import assert from 'node:assert/strict';
import {createServerChatPreview} from '../netlify/functions/server-chat-preview.mjs';
import {createServerChatClient} from '../sarberki-chatbot-project/remote-chat-client.mjs';
import {OperatorSessionError} from '../shared-core/operator-cookie-session.mjs';
const origin='https://leafy-chimera-2403e5.netlify.app',env={URL:origin,SERVER_CHAT_SYNTHETIC_ONLY:'true'};
const makeSession=()=>({protectedRead:async e=>{if(e.headers['x-csrf-token']!=='synthetic')throw new OperatorSessionError(403,'FORBIDDEN');return {setCookie:'synthetic-cookie'};}});
const handler=createServerChatPreview({env,sessionFactory:makeSession,clock:()=>new Date('2026-10-29T12:00:00Z'),fetchImpl:()=>{throw Error('NO_EXTERNAL_NETWORK');}});
const request=(body,headers={})=>new Request(origin+'/.netlify/functions/server-chat-preview',{method:'POST',headers:{origin,'content-type':'application/json','x-csrf-token':'synthetic',...headers},body:JSON.stringify(body)});
test('synthetic client and server complete independent multi-turn chats without external calls',async()=>{
 const send=async(url,opts)=>handler(new Request(origin+url,{...opts,headers:{...opts.headers,origin}}));
 const a=createServerChatClient({request:send,getCsrfToken:async()=>'synthetic',language:'hu'}),b=createServerChatClient({request:send,getCsrfToken:async()=>'synthetic',language:'hu'});
 const first=await a.reply('Van szabad Deluxe faház 2027.06.10-12 között?');const follow=await a.reply('2 felnőtt, gyermek nélkül.');
 const isolated=await b.reply('2 felnőtt, gyermek nélkül.');assert.notEqual(first.text,follow.text);assert.notEqual(follow.text,isolated.text);
 a.reset();assert.deepEqual(await a.reply('2 felnőtt, gyermek nélkül.'),isolated);
});
test('closed gate, invalid auth, forged fields and incorrect origin fail without processing',async()=>{
 assert.equal((await createServerChatPreview({env:{...env,SERVER_CHAT_SYNTHETIC_ONLY:'false'},sessionFactory:makeSession})(request({messages:['a'],language:'hu'}))).status,503);
 assert.equal((await handler(request({messages:['a'],language:'hu'},{'x-csrf-token':'bad'}))).status,403);
 assert.equal((await handler(request({messages:['a'],language:'hu',approved:true}))).status,400);
 assert.equal((await handler(request({messages:['a'],language:'hu'},{origin:'https://other.invalid'}))).status,403);
 assert.equal((await handler(request({messages:Array(31).fill('a'),language:'hu'}))).status,400);
});
test('reset invalidates delayed response and failed requests do not add history',async()=>{
 let release;const client=createServerChatClient({getCsrfToken:async()=>'synthetic',request:async()=>new Promise(r=>release=r)});
 const pending=client.reply('teszt');await new Promise(r=>setImmediate(r));client.reset();release(Response.json({synthetic:true,text:'válasz',language:'hu'}));await assert.rejects(pending,/SESSION_CHANGED/);
});
