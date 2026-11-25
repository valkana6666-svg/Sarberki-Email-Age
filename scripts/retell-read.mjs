// Owner 2026-11-25 (#9 7175557838): Claude's own Retell access – the restricted „Claude TEST” key (Agent edit,
// Testing edit, History read; no call, phone or export rights) from the GitHub Actions secret RETELL_CLAUDE_TEST_API_KEY.
// READ-ONLY here: the TEST agent's non-secret settings and the transcripts / tool calls of ITS calls. Only the fixed
// TEST agent is allowed; a call of any other agent is skipped. Never printed: the key, tool headers (they carry the
// voice-turn key), the full agent JSON. The calls are the owner's own synthetic test calls.
// Usage: RETELL_KEY=… node scripts/retell-read.mjs '{"agent":"agent_…","calls":["call_…"]}'
export const TEST_AGENT='agent_db7df7b565e9c49abc8f9bb3e0';
const API='https://api.retellai.com';
const cut=(s,n)=>{s=String(s??'');return s.length>n?s.slice(0,n)+'…':s;};
export async function retellRead(request,{key,fetchImpl=globalThis.fetch}){
 if(typeof key!=='string'||key.length<16)throw Object.assign(Error('key'),{code:'KEY_MISSING'});
 const q=request||{};if(q.agent!==TEST_AGENT)throw Object.assign(Error('agent'),{code:'AGENT_NOT_ALLOWED'});
 const get=async path=>{const r=await fetchImpl(API+path,{method:'GET',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+key,Accept:'application/json'}});
  const text=await r.text();let json=null;try{json=JSON.parse(text);}catch{}return {http:r.status,json,error:r.ok?null:cut(json?.message||json?.error||text,160)};};
 const out={};
 const a=await get('/get-agent/'+TEST_AGENT);
 out.agent={http:a.http,error:a.error,...(a.json?{agent_id:a.json.agent_id,agent_name:a.json.agent_name,version:a.json.version,is_published:a.json.is_published,language:a.json.language,
  voice_id:a.json.voice_id,voice_model:a.json.voice_model??null,response_engine:{type:a.json.response_engine?.type,llm_id:a.json.response_engine?.llm_id??null},
  interruption_sensitivity:a.json.interruption_sensitivity??null,responsiveness:a.json.responsiveness??null,stt_mode:a.json.stt_mode??null}:{})};
 // The agent's Retell LLM: prompt, first message, model and tool NAMES (never tool headers – they hold the voice key).
 if(q.llm&&a.json?.response_engine?.llm_id){
  const l=await get('/get-retell-llm/'+a.json.response_engine.llm_id);
  out.llm=l.json?{http:l.http,llm_id:l.json.llm_id,version:l.json.version,model:l.json.model??null,begin_message:l.json.begin_message??null,
   general_prompt:l.json.general_prompt??null,tools:(l.json.general_tools||[]).map(t=>({name:t.name,type:t.type,url:t.url??null,hasHeaders:!!(t.headers&&Object.keys(t.headers).length)}))}:{http:l.http,error:l.error};
 }
 out.calls=[];
 for(const id of (Array.isArray(q.calls)?q.calls:[]).slice(0,5)){
  if(!/^call_[a-f0-9]{16,40}$/.test(id)){out.calls.push({id,skipped:'BAD_ID'});continue;}
  const c=await get('/v2/get-call/'+id);
  if(!c.json){out.calls.push({id,http:c.http,error:c.error});continue;}
  if(c.json.agent_id!==TEST_AGENT){out.calls.push({id,skipped:'OTHER_AGENT'});continue;}
  const steps=(c.json.transcript_with_tool_calls||[]).map(u=>u.role==='tool_call_invocation'?{t:'tool',name:u.name,args:cut(u.arguments,700)}
   :u.role==='tool_call_result'?{t:'result',content:cut(u.content,900)}:{t:u.role,text:cut(u.content,400),at:u.words?.[0]?.start??null});
  out.calls.push({id,http:c.http,status:c.json.call_status,durationMs:c.json.end_timestamp&&c.json.start_timestamp?c.json.end_timestamp-c.json.start_timestamp:null,
   disconnection:c.json.disconnection_reason??null,latencyE2eP50:c.json.latency?.e2e?.p50??null,latencyLlmP50:c.json.latency?.llm?.p50??null,steps});
 }
 return out;
}
if(import.meta.url===`file://${process.argv[1]}`){
 let q={};try{q=JSON.parse(process.argv[2]||'{}');}catch{}
 retellRead(q,{key:process.env.RETELL_KEY}).then(r=>console.log(JSON.stringify(r,null,1))).catch(e=>{console.log('BLOCKED',e.code||e.name);process.exit(1);});
}
