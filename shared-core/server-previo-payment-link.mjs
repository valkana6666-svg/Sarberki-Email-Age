// Server-only. Owner 2026-11-25 (#9 7163722661 / 7163781838): EXACT payment → reservation link in Previo, replacing
// the amount+date guess. Verified read-only on the live Previo (runs 45622452841 / 45622652333):
//   payment.invId → document.invId (Hotel.getDocuments, per partner comId) → document.comId → reservation.comId;
//   in the sample every reservation had its own partner (404/404) and 44 payments reached exactly one reservation.
// Safe by design – never "paid" on doubt:
//  - a partner with more than one reservation is only linked through the document's variable symbol (= resId or
//    voucher); otherwise AMBIGUOUS;
//  - a refund (negative payment), mixed currencies, a non-invoice document type (e.g. proforma) or an unreadable
//    Previo give UNCERTAIN / UNKNOWN, with the reason;
//  - no linked payment is "nothing recorded in Previo" – NOT "missing" (a bank transfer may not be booked yet).
// Nothing here marks a deposit as received; it is a checkable suggestion. Reads only; amounts stay on the server
// except the paid / due sums shown to the signed-in operator. No name, note, document number or partner id leaves.
const ORIGIN='https://api.previo.app',CACHE_MS=10*60000;
const docCache=new Map();

export function parseDocuments(xml){
 return [...String(xml||'').matchAll(/<document>([\s\S]*?)<\/document>/g)].map(([,b])=>({
  invId:b.match(/<invId>(\d+)<\/invId>/)?.[1]??null,comId:b.match(/<comId>(\d+)<\/comId>/)?.[1]??null,
  type:(b.match(/<type>([^<]{1,30})<\/type>/)?.[1]||'').trim()||null,curId:b.match(/<curId>(\d+)<\/curId>/)?.[1]??null,
  variableSymbol:(b.match(/<variableSymbol>([^<]{0,30})<\/variableSymbol>/)?.[1]||'').trim()||null,
  priceSum:(()=>{const m=b.match(/<priceSum>(-?[0-9.]+)<\/priceSum>/);return m?Math.round(Number(m[1])):null;})()
 })).filter(d=>d.invId);
}

const INVOICE_TYPES=new Set(['faktura','invoice','számla','szamla','rechnung','račun']);
// Pure. reservation: {resId, voucher, comId, price, deposit (optional HUF)}; partnerReservations: how many reservations
// of the read window share this comId; documents: the partner's documents; payments: parsed Hotel.getPayments.
export function linkReservationPayments({reservation,partnerReservations=1,documents,payments}){
 const r=reservation||{},reasons=[];
 if(!r.comId||!Array.isArray(documents)||!Array.isArray(payments))return Object.freeze({state:'unknown',paid:null,reasons:['PREVIO_UNREADABLE']});
 const own=documents.filter(d=>!d.comId||d.comId===String(r.comId));
 const bySymbol=own.filter(d=>d.variableSymbol&&(d.variableSymbol===String(r.resId)||(r.voucher&&d.variableSymbol===String(r.voucher))));
 let docs;
 if(partnerReservations>1){
  if(!bySymbol.length)return Object.freeze({state:'ambiguous',paid:null,reasons:['PARTNER_HAS_SEVERAL_RESERVATIONS']});
  docs=bySymbol;
 }else docs=own;
 const inv=new Set(docs.map(d=>d.invId));
 const linked=payments.filter(p=>Number.isSafeInteger(p.invId)?inv.has(String(p.invId)):inv.has(p.invId));
 // One payment counted once, even if it appears twice in the list.
 const seen=new Set(),unique=linked.filter(p=>{const k=String(p.payId);if(seen.has(k))return false;seen.add(k);return true;});
 if(!unique.length)return Object.freeze({state:'none_recorded',paid:0,payments:0,documents:docs.length,reasons:docs.length?['INVOICE_WITHOUT_PAYMENT']:['NO_DOCUMENT']});
 if(unique.some(p=>p.price<0))reasons.push('REFUND');
 const cur=new Set([...docs.map(d=>d.curId),...unique.map(p=>p.curId)].filter(Boolean));if(cur.size>1)reasons.push('MIXED_CURRENCY');
 if(docs.some(d=>d.type&&!INVOICE_TYPES.has(d.type.toLowerCase())))reasons.push('NON_INVOICE_DOCUMENT');
 const paid=unique.reduce((s,p)=>s+p.price,0);
 if(reasons.length)return Object.freeze({state:'uncertain',paid,payments:unique.length,documents:docs.length,reasons});
 const target=Number.isSafeInteger(r.deposit)&&r.deposit>0?r.deposit:null,price=Number.isSafeInteger(r.price)&&r.price>0?r.price:null;
 const state=price&&paid>=price?'paid_in_full':target&&paid>=target?'deposit_paid':'partial';
 return Object.freeze({state,paid,payments:unique.length,documents:docs.length,due:price!==null?Math.max(0,price-paid):null,depositDue:target!==null?Math.max(0,target-paid):null,reasons:[],
  lastPaymentOn:unique.map(p=>p.issued).filter(Boolean).sort().at(-1)||null});
}

