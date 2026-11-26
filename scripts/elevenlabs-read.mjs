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

// #9 7187594223 (2026-11-26): inventory – which number / WhatsApp account belongs to which agent, the agent's tools and
// endpoints, the plan's usage – plus a synthetic probe of the chain (ElevenLabs tool endpoint → voice-turn → shared
// engine → Previo TEST read; voice-request switch state). Read-only; numbers masked to the last 2 digits.
if(req.inventory){
 const mask=n=>typeof n==='string'&&n.length>4?'…'+n.slice(-2):n;
 const get=async p=>{const r=await fetch(API+p,{headers:H});let j=null;try{j=await r.json();}catch{}return {status:r.status,j};};
 const phones=await get('/v1/convai/phone-numbers');
 console.log('PHONES',phones.status,JSON.stringify((Array.isArray(phones.j)?phones.j:phones.j?.phone_numbers||[]).map(p=>({id:p.phone_number_id,provider:p.provider,label:p.label,number:mask(p.phone_number),agent:p.assigned_agent?.agent_id||null,inbound:p.supports_inbound??null}))));
 for(const p of ['/v1/convai/whatsapp-accounts','/v1/convai/whatsapp/accounts']){const w=await get(p);console.log('WHATSAPP',p,w.status,cut(JSON.stringify(w.j,(k,v)=>/phone|number|token|secret/i.test(k)&&typeof v==='string'?mask(v):v),600));}
 const agents=await get('/v1/convai/agents?page_size=50');
 console.log('AGENTS',agents.status,JSON.stringify((agents.j?.agents||[]).map(a=>({id:a.agent_id,name:a.name}))));
 const a=await get('/v1/convai/agents/'+AGENT),c=a.j?.conversation_config||{};
 console.log('AGENT',a.status,JSON.stringify({name:a.j?.name,tools:(c.agent?.prompt?.tools||[]).map(t=>({name:t.name,url:t.api_schema?.url})),phones:(a.j?.phone_numbers||[]).map(p=>({provider:p.provider,number:mask(p.phone_number)}))}));
 const s=await get('/v1/user/subscription');
 console.log('PLAN',s.status,JSON.stringify({tier:s.j?.tier,used:s.j?.character_count,limit:s.j?.character_limit,reset:s.j?.next_character_count_reset_unix}));
 const vk=process.env.VOICE_KEY;
 if(vk){
  const base='https://leafy-chimera-2403e5.netlify.app/.netlify/functions/';
  const post=async(fn,body)=>{const r=await fetch(base+fn,{method:'POST',headers:{'content-type':'application/json','x-sarberki-voice-key':vk},body:JSON.stringify(body)});let j=null;try{j=await r.json();}catch{}return {status:r.status,j};};
  const msgs=['Deluxe faházat szeretnénk 2027. április 20-tól 23-ig, két felnőtt.'];
  const t=await post('voice-turn',{caller_messages:msgs});
  console.log('PROBE voice-turn',t.status,JSON.stringify({source:t.j?.source,facts:t.j?.facts,offer:t.j?.offer,reply:cut(t.j?.reply,300)}));
  const q=await post('voice-request',{caller_messages:[...msgs,'Szeretném lefoglalni.','kitalalt kukac example pont test'],email:'kitalalt kukac example pont test',consent:true,conversation_id:'probe_claude_20261126'});
  console.log('PROBE voice-request',q.status,JSON.stringify(q.j));
 }else console.log('PROBE skipped: no voice key');
}
