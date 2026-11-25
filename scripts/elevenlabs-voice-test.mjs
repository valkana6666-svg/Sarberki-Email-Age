// Owner 2026-11-25: Claude's ElevenLabs key (GitHub secret ELEVENLABS_CLAUDE_TEST_API_KEY). Lists Hungarian voices
// of the shared library and reads ONE fixed synthetic phone reply with a few of them (≈200 characters each), so the
// owner can choose the phone voice. Text-to-speech and voice listing only; no account change. The audio is printed as
// base64 between markers (the job log is the transport); the key is never printed.
const API='https://api.elevenlabs.io';
const SAMPLE='Jó hír: kétezer-huszonhét március negyedike és március nyolcadika között a Deluxe házban van szabad hely. Ár: kétszázhatvanezer-nyolcszáz forint, ebből a foglaló százhuszonhatezer forint. Mondja meg, kérem, megfelel-e?';
const key=process.env.XI_KEY;if(!key){console.log('BLOCKED key');process.exit(1);}
const H={'xi-api-key':key,Accept:'application/json'};
const req=JSON.parse(process.argv[2]||'{}');
const r=await fetch(API+'/v1/shared-voices?language=hu&page_size=40&sort=cloned_by_count'+(req.search?'&search='+encodeURIComponent(req.search):''),{headers:H});
const j=await r.json().catch(()=>({}));
console.log('VOICES_HTTP',r.status,j?.detail?.status||'');
const voices=(j.voices||[]).map(v=>({id:v.voice_id,owner:v.public_owner_id,name:v.name,gender:v.gender,age:v.age,accent:v.accent,use:v.use_case,cloned:v.cloned_by_count,verifiedHu:(v.verified_languages||[]).some(l=>l.language==='hu')}));
for(const v of voices)console.log('VOICE',JSON.stringify(v));
const pick=(req.voices&&req.voices.length?voices.filter(v=>req.voices.includes(v.name.split(' - ')[0])||req.voices.includes(v.id)):voices.filter(v=>v.verifiedHu)).slice(0,Number(req.max)||4);
const models=req.models||['eleven_flash_v2_5'];
for(const v of pick)for(const model of models){
 const t=await fetch(API+`/v1/text-to-speech/${v.id}?output_format=mp3_22050_32`,{method:'POST',headers:{...H,'Content-Type':'application/json',Accept:'audio/mpeg'},body:JSON.stringify({text:SAMPLE,model_id:model,language_code:'hu'})});
 if(!t.ok){console.log('TTS_FAIL',v.name,model,t.status,(await t.text()).slice(0,200));continue;}
 const b=Buffer.from(await t.arrayBuffer()).toString('base64');
 console.log(`AUDIO_BEGIN ${v.id} ${model} ${v.name.replace(/\s+/g,'_').slice(0,40)}`);for(let i=0;i<b.length;i+=8000)console.log('A '+b.slice(i,i+8000));console.log('AUDIO_END');
}
