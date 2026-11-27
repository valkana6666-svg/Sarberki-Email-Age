// PERM-20261127-PAST-GUEST-3 (owner 2026-11-27): ONE fictional, checked-out stay in Previo TEST 73521 for the
// returning-guest (20%) test – created as an option with the test-pair contact, then set to checked out (9), read back.
// Idempotent by its booking number (SC-…): a second run finds it and does not create another.
import {buildReservationXml,buildVoucherSearchXml,voucherFor,parseReservationResponse} from '../shared-core/server-previo-reservation-write.mjs';
import {createHash} from 'node:crypto';
const key=process.env.PREVIO_API_KEY;if(!key||key.length<16){console.log('BLOCKED key');process.exit(1);}
const H={Authorization:'ApiKey '+key,'Content-Type':'application/xml',Accept:'application/xml'};
const post=async(p,x)=>{const r=await fetch('https://api.previo.app/x1/hotel/'+p,{method:'POST',redirect:'error',headers:H,body:x});return r.text();};
// Run 2: Previo refuses a status change ≥ 2 months after departure → October dates; the September option is cancelled.
const values={arrival:'2026-10-10',departure:'2026-10-13',adults:'2',children:'0',child_ages:''};
const caseId='tm-'+createHash('sha256').update('past-guest-3b:PERM-20261127-PAST-GUEST-3').digest('hex').slice(0,24);
{const t=await post('reservation','<?xml version="1.0"?><request><hotId>73521</hotId><newReservation><resId>118653715</resId><gCosId>7</gCosId></newReservation></request>');
 console.log('SEPT 118653715 →7',/<error>/.test(t)?(t.match(/<message>([^<]{0,160})/)||[])[1]:'ok');}
const voucher=voucherFor({tenantId:'sarberki-test',caseId});
const find=async()=>[...(await post('searchReservations',buildVoucherSearchXml({hotelId:'73521',voucher,arrival:values.arrival,departure:values.departure}).replace('<cosId>8</cosId>','<cosId>8</cosId><cosId>9</cosId><cosId>10</cosId>'))).matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(m=>m[1]).filter(b=>b.includes(`<voucher>${voucher}</voucher>`))
 .map(b=>({resId:Number(b.match(/<resId>(\d+)/)?.[1]),statusId:Number(b.match(/<statusId>(\d+)/)?.[1]),price:b.match(/<price>([0-9.]+)<\/price>/)?.[1],hasEmail:/<email>sarberkito@gmail\.com<\/email>/.test(b),hasPhone:/<phone>[^<]*765[^<]*<\/phone>/.test(b)}));
let found=await find();console.log('BEFORE',voucher,JSON.stringify(found));
if(!found.length){
 const req=buildReservationXml({tenantId:'sarberki-test',caseId,values,cabin:'deluxe',unit:'12',contactName:'Teszt Visszatérő',contact:{email:'sarberkito@gmail.com',phone:'+36 30 765 4321'},
  totalHuf:192300,optionExpiresUtc:'2026-11-30T12:00:00Z',channel:'email',note:'Kitalált múltbeli tesztfoglalás (törzsvendég-próba, PERM-20261127-PAST-GUEST-3)'});
 const r=parseReservationResponse(await post('reservation',req.xml));console.log('CREATE',JSON.stringify({ok:r.ok,code:r.code||null,resId:r.resId||null}));
 found=await find();
}
if(found.length!==1){console.log('STOP: expected exactly one',found.length);process.exit(1);}
if(found[0].statusId!==9){
 const t=await post('reservation',`<?xml version="1.0"?><request><hotId>73521</hotId><newReservation><resId>${found[0].resId}</resId><gCosId>9</gCosId></newReservation></request>`);
 console.log('STATUS→9',/<error>/.test(t)?(t.match(/<message>([^<]{0,160})/)||[])[1]:'ok');
}
console.log('AFTER',JSON.stringify(await find()));
