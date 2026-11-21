// Owner 2026-11-19: chat two-step booking – 1) request → checked free cabin + price, 2) „Foglalás véglegesítése” →
// the request reaches the daily view as accepted at that price. Synthetic only: no network, fictional data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildChatOffer,offerInput} from '../shared-core/server-chat-offer.mjs';
import {createChatOfferHandler,chatOfferCapacity} from '../netlify/functions/chat-offer.mjs';
import {createChatIntakeHandler} from '../netlify/functions/chat-intake.mjs';
import {createChatOfferProvider,createChatRequestSender,REQUEST_TEXT} from '../sarberki-chatbot-project/chat-request-client.mjs';

const facts={arrival:'2027-05-14',departure:'2027-05-17',adults:3,children:2,childAges:[5,6],cabin:'family'};
const free=n=>async({cabin})=>({freeByCabin:{[cabin]:n}});
const NOW=()=>'2026-11-19T08:00:00.000Z';

test('offer: free Családi, 3 felnőtt + 5 és 6 éves → 184 950 Ft (szállás 180 000 + IFA 4 950), 50% foglaló',async()=>{
 const o=await buildChatOffer({facts,language:'hu',capacityFn:free(2),now:NOW});
 assert.equal(o.status,'AVAILABLE');assert.equal(o.total,184950);assert.equal(o.accommodation,180000);assert.equal(o.tourismTax,4950);
 assert.equal(o.depositPct,50);assert.equal(o.deposit,90000);
 assert.match(o.text,/2027\.05\.14\. – 2027\.05\.17\. között \(3 éj, 5 fő: 3 felnőtt, 2 gyermek\) a kért háztípusban \(Családi\)/);
 assert.match(o.text,/Ár: 184 950 Ft \(szállásdíj 180 000 Ft \+ idegenforgalmi adó 4 950 Ft\)/);
 assert.match(o.text,/Foglalás véglegesítése/);assert.doesNotMatch(o.text,/\b(?:1[0-5]|[1-9])\.? ?(?:ház|egység)\b/,'no internal house number');
 for(const lang of ['de','en','si'])assert.equal((await buildChatOffer({facts,language:lang,capacityFn:free(1),now:NOW})).total,184950);
});
test('offer: booked → UNAVAILABLE text; unknown/failed read → MISSING UNKNOWN (team path); bad facts → no input',async()=>{
 assert.equal((await buildChatOffer({facts,language:'hu',capacityFn:free(0),now:NOW})).status,'UNAVAILABLE');
 assert.equal((await buildChatOffer({facts,language:'hu',capacityFn:async()=>({freeByCabin:{}}),now:NOW})).reason,'UNKNOWN');
 assert.equal((await buildChatOffer({facts,language:'hu',capacityFn:async()=>{throw Error('x');},now:NOW})).reason,'UNKNOWN');
 assert.equal((await buildChatOffer({facts,language:'hu',capacityFn:null})).reason,'UNKNOWN');
 assert.equal(offerInput({...facts,childAges:[5]}),null,'a missing child age');
 assert.equal(offerInput({...facts,units:2}),null,'multi-unit stays with the team');
 assert.equal(offerInput({...facts,departure:'2027-05-14'}),null);
 assert.equal(offerInput({...facts,cabin:'split',adults:2,children:0,childAges:[]}).cabin,'splitA');
 assert.equal(offerInput({...facts,cabin:'split'}).cabin,'splitC');
 assert.equal(offerInput({...facts,cabin:'castle'}),null);
});
const req=(url,b,h={})=>new Request('https://leafy-chimera-2403e5.netlify.app/.netlify/functions/'+url,{method:'POST',body:JSON.stringify(b),
 headers:{origin:'https://leafy-chimera-2403e5.netlify.app','sec-fetch-site':'same-origin','content-type':'application/json',...h}});
