import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchPublicBookingQuote,requestPrevioReadOnly} from './sarberki-public-booking.mjs';

const first='<form id="firstStep" action="https://booking.previo.cz/?hotId=753011&amp;currency=HUF&amp;lang=hu&amp;PHPSESSID=test-session"></form>';
const categories=[{guaId:1,isDefault:true,isChild:false},{guaId:2,isChild:true,ageFrom:8,ageTo:17,isWithoutBed:false},{guaId:3,isChild:true,ageFrom:3,ageTo:7,isWithoutBed:false}];
const kinds=[{obkId:10,hotelLangName:'DELUXE faház'},{obkId:11,hotelLangName:'Családi faház'}];
function mock({free=2,price=122200,tax=2200,error=false,unknown=false}={}){
 const calls=[];
 const request=async(url,options={})=>{
  const path=new URL(url).pathname, data=Object.fromEntries(new URLSearchParams(options.body||''));calls.push({path,data});
  if(error&&path==='/index/get-occupancy-price/') throw Error('Previo nem elérhető');
  let body;
  if(path==='/') body=options.method==='POST'?`var PageParams = ${JSON.stringify({HOT_ID:753011,CUR_CODE:'HUF',RESERVATION_DETAILS:{from:data.arrival,to:data.departure},OBJECT_KINDS:kinds,GUEST_CATEGORIES:categories})} //--><div></div>`:first;
  else if(path==='/index/get-object-kind-occupancy/') body=JSON.stringify({success:true,html:`<form data-numOfFreeRooms="${free}"></form>`});
  else if(path==='/index/get-occupancy-price/'){
    const roomCount=JSON.parse(data.formData||'{"rooms":[]}').rooms.length||1;
    const divisor=price===244400&&roomCount===1?2:1;
    body=JSON.stringify({success:true,unknownPrice:unknown,totalPrice:Math.round(price/divisor),totalTaxes:Math.round(tax/divisor)});
  }
  else throw Error('Váratlan kérés: '+path);
  return {ok:true,url:path==='/'&&options.method==='POST'?'https://booking.previo.cz/index/step-2/?hotId=753011&PHPSESSID=test-session':'https://booking.previo.cz/index/step-1/?hotId=753011&PHPSESSID=test-session',text:async()=>body,json:async()=>JSON.parse(body)};
 };
 return {request,calls};
}
const base={arrival:'2027-10-16',departure:'2027-10-18',cabin:'deluxe',adults:2,children:[]};
test('2 adults: source JSON is the sole price, and availability is checked',async()=>{
 const m=mock();const quote=await fetchPublicBookingQuote(base,m.request);
 assert.equal(quote.total,122200);assert.equal(quote.tourismTax,2200);assert.equal(quote.availableUnits,2);assert.equal(quote.source,'Sárberki hivatalos foglalási felület');
 assert.deepEqual(JSON.parse(m.calls.at(-1).data.formData).rooms[0].guestCategories[0],{guaId:1,count:2});
});
test('2 adults and 7/11 year old children use separate Previo categories',async()=>{
 const m=mock();await fetchPublicBookingQuote({...base,children:[7,11]},m.request);
 const room=JSON.parse(m.calls.at(-1).data.formData).rooms[0];
 assert.equal(room.numOfGuestsWithBed,4);assert.deepEqual(room.guestCategories.map(x=>x.count),[2,1,1]);
});
test('different cabin maps to its own Previo object kind',async()=>{
 const m=mock();await fetchPublicBookingQuote({...base,cabin:'family'},m.request);
 assert.equal(m.calls[2].data.obkId,'11');
});
test('two units return a reconciled per-unit breakdown and require two free units',async()=>{
 const m=mock({free:3,price:244400,tax:4400});
 const quote=await fetchPublicBookingQuote({...base,adults:4,units:2},m.request);
 const aggregateCall=m.calls.find(x=>x.path==='/index/get-occupancy-price/'&&JSON.parse(x.data.formData).rooms.length===2);
 const rooms=JSON.parse(aggregateCall.data.formData).rooms;
 assert.equal(rooms.length,2);
 assert.deepEqual(rooms.map(r=>r.guestCategories[0].count),[2,2]);
 assert.equal(quote.units,2);
 assert.equal(quote.total,244400);
 assert.deepEqual(quote.unitBreakdown,[
   {unit:1,adults:2,children:[],accommodation:120000,tourismTax:2200,total:122200},
   {unit:2,adults:2,children:[],accommodation:120000,tourismTax:2200,total:122200}
 ]);
 const priceCalls=m.calls.filter(x=>x.path==='/index/get-occupancy-price/');
 assert.equal(priceCalls.length,3);
 const unavailable=await fetchPublicBookingQuote({...base,adults:4,units:2},mock({free:1}).request);
 assert.equal(unavailable.status,'unavailable');
 assert.equal(unavailable.availableUnits,1);
});
test('no capacity never requests a price',async()=>{
 const m=mock({free:0});const quote=await fetchPublicBookingQuote(base,m.request);
 assert.equal(quote.status,'unavailable');assert.equal(quote.availableUnits,0);assert.equal(quote.total,undefined);assert.equal(m.calls.length,3);
});
test('invalid input, unknown price and source error fail without a quote',async()=>{
 const m=mock();await assert.rejects(fetchPublicBookingQuote({...base,adults:0},m.request));assert.equal(m.calls.length,0);
 await assert.rejects(fetchPublicBookingQuote(base,mock({unknown:true}).request),/ellenőrzött teljes árat/);
 await assert.rejects(fetchPublicBookingQuote(base,mock({error:true}).request),/nem elérhető/);
});
test('all outbound requests are restricted to anonymous search, occupancy and price',async()=>{
 const m=mock();await fetchPublicBookingQuote(base,m.request);
 assert.deepEqual(m.calls.map(x=>x.path),['/','/','/index/get-object-kind-occupancy/','/index/get-occupancy-price/']);
 for(const call of m.calls) assert.equal(Object.keys(call.data).some(key=>/email|name|phone|payment|confirm|reservation/i.test(key)),false);
});
test('a changed first step form cannot route a POST to a reservation endpoint',async()=>{
 let count=0;
 const request=async()=>{count++;return {ok:true,url:'https://booking.previo.cz/?hotId=753011',text:async()=>'<form id="firstStep" action="https://booking.previo.cz/index/save-reservation/?hotId=753011"></form>'};};
 await assert.rejects(fetchPublicBookingQuote(base,request),/dátuműrlapja megváltozott/);
 assert.equal(count,1);
});
test('a search redirect to any booking submission route is rejected without following it',async()=>{
 let count=0;
 const request=async(url,options={})=>{
  count++;
  assert.equal(options.redirect,'manual');
  if(count===1)return {ok:true,url,text:async()=>first};
  return {status:302,headers:new Headers({location:'https://booking.previo.cz/index/save-reservation/?hotId=753011'})};
 };
 await assert.rejects(fetchPublicBookingQuote(base,request),/nem az engedélyezett keresési oldalra/);
 assert.equal(count,2);
});
test('redirects containing an unexpected guest or tracking parameter are rejected',async()=>{
 let count=0;
 const request=async(url)=>{
  count++;
  if(count===1)return {ok:true,url,text:async()=>first};
  return {status:302,headers:new Headers({location:'https://booking.previo.cz/index/step-2/?hotId=753011&guestEmail=test%40example.invalid'})};
 };
 await assert.rejects(fetchPublicBookingQuote(base,request),/Nem engedélyezett Previo kérés/);
 assert.equal(count,2);
});
test('only the known 302 search redirect is followed as GET',async()=>{
 const m=mock();let count=0;
 const request=async(url,options={})=>{
  count++;
  if(count===2)return {status:302,headers:new Headers({location:'https://booking.previo.cz/index/step-2/?hotId=753011&PHPSESSID=test-session'})};
  if(count===3){assert.equal(options.method,'GET');return {ok:true,url,text:async()=>`var PageParams = ${JSON.stringify({HOT_ID:753011,CUR_CODE:'HUF',RESERVATION_DETAILS:{from:base.arrival,to:base.departure},OBJECT_KINDS:kinds,GUEST_CATEGORIES:categories})} //--><div></div>`};}
  return m.request(url,options);
 };
 const quote=await fetchPublicBookingQuote(base,request);
 assert.equal(quote.total,122200);
 assert.equal(count,5);
});
test('forbidden endpoint, origin, redirect method and body make zero outbound calls',async()=>{
 let calls=0;
 const request=async()=>{calls++;throw Error('outbound call forbidden');};
 const cases=[
  ['https://booking.previo.cz/index/save-reservation/?hotId=753011',{method:'POST',body:'x=1'}],
  ['https://booking.previo.cz/index/step-3/?hotId=753011',{}],
  ['https://booking.previo.cz/index/get-occupancy-price/?hotId=753011',{method:'POST',body:'name=Teszt+Elek'}],
  ['https://other.example/index/get-occupancy-price/?hotId=753011',{method:'POST'}],
  ['https://booking.previo.cz/?hotId=753011',{method:'POST',body:'step=2&arrival=2027-10-16&departure=2027-10-18'}],
  ['https://booking.previo.cz/?hotId=753011&email=test%40example.invalid',{}]
 ];
 for(const [url,options] of cases) await assert.rejects(requestPrevioReadOnly(url,options,request));
 assert.equal(calls,0);
});

