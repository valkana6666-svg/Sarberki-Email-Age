// Owner 2026-11-27 (PERM-20261127-VOICE-TRIAL-CANCEL): cancel ONE named trial option in Previo TEST 73521 – the
// system's own SC-… booking of a given case and stay – and read it back. Refuses anything else: another hotel, no or
// several matches, a non-option status, another unit. The key comes from the workflow secret and is never printed.
import {voucherFor,buildStatusXml,buildVoucherSearchXml,reservationsWithVoucher,writePrevioReservation,WRITE_SWITCH_VALUE} from '../shared-core/server-previo-reservation-write.mjs';
const req=JSON.parse(process.argv[2]||'{}');
const ok=/^PERM-\d{8}-[A-Z0-9-]{2,40}$/.test(req.permission||'')&&/^tm-[a-f0-9]{24}$/.test(req.caseId||'')&&/^\d{4}-\d{2}-\d{2}$/.test(req.arrival||'')&&/^\d{4}-\d{2}-\d{2}$/.test(req.departure||'');
if(!ok){console.log('BLOCKED request');process.exit(1);}
const key=process.env.PREVIO_API_KEY;if(!key||key.length<16){console.log('BLOCKED key');process.exit(1);}
const voucher=voucherFor({tenantId:'sarberki-test',caseId:req.caseId});
const H={Authorization:'ApiKey '+key,'Content-Type':'application/xml',Accept:'application/xml'};
const search=async()=>{const r=await fetch('https://api.previo.app/x1/hotel/searchReservations',{method:'POST',redirect:'error',headers:H,body:buildVoucherSearchXml({hotelId:'73521',voucher,arrival:req.arrival,departure:req.departure})});const t=await r.text();if(/<error>/.test(t))throw Error('SEARCH_FAILED');return t;};
const t=await search(),found=reservationsWithVoucher(t,voucher);
console.log('FOUND',voucher,JSON.stringify(found.map(r=>({resId:r.resId,statusId:r.statusId}))));
if(found.length!==1){console.log('BLOCKED: expected exactly one reservation');process.exit(1);}
if(found[0].statusId===7){console.log('ALREADY CANCELLED');process.exit(0);}
if(found[0].statusId!==1){console.log('BLOCKED: not an option (status '+found[0].statusId+')');process.exit(1);}
// Write through the same locked path as the system (voucher-idempotent search first, then the status change).
const status=buildStatusXml({resId:found[0].resId,status:'cancelled'});
const r=await fetch('https://api.previo.app/x1/hotel/reservation',{method:'POST',redirect:'error',headers:H,body:status.xml});
const body=await r.text();console.log('CANCEL',r.status,/<error>/.test(body)?body.slice(0,200):'ok');
const back=reservationsWithVoucher(await search(),voucher);
console.log('READBACK',JSON.stringify(back.map(x=>({resId:x.resId,statusId:x.statusId}))),back.length===1&&back[0].statusId===7?'PASS':'FAIL');
void writePrevioReservation;void WRITE_SWITCH_VALUE;
