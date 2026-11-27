// Claude 2026-11-27 (PERM-20261127-VOICE-TUB-NOTE): the hot tub line the caller asked for in the 14:54 TEST call,
// written once into that case's own SC-… option (Previo TEST 73521) by the system's partial note XML, then read back.
// Prints only the Previo error message, lengths and flags – no guest data. Refuses anything but exactly one active option.
import {voucherFor,buildVoucherSearchXml,buildNoteXml,parseReservationResponse} from '../shared-core/server-previo-reservation-write.mjs';
const req=JSON.parse(process.argv[2]||'{}');
if(!/^PERM-20261127-VOICE-TUB-NOTE$/.test(req.permission||'')||!/^tm-[a-f0-9]{24}$/.test(req.caseId||'')||!/^DÉZSAFÜRDŐ [^<>]{5,120}$/.test(req.line||'')){console.log('BLOCKED request');process.exit(1);}
const key=process.env.PREVIO_API_KEY;if(!key||key.length<16){console.log('BLOCKED key');process.exit(1);}
const voucher=voucherFor({tenantId:'sarberki-test',caseId:req.caseId});
const H={Authorization:'ApiKey '+key,'Content-Type':'application/xml',Accept:'application/xml'};
const post=async(p,x)=>{const r=await fetch('https://api.previo.app/x1/hotel/'+p,{method:'POST',redirect:'error',headers:H,body:x});return {http:r.status,text:await r.text()};};
const tag=(b,t)=>b.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1]??null;
const find=async()=>{const {text}=await post('searchReservations',buildVoucherSearchXml({hotelId:'73521',voucher,arrival:req.arrival,departure:req.departure}));
 return [...text.matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(m=>m[1]).filter(b=>b.includes(`<voucher>${voucher}</voucher>`));};
const flat=s=>String(s||'').normalize('NFC').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
const before=await find();
const act=before.filter(b=>['1','2'].includes(tag(b,'statusId')));
if(act.length!==1){console.log('BLOCKED: active',act.length);process.exit(1);}
const b=act[0],note=tag(b,'note')||'',g=tag(b,'gNote')||'';
console.log('BEFORE',JSON.stringify({resId:tag(b,'resId'),noteLen:note.length,gNoteLen:g.length,noteEqualsGNote:note===g,tub:/DÉZSA/.test(note)}));
const xml=buildNoteXml({resId:Number(tag(b,'resId')),note:[note,req.line].filter(Boolean).join(' | ')}).xml;
const w=await post('reservation',xml);const p=parseReservationResponse(w.text);
console.log('WRITE',w.http,JSON.stringify({ok:p.ok,code:p.code||null,message:(w.text.match(/<message>([^<]{0,200})/)||[])[1]||null,root:w.text.slice(0,60).replace(/[0-9]{6,}/g,'#')}));
const a=(await find()).find(x=>tag(x,'resId')===tag(b,'resId'))||'';
const n2=tag(a,'note')||'',g2=tag(a,'gNote')||'';
console.log('AFTER',JSON.stringify({noteLen:n2.length,gNoteLen:g2.length,noteTub:/DÉZSA/.test(n2),gNoteTub:/DÉZSA/.test(g2),exact:n2.includes(req.line),flat:flat(n2).includes(flat(req.line)),gNoteUnchanged:g2===g,tail:n2.slice(-90)}));
