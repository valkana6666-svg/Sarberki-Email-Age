// Owner 2026-11-25 (#9 7170471506): phone channel (Retell custom function) on the shared engine. Synthetic only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createVoiceTurnHandler} from '../netlify/functions/voice-turn.mjs';
import {voiceTurn,callerUtterances,speakable,voiceAuthorized} from '../shared-core/voice-turn.mjs';

const KEY='synthetic-voice-key-0123456789abcdef0123',RK='synthetic-retell-api-key-000';
const req=(body,headers={})=>{const raw=typeof body==='string'?body:JSON.stringify(body);return new Request('https://x.test/.netlify/functions/voice-turn',{method:'POST',headers:{'content-type':'application/json','x-sarberki-voice-key':KEY,...headers},body:raw});};
const sig=(raw,ms=Date.now(),key=RK)=>`v=${ms},d=${createHmac('sha256',key).update(raw+ms).digest('hex')}`;
const CLOCK=()=>new Date('2026-11-25T12:00:00Z');

test('switch, method, key and Retell signature',async()=>{
 const off=createVoiceTurnHandler({env:{}});assert.equal((await off(req({message:'x'}))).status,503);
 const h=createVoiceTurnHandler({env:{VOICE_TURN:'test-only',VOICE_TURN_KEY:KEY},fetchImpl:async()=>{throw Error('no network');}});
 assert.equal((await h(new Request('https://x.test',{method:'GET'}))).status,405);
 assert.equal((await h(req({message:'Szia'},{'x-sarberki-voice-key':'wrong'}))).status,401);
 assert.equal((await createVoiceTurnHandler({env:{VOICE_TURN:'test-only',VOICE_TURN_KEY:'short'}})(req({message:'x'}))).status,401,'a short key never authorises');
 assert.equal((await h(req({args:{}}))).status,400);
 const ok=await h(req({message:'Deluxe faházat szeretnénk 2027. június 10-től 13-ig, 2 felnőtt.'}));assert.equal(ok.status,200);
 const signed=createVoiceTurnHandler({env:{VOICE_TURN:'test-only',VOICE_TURN_KEY:KEY,RETELL_API_KEY:RK}});
 const body=JSON.stringify({message:'Hány órától lehet érkezni?'});
 assert.equal((await signed(req(body))).status,401,'signature required when the provider key is set');
 assert.equal((await signed(req(body,{'x-retell-signature':sig(body)}))).status,200);
 assert.equal((await signed(req(body,{'x-retell-signature':sig(body,Date.now()-6*60000)}))).status,401,'older than 5 minutes');
 assert.equal((await signed(req(body,{'x-retell-signature':sig(body+'x')}))).status,401,'other body');
 assert.equal(voiceAuthorized({headers:new Headers({'x-sarberki-voice-key':KEY}),raw:'',env:{VOICE_TURN_KEY:KEY}}),true);
});

test('caller utterances: the call transcript (agent lines never replayed), or tool arguments',()=>{
 assert.deepEqual(callerUtterances({call:{transcript_object:[{role:'agent',content:'Üdvözlöm!'},{role:'user',content:'Szia'},{role:'agent',content:'Miben segíthetek?'},{role:'user',content:'Deluxe ház?'}]},args:{message:'ignored'}}),['Szia','Deluxe ház?']);
 assert.deepEqual(callerUtterances({args:{caller_messages:['a',' b ',3,'']}}),['a','b']);
 assert.deepEqual(callerUtterances({message:'root'}),['root']);
 assert.equal(callerUtterances({args:{caller_messages:Array.from({length:60},(_,i)=>'m'+i)}}).length,40);
});

test('replay through the shared engine; the checked offer when the stay is complete; spoken form',async()=>{
 let offered=null;
 const offerFn=async({facts,language})=>{offered={facts,language};return {status:'AVAILABLE',total:128200,text:'Jó hír: a Deluxe ház 2027.06.10. – 2027.06.13. között szabad.\nÁr: 128 200 Ft.'};};
 const r=await voiceTurn({utterances:['Szia, foglalnék','Deluxe faházat','június 10-től 13-ig','ketten jövünk, 2 felnőtt'],clock:CLOCK,offerFn});
 assert.equal(r.source,'offer');assert.equal(r.reply,'Jó hír: a Deluxe ház 2027. június 10. – 2027. június 13. között szabad. Ár: 128200 forint.');
 assert.deepEqual(r.facts,{arrival:'2027-06-10',departure:'2027-06-13',adults:2,children:0,cabin:'Deluxe'});assert.equal(offered.facts.cabin,'deluxe');assert.deepEqual(r.offer,{status:'AVAILABLE',total:128200});
 const missing=await voiceTurn({utterances:['Deluxe faházat szeretnénk június 10-13'],clock:CLOCK,offerFn:async()=>{throw Error('not called');}});
 assert.equal(missing.source,'engine');assert.match(missing.reply,/felnőtt/);assert.doesNotMatch(missing.reply,/^Tisztelt|Szállás /);
 const de=await voiceTurn({utterances:['Wir möchten ein Familienhaus vom 5. bis 8. Juli 2027 für 2 Erwachsene'],clock:CLOCK});assert.equal(de.language,'de');
});

