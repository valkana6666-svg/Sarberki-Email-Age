// Owner 2026-11-26 (PERM-20261126-VOICE-OPTION): the phone assistant takes a booking with the e-mail address only,
// saves the request (channel „phone”) and pre-fills a 48-hour Previo TEST option. Synthetic only: no network,
// fictional data (the owner's ElevenLabs test call wording, conv_7801…).
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSpokenEmail,speakEmail,stayUtterances,voiceRequest,voiceExternalId,PHONE_CONTACT_NAME} from '../shared-core/voice-request.mjs';
import {voiceTurn,ASK_EMAIL} from '../shared-core/voice-turn.mjs';
import {prefillChatBooking,PHONE_NOTE,PREFILL_OPTION_HOURS} from '../shared-core/server-chat-prefill.mjs';
import {createVoiceRequestHandler} from '../netlify/functions/voice-request.mjs';
import {voucherFor} from '../shared-core/server-previo-reservation-write.mjs';

const C=()=>new Date('2026-11-26T09:00:00Z');
const CALL=['Szeretnék érdeklődni, hogy ööö, 2027. március 4-től 8-ig ööö, van-e szabad deluxe faház?','Négy felnőtt érkezne, gyerek nélkül.',
 'Akkor szeretném lefoglalni ezt a deluxe faházat négy főre, és szeretnék minden napra dézsafürdőt hozzá bérelni.'];
const MAIL='kitalalt pont anna2028 kukac example pont test';
const OFFER={status:'AVAILABLE',total:260800,deposit:126000,depositPct:50,arrival:'2027-03-04',text:'Jó hír: szabad.\nÁr: 260 800 Ft.'};

test('spoken e-mail → address (HU/DE/EN/SI words), invalid stays invalid; spoken back',()=>{
 assert.equal(normalizeSpokenEmail('kovacs pont anna kukac gmail pont com'),'kovacs.anna@gmail.com');
 assert.equal(normalizeSpokenEmail('Anna kötőjel B alulvonás 7 kukac Example pont test.'),'anna-b_7@example.test');
 assert.equal(normalizeSpokenEmail('max punkt muster ät web punkt de'),'max.muster@web.de');
 assert.equal(normalizeSpokenEmail('john dot smith at example dot com'),'john.smith@example.com');
 assert.equal(normalizeSpokenEmail('janez pika novak afna gmail pika com'),'janez.novak@gmail.com');
 assert.equal(normalizeSpokenEmail('Kitalalt.Anna@Example.test'),'kitalalt.anna@example.test');
 for(const bad of ['kukac gmail pont com','anna kukac gmail','a@b@c.com','',null,'x'.repeat(201)])assert.equal(normalizeSpokenEmail(bad),null,String(bad).slice(0,20));
 assert.equal(speakEmail('kitalalt.anna2028@example.test','hu'),'kitalalt pont anna kettő nulla kettő nyolc kukac example pont test');
 assert.equal(speakEmail('a-b_c@x.de','de'),'a Bindestrich b Unterstrich c at x Punkt de');
});

test('the stay is replayed only up to the booking decision; the dictated address is never stay data',()=>{
 assert.deepEqual(stayUtterances([...CALL,MAIL,'Igen.']),CALL);
 assert.deepEqual(stayUtterances(['Deluxe 2027. március 4-től 8-ig, négy felnőtt.','anna kukac example pont test']),['Deluxe 2027. március 4-től 8-ig, négy felnőtt.']);
});

test('acceptance with the phone request on: deposit terms + ONE e-mail question (no „send it by chat”); off: the honest old reply',async()=>{
 const offerFn=async()=>OFFER;
 const on=await voiceTurn({utterances:CALL,clock:C,offerFn,intake:true});
 assert.equal(on.source,'accept_email');assert.match(on.reply,/^Foglalóként a szállásdíj ötven százalékát/);
 assert.match(on.reply,/A dézsát is felírom/);assert.ok(on.reply.endsWith(ASK_EMAIL.hu));assert.doesNotMatch(on.reply,/chatjében|nem tudjuk véglegesíteni/);
 const off=await voiceTurn({utterances:CALL,clock:C,offerFn});assert.equal(off.source,'accept');assert.match(off.reply,/nem tudjuk véglegesíteni/);
 const noOffer=await voiceTurn({utterances:CALL,clock:C,offerFn:async()=>({status:'UNKNOWN'}),intake:true});
 assert.equal(noOffer.source,'accept','no checked free cabin → no e-mail question, no promise');
 const de=await voiceTurn({utterances:['Wir möchten ein Deluxe Haus vom 4. bis 8. März 2027 für vier Erwachsene.','Ja, wir buchen es.'],clock:C,offerFn,intake:true});
 assert.ok(de.reply.endsWith(ASK_EMAIL.de));
});

