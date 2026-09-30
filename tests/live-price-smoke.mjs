import assert from 'node:assert/strict';

const endpoint='https://leafy-chimera-2403e5.netlify.app/.netlify/functions/price-quote';
const input={arrival:'2026-10-16',departure:'2026-10-18',cabin:'deluxe',adults:2,children:[]};

const response=await fetch(endpoint,{
  method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify(input)
});

const raw=await response.text();
let result;
try { result=JSON.parse(raw); }
catch { throw new Error('A teszt Netlify árlekérője nem JSON választ adott: '+raw.slice(0,200)); }

assert.equal(response.ok,true,'Az élő teszt árlekérés HTTP hibával tért vissza: '+raw);
assert.equal(result.status,'review_required');
assert.equal(result.source,'Sárberki hivatalos foglalási felület');
assert.equal(result.arrival,input.arrival);
assert.equal(result.departure,input.departure);
assert.equal(result.cabin,input.cabin);
assert.equal(result.adults,input.adults);
assert.deepEqual(result.children,input.children);
assert.equal(result.currency,'HUF');
assert.equal(result.availability,'available');
assert.ok(Number.isInteger(result.availableUnits) && result.availableUnits>=1,'Nincs igazolt szabad egység.');
assert.ok(Number.isSafeInteger(result.total) && result.total>0,'Nincs érvényes teljes ár.');
assert.ok(Number.isSafeInteger(result.accommodation) && result.accommodation>=0);
assert.ok(Number.isSafeInteger(result.tourismTax) && result.tourismTax>=0);
assert.equal(result.accommodation+result.tourismTax,result.total);
assert.equal(result.bookingCompleted,false);
assert.equal(result.eurConversion?.status,'available','Nincs aktuális MNB EUR átváltás: '+JSON.stringify(result.eurConversion));
assert.ok(Number.isFinite(result.eurConversion.rateHufPerEur) && result.eurConversion.rateHufPerEur>0,'Nincs érvényes MNB EUR-középárfolyam.');
assert.ok(Number.isFinite(result.eurConversion.totalEur) && result.eurConversion.totalEur>0,'Nincs EUR végösszeg.');

console.log('LIVE PREVIO PRICE PASS', JSON.stringify({
  arrival:result.arrival,
  departure:result.departure,
  cabin:result.cabin,
  availableUnits:result.availableUnits,
  accommodation:result.accommodation,
  tourismTax:result.tourismTax,
  total:result.total,
  currency:result.currency,
  eurTotal:result.eurConversion.totalEur,
  mnbRate:result.eurConversion.rateHufPerEur,
  mnbRateDate:result.eurConversion.rateDate
}));


const multiInput={arrival:'2026-10-16',departure:'2026-10-18',cabin:'deluxe',adults:4,children:[],units:2};
const multiResponse=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(multiInput)});
const multiRaw=await multiResponse.text();
let multi;
try { multi=JSON.parse(multiRaw); } catch { throw new Error('A többegységes élő árlekérés nem JSON választ adott: '+multiRaw.slice(0,200)); }
assert.equal(multiResponse.ok,true,'A többegységes élő árlekérés HTTP hibával tért vissza: '+multiRaw);
assert.equal(multi.status,'review_required');
assert.equal(multi.units,2);
assert.ok(Number.isInteger(multi.availableUnits)&&multi.availableUnits>=2,'Nincs legalább két szabad Deluxe egység az élő többegységes próbához.');
assert.ok(Number.isSafeInteger(multi.total)&&multi.total>0,'Nincs hiteles többegységes teljes ár.');
assert.equal(multi.bookingCompleted,false);
assert.equal(multi.eurConversion?.status,'available');
console.log('LIVE PREVIO MULTI-UNIT PASS',JSON.stringify({units:multi.units,availableUnits:multi.availableUnits,total:multi.total,eurTotal:multi.eurConversion.totalEur}));