test('free question → fact-bound assist; thanks → short reply, no model call; no write path exists',async()=>{
 let asked=0;const assistFn=async()=>{asked++;return 'Igen, éjszaka is lehet horgászni.';};
 const q=await voiceTurn({utterances:['Lehet éjszaka horgászni?'],clock:CLOCK,assistFn});assert.equal(q.source,'assist');assert.equal(q.reply,'Igen, éjszaka is lehet horgászni.');
 const t=await voiceTurn({utterances:['Deluxe faházat szeretnénk 2027. június 10-től 13-ig, 2 felnőtt.','Köszi, ennyi!'],clock:CLOCK,assistFn});
 assert.equal(t.source,'engine');assert.equal(asked,1,'no model call for thanks');assert.match(t.reply,/köszönjük/i);
 assert.equal(speakable('Tisztelt Vendégünk!\n\nKöszönjük érdeklődését.\n\nSzállás\n– 2 felnőtt\nÜdvözlettel:\nSárberki Horgásztó'),'2 felnőtt');
 assert.ok(speakable('x. '.repeat(500)).length<=700);
});

import {buildConversations,checkFacts} from '../scripts/chat-language-e2e.mjs';
test('channel parity: the 100 four-language scenarios give the same stay facts on the phone path',async()=>{
 const bad=[];
 for(const c of buildConversations()){
  const r=await voiceTurn({utterances:c.turns.map(t=>t.text),clock:CLOCK});
  const f={dates:{arrival:r.facts.arrival,departure:r.facts.departure},adults:r.facts.adults,children:r.facts.children??0,cabin:r.facts.cabin};
  const want={...c.want};delete want.child_ages;
  const issues=checkFacts(f,want);if(issues.length)bad.push(c.id+': '+issues.join('; '));
  if(typeof r.reply!=='string'||!r.reply.trim())bad.push(c.id+': empty reply');
 }
 assert.deepEqual(bad,[]);
});

import {normalizeSpokenHu} from '../shared-core/voice-turn.mjs';
test('live call 2026-11-25 (call_80ab29bb…): spoken Hungarian dates and party reach the engine',async()=>{
 assert.equal(normalizeSpokenHu('Szeretnék. Hogy vane Samads Páz kétezer 27 június 2től június nyolcig.'),'Szeretnék. Hogy vane Samads Páz 2027 június 2-től június 8-ig.');
 assert.equal(normalizeSpokenHu('kétezer-huszonhét július elsejétől négy éjszakára'),'2027 július 1-től 4 éjszakára');
 assert.equal(normalizeSpokenHu('június tizedikétől tizenharmadikáig két felnőtt'),'június 10-től 13-ig 2 felnőtt');
 assert.equal(normalizeSpokenHu('Három felnőttet szeretnék. Gyerek nélkül.'),'3 felnőttet szeretnék. Gyerek nélkül.');
 for(const t of ['egy hét múlva jönnénk','Hét órakor érkezünk','Egy Deluxe házat kérnénk'])assert.equal(normalizeSpokenHu(t),t,'no date/party context: unchanged');
 const U=['Halló.','Miért nem hallok?','Szeretnék. Hogy vane Samads Páz kétezer 27 június 2től június nyolcig.','Három felnőttet szeretnék. Gyerek nélkül.','Három felnőtt lesz, gyerek nem lesz. Csak három felnőtt.'];
 const r=await voiceTurn({utterances:U,clock:()=>new Date('2026-11-25T19:20:00Z')});
 assert.deepEqual(r.facts,{arrival:'2027-06-02',departure:'2027-06-08',adults:3,children:0,cabin:null});
 assert.match(r.reply,/2027\. június 2\. és 2027\. június 8\. között 3 fő/);assert.doesNotMatch(r.reply,/telefonszám/,'no phone number asked on a phone call');
 const done=await voiceTurn({utterances:[...U,'Családi házat kérnék.'],clock:()=>new Date('2026-11-25T19:20:00Z'),offerFn:async()=>({status:'AVAILABLE',total:200000,text:'Jó hír: szabad.'})});
 assert.equal(done.source,'offer');assert.equal(done.facts.cabin,'Családi');
});

import {buildCalls,runVoice} from '../scripts/voice-speech-e2e.mjs';
import {normalizeSpoken,normalizeCabinNames} from '../shared-core/voice-normalize.mjs';
test('phone-style set: 100 calls (25 per language) – spoken numbers, years, "a week", child ages, misheard cabins, fillers, corrections',async()=>{
 const res=await runVoice(buildCalls());assert.equal(res.length,100);
 assert.deepEqual(res.filter(r=>!r.ok).map(r=>r.id+': '+r.issues.join('; ')),[]);
});
test('spoken-number normaliser: four languages, and unrelated words stay unchanged',()=>{
 assert.equal(normalizeSpoken('We would like the family cabin from June tenth to the thirteenth twenty twenty seven, three adults and two kids aged five and eight'),'We would like the family cabin from June 10 to 13 2027, 3 adults and 2 kids aged 5 and 8');
 assert.equal(normalizeSpoken('Wir möchten vom zehnten bis sechsten Juni zweitausendsiebenundzwanzig, drei Erwachsene'),'Wir möchten vom 10. bis 6. Juni 2027, 3 Erwachsene');
 assert.equal(normalizeSpoken('Želimo od desetega do trinajstega junija dva tisoč sedemindvajset, trije odrasli'),'Želimo od 10. do 13. junija 2027, trije odrasli');
 assert.equal(normalizeSpoken('ketten meg a két gyerek egy ötéves és egy nyolcéves, július elsejétől egy hétre'),'ketten meg a 2 gyerek egy 5 éves és egy 8 éves, július 1-től 7 éjszakára');
 for(const t of ['in a week we will call','Ich komme in einer Woche wieder','egy hét múlva','Hét órakor','first time here','the second floor'])assert.equal(normalizeSpoken(t),t);
 assert.equal(normalizeCabinNames('a de luxe cabin, de luks hiško, víp apartman, v i p'),'a Deluxe cabin, Deluxe hiško, VIP apartman, VIP');
});