test('request: re-checked offer → saved case (channel facts + e-mail) → 48 h option → honest reply with the address read back; one Pushover',async()=>{
 const created=[],notes=[],prefills=[];let offerFacts=null;
 const r=await voiceRequest({utterances:[...CALL,MAIL,'Igen, jól.'],email:MAIL,consent:true,conversationId:'conv_7801m8aepe61e3g98p2zmpbyzmed',clock:C,
  offerFn:async({facts})=>{offerFacts=facts;return OFFER;},
  createFn:async a=>{created.push(a);return {caseId:'tm-aaaaaaaaaaaaaaaaaaaaaaaa'};},
  prefillFn:async a=>{prefills.push(a);return {status:'created',unit:'11'};},notifyFn:async m=>{notes.push(m);}});
 assert.equal(r.ok,true);assert.equal(r.status,'OPTION_CREATED');assert.equal(r.caseId,'tm-aaaaaaaaaaaaaaaaaaaaaaaa');
 assert.deepEqual(offerFacts,{arrival:'2027-03-04',departure:'2027-03-08',adults:4,children:0,cabin:'deluxe',units:1},'the address digits never change the stay');
 assert.equal(created.length,1);assert.equal(created[0].externalId,'voice_conv_7801m8aepe61e3g98p2zmpbyzmed');
 assert.equal(created[0].facts.email,'kitalalt.anna2028@example.test');assert.equal(created[0].facts.language,'hu');
 assert.match(created[0].summary,/újraellenőrzött ára: 260 800 Ft/);assert.match(created[0].summary,/dézsafürdőt/);assert.doesNotMatch(created[0].summary,/kukac/);
 assert.equal(prefills[0].email,'kitalalt.anna2028@example.test');
 assert.match(r.reply,/negyvennyolc órára előzetesen lefoglaltuk/);assert.match(r.reply,/kitalalt pont anna kettő nulla kettő nyolc kukac example pont test címre/);
 assert.equal(notes.length,1);assert.match(notes[0],/48 órás opcióként.*11\. egység/);assert.doesNotMatch(notes[0],/@|kitalalt/,'no contact data in the Pushover');
});

test('request: nothing is saved or promised without a valid address, consent, a complete stay and a re-checked free cabin',async()=>{
 let creates=0;const createFn=async()=>{creates++;return {caseId:'tm-x'};};
 const base={utterances:[...CALL,MAIL],email:MAIL,consent:true,conversationId:'conv_1234567',clock:C,offerFn:async()=>OFFER,createFn};
 const bad=await voiceRequest({...base,email:'anna kukac'});assert.equal(bad.status,'EMAIL_INVALID');assert.match(bad.reply,/betűzze/);
 assert.equal((await voiceRequest({...base,consent:undefined})).status,'CONSENT_REQUIRED');
 assert.equal((await voiceRequest({...base,utterances:['Szeretném lefoglalni.',MAIL]})).status,'FACTS_INCOMPLETE');
 const full=await voiceRequest({...base,offerFn:async()=>({status:'UNAVAILABLE',text:'foglalt'})});assert.equal(full.status,'NOT_FREE');assert.match(full.reply,/nem szabad/);
 assert.equal((await voiceRequest({...base,offerFn:async()=>{throw Error('previo');}})).status,'CHECK_FAILED');
 assert.equal((await voiceRequest({...base,offerFn:async()=>({status:'UNKNOWN'})})).status,'CHECK_FAILED');
 assert.equal(creates,0);
 for(const r of [await voiceRequest({...base,createFn:async()=>{throw Error('db');}}),await voiceRequest({...base,createFn:async()=>null})]){
  assert.equal(r.ok,false);assert.equal(r.status,'SAVE_FAILED');assert.match(r.reply,/nem sikerült rögzítenem/);assert.doesNotMatch(r.reply,/rögzítettük|lefoglaltuk/);}
 // Saved, but no Previo option: the request is promised, the 48-hour hold is NOT.
 const noOpt=await voiceRequest({...base,prefillFn:async()=>({status:'skipped',reason:'NO_FREE_UNIT'})});
 assert.equal(noOpt.ok,true);assert.equal(noOpt.status,'REQUEST_SAVED');assert.match(noOpt.reply,/rögzítettük/);assert.doesNotMatch(noOpt.reply,/negyvennyolc|lefoglaltuk/);
 assert.equal((await voiceRequest({...base,prefillFn:async()=>{throw Error('x');}})).status,'REQUEST_SAVED');
});

