// Owner 2026-11-27 (PERM-20261127-VOICE-TUB-NOTE): hot tub on the phone – before or after the booking – keeps the
// thread, is answered with its price and goes to the Previo option's FIRST note field in the live form
// („DÉZSAFÜRDŐ <date> [<h> ÓRÁTÓL] 1x24 óra, <n> fő – <price> Ft”). Synthetic only, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTubRequest,tubNoteLines,isTubRequest,tubPricePer24h} from '../shared-core/voice-tub.mjs';
import {voiceTurn} from '../shared-core/voice-turn.mjs';
import {voiceRequest,voiceAddTub,stayTubLines} from '../shared-core/voice-request.mjs';
import {buildReservationXml,buildNoteXml,voucherFor} from '../shared-core/server-previo-reservation-write.mjs';

const C=()=>new Date('2026-11-27T10:00:00Z'),STAY={arrival:'2027-03-03',departure:'2027-03-09',guests:5};
const BASE=['Deluxe faház 2027. március 3-tól 9-ig.','Három felnőtt és két gyerek, négy és öt évesek.','Igen, szeretném lefoglalni.','Nagy Ádám, sarberkito kukac gmail pont com.','Igen, rögzítheti.'];

test('tub request: days within the stay, guests, hour; price 30 000 / 24 h up to 6, +4 000 per person above',()=>{
 assert.deepEqual(parseTubRequest('Szeretnék dézsát is március 5-re és 6-ra, öt főre.',STAY).days,['2027-03-05','2027-03-06']);
 const r=parseTubRequest('Dézsát szeretnénk 5-én este 6-tól, hét főre.',STAY);assert.deepEqual([r.days,r.persons,r.hour,r.total],[['2027-03-05'],7,18,34000]);
 assert.equal(parseTubRequest('Dézsát kérnénk minden napra.',STAY).days.length,6);
 assert.deepEqual(parseTubRequest('Kérünk dézsát is.',STAY).days,[]);
 assert.equal(tubPricePer24h(6),30000);assert.equal(tubPricePer24h(8),38000);
 for(const t of ['Mennyibe kerül a dézsa?','Mégse kell dézsa.','Családi faház dézsával 2027. július 10-től 13-ig'])assert.equal(isTubRequest(t),false,t);
 assert.deepEqual(tubNoteLines(r),['DÉZSAFÜRDŐ 2027.03.05. 18 ÓRÁTÓL 1x24 óra, 7 fő – 34 000 Ft (telefonos igény)']);
 assert.deepEqual(tubNoteLines(parseTubRequest('Dézsát kérünk 5-re.',STAY)),['DÉZSAFÜRDŐ 2027.03.05. 1x24 óra, 5 fő – 30 000 Ft (telefonos igény)'],'no hour → 1x24 óra');
});

test('the thread is kept: after the booking a tub request is answered, the stay does not change, no „would you like to book?”',async()=>{
 const t=await voiceTurn({utterances:[...BASE,'Szeretnék dézsát is március 5-re és 6-ra, öt főre.'],clock:C,booked:true});
 assert.equal(t.source,'tub');assert.match(t.reply,/március ötödike és március hatodika, öt főre, két napra, összesen hatvanezer forint/);
 assert.deepEqual([t.facts.arrival,t.facts.departure,t.facts.adults,t.facts.children],['2027-03-03','2027-03-09',3,2]);
 const offerFn=async()=>({status:'AVAILABLE',total:417900,text:'Jó hír: szabad.\nÁr: 417 900 Ft.'});
 const after=await voiceTurn({utterances:[...BASE,'Szeretnék dézsát is március 5-re és 6-ra, öt főre.','Mennyi lesz összesen?'],clock:C,offerFn,booked:true});
 assert.equal(after.facts.arrival,'2027-03-03');assert.doesNotMatch(after.reply,/Szeretné lefoglalni/);
});

