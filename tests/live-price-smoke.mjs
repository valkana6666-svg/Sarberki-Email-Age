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
assert.equal(multi.unitBreakdown.length,2);
assert.equal(multi.unitBreakdown.reduce((sum,unit)=>sum+unit.total,0),multi.total);
assert.equal(multi.unitBreakdown.reduce((sum,unit)=>sum+unit.tourismTax,0),multi.tourismTax);
for(const unit of multi.unitBreakdown) assert.ok(Number.isSafeInteger(unit.total)&&unit.total>0);
console.log('LIVE PREVIO MULTI-UNIT PASS',JSON.stringify({units:multi.units,availableUnits:multi.availableUnits,total:multi.total,eurTotal:multi.eurConversion.totalEur}));

const childInput={...input,children:[7,11]};
const childResponse=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(childInput),signal:AbortSignal.timeout(60000)});
const child=await childResponse.json();
assert.equal(childResponse.ok,true,JSON.stringify(child));
assert.equal(child.status,'review_required');
assert.deepEqual(child.children,[7,11]);
assert.equal(child.bookingCompleted,false);
assert.equal(child.accommodation+child.tourismTax,child.total);
assert.equal(child.eurConversion?.status,'available');
console.log('LIVE PREVIO CHILD REVIEW PASS',JSON.stringify({children:child.children,availableUnits:child.availableUnits,total:child.total,tourismTax:child.tourismTax,eurTotal:child.eurConversion.totalEur,status:child.status}));


const mappedCabins=['deluxe','family','vip','small'];
const childAges=[2,5,13,17];
const matrix=[];
for(const cabin of mappedCabins){
  for(const age of childAges){
    const matrixInput={arrival:'2026-10-16',departure:'2026-10-18',cabin,adults:2,children:[age]};
    const matrixResponse=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(matrixInput),signal:AbortSignal.timeout(60000)});
    const matrixRaw=await matrixResponse.text();
    let quote;
    try { quote=JSON.parse(matrixRaw); } catch { throw new Error(`Nem JSON élő gyermekár-válasz: ${cabin}/${age}: ${matrixRaw.slice(0,200)}`); }
    assert.equal(matrixResponse.ok,true,`Élő gyermekár HTTP hiba ${cabin}/${age}: ${matrixRaw}`);
    assert.equal(quote.cabin,cabin);
    assert.equal(quote.adults,2);
    assert.deepEqual(quote.children,[age]);
    assert.equal(quote.bookingCompleted,false);
    if(quote.status==='unavailable'){
      const row={cabin,age,adults:2,children:[age],status:'unavailable',availableUnits:quote.availableUnits};
      matrix.push(row);console.log('LIVE PREVIO CHILD MATRIX ROW',JSON.stringify(row));continue;
    }
    assert.equal(quote.status,'review_required',`${cabin}/${age}`);
    assert.equal(quote.currency,'HUF');
    assert.equal(quote.availability,'available');
    assert.ok(Number.isSafeInteger(quote.total)&&quote.total>0,`${cabin}/${age}: nincs teljes ár`);
    assert.equal(quote.accommodation+quote.tourismTax,quote.total);
    const row={cabin,age,adults:2,children:[age],status:quote.status,availableUnits:quote.availableUnits,accommodation:quote.accommodation,tourismTax:quote.tourismTax,total:quote.total};
    matrix.push(row);console.log('LIVE PREVIO CHILD MATRIX ROW',JSON.stringify(row));
  }
  const adultControlInput={arrival:'2026-10-16',departure:'2026-10-18',cabin,adults:3,children:[]};
  const adultResponse=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(adultControlInput),signal:AbortSignal.timeout(60000)});
  const adultRaw=await adultResponse.text();
  let adultQuote;
  try { adultQuote=JSON.parse(adultRaw); } catch { throw new Error(`Nem JSON élő 18 éves/felnőtt kontroll: ${cabin}: ${adultRaw.slice(0,200)}`); }
  assert.equal(adultResponse.ok,true,`Élő felnőtt kontroll HTTP hiba ${cabin}: ${adultRaw}`);
  assert.equal(adultQuote.cabin,cabin);
  assert.equal(adultQuote.adults,3);
  assert.deepEqual(adultQuote.children,[]);
  assert.equal(adultQuote.bookingCompleted,false);
  if(adultQuote.status==='unavailable'){
    const row={cabin,age:18,adults:3,children:[],status:'unavailable',availableUnits:adultQuote.availableUnits};
    matrix.push(row);console.log('LIVE PREVIO CHILD MATRIX ROW',JSON.stringify(row));continue;
  }
  assert.equal(adultQuote.status,'review_required');
  assert.equal(adultQuote.availability,'available');
  assert.ok(Number.isSafeInteger(adultQuote.total)&&adultQuote.total>0);
  const row={cabin,age:18,adults:3,children:[],status:adultQuote.status,availableUnits:adultQuote.availableUnits,accommodation:adultQuote.accommodation,tourismTax:adultQuote.tourismTax,total:adultQuote.total};
  matrix.push(row);console.log('LIVE PREVIO CHILD MATRIX ROW',JSON.stringify(row));
}
console.log('LIVE PREVIO CHILD MATRIX PASS',JSON.stringify(matrix));
