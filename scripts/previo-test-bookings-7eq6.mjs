// PERM-20261128-TEST-BOOKINGS-7EQ6 (owner 2026-11-28): four TEST bookings through the SAME chat pre-fill path as a chat
// booking (returning-guest check on Previo history, central price engine incl. 7=6, free unit, option), then confirmed
// (2) so they stay. Fictional guests, e-mail sarberkito@gmail.com. Idempotent per booking number. Prints the result of
// each: unit, Previo price, staff note, expected numbers – no other guest data.
import {createHash} from 'node:crypto';
import {prefillChatBooking} from '../shared-core/server-chat-prefill.mjs';
import {voucherFor,buildVoucherSearchXml} from '../shared-core/server-previo-reservation-write.mjs';
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';
import {applyReturningDiscount} from '../shared-core/returning-guest.mjs';
const key=process.env.PREVIO_API_KEY;if(!key||key.length<16){console.log('BLOCKED key');process.exit(1);}
const PERM='PERM-20261128-TEST-BOOKINGS-7EQ6';
const env={CHAT_PREVIO_PREFILL:'test-only',PREVIO_WRITE_ENABLED:'sandbox-73521-only',PREVIO_HOTEL_ID:'73521',PREVIO_WRITE_PERMISSION_ID:PERM,PREVIO_API_KEY:key,
 PREVIO_SEND_GUEST_CONTACT:'test-pair-only',RETURNING_GUEST_CHECK:'test-only',PREVIO_READ_API_ENABLED:'sandbox-73521-only'};
const post=async(p,x)=>{const r=await fetch('https://api.previo.app/x1/hotel/'+p,{method:'POST',redirect:'error',headers:{Authorization:'ApiKey '+key,'Content-Type':'application/xml',Accept:'application/xml'},body:x});return r.text();};
const B=[
 {tag:'1 normál 7 éj',name:'Teszt Hétéjszaka',phone:'+36 30 111 2201',arrival:'2027-10-04',departure:'2027-10-11',ret:false},
 {tag:'2 normál 14 éj szezonhatár',name:'Teszt Kéthét',phone:'+36 30 111 2202',arrival:'2027-08-19',departure:'2027-09-02',ret:false},
 {tag:'3 törzsvendég 3 éj',name:'Teszt Visszatérő',phone:'+36 30 765 4321',arrival:'2027-10-05',departure:'2027-10-08',ret:true},
 {tag:'4 törzsvendég 7 éj',name:'Teszt Visszatérő',phone:'+36 30 765 4321',arrival:'2027-10-12',departure:'2027-10-19',ret:true}];
for(const b of B){
 const caseId='tm-'+createHash('sha256').update(PERM+':'+b.tag).digest('hex').slice(0,24),voucher=voucherFor({tenantId:'sarberki-test',caseId});
 const facts={arrival:b.arrival,departure:b.departure,adults:2,children:0,childAges:[],cabin:'deluxe'};
 let q=fetchPublicPriceReference({arrival:b.arrival,departure:b.departure,cabin:'deluxe',adults:2,children:[]});
 if(b.ret)q=applyReturningDiscount(q,{status:'eligible',pct:20,lastStay:'2026-10-10'});
 const r=await prefillChatBooking({env,tenantId:'sarberki-test',caseId,facts,name:b.name,email:'sarberkito@gmail.com',phone:b.phone,channel:'chat'});
 const find=async()=>[...(await post('searchReservations',buildVoucherSearchXml({hotelId:'73521',voucher,arrival:b.arrival,departure:b.departure}))).matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(m=>m[1]).filter(x=>x.includes(`<voucher>${voucher}</voucher>`));
 let rows=await find();
 const resId=rows[0]?.match(/<resId>(\d+)/)?.[1];
 if(rows.length===1&&rows[0].match(/<statusId>(\d+)/)?.[1]==='1'){const t=await post('reservation',`<?xml version="1.0"?><request><hotId>73521</hotId><newReservation><resId>${resId}</resId><gCosId>2</gCosId></newReservation></request>`);
  console.log('CONFIRM',b.tag,/<error>/.test(t)?(t.match(/<message>([^<]{0,160})/)||[])[1]:'ok');rows=await find();}
 const x=rows[0]||'';
 console.log('BOOKING',JSON.stringify({tag:b.tag,prefill:r.status,reason:r.reason||null,returning:r.returning??null,voucher,resId:x.match(/<resId>(\d+)/)?.[1]||null,statusId:x.match(/<statusId>(\d+)/)?.[1]||null,
  unit:r.unit||null,previoPrice:x.match(/<price>([0-9.]+)<\/price>/)?.[1]||null,expected:{list:q.accommodationBeforeDiscount??q.listAccommodation??q.accommodation,returning20:q.returningDiscount?.amount??0,free7eq6:q.weeklyFree?.amount??0,accommodation:q.accommodation,ifa:q.tourismTax,gross:q.total},
  note:(x.match(/<gNote>([^<]{0,400})<\/gNote>/)?.[1]||'').replace(/\+?\d[\d ]{7,}\d/g,'[telefon]')}));
}
