#!/usr/bin/env node
// Read-only price check (owner-approved 2026-11-09): Previo 73521 suggester total vs our 2027 price-list calculator,
// adults only by default; --children runs the child cases (see docs/PREVIO-GYEREKAR-JAVASLAT-2026-11-09.md). API TEST only;
// the suggester books nothing. Usage: NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/previo-price-compare.mjs
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';
import {previoPriceRequest,PREVIO_TEST_73521} from '../shared-core/previo-booking-intent.mjs';
export const CASES=Object.freeze([
 ['deluxe','2027-06-15','2027-06-17',2,'alap'],['deluxe','2027-06-15','2027-06-16',2,'1 éj +20%'],
 ['deluxe','2027-07-10','2027-07-12',4,'főszezon +10%'],['splitC','2027-06-15','2027-06-17',5,'C 5. felnőtt'],
 ['family','2027-06-20','2027-06-23',5,'pótfelnőtt'],['vip','2027-08-25','2027-08-28',3,'főszezon után'],
 ['small','2027-06-15','2027-06-17',2,'különálló'],['splitA','2027-06-15','2027-06-17',2,'A/B apartman']]);
// --children (docs/PREVIO-GYEREKAR-JAVASLAT-2026-11-09.md): expected to pass only after the child categories are set.
export const CHILD_CASES=Object.freeze([
 ['deluxe','2027-06-15','2027-06-17',2,'alaplétszámon belül',[4,1]],['deluxe','2027-06-15','2027-06-17',4,'gyerek 5',[5]],
 ['deluxe','2027-06-15','2027-06-17',4,'gyerek 1',[1]],['deluxe','2027-06-15','2027-06-17',4,'gyerek 12',[12]],
 ['deluxe','2027-06-15','2027-06-17',4,'gyerek 5 és 1',[5,1]],
 ['family','2027-06-15','2027-06-17',4,'Családi + gyerek 5',[5]],['family','2027-06-15','2027-06-17',4,'Családi + baba',[1]],
 ['vip','2027-06-15','2027-06-17',4,'VIP + gyerek 6',[6]],['splitC','2027-06-15','2027-06-17',4,'C + gyerek 7',[7]],
 ['deluxe','2027-07-10','2027-07-12',4,'főszezon + gyerek',[5]],['deluxe','2027-06-15','2027-06-16',4,'1 éj + gyerek',[5]],
 ['family','2027-06-15','2027-06-17',2,'Családi, 2 gyerek alaplétszámon belül',[4,12]],
 ['small','2027-06-15','2027-06-17',2,'15-ös pótágy gyerek (Previo-ár hiányzik 11-11)',[5]]]);
if(import.meta.url===`file://${process.argv[1]}`){
 let fail=0;
 const list=process.argv.includes('--children')?CHILD_CASES:CASES;
 for(const [cabin,arrival,departure,adults,label,kids=[]] of list){
  const ours=fetchPublicPriceReference({arrival,departure,cabin,adults,children:kids});
  const req=previoPriceRequest({values:{arrival,departure,adults:String(adults),children:String(kids.length),child_ages:kids.join(',')},cabin,property:PREVIO_TEST_73521});
  const r=await fetch('https://api.previo.app/rest/reservations/accounts/suggester',{method:'POST',redirect:'error',
   headers:{Authorization:'ApiKey PROXY_REPLACES_THIS','X-Previo-Hotel-Id':req.hotelId,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(req.body)});
  const j=r.ok?await r.json():{};const ok=r.ok&&j.totalPrice===ours.total;if(!ok)fail++;
  console.log(`${ok?'PASS':'FAIL'} ${label}: ${cabin} ${arrival}→${departure} ${adults} fő – Previo ${r.status} ${j.totalPrice??'-'} / árlista ${ours.total}`);
 }
 process.exit(fail?1:0);
}