test('chat-offer endpoint: off unless both TEST switches; TEST 73521 only; same-origin, exact keys, rate limit',async()=>{
 const on={INTAKE_CHAT_ENABLED:'test-only',PREVIO_READ_API_ENABLED:'sandbox-73521-only',PREVIO_HOTEL_ID:'73521',PREVIO_ROOM_KIND_MAP:'{}'};
 assert.equal(chatOfferCapacity({...on,PREVIO_HOTEL_ID:'753011'},fetch),null,'the live property is never read here');
 assert.equal((await createChatOfferHandler({env:{...on,INTAKE_CHAT_ENABLED:''}})(req('chat-offer',{facts,language:'hu'}))).status,503);
 assert.equal((await createChatOfferHandler({env:{...on,PREVIO_READ_API_ENABLED:''}})(req('chat-offer',{facts,language:'hu'}))).status,503);
 const h=createChatOfferHandler({env:on,perMinute:1});
 assert.equal((await h(req('chat-offer',{facts,language:'hu'},{'sec-fetch-site':'cross-site'}))).status,403);
 assert.equal((await h(req('chat-offer',{facts,language:'hu',extra:1}))).status,400);
 const ok=await h(req('chat-offer',{facts,language:'hu'}));assert.equal(ok.status,200);
 assert.equal((await ok.json()).offer.reason,'UNKNOWN','the empty test mapping cannot be read → no offer, never a guess');
 assert.equal((await h(req('chat-offer',{facts,language:'hu'}))).status,429);
});
const env={INTAKE_ENABLED:'test-only',INTAKE_CHAT_ENABLED:'test-only',SUPABASE_URL:'https://mojnqizbcaczstguikpv.supabase.co',INTAKE_HMAC_KEY:'ab'.repeat(32),
 SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',INTAKE_ACCOUNT_EMAIL:'intake@example.test',INTAKE_ACCOUNT_PASSWORD:'not-a-real-secret',ISOLATED_APPROVAL_ATTESTATION_KEY:'e5'.repeat(32)};
const body={consent:true,facts,language:'hu',phone:'+36 30 000 0000',email:'valkana6666@gmail.com',transcript:['Családi faház május 14-17, 3 felnőtt és 2 gyerek','5 és 6 évesek']};
test('step 2: the accepted price comes with the request, is re-computed on the server and shown to the operator',async()=>{
 let rpc=null;
 const fetchImpl=async(url,o={})=>{if(String(url).includes('/auth/v1/token'))return new Response(JSON.stringify({access_token:'jwt'}));rpc=JSON.parse(o.body);return new Response(JSON.stringify({caseId:'tm-x',revision:1}));};
 const h=createChatIntakeHandler({env,fetchImpl,random:()=>'0123456789abcdef'});
 assert.equal((await h(req('chat-intake',{...body,acceptedTotal:184950}))).status,200);
 assert.match(rpc.p_data.messages[0].text,/VÉGLEGESÍTETTE a foglalási igényét a felajánlott áron: 184 950 Ft \(árlista szerint egyezik\)/);
 assert.equal((await h(req('chat-intake',{...body,acceptedTotal:1000}))).status,200);
 assert.match(rpc.p_data.messages[0].text,/FIGYELEM: az árlista most 184 950 Ft, ellenőrizd/,'a changed page price is flagged, never trusted');
 assert.equal((await h(req('chat-intake',{...body,acceptedTotal:'184950'}))).status,400);
 assert.equal((await h(req('chat-intake',body))).status,200);assert.doesNotMatch(rpc.p_data.messages[0].text,/VÉGLEGESÍTETTE/,'step-1 path unchanged');
});
test('client: offer provider and sender (acceptedTotal only when given); texts in 4 languages',async()=>{
 const calls=[];const request=async(url,o)=>{calls.push({url,body:JSON.parse(o.body)});return new Response(JSON.stringify(url.includes('chat-offer')?{offer:{status:'AVAILABLE',text:'x',total:184950}}:{status:'sent'}));};
 assert.equal((await createChatOfferProvider({request})({facts,language:'hu'})).total,184950);
 await createChatRequestSender({request})({facts,phone:'+36 30 000 0000',language:'hu',transcript:['x'],acceptedTotal:184950});
 assert.equal(calls[1].body.acceptedTotal,184950);
 await createChatRequestSender({request})({facts,phone:'+36 30 000 0000',language:'hu',transcript:['x']});
 assert.equal('acceptedTotal' in calls[2].body,false);
 assert.equal(await createChatOfferProvider({request:async()=>new Response('{}',{status:503})})({facts,language:'hu'}),null);
 for(const l of ['hu','de','en','si'])for(const k of ['send','confirm','confirmNote','confirmed','toTeam','noOffer','checking'])assert.ok(REQUEST_TEXT[l][k],l+'.'+k);
});

test('owner 2026-11-19: the guest is told exactly what is missing; fixable gaps keep the form, others go to the team',async()=>{
 const m=async(f,lang='hu',cap=free(1))=>buildChatOffer({facts:f,language:lang,capacityFn:cap,now:NOW});
 const ages=await m({...facts,childAges:[5]});
 assert.equal(ages.status,'MISSING');assert.equal(ages.reason,'CHILD_AGES');assert.equal(ages.fixable,true);assert.match(ages.text,/hiányzik a gyermek\(ek\) életkora/);
 const big=await m({...facts,cabin:'deluxe',adults:7,children:0,childAges:[]});
 assert.equal(big.reason,'TOO_MANY');assert.match(big.text,/\(Deluxe\) legfeljebb 6 fő fér/);
 assert.equal((await m({...facts,departure:'2027-05-14'})).reason,'DATES');
 const multi=await m({...facts,units:2});assert.equal(multi.reason,'MULTI_UNIT');assert.equal(multi.fixable,false);
 const unknown=await m(facts,'hu',async()=>({freeByCabin:{}}));assert.equal(unknown.reason,'UNKNOWN');assert.equal(unknown.fixable,false);
 for(const l of ['de','en','si'])assert.equal((await m({...facts,childAges:[5]},l)).reason,'CHILD_AGES');
});

test('texts: the consent hint is the consent hint (regression 2026-11-21: it had been overwritten by the thank-you text)',()=>{
 assert.equal(REQUEST_TEXT.hu.needConsent,'Kérjük, pipálja be a hozzájárulást.');
 for(const l of ['hu','de','en','si']){assert.notEqual(REQUEST_TEXT[l].needConsent,REQUEST_TEXT[l].sent);assert.doesNotMatch(REQUEST_TEXT[l].needConsent,/Köszönjük|Vielen Dank|Thank you|Hvala/);}
});

test('owner 2026-11-21: requested type booked → free alternatives at once (own read per type, max 3, cheapest first); unknown reads left out',async()=>{
 const reads=[];const cap=async({cabin})=>{reads.push(cabin);if(cabin==='vip')throw Error('x');return {freeByCabin:{[cabin]:['family','splitC'].includes(cabin)?1:0}};};
 const o=await buildChatOffer({facts:{arrival:'2027-06-10',departure:'2027-06-13',adults:4,children:0,childAges:[],cabin:'deluxe'},language:'hu',capacityFn:cap,now:NOW});
 assert.equal(o.status,'UNAVAILABLE');assert.deepEqual(o.alternatives.map(a=>a.cabin),['splitC','family']);
 assert.match(o.text,/a kért háztípusban \(Deluxe\) nincs szabad hely\.\nUgyanerre az időszakra szabad: Osztott C – .* Ft; Családi – .* Ft\./);
 assert.ok(!reads.includes('splitA')&&!reads.includes('small'),'types too small for 4 are not even read');
 const none=await buildChatOffer({facts:{arrival:'2027-06-10',departure:'2027-06-13',adults:2,children:0,childAges:[],cabin:'deluxe'},language:'hu',capacityFn:async({cabin})=>({freeByCabin:{[cabin]:0}}),now:NOW});
 assert.match(none.text,/más háztípusban sincs szabad hely/);
});
