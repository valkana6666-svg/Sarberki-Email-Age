// READ-ONLY (Claude, owner 2026-11-27): the documents of ONE Previo TEST 73521 booking (by booking number + stay):
// type, amounts, dates, field names – never names, addresses, tax ids or document numbers. Calls: searchReservations,
// getDocuments (reads only).
const req=JSON.parse(process.argv[2]||'{}');
// List mode: every booking overlapping a window (state, dates, unit objId, booking number) – no guest data.
if(req.list===true&&/^\d{4}-\d{2}-\d{2}$/.test(req.arrival||'')&&/^\d{4}-\d{2}-\d{2}$/.test(req.departure||'')){
 const key=process.env.PREVIO_API_KEY;
 const r=await fetch('https://api.previo.app/x1/hotel/searchReservations',{method:'POST',redirect:'error',headers:{Authorization:'ApiKey '+key,'Content-Type':'application/xml',Accept:'application/xml'},
  body:`<?xml version="1.0"?><request><hotId>73521</hotId><term><from>${req.arrival}</from><to>${req.departure}</to></term><termType>overlap</termType><statuses>${[1,2,3,4,5,6,7,8,9,10].map(i=>`<cosId>${i}</cosId>`).join('')}</statuses></request>`});
 const text=await r.text();console.log('LIST',r.status,(text.match(/<message>([^<]{0,160})/)||[])[1]||'');
 for(const b of [...text.matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(m=>m[1]))
  console.log('ITEM',JSON.stringify({resId:b.match(/<resId>(\d+)/)?.[1],statusId:b.match(/<statusId>(\d+)/)?.[1],from:b.match(/<term>\s*<from>([^<]{10})/)?.[1],to:b.match(/<term>[\s\S]*?<to>([^<]{10})/)?.[1],objId:b.match(/<object>\s*<objId>(\d+)/)?.[1],voucher:b.match(/<voucher>([^<]{0,30})<\/voucher>/)?.[1]||null,created:b.match(/<created>([^<]{10})/)?.[1]}));
 process.exit(0);
}
if(!/^SC-[0-9A-F]{16}$/.test(req.voucher||'')||!/^\d{4}-\d{2}-\d{2}$/.test(req.arrival||'')||!/^\d{4}-\d{2}-\d{2}$/.test(req.departure||'')){console.log('BLOCKED request');process.exit(1);}
const key=process.env.PREVIO_API_KEY;if(!key||key.length<16){console.log('BLOCKED key');process.exit(1);}
const call=async(method,inner)=>{const r=await fetch('https://api.previo.app/x1/hotel/'+method,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
 headers:{Authorization:'ApiKey '+key,'Content-Type':'application/xml',Accept:'application/xml'},body:`<?xml version="1.0"?><request><hotId>73521</hotId>${inner}</request>`});return {http:r.status,text:await r.text()};};
const s=await call('searchReservations',`<term><from>${req.arrival}</from><to>${req.departure}</to></term><fulltext>${req.voucher}</fulltext><statuses>${[1,2,3,4,5,6,7,8,9,10].map(i=>`<cosId>${i}</cosId>`).join('')}</statuses>`);
const b=[...s.text.matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(m=>m[1]).find(x=>x.includes(`<voucher>${req.voucher}</voucher>`));
if(!b){console.log('NOT FOUND',s.http);process.exit(0);}
const com=b.match(/<comId>(\d+)<\/comId>/)?.[1];
console.log('RES',JSON.stringify({statusId:b.match(/<statusId>(\d+)/)?.[1],price:b.match(/<price>([0-9.]+)<\/price>/)?.[1],hasEmail:/<email>[^<]+@/.test(b),staffNote:(b.match(/<gNote>([^<]{0,400})<\/gNote>/)?.[1]||'').replace(/[^\s]+@[^\s]+/g,'[e-mail]').replace(/\+?\d[\d ]{7,}\d/g,'[telefon]')}));
const d=await call('getDocuments',`<comId>${com}</comId><term><from>2026-01-01</from><to>2027-12-31</to></term>`);
const docs=[...d.text.matchAll(/<document>([\s\S]*?)<\/document>/g)].map(m=>m[1]);
console.log('DOCS',d.http,docs.length,(d.text.match(/<message>([^<]{0,160})/)||[])[1]||'');
const SAFE=/^(type|title|curId|priceSum|price|count|allPrice|vat|vatRate|dateIssued|dateTax|dateAccounting|dateDue|dueDate|dateMaturity|paymentType|paymentTypeId|status|state|paid|toPay|unit|name)$/;
for(const x of docs){
 const fields={};for(const m of x.matchAll(/<([A-Za-z]+)>([^<]{0,60})<\/\1>/g)){const k=m[1];if(!SAFE.test(k))continue;if(k==='name'&&!/záloh|előleg|szállás|ifa|adó|deposit|advance/i.test(m[2]))continue;(fields[k]??=[]).push(m[2]);}
 console.log('DOC',JSON.stringify({fields,tags:[...new Set([...x.matchAll(/<([A-Za-z]+)[ >]/g)].map(m=>m[1]))]}));
}