test('one call = one request id; without a provider id a stable hash',()=>{
 assert.equal(voiceExternalId('conv_abc123','x','y'),'voice_conv_abc123');
 const a=voiceExternalId(undefined,['a'],'m@x.de'),b=voiceExternalId('',['a'],'m@x.de');assert.equal(a,b);assert.match(a,/^voice_h[a-f0-9]{32}$/);
 assert.notEqual(a,voiceExternalId(null,['a'],'n@x.de'));assert.match(voiceExternalId('bad id!',[],''),/^voice_h/);
});

test('Previo pre-fill, phone: its own switch, phone source, phone note (no „Chatből”), placeholder name, no returning-guest check',async()=>{
 const calls=[];const writer={createOption:async a=>{calls.push(a);return {resId:7,voucher:voucherFor(a),created:true};}};
 let history=0;const NOW=Date.parse('2026-11-26T09:00:00Z');
 const base={tenantId:'sarberki-test',caseId:'tm-bbbbbbbbbbbbbbbbbbbbbbbb',facts:{arrival:'2027-03-04',departure:'2027-03-08',adults:4,children:0,cabin:'deluxe'},
  name:PHONE_CONTACT_NAME,email:'kitalalt@example.test',phone:'',channel:'phone',writer,unitCheckFn:async()=>({status:'free'}),historyFn:async()=>{history++;return {status:'eligible'};},
  quoteFn:async()=>({status:'public_reference',accommodation:252000,cabin:'deluxe'}),now:()=>NOW};
 assert.equal((await prefillChatBooking({...base,env:{CHAT_PREVIO_PREFILL:'test-only'}})).status,'off','the chat switch does not open the phone');
 assert.equal((await prefillChatBooking({...base,channel:'sms',env:{VOICE_INTAKE:'test-only'}})).status,'off');
 const r=await prefillChatBooking({...base,env:{VOICE_INTAKE:'test-only'}});
 assert.equal(r.status,'created');assert.equal(calls[0].channel,'phone');assert.equal(calls[0].note,PHONE_NOTE);assert.doesNotMatch(PHONE_NOTE,/Chatből|[,:-]/);
 assert.equal(calls[0].contactName,'Telefonos foglalás');assert.equal(calls[0].totalHuf,252000);assert.equal(history,0);
 assert.equal(calls[0].optionExpiresUtc,new Date(NOW+PREFILL_OPTION_HOURS*3600000).toISOString());
 assert.equal(calls[0].contact,null,'not a test-pair address: no contact data to Previo');
});

test('handler: off by default and without the phone/intake switches; provider key required; setup checked',async()=>{
 const KEY='synthetic-voice-key-0123456789abcdef0123';
 const req=(body,key=KEY)=>new Request('https://x.test/.netlify/functions/voice-request',{method:'POST',headers:{'content-type':'application/json','x-sarberki-voice-key':key},body:JSON.stringify(body)});
 const ON={VOICE_INTAKE:'test-only',VOICE_TURN:'test-only',INTAKE_ENABLED:'test-only',SUPABASE_URL:'https://mojnqizbcaczstguikpv.supabase.co',VOICE_TURN_KEY:KEY};
 const noNet=async()=>{throw Error('no network');};
 assert.equal((await createVoiceRequestHandler({env:{}})(req({}))).status,503);
 for(const k of ['VOICE_INTAKE','VOICE_TURN','INTAKE_ENABLED','SUPABASE_URL']){const env={...ON};delete env[k];assert.equal((await createVoiceRequestHandler({env,fetchImpl:noNet})(req({caller_messages:['x']}))).status,503,k);}
 const h=createVoiceRequestHandler({env:ON,fetchImpl:noNet});
 assert.equal((await h(req({caller_messages:['x']},'wrong'))).status,401);
 assert.equal((await h(req({}))).status,400);
 assert.equal((await h(req({caller_messages:CALL,email:MAIL,consent:true}))).status,503,'intake account not configured → setup required');
});