// Server reader: the partner's documents (cached per comId), read-only.
export function previoDocumentReader(env,fetchImpl=globalThis.fetch,{now=()=>Date.now()}={}){
 if(env?.PREVIO_PAYMENT_HINT!=='test-only'||String(env?.PREVIO_HOTEL_ID)!=='73521')return null;
 const key=env.PREVIO_API_KEY;if(typeof key!=='string'||key.length<16)return null;
 return async comId=>{
  if(!/^\d{1,12}$/.test(String(comId||'')))throw Object.assign(Error('comId'),{code:'PREVIO_UNAVAILABLE'});
  const hit=docCache.get(String(comId));if(hit&&now()-hit.at<CACHE_MS)return hit.list;
  const r=await fetchImpl(ORIGIN+'/x1/hotel/getDocuments',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),
   headers:{Authorization:'ApiKey '+key,'Content-Type':'application/xml',Accept:'application/xml'},body:`<?xml version="1.0"?><request><hotId>73521</hotId><comId>${comId}</comId></request>`});
  const text=await r.text();
  if(!r.ok||/<error>/.test(text)||!/<documents/.test(text))throw Object.assign(Error('read'),{code:'PREVIO_UNAVAILABLE'});
  const list=parseDocuments(text);docCache.set(String(comId),{at:now(),list});if(docCache.size>500)docCache.delete(docCache.keys().next().value);return list;
 };
}
export function resetDocumentCache(){docCache.clear();}

const huf=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' Ft';
export const PAYMENT_STATE_HU=Object.freeze({paid_in_full:'teljesen kifizetve',deposit_paid:'foglaló befizetve',partial:'részfizetés',none_recorded:'a Previóban nincs rögzített befizetés',
 ambiguous:'nem köthető egyértelműen (több foglalás ugyanannál a partnernél)',uncertain:'bizonytalan',unknown:'a Previo most nem olvasható'});
const REASON_HU={REFUND:'visszatérítés',MIXED_CURRENCY:'eltérő pénznem',NON_INVOICE_DOCUMENT:'nem számla típusú dokumentum (pl. proforma)',PREVIO_UNREADABLE:'a Previo nem olvasható',
 PARTNER_HAS_SEVERAL_RESERVATIONS:'a partnernek több foglalása van',INVOICE_WITHOUT_PAYMENT:'van számla, befizetés nincs hozzá',NO_DOCUMENT:'nincs kiállított számla'};
// One operator line for the daily view (replaces the old amount+date guess).
export function paymentLinkLine(link){
 if(!link)return null;
 const why=link.reasons?.length?' ('+link.reasons.map(r=>REASON_HU[r]||r).join(', ')+')':'';
 if(link.state==='deposit_paid'||link.state==='paid_in_full')
  return `💰 Previo: ${PAYMENT_STATE_HU[link.state]} – ${huf(link.paid)}${link.lastPaymentOn?', utolsó: '+link.lastPaymentOn.replaceAll('-','. ')+'.':''} (pontos számla–foglalás kötés). Ha egyezik, nyomd meg: „Foglaló beérkezett”.`;
 if(link.state==='partial')return `💰 Previo: részfizetés – ${huf(link.paid)} befizetve${link.depositDue?', a foglalóból még '+huf(link.depositDue):''}${link.due?', összesen hátralék '+huf(link.due):''}.`;
 if(link.state==='uncertain')return `⚠️ Previo: bizonytalan befizetés – ${huf(link.paid)}${why}. Ellenőrizd a Previóban.`;
 return `💰 Previo: ${PAYMENT_STATE_HU[link.state]}${why}.`;
}
