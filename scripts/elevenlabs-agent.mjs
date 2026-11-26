// Owner 2026-11-25 („csináld meg”, „Megadom az engedélyt”): an ElevenLabs Agents TEST agent that answers ONLY through
// our shared engine – webhook tool sarberki_reply → voice-turn (same endpoint and prompt as the Retell test agent).
// Voice: David (Hungarian, eleven_flash_v2_5). No phone number, no publishing. Idempotent (same name → update).
// The voice-turn key comes from VOICE_KEY (masked in the workflow) and is never printed.
import {readFileSync} from 'node:fs';
const API='https://api.elevenlabs.io',NAME='Sárberki TEST – saját AI (ElevenLabs)';
const VOICE='M336tBVZHWWiWb4R54ui',URL='https://leafy-chimera-2403e5.netlify.app/.netlify/functions/voice-turn';
const REQUEST_URL='https://leafy-chimera-2403e5.netlify.app/.netlify/functions/voice-request';
const key=process.env.XI_KEY,voiceKey=process.env.VOICE_KEY;
if(!key||!voiceKey||voiceKey.length<32){console.log('BLOCKED',!key?'xi key':'voice key');process.exit(1);}
// Owner 2026-11-26: ElevenLabs is the phone platform; its own prompt with the booking steps (e-mail → sarberki_request).
const file=readFileSync('docs/V3-ELEVENLABS-PROMPT.md','utf8'),prompt=file.slice(file.indexOf('\n---\n')+5).trim();
const H={'xi-api-key':key,'Content-Type':'application/json',Accept:'application/json'};
const body={name:NAME,tags:['sarberki-test'],conversation_config:{
 agent:{first_message:'Üdvözlöm! A Sárberki Horgásztó automatikus asszisztense vagyok. Miben segíthetek?',language:'hu',
  prompt:{prompt,llm:'gemini-2.5-flash',temperature:0,tools:[{type:'webhook',name:'sarberki_reply',
   description:'A Sárberki saját rendszerének válasza. Minden hívói megszólalás után kötelező meghívni; a válasz reply mezőjét szó szerint kell elmondani.',
   response_timeout_secs:8,
   api_schema:{url:URL,method:'POST',request_headers:{'x-sarberki-voice-key':voiceKey},
    request_body_schema:{type:'object',description:'A hívás eddigi hívói mondatai',properties:{
     caller_messages:{type:'array',description:'A hívó EDDIGI ÖSSZES mondata szó szerint, időrendben (a legutóbbi is).',items:{type:'string',description:'Egy hívói mondat szó szerint'}},
     language:{type:'string',description:'A hívó nyelve, ha egyértelmű: hu, de, en vagy si.',enum:['hu','de','en','si']},
     // Real phone line only (owner 2026-11-26: the TEST line answers only the owner's test callers).
     caller_id:{type:'string',description:'',dynamic_variable:'system__caller_id'}},required:['caller_messages']}}},
   // Owner 2026-11-26 (PERM-20261126-VOICE-OPTION): the booking request with the e-mail address (voice-request).
   {type:'webhook',name:'sarberki_request',
   description:'Foglalási igény rögzítése. Csak akkor hívd, ha a hívó elfogadta az ajánlatot, megadta az e-mail-címét, a visszaolvasott címet megerősítette és hozzájárult a rögzítéshez. A válasz reply mezőjét szó szerint mondd el; rögzítést csak ok:true esetén állíts.',
   response_timeout_secs:20,
   api_schema:{url:REQUEST_URL,method:'POST',request_headers:{'x-sarberki-voice-key':voiceKey},
    request_body_schema:{type:'object',description:'A foglalási igény',properties:{
     caller_messages:{type:'array',description:'A hívó EDDIGI ÖSSZES mondata szó szerint, időrendben.',items:{type:'string',description:'Egy hívói mondat szó szerint'}},
     name:{type:'string',description:'A hívó neve úgy, ahogy megadta és megerősítette (pl. „Kovács Anna”).'},
     email:{type:'string',description:'A hívó e-mail-címe úgy, ahogy elhangzott és megerősítette (pl. „kovacs pont anna kukac gmail pont com”).'},
     consent:{type:'boolean',description:'true, ha a hívó igent mondott a rögzítésre ezzel a címmel.'},
     conversation_id:{type:'string',description:'',dynamic_variable:'system__conversation_id'},
     // Real phone line only: the caller's number (owner 2026-11-26: no need to ask for it).
     caller_id:{type:'string',description:'',dynamic_variable:'system__caller_id'},
     language:{type:'string',description:'A hívó nyelve: hu, de, en vagy si.',enum:['hu','de','en','si']}},required:['caller_messages','name','email','consent','conversation_id']}}}]}},
 tts:{voice_id:VOICE,model_id:'eleven_flash_v2_5'},
 // Owner 2026-11-26: a call lasts at most 5 minutes (prepaid number + agent minutes).
 conversation:{max_duration_seconds:300},
 // Owner's call 2026-11-26: „horgászjegyeket” was heard as „horgászigényeket” – our own words for the speech recogniser.
 asr:{keywords:['horgászjegy','napijegy','napijegyet','horgászjegyet','rekord tó','normál tó','dézsa','dézsafürdő','Deluxe','VIP','Családi','faház','Sárberki','kukac','pont','foglaló']}}};
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
