// Owner 2026-11-27 (PERM-20261127-LIVE-TUB-READ): how is a hot tub recorded in the LIVE Previo? Read only
// (searchReservations + code lists). Output: which XML fields mention the tub, counts, and ANONYMISED shapes only –
// numbers become N / DATE / TIME, every word outside a small vocabulary becomes „…”. No name, phone, e-mail or id.
const ORIGIN='https://api.previo.app',key=process.env.PREVIO_KEY,hotel=process.env.PREVIO_HOTEL;
if(!key||!/^(73521|753011)$/.test(hotel||'')){console.log('BLOCKED key/hotel');process.exit(1);}
const req=JSON.parse(process.argv[2]||'{}'),from=req.from||'2025-01-01',to=req.to||'2027-12-31';
const call=async(svc,method,inner)=>{const r=await fetch(`${ORIGIN}/x1/${svc}/${method}`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{Authorization:'ApiKey '+key,'Content-Type':'application/xml',Accept:'application/xml'},body:`<?xml version="1.0"?><request><hotId>${hotel}</hotId>${inner}</request>`});return {http:r.status,text:await r.text()};};
const TUB=/dézs|dezs|dézsafürd|hot\s*tub|badezuber|kád|kad\b/iu;
const KEEP=new Set('ház házhoz házban házat dézsa dézsát dézsához dézsafürdő dezsa fő főre fős óra órára órától óráig órakor nap napra napot napokra éjszaka este reggel délután délelőtt foglalva foglalt kér kérnek kérik kért fizetve fizetendő ft forint és is a az db x + - ig tól től re ra hétfő kedd szerda csütörtök péntek szombat vasárnap január február március április május június július augusztus szeptember október november december tó tóra normál rekord ingyenes külön díj'.split(' '));
function shape(t){
 return String(t).replace(/\b20\d\d[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}\.?/g,' DATE ').replace(/\b\d{1,2}[.\-/]\d{1,2}\.?(?!\d)/g,' DATE ')
  .replace(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g,' TIME ').replace(/\b\d{1,2}(?=\s*-?\s*(?:es|as|os|ös)\b)/g,'N').replace(/\d+/g,'N')
  .split(/(\s+|[,;:()!?])/).map(w=>{const x=w.toLowerCase().replace(/[^\p{L}+\-]/gu,'');if(!x||/^\s+$/.test(w)||/^[,;:()!?]$/.test(w)||/^(N|DATE|TIME)/.test(w.trim()))return w;return KEEP.has(x)||KEEP.has(x.replace(/-?(es|as|os|ös)$/,''))||/^n-?(es|as|os|ös)$/i.test(x)?w:'…';}).join('').replace(/(…\s*)+/g,'… ').replace(/\s+/g,' ').trim().slice(0,140);
}
const rs=await call('hotel','searchReservations',`<term><from>${from}</from><to>${to}</to></term><termType>overlap</termType><statuses>${[1,2,3,4,5,6,7,8].map(i=>`<cosId>${i}</cosId>`).join('')}</statuses>`);
const blocks=[...rs.text.matchAll(/<reservation>([\s\S]*?)<\/reservation>/g)].map(m=>m[1]);
const out={hotel,window:{from,to},http:rs.http,error:(rs.text.match(/<message>([^<]{0,120})/)||[])[1]||null,reservations:blocks.length,fieldsMentioningTub:{},shapes:{},noteFields:{},servicesInReservation:0};
for(const b of blocks){
 for(const m of b.matchAll(/<([A-Za-z]+)>([^<]{1,4000})<\/\1>/g)){
  const [,tag,val]=m;if(/note|comment|remark|desc|text/i.test(tag))out.noteFields[tag]=(out.noteFields[tag]||0)+1;
  if(TUB.test(val)){out.fieldsMentioningTub[tag]=(out.fieldsMentioningTub[tag]||0)+1;const sh=shape(val);out.shapes[sh]=(out.shapes[sh]||0)+1;}
 }
 if(/<(?:service|services|accountItem)>/i.test(b)&&TUB.test(b))out.servicesInReservation++;
}
out.shapes=Object.entries(out.shapes).sort((a,b)=>b[1]-a[1]).slice(0,25).map(([s,n])=>({n,shape:s}));
out.codeLists={};
for(const [svc,m] of [['hotel','getAccountItemTypes'],['system','getAccountItemTypes'],['hotel','getServices'],['hotel','getProducts']]){
 const r=await call(svc,m,'');const names=[...r.text.matchAll(/<name>([^<]{1,60})<\/name>/g)].map(x=>x[1]).filter(x=>TUB.test(x));
 out.codeLists[svc+'.'+m]={http:r.http,error:(r.text.match(/<message>([^<]{0,80})/)||[])[1]||null,tubNames:names.slice(0,10)};
}
console.log(JSON.stringify(out,null,1));
