// Owner 2026-11-25 (#9 7163469686): Previo granted Hotel.getAccountItems and Hotel.getDocuments (read). This READ-ONLY
// probe checks, for the TEST (73521) and the live (753011) key: is each method allowed, which fields it returns, and
// can a payment be tied to ONE reservation (payment → invoice/document → reservation, or account item → reservation)?
// Only HTTP status, Previo error text, tag paths, counts, code-like enum values and link COUNTS are printed – never an
// amount, a name, a note, a document number or an id. Calls: searchReservations, getPayments, getAccountItems,
// getDocuments (all reads). No write, status or configuration call exists here.
// Usage: PREVIO_KEY=… PREVIO_HOTEL=73521|753011 node scripts/previo-finance-probe.mjs '{"from":"2026-01-01","to":"2026-12-31"}'
const ORIGIN='https://api.previo.app';
export function tagPaths(xml){
 const out=new Set(),stack=[];
 for(const m of String(xml).matchAll(/<(\/?)([A-Za-z][A-Za-z0-9]*)(\s[^>]*)?(\/?)>/g)){if(m[1]){stack.pop();continue;}out.add([...stack.slice(-2),m[2]].join('>'));if(!m[4])stack.push(m[2]);}
 return [...out].sort();
}
const blocks=(xml,tag)=>[...String(xml).matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`,'g'))].map(m=>m[1]);
const ids=(xml,tag)=>[...String(xml).matchAll(new RegExp(`<${tag}>(\\d+)</${tag}>`,'g'))].map(m=>m[1]);
const err=t=>/<error>/.test(t)?String(t.match(/<message>([^<]{0,160})/)?.[1]||'error'):null;
// Code-like enum fields (type/status/currency…): distinct short values are business codes, not personal data.
export function enums(xml,record){
 const out={};
 for(const b of blocks(xml,record))for(const m of b.matchAll(/<([A-Za-z]*(?:[Tt]ype|[Kk]ind|[Ss]tatus|[Cc]ode|[Cc]ur[A-Za-z]*|Id))>([A-Za-z0-9_.-]{1,12})<\/\1>/g)){
  const k=m[1];if(/^(?:resId|payId|invId|docId|itemId|guId|gueId|accId|comId|parId|prpId|objId|number|voucher)$/i.test(k))continue;
  (out[k]??=new Set()).add(m[2]);
 }
 return Object.fromEntries(Object.entries(out).map(([k,v])=>[k,v.size>12?`${v.size} distinct`:[...v].sort()]));
}
export async function probe({key,hotel,from,to,fetchImpl=globalThis.fetch,maxRes=5}){
 const call=async(method,inner)=>{
  const r=await fetchImpl(ORIGIN+'/x1/hotel/'+method,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'ApiKey '+key,'Content-Type':'application/xml',Accept:'application/xml'},
   body:`<?xml version="1.0"?><request><hotId>${hotel}</hotId>${inner}</request>`});
  return {http:r.status,text:await r.text()};
 };
 const out={hotel};
 const rs=await call('searchReservations',`<term><from>${from}</from><to>${to}</to></term><termType>overlap</termType>`);
 const res=blocks(rs.text,'reservation'),resIds=new Set(res.map(b=>b.match(/<resId>(\d+)<\/resId>/)?.[1]).filter(Boolean));
 out.searchReservations={http:rs.http,error:err(rs.text),reservations:res.length};
 const pay=await call('getPayments','');
 const pays=blocks(pay.text,'payment'),payInv=new Set(pays.map(b=>b.match(/<invId>(\d+)<\/invId>/)?.[1]).filter(Boolean));
 out.getPayments={http:pay.http,error:err(pay.text),payments:pays.length,withInvoiceId:pays.filter(b=>/<invId>\d+/.test(b)).length,paths:tagPaths(pays.slice(0,50).join('')).filter(p=>!/description/.test(p))};
 // Account items: try per reservation (most specific), then by term.
 const acc=[];let accPaths=new Set(),accEnums={},accLinked=0,accItems=0,accReq=null;
 for(const id of [...resIds].slice(0,maxRes)){
  const a=await call('getAccountItems',`<resId>${id}</resId>`);acc.push({http:a.http,error:err(a.text)});
  if(!err(a.text)){accReq='resId';const items=blocks(a.text,'accountItem').length?blocks(a.text,'accountItem'):blocks(a.text,'item');accItems+=items.length;
   for(const p of tagPaths(a.text))accPaths.add(p);Object.assign(accEnums,enums(a.text,blocks(a.text,'accountItem').length?'accountItem':'item'));
   if(ids(a.text,'resId').includes(id))accLinked++;}
 }
 if(!accReq){const a=await call('getAccountItems',`<term><from>${from}</from><to>${to}</to></term>`);acc.push({http:a.http,error:err(a.text),by:'term'});
  if(!err(a.text)){accReq='term';for(const p of tagPaths(a.text))accPaths.add(p);accItems+=(a.text.match(/<accountItem>|<item>/g)||[]).length;}}
 out.getAccountItems={calls:acc,request:accReq,items:accItems,reservationsAnsweredWithOwnResId:accLinked,paths:[...accPaths].filter(p=>!/name|note|desc|text|guest|mail|phone/i.test(p.split('>').pop())).sort(),enums:accEnums};
 // Documents: by term, then by reservation.
 let doc=await call('getDocuments',`<term><from>${from}</from><to>${to}</to></term>`),docBy='term';
 if(err(doc.text)&&resIds.size){doc=await call('getDocuments',`<resId>${[...resIds][0]}</resId>`);docBy='resId';}
 const docs=blocks(doc.text,'document');
 const docRes=docs.map(b=>b.match(/<resId>(\d+)<\/resId>/)?.[1]).filter(Boolean),docInv=new Set(docs.flatMap(b=>[...b.matchAll(/<(?:invId|docId)>(\d+)<\/(?:invId|docId)>/g)].map(m=>m[1])));
 out.getDocuments={http:doc.http,error:err(doc.text),request:docBy,documents:docs.length,withResId:docRes.length,resIdInWindow:docRes.filter(x=>resIds.has(x)).length,
  paths:tagPaths(docs.slice(0,50).join('')).filter(p=>!/name|note|desc|text|guest|mail|phone|address|street|city|zip|vat|dic|ico/i.test(p.split('>').pop())),enums:enums(doc.text,'document')};
 // The chain that would tie ONE payment to ONE reservation: payment.invId → document (invId/docId) → document.resId.
 out.link={paymentsWhoseInvoiceIsADocument:pays.filter(b=>{const i=b.match(/<invId>(\d+)<\/invId>/)?.[1];return i&&docInv.has(i);}).length,
  paymentsReachingAReservation:pays.filter(b=>{const i=b.match(/<invId>(\d+)<\/invId>/)?.[1];if(!i)return false;const d=docs.find(x=>new RegExp(`<(?:invId|docId)>${i}</`).test(x));return !!d?.match(/<resId>\d+/);}).length};
 return out;
}
if(import.meta.url===`file://${process.argv[1]}`){
 let q={};try{q=JSON.parse(process.argv[2]||'{}');}catch{}
 const key=process.env.PREVIO_KEY,hotel=process.env.PREVIO_HOTEL;
 if(!key||!/^(73521|753011)$/.test(hotel||'')){console.log('BLOCKED key/hotel');process.exit(1);}
 probe({key,hotel,from:q.from||'2026-01-01',to:q.to||'2026-12-31'}).then(r=>console.log(JSON.stringify(r,null,1))).catch(e=>{console.log('FAILED',e.code||e.name);process.exit(1);});
}
