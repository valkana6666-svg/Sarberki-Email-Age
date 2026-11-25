// Server-only. Owner 2026-11-25 ("előleg befizetés megérkezett … be kéne építeni"): Previo's Hotel.getPayments is
// readable, but a payment carries no reservation id and the API ignores every filter (each call returns all payments,
// read-only probes 2026-11-25). So the system can only SUGGEST: a payment whose amount equals the case's deposit and
// which was issued after the booking was confirmed is shown to the operator as "probably arrived"; the operator
// confirms with the existing "Foglaló beérkezett" button. Never closes a case by itself (two deposits can be equal).
// TEST 73521 only, own switch PREVIO_PAYMENT_HINT=test-only (default off), read-only, cached for 10 minutes; only
// payId, invoice id, amount, date and payment-type code are kept – never the description (it may hold a name).
const ORIGIN='https://api.previo.app',CACHE_MS=10*60000;
let cache=null;

export function parsePayments(xml){
 return [...String(xml||'').matchAll(/<payment>([\s\S]*?)<\/payment>/g)].map(([,b])=>{
  const num=re=>{const m=b.match(re);return m?Number(m[1]):null;};
  return Object.freeze({payId:num(/<payId>(\d+)<\/payId>/),invId:num(/<invId>(\d+)<\/invId>/),price:(()=>{const m=b.match(/<price>(-?[0-9]+(?:\.[0-9]+)?)<\/price>/);return m?Math.round(Number(m[1])):null;})(),
   issued:b.match(/<issued>(\d{4}-\d{2}-\d{2})/)?.[1]??null,type:num(/<cptId>(\d+)<\/cptId>/)});
 }).filter(p=>Number.isSafeInteger(p.payId)&&Number.isSafeInteger(p.price)&&p.issued);
}

export function previoPaymentReader(env,fetchImpl=globalThis.fetch,{now=()=>Date.now()}={}){
 if(env?.PREVIO_PAYMENT_HINT!=='test-only'||String(env?.PREVIO_HOTEL_ID)!=='73521')return null;
 const key=env.PREVIO_API_KEY;if(typeof key!=='string'||key.length<16)return null;
 return async()=>{
  if(cache&&now()-cache.at<CACHE_MS)return cache.list;
  const r=await fetchImpl(ORIGIN+'/x1/hotel/getPayments',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),
   headers:{Authorization:'ApiKey '+key,'Content-Type':'application/xml',Accept:'application/xml'},body:'<?xml version="1.0"?><request><hotId>73521</hotId></request>'});
  const text=await r.text();
  if(!r.ok||/<error>/.test(text)||!/<payments/.test(text))throw Object.assign(Error('read'),{code:'PREVIO_UNAVAILABLE'});
  const list=parsePayments(text);cache={at:now(),list};return list;
 };
}

// Pure: candidate payments for a finalized booking – same amount as the deposit, issued on/after the confirmation day.
export function depositPaymentHint(booking,payments){
 const amount=booking?.deposit?.amount,since=String(booking?.previo?.recordedAt||booking?.previo?.attestedAt||'').slice(0,10);
 if(booking?.status!=='finalized'||!Number.isSafeInteger(amount)||amount<=0||!/^\d{4}-\d{2}-\d{2}$/.test(since)||!Array.isArray(payments))return [];
 return payments.filter(p=>p.price===amount&&p.issued>=since).sort((a,b)=>b.issued.localeCompare(a.issued)).slice(0,3);
}

const huf=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const dot=d=>d.replaceAll('-','. ')+'.';
export function paymentHintLine(candidates){
 if(!Array.isArray(candidates)||!candidates.length)return '💰 A Previóban még nincs a foglalóval egyező befizetés.';
 const c=candidates[0],more=candidates.length>1?` (további ${candidates.length-1} hasonló tétel is van – ellenőrizd a Previóban)`:'';
 return `💰 Valószínűleg megjött a foglaló: ${huf(c.price)} Ft, ${dot(c.issued)}${Number.isSafeInteger(c.invId)?`, számla #${c.invId}`:''}${more}. Ha egyezik, nyomd meg: „Foglaló beérkezett”.`;
}