test('caller number from the phone line is saved (no need to ask); a web/app test call or a hidden number gives none',async()=>{
 const {callerPhone}=await import('../shared-core/voice-request.mjs');
 assert.equal(callerPhone('+36301234567'),'+36301234567');assert.equal(callerPhone('anonymous'),null);assert.equal(callerPhone(''),null);assert.equal(callerPhone(undefined),null);assert.equal(callerPhone('123'),null);
 const created=[],prefills=[];
 const base={utterances:[...CALL,MAIL],email:MAIL,consent:true,conversationId:'conv_caller01',clock:C,offerFn:async()=>OFFER,
  createFn:async a=>{created.push(a);return {caseId:'tm-c'};},prefillFn:async a=>{prefills.push(a);return {status:'created',unit:'12'};}};
 await voiceRequest({...base,callerId:'+36301234567'});
 assert.equal(created[0].facts.phone,'+36301234567');assert.match(created[0].summary,/hívó száma a telefonvonalról: \+36301234567/);assert.equal(prefills[0].phone,'+36301234567');
 await voiceRequest({...base,callerId:'{{system__caller_id}}'});
 assert.equal(created[1].facts.phone,undefined);assert.match(created[1].summary,/hívószám nem érkezett meg/);assert.equal(prefills[1].phone,'');
});

test('owner 2026-11-26: the e-mail question asks for the address slowly and clearly (all four languages)',()=>{
 assert.match(ASK_EMAIL.hu,/lassan és tagoltan/);assert.match(ASK_EMAIL.de,/langsam und deutlich/);assert.match(ASK_EMAIL.en,/slowly and clearly/);assert.match(ASK_EMAIL.si,/počasi in razločno/);
});

test('owner 2026-11-26: the TEST line takes bookings only from the owner\'s test callers; app calls (no number) stay allowed',async()=>{
 const {callerAllowed,TEST_LINE}=await import('../shared-core/voice-request.mjs');
 const env={VOICE_CALLER_ALLOWLIST:'+36 30 000 0001, 06200000002'};
 assert.equal(callerAllowed({},'+36301112233'),true,'no list: nobody is filtered');
 assert.equal(callerAllowed(env,'+36300000001'),true);assert.equal(callerAllowed(env,'0036300000001'),true);assert.equal(callerAllowed(env,'+36200000002'),true,'06… in the list = +36…');
 assert.equal(callerAllowed(env,'+36301112233'),false);assert.equal(callerAllowed(env,undefined),true,'app/web test call: no number');
 const {createVoiceTurnHandler}=await import('../netlify/functions/voice-turn.mjs');
 const KEY='synthetic-voice-key-0123456789abcdef0123';
 const req=b=>new Request('https://x.test/.netlify/functions/voice-turn',{method:'POST',headers:{'content-type':'application/json','x-sarberki-voice-key':KEY},body:JSON.stringify(b)});
 const h=createVoiceTurnHandler({env:{VOICE_TURN:'test-only',VOICE_TURN_KEY:KEY,...env},fetchImpl:async()=>{throw Error('no network');}});
 const stranger=await (await h(req({caller_messages:['Deluxe faház 2027. április 20-tól 23-ig, két felnőtt.'],caller_id:'+36301112233'}))).json();
 assert.equal(stranger.source,'test_line');assert.equal(stranger.reply,TEST_LINE.hu);assert.equal(stranger.offer,null);
 const owner=await (await h(req({caller_messages:['Deluxe faház 2027. április 20-tól 23-ig, két felnőtt.'],caller_id:'+36300000001'}))).json();
 assert.notEqual(owner.source,'test_line');
 const ON={VOICE_INTAKE:'test-only',VOICE_TURN:'test-only',INTAKE_ENABLED:'test-only',SUPABASE_URL:'https://mojnqizbcaczstguikpv.supabase.co',VOICE_TURN_KEY:KEY,...env};
 const r=await (await createVoiceRequestHandler({env:ON,fetchImpl:async()=>{throw Error('no network');}})(new Request('https://x.test/.netlify/functions/voice-request',{method:'POST',headers:{'content-type':'application/json','x-sarberki-voice-key':KEY},
  body:JSON.stringify({caller_messages:CALL,email:MAIL,consent:true,conversation_id:'conv_x1234567',caller_id:'+36301112233'})}))).json();
 assert.equal(r.status,'TEST_LINE');assert.equal(r.ok,false,'nothing saved for an unknown caller');
});

