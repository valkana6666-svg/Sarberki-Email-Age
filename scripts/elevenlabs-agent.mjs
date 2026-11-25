// Owner 2026-11-25 („csináld meg”, „Megadom az engedélyt”): an ElevenLabs Agents TEST agent that answers ONLY through
// our shared engine – webhook tool sarberki_reply → voice-turn (same endpoint and prompt as the Retell test agent).
// Voice: David (Hungarian, eleven_flash_v2_5). No phone number, no publishing. Idempotent (same name → update).
// The voice-turn key comes from VOICE_KEY (masked in the workflow) and is never printed.
import {readFileSync} from 'node:fs';
const API='https://api.elevenlabs.io',NAME='Sárberki TEST – saját AI (ElevenLabs)';
const VOICE='M336tBVZHWWiWb4R54ui',URL='https://leafy-chimera-2403e5.netlify.app/.netlify/functions/voice-turn';
const key=process.env.XI_KEY,voiceKey=process.env.VOICE_KEY;
if(!key||!voiceKey||voiceKey.length<32){console.log('BLOCKED',!key?'xi key':'voice key');process.exit(1);}
const file=readFileSync('docs/V3-RETELL-PROMPT.md','utf8'),prompt=file.slice(file.indexOf('\n---\n')+5).trim();
const H={'xi-api-key':key,'Content-Type':'application/json',Accept:'application/json'};
const body={name:NAME,tags:['sarberki-test'],conversation_config:{
 agent:{first_message:'Üdvözlöm! A Sárberki Horgásztó automatikus asszisztense vagyok. Miben segíthetek?',language:'hu',
  prompt:{prompt,llm:'gemini-2.5-flash',temperature:0,tools:[{type:'webhook',name:'sarberki_reply',
   description:'A Sárberki saját rendszerének válasza. Minden hívói megszólalás után kötelező meghívni; a válasz reply mezőjét szó szerint kell elmondani.',
   response_timeout_secs:8,
   api_schema:{url:URL,method:'POST',request_headers:{'x-sarberki-voice-key':voiceKey},
    request_body_schema:{type:'object',description:'A hívás eddigi hívói mondatai',properties:{
     caller_messages:{type:'array',description:'A hívó EDDIGI ÖSSZES mondata szó szerint, időrendben (a legutóbbi is).',items:{type:'string',description:'Egy hívói mondat szó szerint'}},
     language:{type:'string',description:'A hívó nyelve, ha egyértelmű: hu, de, en vagy si.',enum:['hu','de','en','si']}},required:['caller_messages']}}}]}},
 tts:{voice_id:VOICE,model_id:'eleven_flash_v2_5'}}};
const list=await fetch(API+'/v1/convai/agents?page_size=100&search='+encodeURIComponent('Sárberki TEST'),{headers:H}).then(r=>r.json()).catch(()=>({}));
const found=(list.agents||[]).find(a=>a.name===NAME);
const r=found?await fetch(API+'/v1/convai/agents/'+found.agent_id,{method:'PATCH',headers:H,body:JSON.stringify(body)})
 :await fetch(API+'/v1/convai/agents/create',{method:'POST',headers:H,body:JSON.stringify(body)});
const j=await r.json().catch(()=>({}));
const id=j.agent_id||found?.agent_id;
console.log('AGENT',r.status,found?'updated':'created',id||'',r.ok?'':JSON.stringify(j).slice(0,400));
if(id){const g=await fetch(API+'/v1/convai/agents/'+id,{headers:H}).then(x=>x.json());
 const c=g.conversation_config||{};const tools=c.agent?.prompt?.tools||[];
 console.log('CHECK',JSON.stringify({name:g.name,language:c.agent?.language,voice:c.tts?.voice_id,model:c.tts?.model_id,llm:c.agent?.prompt?.llm,
  tools:tools.map(t=>({name:t.name,type:t.type,url:t.api_schema?.url,hasHeader:!!t.api_schema?.request_headers})),promptStart:(c.agent?.prompt?.prompt||'').slice(0,60)}));}