test('booking with a tub request: summary + Previo reservation note (<gNote>); after the booking: appended to the same case',async()=>{
 const utt=['Deluxe faház 2027. március 3-tól 9-ig, három felnőtt és két gyerek, négy és öt évesek.','Szeretnénk dézsát is 5-re.','Igen, szeretném lefoglalni.','sarberkito kukac gmail pont com'];
 const created=[],prefills=[];
 await voiceRequest({utterances:utt,email:'sarberkito kukac gmail pont com',name:'Teszt Elek',consent:true,conversationId:'conv_tub00001',callerId:'+36300000001',clock:C,
  offerFn:async()=>({status:'AVAILABLE',total:417900}),createFn:async a=>{created.push(a);return {caseId:'tm-t'};},prefillFn:async a=>{prefills.push(a);return {status:'created',unit:'11'};}});
 assert.equal(created[0].facts.arrival,'2027-03-03','the tub day did not become the stay');
 assert.match(created[0].summary,/Dézsaigény[\s\S]*DÉZSAFÜRDŐ 2027\.03\.05\. 1x24 óra, 5 fő – 30 000 Ft/);
 assert.equal(prefills[0].mainNote,'DÉZSAFÜRDŐ 2027.03.05. 1x24 óra, 5 fő – 30 000 Ft (telefonos igény)');
 const xml=buildReservationXml({tenantId:'sarberki-test',caseId:'tm-aaaaaaaaaaaaaaaaaaaaaaaa',values:{arrival:'2027-03-03',departure:'2027-03-09',adults:'3',children:'2',child_ages:'4,5'},cabin:'deluxe',unit:'11',
  contactName:'Teszt Elek',totalHuf:408000,optionExpiresUtc:'2026-11-29T10:00:00Z',channel:'phone',note:'Telefonról érkezett.',mainNote:prefills[0].mainNote}).xml;
 assert.match(xml,/<gNote>Telefonról érkezett\. \| DÉZSAFÜRDŐ 2027\.03\.05\. 1x24 óra, 5 fő – 30 000 Ft \(telefonos igény\)<\/gNote>/);assert.doesNotMatch(xml,/<note>/,'Previo ignores <note> (73521, run 46012421447)');
 assert.deepEqual(stayTubLines(['Családi faház dézsával 2027. július 10-től 13-ig, négy felnőtt.'],{arrival:'2027-07-10',departure:'2027-07-13',adults:4,children:0}),['DÉZSAFÜRDŐ napok egyeztetendők 1x24 óra/nap, 4 fő – 30 000 Ft/24 óra (telefonos igény)']);
 const calls=[];const r=await voiceAddTub({utterances:[...BASE,'Szeretnék dézsát is március 5-re és 6-ra, öt főre.'],email:'sarberkito kukac gmail pont com',conversationId:'conv_tub00002',clock:C,
  noteFn:async a=>{calls.push(a);return {resId:1,added:a.lines.length};}});
 assert.equal(r.status,'TUB_NOTED');assert.match(calls[0].caseId,/^tm-[a-f0-9]{24}$/);assert.equal(calls[0].lines.length,2);assert.equal(calls[0].arrival,'2027-03-03');
 const fail=await voiceAddTub({utterances:[...BASE,'Szeretnék dézsát is 5-re.'],email:'sarberkito kukac gmail pont com',conversationId:'conv_tub00003',clock:C,noteFn:async()=>{throw Error('previo');}});
 assert.equal(fail.status,'TUB_NOT_SAVED');assert.match(fail.reply,/Munkatársunk a foglalásához rögzíti/);
 assert.match(buildNoteXml({resId:7,note:'a | b'}).xml,/<resId>7<\/resId><gNote>a \| b<\/gNote>/);
});

test('owner 2026-11-27: every way of saying the days – whole stay, „csak harmadikára / negyedikére”, first/last nights, a day answer to „melyik napokra?”',async()=>{
 const whole=['Dézsát szeretnénk minden napra.','Dézsát kérünk az összes napra.','Dézsát szeretnénk az egészre.','Dézsát kérnénk az egész ott tartózkodásunk teljes idejére.','Dézsát kérünk végig.','We would like the hot tub for the whole stay.','Wir möchten den Badezuber die ganze Zeit.','Želimo masažno kad vse dni.'];
 for(const t of whole)assert.equal(parseTubRequest(t,STAY).days.length,6,t);
 const one={'Dézsát szeretnénk csak harmadikára.':['2027-03-03'],'Dézsát csak negyedikére kérnénk.':['2027-03-04'],'Dézsát kérünk harmadikára és negyedikére.':['2027-03-03','2027-03-04'],
  'Dézsát szeretnénk az első két napra.':['2027-03-03','2027-03-04'],'Dézsát kérünk az utolsó napra.':['2027-03-08'],'Wir möchten den Badezuber am dritten.':['2027-03-03']};
 for(const [t,d] of Object.entries(one))assert.deepEqual(parseTubRequest(t,STAY).days,d,t);
 const ask=await voiceTurn({utterances:[...BASE,'Kérünk dézsát is.'],clock:C,booked:true});assert.match(ask.reply,/Melyik napokra/);
 const ans=await voiceTurn({utterances:[...BASE,'Kérünk dézsát is.','Csak negyedikére.'],clock:C,booked:true});
 assert.equal(ans.source,'tub');assert.deepEqual(ans.tub.days,['2027-03-04']);assert.equal(ans.facts.arrival,'2027-03-03','the stay is kept');
 assert.deepEqual(stayTubLines(['Deluxe faház 2027. március 3-tól 9-ig, három felnőtt.','Kérünk dézsát is.','Csak negyedikére.'],{arrival:'2027-03-03',departure:'2027-03-09',adults:3,children:0}),['DÉZSAFÜRDŐ 2027.03.04. 1x24 óra, 3 fő – 30 000 Ft (telefonos igény)']);
});