// The owner's booking call 2026-11-26 evening (conv_2601m8d2hd8ceyn8jze5w23526z1), synthetic data.
test('owner call 2026-11-26: name asked, digits read back one by one, „14:00” spoken as a time, side price questions stay side questions',async()=>{
 const {speakEmail:se,spokenName,voiceRequest:vr}=await import('../shared-core/voice-request.mjs');
 assert.equal(se('pelda66666@example.test','hu'),'pelda hat hat hat hat hat kukac example pont test');
 assert.equal(spokenName(' Teszt  Elek '),'Teszt Elek');assert.equal(spokenName('x'),null);assert.equal(spokenName('<b>'),null);
 assert.match(ASK_EMAIL.hu,/nevét, majd lassan és tagoltan az e-mail-címét/);
 const created=[],prefills=[];
 await vr({utterances:[...CALL,MAIL],email:MAIL,name:'Teszt Elek',consent:true,conversationId:'conv_name0001',clock:C,offerFn:async()=>OFFER,
  createFn:async a=>{created.push(a);return {caseId:'tm-n'};},prefillFn:async a=>{prefills.push(a);return {status:'created',unit:'11'};}});
 assert.equal(created[0].facts.name,'Teszt Elek');assert.equal(prefills[0].name,'Teszt Elek');
 const {speakable}=await import('../shared-core/voice-turn.mjs');
 assert.equal(speakable('A szállást 14:00 órától lehet átvenni, a bejelentkezés 14:00 és 2:00 között; reggeli 8:30-tól.',450,'hu'),'A szállást tizennégy órától lehet átvenni, a bejelentkezés tizennégy óra és két óra között; reggeli nyolc óra harminc perc-tól.');
 const C2=()=>new Date('2026-11-26T22:00:00Z');let offers=0;const asked=[];
 const offerFn=async()=>{offers++;return OFFER;},assistFn=async({message})=>{asked.push(message);return 'A napijegy 7 500 Ft.';};
 const base=['Érdeklődni szeretnék, hogy 2027. április 4-től 10-éig van egy deluxe házuk kiadó. Öt felnőtt részére.'];
 const t=x=>voiceTurn({utterances:[...base,...x],clock:C2,offerFn,assistFn,intake:true});
 offers=0;const a=await t(['És a horgász napi jegy?','Mennyibe kerül?']);assert.equal(a.source,'assist');assert.equal(offers,0,'short price question after a ticket question');
 assert.match(asked.at(-1),/napi jegy\? Mennyibe kerül\?/);
 const b=await t(['És a rekordtóra mennyibe kerül?']);assert.equal(b.source,'assist');assert.equal(offers,0);
 const c=await t(['És a horgász napi jegy?','Mennyibe kerül a szállás?']);assert.equal(c.source,'offer','naming the stay is a stay question');
 const d=await t(['Le szeretném foglalni a szállást.']);assert.equal(d.source,'accept_email');assert.match(d.reply,/nevét/);
});

test('owner call 2026-11-26: a full side question stands alone (not joined with the check-in question)',async()=>{
 const asked=[];const assistFn=async({message})=>{asked.push(message);return 'A napijegy 7 500 Ft.';};
 const base=['Deluxe faház 2027. április 4-től 10-ig, öt felnőtt.','Hány órától lehet átvenni a szállást?'];
 await voiceTurn({utterances:[...base,'És a horgász napi jegy?'],clock:C,offerFn:async()=>OFFER,assistFn});
 assert.equal(asked.at(-1),'És a horgász napi jegy?');
});

