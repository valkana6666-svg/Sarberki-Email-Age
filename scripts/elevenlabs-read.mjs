// Owner 2026-11-25: read the ElevenLabs TEST agent's latest conversations (transcript, our tool calls and results) –
// read-only, the TEST agent only. The owner's own synthetic test calls. The key is never printed.
const API='https://api.elevenlabs.io',AGENT='agent_4101m8aea94kfw6srp83xe9mn2d6';
const key=process.env.XI_KEY;if(!key){console.log('BLOCKED');process.exit(1);}
const H={'xi-api-key':key,Accept:'application/json'},cut=(s,n)=>{s=typeof s==='string'?s:JSON.stringify(s??'');return s.length>n?s.slice(0,n)+'…':s;};
const req=JSON.parse(process.argv[2]||'{}');
const list=await fetch(API+'/v1/convai/conversations?page_size='+(Number(req.last)||2)+'&agent_id='+AGENT,{headers:H}).then(r=>r.json());
for(const c of list.conversations||[]){
 const d=await fetch(API+'/v1/convai/conversations/'+c.conversation_id,{headers:H}).then(r=>r.json());
 if(d.agent_id!==AGENT)continue;
 console.log('CONV',JSON.stringify({id:d.conversation_id,status:d.status,start:d.metadata?.start_time_unix_secs,duration:d.metadata?.call_duration_secs,cost:d.metadata?.cost,termination:d.metadata?.termination_reason}));
 for(const t of d.transcript||[]){
  console.log('T',JSON.stringify({role:t.role,at:t.time_in_call_secs,msg:cut(t.message,500),
   tools:(t.tool_calls||[]).map(x=>({name:x.tool_name,params:cut(x.params_as_json,600)})),
   results:(t.tool_results||[]).map(x=>({name:x.tool_name,error:x.is_error,latency:x.tool_latency_secs,value:cut(x.result_value,700)})),
   ttfb:t.conversation_turn_metrics?.metrics?.convai_llm_service_ttfb?.elapsed_time??null}));
 }
}
