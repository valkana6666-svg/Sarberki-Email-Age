// Read-only (Claude, 2026-11-27): Previo TEST 73521 – the system's own SC-… reservation of one case: status and the
// shape of its note fields (length, hot tub line present, field names). No write; no guest data printed.
import {voucherFor,buildVoucherSearchXml} from '../shared-core/server-previo-reservation-write.mjs';
const req=JSON.parse(process.argv[2]||'{}');
if(!/^tm-[a-f0-9]{24}$/.test(req.caseId||'')||!/^\d{4}-\d{2}-\d{2}$/.test(req.arrival||'')||!/^\d{4}-\d{2}-\d{2}$/.test(req.departure||'')){console.log('BLOCKED request');process.exit(1);}
const key=process.env.PREVIO_API_KEY;if(!key||key.length<16){console.log('BLOCKED key');process.exit(1);}
const voucher=voucherFor({tenantId:'sarberki-test',caseId:req.caseId});
const r=await fetch('https://api.previo.app/x1/hotel/searchReservations',{method:'POST',redirect:'error',headers:{Authorization:'ApiKey '+key,'Content-Type':'application/xml',Accept:'application/xml'},body:buildVoucherSearchXml({hotelId:'73521',voucher,arrival:req.arrival,departure:req.departure})});
const t=await r.text();
console.log('HTTP',r.status,'error:',(t.match(/<message>([^<]{0,160})/)||[])[1]||null);
const blocks=[...t.matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(m=>m[1]);
console.log('BLOCKS',blocks.length,'withVoucher',blocks.filter(b=>b.includes(`<voucher>${voucher}</voucher>`)).length);
for(const b of blocks.filter(b=>b.includes(voucher))){
 const tags=[...new Set([...b.matchAll(/<([A-Za-z]+)[ >]/g)].map(m=>m[1]))];
 const f=tag=>{const m=b.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));return m?{len:m[1].length,tub:/D[ÉE]ZSA/i.test(m[1]),cdata:/CDATA/.test(m[1]),nested:/</.test(m[1].replace(/<!\[CDATA\[[\s\S]*?\]\]>/g,''))}:null;};
 console.log('RES',JSON.stringify({resId:b.match(/<resId>(\d+)/)?.[1],statusId:b.match(/<statusId>(\d+)/)?.[1],note:f('note'),gNote:f('gNote'),noteTags:tags.filter(x=>/note|comment/i.test(x))}));
 console.log('TAGS',tags.join(','));
}