// Owner's TEST call 2026-11-27 14:54 (conv_3501…): Previo kept the note only in <gNote>, dropped „,” „–” „|”; the start
// hour came as a separate answer („Délután 4-től szeretném kérni.”).
import {previoBookingWriter} from '../shared-core/server-previo-booking-sync.mjs';
import {isTubTurn,tubTexts} from '../shared-core/voice-tub.mjs';
test('14:54 call: the hour answer joins the tub request; appendNote writes <gNote>, replaces our own line of that day, reads back without punctuation',async()=>{
 const U=['Szeretnék lefoglalni egy Deluxe faházat, március 3-tól 7-ig.','Három felnőtt érkezik, két gyermek. A gyermek három és négy évesek.','Igen, szeretném lefoglalni.','Tóth István.','Sárberkitó kukac gmail pont com.','Igen, rögzítheted a foglalási igényt.','Dézsát is szeretnék foglalni negyedikére. Egész napra.','Délután 4-től szeretném kérni.'];
 assert.equal(isTubTurn(U,7),true);assert.equal(isTubTurn(U,1),false);assert.equal(tubTexts(U).length,1);
 assert.equal(isTubTurn(['Március 3-tól 7-ig.','Délután 4-kor érkezünk.'],1),false,'a time without a tub request before it is not a tub turn');
 const calls=[];
 const r=await voiceAddTub({utterances:U,email:'sarberkito@gmail.com',conversationId:'conv_tub01454',language:'hu',clock:C,noteFn:async a=>{calls.push(a);return {added:1};}});
 assert.deepEqual(calls[0].lines,['DÉZSAFÜRDŐ 2027.03.04. 16 ÓRÁTÓL 1x24 óra, 5 fő – 30 000 Ft (telefonos igény)']);
 assert.match(r.reply,/március 4\., 16 órától, 5 főre/);
 // Previo double: stores <gNote> without „,” „–” „|” and echoes it as <note> too.
 let gnote='Telefonról érkezett. Ellenőrizd.  DÉZSAFÜRDŐ 2027.03.04. 1x24 óra 5 fő  30 000 Ft (telefonos igény)';const sent=[];
 const voucher=voucherFor({tenantId:'sarberki-test',caseId:'tm-aaaaaaaaaaaaaaaaaaaaaaaa'});
 const fetchImpl=async(url,{body})=>{sent.push(body);
  if(url.endsWith('/searchReservations'))return new Response(`<reservations><reservation><resId>55</resId><voucher>${voucher}</voucher><statusId>1</statusId><note>${gnote}</note><gNote>${gnote}</gNote></reservation></reservations>`);
  const m=body.match(/<gNote>([^<]*)<\/gNote>/);if(m)gnote=m[1].replace(/[,–|]/g,'');return new Response('<reservations><reservation><resId>55</resId></reservation></reservations>');};
 const w=previoBookingWriter({PREVIO_WRITE_ENABLED:'sandbox-73521-only',PREVIO_HOTEL_ID:'73521',PREVIO_WRITE_PERMISSION_ID:'PERM-20261127-VOICE-TUB-NOTE',PREVIO_API_KEY:'k'.repeat(20)},fetchImpl);
 const out=await w.appendNote({tenantId:'sarberki-test',caseId:'tm-aaaaaaaaaaaaaaaaaaaaaaaa',arrival:'2027-03-03',departure:'2027-03-07',lines:calls[0].lines});
 assert.deepEqual(out,{resId:55,added:1});
 const write=sent.find(b=>b.includes('<newReservation>'));
 assert.match(write,/<resId>55<\/resId><gNote>Telefonról érkezett\. Ellenőrizd\. \| DÉZSAFÜRDŐ 2027\.03\.04\. 16 ÓRÁTÓL 1x24 óra, 5 fő – 30 000 Ft \(telefonos igény\)<\/gNote>/);
 assert.doesNotMatch(write,/1x24 óra 5 fő  30 000/,'the earlier line of the same day is replaced');
 // the same line again → nothing written
 const n=sent.length;assert.deepEqual(await w.appendNote({tenantId:'sarberki-test',caseId:'tm-aaaaaaaaaaaaaaaaaaaaaaaa',arrival:'2027-03-03',departure:'2027-03-07',lines:calls[0].lines}),{resId:55,added:0});
 assert.equal(sent.slice(n).some(b=>b.includes('<newReservation>')),false);
});
