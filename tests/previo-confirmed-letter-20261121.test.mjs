// Owner 2026-11-21: after the staff confirmed the pre-filled booking in Previo, the guest always gets our confirmation
// letter (operator click). Synthetic only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {previoConfirmedLetter} from '../shared-core/server-test-mailbox-confirm.mjs';
import {buildBookingConfirmation} from '../shared-core/booking-confirmation-draft.mjs';
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';

const record={tenantId:'sarberki-test',caseId:'tm-abcdefabcdefabcdefabcdef',revision:3,data:{state:{values:{arrival:'2027-08-02',departure:'2027-08-05',adults:'2',children:'0',unit:'Családi',name:'Teszt Anna',language:'hu'}}}};
test('confirmed letter wording: "Foglalását megerősítettük" with the booking number, 4 languages',()=>{
 const quote=fetchPublicPriceReference({arrival:'2027-08-02',departure:'2027-08-05',cabin:'family',adults:2,children:[]});
 const c=buildBookingConfirmation({values:record.data.state.values,quote,previo:{reference:'V2-118436361',recordedAt:'2026-11-21T12:00:00Z'},language:'hu',bookingNumber:'SC-289D292A2909C490',confirmed:true});
 assert.match(c.text,/Köszönjük foglalását! Foglalását megerősítettük, az alábbi adatokkal\./);
 assert.match(c.text,/Foglalási szám: SC-289D292A2909C490/);assert.match(c.text,/összesen: 184 800 Ft/);assert.match(c.text,/VOUCHER/);
 for(const [l,re] of [['de',/Buchung mit den folgenden Angaben bestätigt/],['en',/We have confirmed your booking/],['si',/rezervacijo smo potrdili/]])
  assert.match(buildBookingConfirmation({values:record.data.state.values,quote,previo:{reference:'V2-1',recordedAt:'2026-11-21T12:00:00Z'},language:l,confirmed:true}).text,re);
});
test('Previo is the source: changed dates or price stop before anything is saved',async()=>{
 let called=false;const transport=async()=>{called=true;return null;};
 await assert.rejects(previoConfirmedLetter({record,previo:{resId:1,unit:'2',from:'2027-08-03',to:'2027-08-05',price:181500},attestationKey:'a'.repeat(64),transport}),/PREVIO_DATES_EDITED/);
 await assert.rejects(previoConfirmedLetter({record,previo:{resId:1,unit:'2',from:'2027-08-02',to:'2027-08-05',price:150000},attestationKey:'a'.repeat(64),transport}),/PREVIO_PRICE_EDITED/);
 await assert.rejects(previoConfirmedLetter({record,previo:null,transport}),/PREVIO_NOT_CONFIRMED/);
 assert.equal(called,false,'no database call on a refusal');
});

// Owner 2026-11-27: the letter may go out while Previo still shows an OPTION – then it does not say „megerősítettük”.
test('option letter (sendNow): „Foglalását rögzítettük … foglaló beérkezése után válik véglegessé”, approved for sending',async()=>{
 const quote=fetchPublicPriceReference({arrival:'2027-08-02',departure:'2027-08-05',cabin:'family',adults:2,children:[]});
 const calls=[];
 const transport=async(path,{body}={})=>{calls.push({path,body});
  if(path.endsWith('/sc_tm_confirm_booking'))return {case_id:record.caseId,revision:4,data:{state:{approval:'pending'},booking:{status:'finalized'},drafts:[body.p_draft]}};
  if(path.endsWith('/sc_tm_decide'))return {case_id:record.caseId,revision:5,data:{state:{approval:'approved_internal'},booking:{status:'finalized'}}};
  return null;};
 const rec={...record,data:{...record.data,messages:[],drafts:[{text:'x'}],sourceReceipt:{provider:'phone'},sender:'intake:phone'}};
 let r;try{r=await previoConfirmedLetter({record:rec,previo:{resId:9,unit:'2',from:'2027-08-02',to:'2027-08-05',price:quote.total},attestationKey:'a'.repeat(64),transport,optionLetter:true,unitCheckFn:async()=>({status:'free'})});}
 catch(e){r={error:e.code};}
 const draft=calls.find(c=>c.path.endsWith('/sc_tm_confirm_booking'))?.body?.p_draft?.text||'';
 assert.match(draft,/Foglalását rögzítettük/);assert.doesNotMatch(draft,/megerősítettük/);assert.match(draft,/foglaló beérkezése után válik véglegessé/);
 assert.equal(r.approved,true);
});
