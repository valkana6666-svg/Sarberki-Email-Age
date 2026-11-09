#!/usr/bin/env node
// Read-only price check (owner-approved 2026-11-09): Previo 73521 suggester total vs our 2027 price-list calculator,
// adults only (Previo's "Gyerek" 0–17 category cannot express the 0–2 free / 3–8 +5000 rule). API TEST only;
// the suggester books nothing. Usage: NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/previo-price-compare.mjs
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';
import {previoPriceRequest,PREVIO_TEST_73521} from '../shared-core/previo-booking-intent.mjs';
export const CASES=Object.freeze([
 ['deluxe','2027-06-15','2027-06-17',2,'alap'],['deluxe','2027-06-15','2027-06-16',2,'1 éj +20%'],
 ['deluxe','2027-07-10','2027-07-12',4,'főszezon +10%'],['splitC','2027-06-15','2027-06-17',5,'C 5. felnőtt'],
 ['family','2027-06-20','2027-06-23',5,'pótfelnőtt'],['vip','2027-08-25','2027-08-28',3,'főszezon után'],
 ['small','2027-06-15','2027-06-17',2,'különálló'],['splitA','2027-06-15','2027-06-17',2,'A/B apartman']]);
if(import.meta.url===`file://${process.argv[1]}`){
 let fail=0;
 for(const [cabin,arrival,departure,adults,label] of CASES){
  const ours=fetchPublicPriceReference({arrival,departure,cabin,adults,children:[]});
  const req=previoPriceRequest({values:{arrival,departure,adults:String(adults),children:'0'},cabin,property:PREVIO_TEST_73521});
  const r=await fetch('https://api.previo.app/rest/reservations/accounts/suggester',{method:'POST',redirect:'error',
   headers:{Authorization:'ApiKey PROXY_REPLACES_THIS','X-Previo-Hotel-Id':req.hotelId,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(req.body)});
  const j=r.ok?await r.json():{};const ok=r.ok&&j.totalPrice===ours.total;if(!ok)fail++;
  console.log(`${ok?'PASS':'FAIL'} ${label}: ${cabin} ${arrival}→${departure} ${adults} fő – Previo ${r.status} ${j.totalPrice??'-'} / árlista ${ours.total}`);
 }
 process.exit(fail?1:0);
}