// The owner's first call over the Telnyx number (conv_2401m8d4bdnkfgn8g5drh8r5v0w7), synthetic address.
test('phone call 2026-11-27: spoken address forms → one address; the server reads it back naturally before saving',async()=>{
 const {normalizeSpokenEmail:n,voiceConfirm}=await import('../shared-core/voice-request.mjs');
 for(const s of ['Pel-da, hat-hat-hat-hat, kukac, gmail, pont, com.','pelda hatezer-hatszáz-hatvanhat kukac gmail pont com','pelda hat hat hat hat kukac gmail pont com','Pelda6666@gmail.com','pelda 6666 kukac gmail pont com'])
  assert.equal(n(s),'pelda6666@gmail.com',s);
 assert.equal(n('anna kötőjel kiss kukac example pont test'),'anna-kiss@example.test','„kötőjel” is a real hyphen');
 const c=voiceConfirm({email:'Pel-da, hat-hat-hat-hat, kukac, gmail, pont, com.',name:'Teszt Elek',language:'hu'});
 assert.equal(c.status,'CONFIRM');assert.equal(c.ok,false);
 assert.equal(c.reply,'Teszt Elek, az e-mail-cím: pelda hat hat hat hat kukac gmail pont com. Jól értettem, és rögzíthetem a foglalási igényt ezekkel az adatokkal?');
 assert.doesNotMatch(c.reply,/g m a i l|p e l d a/,'never letter by letter');
 assert.equal(voiceConfirm({email:'nem tudom',language:'hu'}).status,'EMAIL_INVALID');
 const KEY='synthetic-voice-key-0123456789abcdef0123';
 const ON={VOICE_INTAKE:'test-only',VOICE_TURN:'test-only',INTAKE_ENABLED:'test-only',SUPABASE_URL:'https://mojnqizbcaczstguikpv.supabase.co',VOICE_TURN_KEY:KEY};
 let calls=0;const h=createVoiceRequestHandler({env:ON,fetchImpl:async()=>{calls++;throw Error('no network');}});
 const r=await (await h(new Request('https://x.test/.netlify/functions/voice-request',{method:'POST',headers:{'content-type':'application/json','x-sarberki-voice-key':KEY},
  body:JSON.stringify({caller_messages:CALL,name:'Teszt Elek',email:'pelda hat hat hat hat kukac gmail pont com',preview:true,consent:false,conversation_id:'conv_p1234567'})}))).json();
 assert.equal(r.status,'CONFIRM');assert.equal(calls,0,'preview: no login, no save, no Previo');
});

test('owner 2026-11-27: the caller number is saved with the request; the tool result shows only whether it arrived',async()=>{
 const {voiceConfirm,voiceRequest:vr}=await import('../shared-core/voice-request.mjs');
 assert.equal(voiceConfirm({email:MAIL,callerId:'+36301234567'}).callerNumber,true);
 assert.equal(voiceConfirm({email:MAIL}).callerNumber,false);
 assert.doesNotMatch(JSON.stringify(voiceConfirm({email:MAIL,callerId:'+36301234567'})),/301234567/);
 const created=[];
 const r=await vr({utterances:[...CALL,MAIL],email:MAIL,name:'Teszt Elek',consent:true,conversationId:'conv_ph000001',callerId:'+36301234567',clock:C,offerFn:async()=>OFFER,
  createFn:async a=>{created.push(a);return {caseId:'tm-p'};}});
 assert.equal(r.callerNumber,true);assert.doesNotMatch(JSON.stringify(r),/301234567/);
 assert.equal(created[0].facts.phone,'+36301234567');assert.match(created[0].summary,/A hívó száma a telefonvonalról: \+36301234567/);
});

test('owner 2026-11-27: the phone price answer is short – price per type, extra adult, the question for the dates',async()=>{
 const {voiceTurn:vt}=await import('../shared-core/voice-turn.mjs');
 const one=await vt({utterances:['Mennyibe kerül a Deluxe faház?'],clock:C});
 assert.equal(one.reply,'A Deluxe faház alapára hatvanháromezer forint éjszakánként, négy főre; legfeljebb hat fő fér el. Minden további felnőtt plusz tízezer forint éjszakánként. A végső ár a létszámtól és a szezontól függően változhat. A pontos árhoz kérem, mondja meg az érkezés és távozás dátumát és a létszámot.');
 const all=await vt({utterances:['Mennyibe kerülnek a faházak?'],clock:C});
 assert.ok(all.reply.length<450);assert.match(all.reply,/ötvenötezer/);assert.match(all.reply,/huszonnégyezer forinttól/);assert.match(all.reply,/mondja meg az érkezés/);
});
