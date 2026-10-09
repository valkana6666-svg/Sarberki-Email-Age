import assert from 'node:assert/strict';

// Synthetic price-list calculation on the deployed isolated test site.
// DO NOT call any Previo or availability endpoint. This cannot confirm a free cabin.
const base='https://leafy-chimera-2403e5.netlify.app';
const input={arrival:'2027-10-01',departure:'2027-10-03',cabin:'deluxe',adults:2,children:[5,8]};
const response=await fetch(base+'/api/price-reference',{
  method:'POST',headers:{'content-type':'application/json',accept:'application/json'},
  body:JSON.stringify(input),cache:'no-store',signal:AbortSignal.timeout(70000)
});
const raw=await response.text();
let quote;
try{quote=JSON.parse(raw);}catch{throw Error('Public reference returned non-JSON HTTP '+response.status+': '+raw.slice(0,180));}
assert.equal(response.status,200,'Live public reference unavailable: '+JSON.stringify({httpStatus:response.status,response:quote}));
assert.match(response.headers.get('content-type')||'',/application\/json/u);
assert.equal(quote.status,'public_reference');
assert.equal(quote.referenceOnly,true);
assert.equal(quote.availability,'not_checked');
assert.equal(quote.availableUnits,null);
assert.equal(quote.bookingCompleted,false);
assert.equal(quote.arrival,input.arrival);
assert.equal(quote.departure,input.departure);
assert.equal(quote.cabin,input.cabin);
assert.equal(quote.adults,input.adults);
assert.deepEqual(quote.children,input.children);
assert.equal(quote.accommodation,120000);
assert.equal(quote.tourismTax,2200);
assert.equal(quote.total,122200);
assert.equal(quote.currency,'HUF');
assert.match(quote.source,/publikus árlista/u);
if(quote.eurConversion.status==='available'){
  assert.equal(quote.eurConversion.source,'Magyar Nemzeti Bank');
  assert.ok(quote.eurConversion.rateHufPerEur>0);
  assert.match(quote.eurConversion.rateDate,/^20\d{2}-\d{2}-\d{2}$/u);
  assert.ok(Math.abs(quote.eurConversion.totalEur-Math.round(quote.total/quote.eurConversion.rateHufPerEur*100)/100)<0.001);
}else assert.equal(quote.eurConversion.status,'unavailable');
console.log('DEPLOYED PUBLIC PRICE REFERENCE PASS',JSON.stringify({httpStatus:response.status,accommodation:quote.accommodation,tourismTax:quote.tourismTax,total:quote.total,availability:quote.availability,eurStatus:quote.eurConversion.status,eurTotal:quote.eurConversion.totalEur??null}));
