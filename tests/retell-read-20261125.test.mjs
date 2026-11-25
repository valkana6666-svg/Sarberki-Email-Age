// Owner 2026-11-25: Claude's restricted Retell key – read the TEST agent, update ONLY its prompt. Synthetic, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {retellRead,TEST_AGENT,promptFromFile} from '../scripts/retell-read.mjs';
const SECRET='x-sarberki-voice-key-value-SECRET';
const LLM={llm_id:'llm_1',version:0,model:'m',begin_message:'',general_prompt:'old',general_tools:[{name:'sarberki_reply',type:'custom',url:'https://x',headers:{'x-sarberki-voice-key':SECRET}}]};
function mock(){const calls=[];return {calls,fetchImpl:async(url,o)=>{calls.push([o.method,url.replace('https://api.retellai.com',''),o.body?JSON.parse(o.body):null]);
 if(url.includes('/get-agent/'))return new Response(JSON.stringify({agent_id:TEST_AGENT,response_engine:{type:'retell-llm',llm_id:'llm_1'},voice_id:'v'}));
 if(url.includes('/get-retell-llm/'))return new Response(JSON.stringify(LLM));
 if(url.includes('/update-retell-llm/'))return new Response(JSON.stringify({...LLM,general_prompt:JSON.parse(o.body).general_prompt}));
 if(url.includes('/v2/get-call/'))return new Response(JSON.stringify({agent_id:url.endsWith('aaaaaaaaaaaaaaaa')?TEST_AGENT:'agent_other',transcript_with_tool_calls:[{role:'user',content:'Halló'}]}));
 return new Response('{}',{status:404});}};}
test('only the TEST agent; a call of another agent is skipped; tool headers never leave',async()=>{
 await assert.rejects(retellRead({agent:'agent_other'},{key:'k'.repeat(20),fetchImpl:mock().fetchImpl}),e=>e.code==='AGENT_NOT_ALLOWED');
 const m=mock(),r=await retellRead({agent:TEST_AGENT,llm:true,calls:['call_aaaaaaaaaaaaaaaa','call_bbbbbbbbbbbbbbbb']},{key:'k'.repeat(20),fetchImpl:m.fetchImpl});
 assert.equal(r.calls[0].steps[0].text,'Halló');assert.equal(r.calls[1].skipped,'OTHER_AGENT');
 assert.ok(!JSON.stringify(r).includes(SECRET));assert.equal(r.llm.tools[0].hasHeaders,true);assert.ok(m.calls.every(([meth])=>meth==='GET'),'read mode: GET only');
});
test('prompt update: one PATCH with general_prompt only (tools untouched), read back by hash',async()=>{
 const m=mock(),r=await retellRead({agent:TEST_AGENT,updatePrompt:true},{key:'k'.repeat(20),fetchImpl:m.fetchImpl});
 const patch=m.calls.filter(c=>c[0]==='PATCH');assert.equal(patch.length,1);assert.equal(patch[0][1],'/update-retell-llm/llm_1');assert.deepEqual(Object.keys(patch[0][2]),['general_prompt']);
 assert.equal(r.update.sentSha256,r.update.storedSha256);assert.ok(!JSON.stringify(r).includes(SECRET));
 assert.equal(promptFromFile('a\n---\nTe vagy.'),'Te vagy.');assert.equal(promptFromFile('nincs elválasztó'),null);
});
