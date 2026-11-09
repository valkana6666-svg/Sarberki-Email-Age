import test from 'node:test';
import assert from 'node:assert/strict';
import {readPrevioPrice,previoPriceChecker,previoPriceLine} from '../shared-core/server-previo-price-check.mjs';
import {priceTestMailboxCase} from '../shared-core/server-test-mailbox-price.mjs';
import {PRICE_LINE} from '../shared-core/price-insert-sentence.mjs';

// Synthetic key/case only; fetch injected, no network.
const API='synthetic-previo-key-0123456789';
const values={arrival:'2027-06-15',departure:'2027-06-17',adults:'2',children:'0',child_ages:''};
const suggester=(total,status=200)=>{const calls=[];return {calls,fetchImpl:async(url,o)=>{calls.push({url,o});
 return new Response(JSON.stringify({currency:{currencyId:9,currencyCode:'HUF'},totalPrice:total}),{status});}};};

test('suggester read: POST to the pinned host for 73521, adults as Felnőtt, total returned',async()=>{
 const s=suggester(128200);const r=await readPrevioPrice({apiKey:API,values,cabin:'deluxe',fetchImpl:s.fetchImpl});
 assert.deepEqual(r,{status:'read',total:128200});
 const {url,o}=s.calls[0];assert.equal(url,'https://api.previo.app/rest/reservations/accounts/suggester');
 assert.equal(o.method,'POST');assert.equal(o.redirect,'error');assert.equal(o.headers['X-Previo-Hotel-Id'],'73521');
 assert.deepEqual(JSON.parse(o.body).rooms[0].guests,[{guestCategoryId:472221},{guestCategoryId:472221}]);
});
test('not comparable with a child under 9; unavailable on error, bad key, wrong currency – no throw',async()=>{
 const s=suggester(1);
 assert.equal((await readPrevioPrice({apiKey:API,values:{...values,children:'1',child_ages:'5'},cabin:'deluxe',fetchImpl:s.fetchImpl})).status,'not_comparable');
 assert.equal(s.calls.length,0);
 assert.equal((await readPrevioPrice({apiKey:API,values,cabin:'deluxe',fetchImpl:suggester(1,400).fetchImpl})).status,'unavailable');
 assert.equal((await readPrevioPrice({apiKey:'x',values,cabin:'deluxe',fetchImpl:s.fetchImpl})).status,'unavailable');
 assert.equal((await readPrevioPrice({apiKey:API,values,cabin:'deluxe',fetchImpl:async()=>new Response('{"currency":{"currencyCode":"EUR"},"totalPrice":5}')})).status,'unavailable');
 assert.equal((await readPrevioPrice({apiKey:API,values,cabin:'deluxe',fetchImpl:async()=>{throw Error('net');}})).status,'unavailable');
});
test('checker only behind the owner switch and 73521',()=>{
 assert.equal(previoPriceChecker({},fetch),null);
 assert.equal(previoPriceChecker({PREVIO_READ_API_ENABLED:'sandbox-73521-only',PREVIO_HOTEL_ID:'753011'},fetch),null);
 assert.equal(typeof previoPriceChecker({PREVIO_READ_API_ENABLED:'sandbox-73521-only',PREVIO_HOTEL_ID:'73521'},fetch),'function');
});
test('operator line: match / difference / not comparable / unavailable',()=>{
 assert.equal(previoPriceLine({status:'read',total:128200},128200),'Previo-ár (csak olvasó): 128 200 Ft – egyezik az árlistával.');
 assert.match(previoPriceLine({status:'read',total:130000},128200),/ELTÉR az árlistától \(128 200 Ft\)/);
 assert.match(previoPriceLine({status:'not_comparable'},1),/nem összevethető/);
 assert.match(previoPriceLine(null,1),/nem ellenőrizhető/);
});
test('price step: the Previo line goes to the operator text only; guest text and our total unchanged',async()=>{
 const record={tenantId:'sarberki-test',caseId:'tm-18f2a0b1c2d3e4f0',revision:2,data:{state:{values:{...values,language:'hu'}},
  drafts:[{text:'Kedves Vendégünk!\n\n'+PRICE_LINE.hu+'\n\nÜdvözlettel:\nSárberki Horgásztó',operatorReviewText:'Ellenőrző szöveg.'}]}};
 const saved=[];
 const r=await priceTestMailboxCase({record,cabin:'deluxe',availabilityConfirmed:true,attestationKey:'e5'.repeat(32),
  transport:async(p,{body})=>{saved.push(body);return {case_id:body.p_case,revision:3};},
  quoteFn:i=>({status:'public_reference',total:128200,cabin:i.cabin,nights:2,adults:2,children:[],lines:[]}),
  priceCheckFn:async({cabin})=>{assert.equal(cabin,'deluxe');return {status:'read',total:128200};}});
 assert.equal(r.quote.total,128200);
 assert.match(saved[0].p_draft.operatorReviewText,/Previo-ár \(csak olvasó\): 128 200 Ft – egyezik az árlistával\./);
 assert.doesNotMatch(saved[0].p_draft.text,/Previo/);
 // A failing checker never blocks the price step.
 const s2=[];await priceTestMailboxCase({record,cabin:'deluxe',availabilityConfirmed:true,attestationKey:'e5'.repeat(32),
  transport:async(p,{body})=>{s2.push(body);return {case_id:body.p_case,revision:3};},
  quoteFn:i=>({status:'public_reference',total:128200,cabin:i.cabin,nights:2,adults:2,children:[],lines:[]}),priceCheckFn:async()=>{throw Error('x');}});
 assert.match(s2[0].p_draft.operatorReviewText,/nem ellenőrizhető/);
});