test('initial anonymous GET may redirect only to step-1',async()=>{
 let calls=0;
 const response=await requestPrevioReadOnly('https://booking.previo.cz/?hotId=753011',{},async(url,options)=>{
  calls++;
  if(calls===1)return {status:302,headers:new Headers({location:'https://booking.previo.cz/index/step-1/?hotId=753011&PHPSESSID=test-session'})};
  assert.equal(new URL(url).pathname,'/index/step-1/');assert.equal(options.method,'GET');return {status:200,ok:true};
 });
 assert.equal(response.status,200);assert.equal(calls,2);
});

test('nested personal fields and reservation hashes are blocked before network access',async()=>{
  let calls=0;
  const room={hash:null,isNonRef:false,numOfGuestsWithBed:2,guestCategories:[{guaId:1,count:2}]};
  for(const rooms of [[{...room,email:'test@example.invalid'}],[{...room,hash:'reservation-id'}],[{...room,guestCategories:[{guaId:1,count:2,name:'Guest'}]}]]) {
    const body=new URLSearchParams({hotId:'753011',currency:'HUF',lang:'hu',obkId:'10',PHPSESSID:'test',formData:JSON.stringify({obkId:10,rooms})});
    await assert.rejects(requestPrevioReadOnly('https://booking.previo.cz/index/get-occupancy-price/?hotId=753011',{method:'POST',body},async()=>{calls++;}),/névtelen/u);
  }
  assert.equal(calls,0);
});
