// Opt-in anonymous, read-only probe; excluded from npm test.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {fetchPublicBookingAvailability} from '../price-source/sarberki-public-booking.mjs';
import {buildAvailabilityOptions} from '../netlify/functions/availability-options.mjs';
import * as core from '../sarberki-core.mjs';
import {splitRequestFromText} from '../split-units.mjs';
if(!process.argv.includes('--live-read-only')) throw Error('Use --live-read-only to enable the anonymous public occupancy probe.');
const stay={arrival:'2026-10-23',departure:'2026-10-25'};
const results=await Promise.all(['vip','family','deluxe','splitC','splitA'].map(async cabin=>{
 const evidence=[];
 const request=async(url,options={})=>{
  const response=await fetch(url,options);
  const path=new URL(url).pathname;
  if(response.ok){
   const text=await response.clone().text();
   const item={method:options.method||'GET',path,status:response.status,sha256:crypto.createHash('sha256').update(text).digest('hex')};
   const params=text.match(/var PageParams = (\{.*?\})\s*\/\/-->/s);
   if(params){const p=JSON.parse(params[1]);item.dates={from:p.RESERVATION_DETAILS?.from,to:p.RESERVATION_DETAILS?.to};item.hotelId=p.HOT_ID;item.currency=p.CUR_CODE;item.kinds=p.OBJECT_KINDS.map(k=>({id:k.obkId,name:k.hotelLangName,total:k.numOfRooms}));}
   if(path==='/index/get-object-kind-occupancy/'){
    const p=JSON.parse(text);item.success=p.success;item.freeCounts=[...String(p.html).matchAll(/data-numOfFreeRooms="(\d+)"/g)].map(m=>Number(m[1]));
   }
   evidence.push(item);
  }
  return response;
 };
 try{return {cabin,result:await fetchPublicBookingAvailability({...stay,cabin},request),evidence};}
 catch(error){return {cabin,error:error.message,evidence};}
}));
const labels=['VIP apartman','Családi faház','Deluxe faház','Osztott faház C, emeleti, négyszemélyes apartman','Osztott faház A+B, két kétszemélyes apartman',null];
const inquiries=labels.map(label=>{
 const body=`Tisztelt Sárberki Horgásztó!\n\nÉrdeklődni szeretnénk, hogy 2026. október 23–25. között rendelkezésre áll-e ${label?'egy '+label:'szállás'} négy felnőtt részére, gyermek nélkül.\n\nAmennyiben igen, szeretnénk érdeklődni a foglalás lehetőségéről.\n\nKöszönettel!`;
 return {subject:'Szállásfoglalási érdeklődés',body,parsed:{dates:core.dateRangeFromText(body,new Date('2026-10-08T17:00:00Z')),adults:core.adultCountFromText(body),guests:core.guestCountFromText(body),children:core.childCountFromText(body),cabin:core.cabinFromText(body),split:splitRequestFromText(body)}};
});
const lookup=Object.fromEntries(results.map(x=>[x.cabin,x]));
const repaired=await buildAvailabilityOptions({...stay,guests:4},async input=>{const row=lookup[input.cabin];if(!row?.result)throw Error(row?.error||'Not probed');return row.result;});
const output={probeStartedFor:stay,guests:4,finishedAt:new Date().toISOString(),results,inquiries,repaired,bookingCompleted:false,emailSent:false};
await fs.writeFile(new URL('../reports/central-booking-2026-10-08/live-evidence.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(results.map(({cabin,result,error})=>({cabin,availableUnits:result?.availableUnits,checkedAt:result?.checkedAt,error}))));
console.log(JSON.stringify(inquiries.map(x=>x.parsed)));
