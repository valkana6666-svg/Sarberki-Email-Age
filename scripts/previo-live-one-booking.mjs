// READ-ONLY (Claude, PERM-20261127-LIVE-PRICE-COMPARE, owner 2026-11-27): find ONE live booking in Previo 753011 – the
// owner's screenshot (unit 7/B, 2027-05-06 → 05-09) – and compare its price with our own calculator. Calls:
// Hotel.searchReservations and Hotel.getDocuments (reads only). Printed: state, dates, unit, price, guest-category
// counts, document type/amount/date. Never a name, e-mail, phone, note or document number.
import {PREVIO_LIVE_753011} from '../shared-core/previo-booking-intent.mjs';
import {fetchPublicPriceReference} from '../price-source/public-price-fallback.mjs';
const key=process.env.PREVIO_LIVE_API_KEY;if(!key||key.length<16){console.log('BLOCKED key');process.exit(1);}
const HOTEL='753011',FROM='2027-05-06',TO='2027-05-09',UNIT='7/B',OBJ=PREVIO_LIVE_753011.rooms[UNIT];
const call=async(method,inner)=>{const r=await fetch('https://api.previo.app/x1/hotel/'+method,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
 headers:{Authorization:'ApiKey '+key,'Content-Type':'application/xml',Accept:'application/xml'},body:`<?xml version="1.0"?><request><hotId>${HOTEL}</hotId>${inner}</request>`});return {http:r.status,text:await r.text()};};
const s=await call('searchReservations',`<term><from>${FROM}</from><to>${TO}</to></term><termType>overlap</termType><statuses>${[1,2,3,4,5,6,7,8].map(i=>`<cosId>${i}</cosId>`).join('')}</statuses>`);
console.log('SEARCH',s.http,(s.text.match(/<message>([^<]{0,120})/)||[])[1]||'ok');
const blocks=[...s.text.matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(m=>m[1]).filter(b=>new RegExp(`<object>\\s*<objId>${OBJ}</objId>`).test(b));
console.log('MATCHES on',UNIT,blocks.length);
for(const b of blocks){
 const g=b.match(/<guaId>(\d+)<\/guaId>/g)||[],cats={};for(const x of g){const id=x.replace(/\D/g,'');cats[id]=(cats[id]||0)+1;}
 const com=b.match(/<comId>(\d+)<\/comId>/)?.[1];
 console.log('RES',JSON.stringify({statusId:b.match(/<statusId>(\d+)/)?.[1],from:b.match(/<term>\s*<from>([^<]{10})/)?.[1],to:b.match(/<term>[\s\S]*?<to>([^<]{10})/)?.[1],
  price:b.match(/<price>([0-9.]+)<\/price>/)?.[1]??b.match(/<price>[\s\S]*?<total>([0-9.]+)/)?.[1],currency:b.match(/<code>([A-Z]{3})<\/code>/)?.[1],guestCategories:cats,numGuests:g.length,
  partner:/<partner>[\s\S]*?<prpId>\d+/.test(b),created:b.match(/<created>(\d{4}-\d{2}-\d{2})/)?.[1]}));
 if(com){const d=await call('getDocuments',`<comId>${com}</comId><term><from>2026-01-01</from><to>2027-12-31</to></term>`);
  const docs=[...d.text.matchAll(/<document>([\s\S]*?)<\/document>/g)].map(m=>m[1]);
  console.log('DOCS',d.http,docs.length,(d.text.match(/<message>([^<]{0,120})/)||[])[1]||'');
  for(const x of docs){const tags=[...new Set([...x.matchAll(/<([A-Za-z]+)>/g)].map(m=>m[1]))];
   console.log('DOC',JSON.stringify({type:x.match(/<(?:type|docType|typeName)>([^<]{1,30})</)?.[1]??null,amounts:[...x.matchAll(/<(total|amount|price|sum|paid|toPay)>([0-9.]+)</g)].map(m=>m[1]+'='+m[2]).slice(0,6),
    dates:[...x.matchAll(/<([A-Za-z]*[Dd]ate[A-Za-z]*|due[A-Za-z]*|maturity)>([0-9: -]{10,19})</g)].map(m=>m[1]+'='+m[2]).slice(0,6),tags:tags.filter(t=>!/name|mail|phone|address|street|city|zip|number|note|vat|ico|dic|iban|account/i.test(t)).slice(0,40)}));}}
}
const q=fetchPublicPriceReference({arrival:FROM,departure:TO,cabin:'splitB',adults:2,children:[]});
console.log('OURS',JSON.stringify({accommodation:q.accommodation,tourismTax:q.tourismTax,total:q.total,perNight:q.calculation?.nightLines?.map(n=>n.amountHuf)}));
