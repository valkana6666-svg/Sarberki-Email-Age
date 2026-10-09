import assert from 'node:assert/strict';

// This safe smoke test calls only our test-host MNB currency helper.
// It must never call the Previo booking, availability or price endpoints.
const endpoint='https://leafy-chimera-2403e5.netlify.app/.netlify/functions/manual-fx';
const response=await fetch(endpoint,{method:'GET',headers:{accept:'application/json'},signal:AbortSignal.timeout(70000)});
const raw=await response.text();
let result;
try{result=JSON.parse(raw);}catch{throw Error('MNB helper returned non-JSON: '+response.status+' '+raw.slice(0,180));}
assert.match(response.headers.get('content-type')||'',/application\/json/u);
if(response.status===200){
  assert.equal(result.status,'available');
  assert.ok(Number.isFinite(result.rateHufPerEur)&&result.rateHufPerEur>0);
  assert.match(result.rateDate,/^20\d{2}-\d{2}-\d{2}$/u);
  assert.equal(result.source,'Magyar Nemzeti Bank');
}else{
  assert.equal(response.status,503,'Unexpected status '+response.status+': '+raw);
  assert.equal(result.status,'unavailable','Expected only a controlled MNB outage, not Netlify function failure.');
}
console.log('TEST-HOST MNB FUNCTION REACHABLE',JSON.stringify({httpStatus:response.status,status:result.status,rateDate:result.rateDate||null}));
