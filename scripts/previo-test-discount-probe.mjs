// PERM-20261127-DISCOUNT-API-PROBE (owner 2026-11-27): does Previo's XML reservation accept a per-guest <discount> and
// show it as its own discount line on the folio (like the „%” button)? ONE fictional option on TEST 73521, read back
// (reservation + account items), then cancelled. Prints only codes, amounts, item names – no guest data.
import {buildReservationXml,buildVoucherSearchXml,voucherFor,parseReservationResponse} from '../shared-core/server-previo-reservation-write.mjs';
import {createHash} from 'node:crypto';
const key=process.env.PREVIO_API_KEY;if(!key||key.length<16){console.log('BLOCKED key');process.exit(1);}
const post=async(p,x)=>{const r=await fetch('https://api.previo.app/x1/hotel/'+p,{method:'POST',redirect:'error',headers:{Authorization:'ApiKey '+key,'Content-Type':'application/xml',Accept:'application/xml'},body:x});return r.text();};
const err=t=>/<error>/.test(t)?(t.match(/<message>([^<]{0,200})/)||[])[1]||'error':null;
const values={arrival:'2027-11-02',departure:'2027-11-05',adults:'2',children:'0',child_ages:''};
const caseId='tm-'+createHash('sha256').update('discount-probe:PERM-20261127-DISCOUNT-API-PROBE').digest('hex').slice(0,24);
const voucher=voucherFor({tenantId:'sarberki-test',caseId});
const find=async()=>[...(await post('searchReservations',buildVoucherSearchXml({hotelId:'73521',voucher,arrival:values.arrival,departure:values.departure}))).matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(m=>m[1]).filter(b=>b.includes(`<voucher>${voucher}</voucher>`));
let list=await find();
if(!list.length){
 const req=buildReservationXml({tenantId:'sarberki-test',caseId,values,cabin:'deluxe',unit:'14',contactName:'Teszt Kedvezmény',contact:{email:'sarberkito@gmail.com',phone:null},
  totalHuf:192300,optionExpiresUtc:'2026-11-29T20:00:00Z',channel:'email',note:'Kedvezmény-API próba (PERM-20261127-DISCOUNT-API-PROBE)'});
 const xml=req.xml.replace(/<guest><guaId>(\d+)<\/guaId><\/guest>/g,'<guest><guaId>$1</guaId><discount>20</discount></guest>');
 console.log('SENT guest discount tags',(xml.match(/<discount>20<\/discount>/g)||[]).length);
 const t=await post('reservation',xml);const r=parseReservationResponse(t);console.log('CREATE',JSON.stringify({ok:r.ok,code:r.code||null,error:err(t)}));
 list=await find();
}
for(const b of list){
 const resId=b.match(/<resId>(\d+)/)?.[1];
 console.log('RES',JSON.stringify({resId,statusId:b.match(/<statusId>(\d+)/)?.[1],price:b.match(/<price>([0-9.]+)<\/price>/)?.[1],guestDiscounts:[...b.matchAll(/<discount>([^<]{0,20})<\/discount>/g)].map(m=>m[1])}));
 const a=await post('getAccountItems',`<resId>${resId}</resId>`);
 console.log('ACCOUNT',err(a)||'ok');
 for(const it of [...a.matchAll(/<(?:item|accountItem)>([\s\S]*?)<\/(?:item|accountItem)>/g)].map(m=>m[1]))
  console.log('ITEM',JSON.stringify({name:(it.match(/<name>([^<]{0,90})<\/name>/)||[])[1]||null,price:(it.match(/<price>([0-9.-]+)<\/price>/)||[])[1]||null,count:(it.match(/<count>([0-9.]+)<\/count>/)||[])[1]||null,
   type:(it.match(/<(?:type|itemType|kind)>([^<]{0,30})</)||[])[1]||null,tags:[...new Set([...it.matchAll(/<([A-Za-z]+)>/g)].map(m=>m[1]))].join(',')}));
 if(!/<(?:item|accountItem)>/.test(a))console.log('ACCOUNT_RAW_TAGS',[...new Set([...a.matchAll(/<([A-Za-z]+)[ >]/g)].map(m=>m[1]))].join(','));
 // Cleanup: cancel the probe option.
 const c=await post('reservation',`<?xml version="1.0"?><request><hotId>73521</hotId><newReservation><resId>${resId}</resId><gCosId>7</gCosId></newReservation></request>`);
 console.log('CANCEL',err(c)||'ok');
}
console.log('AFTER',JSON.stringify((await find()).map(b=>({statusId:b.match(/<statusId>(\d+)/)?.[1]}))));
