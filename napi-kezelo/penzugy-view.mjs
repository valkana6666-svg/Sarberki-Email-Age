// Owner 2026-11-25 (#9 7159099524): separate finance view over the SAME case store – deposits of recorded bookings.
// Pure helpers (no DOM, no network): grouping, search, totals, row text. A probable Previo payment is shown only as a
// suggestion; nothing here marks a deposit as received (that stays the human "Foglaló beérkezett" step).
const HOUR=3600000;
export const GROUPS=Object.freeze({
 overdue:{label:'Lejárt',info:'A határidő lejárt, a foglaló nincs megjelölve.'},
 soon:{label:'Hamarosan esedékes',info:'48 órán belül lejár a határidő.'},
 waiting:{label:'Várakozó',info:'Foglaló még nem érkezett, a határidő később jár le.'},
 received:{label:'Beérkezett / lezárt',info:'A foglaló beérkezett (ember jelölte meg).'},
 nopay:{label:'Csak Previóban',info:'Csak a Previóban szereplő foglalás (honlap, telefon, partner): befizetés a Previo számláiból, nincs foglaló-határidő.'},
 cancelled:{label:'Lemondva',info:'Lemondott foglalás – nincs foglaló-teendő.'}
});
export const GROUP_ORDER=Object.freeze(['overdue','soon','waiting','received','nopay','cancelled']);
// Owner 2026-11-25 (#9 7161371109): every item carries its origin. Own = arrived through our system (chatbot, e-mail,
// or entered in the daily view); external = Previo names a sales partner; unknown = Previo-only, no partner – the
// origin is NOT inferred from the mere absence of a local case.
export const SOURCES=Object.freeze({own:'Saját rendszer',external:'Rendszeren kívüli',unknown:'Ismeretlen eredet'});
const OWN_CHANNEL={chat:'chatbot',email:'e-mail',phone:'telefon (napi kezelőben rögzítve)'};
const PREVIO_STATE_HU={option:'opció',confirmed:'megerősítve',checked_in:'bejelentkezett',waiting:'várólista',cancelled:'lemondva',no_show:'nem jelent meg',checked_out:'kijelentkezett',other:'egyéb'};

// Pure: our cases + Previo bookings → one list, one item per booking. A Previo booking that is one of our cases
// (reference "V2-<resId>") is merged into the case (its Previo state is attached), never listed twice.
export function mergeFinance(rows,previoItems){
 const local=(Array.isArray(rows)?rows:[]).filter(r=>r?.summary?.finance);
 const byRes=new Map();
 for(const r of local){const m=/^V2-(\d+)$/.exec(r.summary.finance.reference||'');if(m)byRes.set(Number(m[1]),r);}
 const out=local.map(r=>({...r,source:'own',channel:OWN_CHANNEL[r.summary.channel]||'e-mail'}));
 const index=new Map(out.map(r=>[r.caseId,r]));
 for(const it of Array.isArray(previoItems)?previoItems:[]){
  const hit=it.resIds.map(id=>byRes.get(id)).find(Boolean);
  if(hit){const o=index.get(hit.caseId);o.previoState=it.state;continue;}
  out.push({caseId:it.key,kind:'previo',source:it.source.group==='external'?'external':'unknown',channel:it.source.channel,previo:it,
   summary:{name:null,unit:it.unit||it.house,arrival:it.from,departure:it.to,booking:it.state==='cancelled'?'cancelled':'previo',
    finance:{amount:null,deadlineUtc:null,receivedOn:null,reference:it.voucher,reminders:{}}}});
 }
 return out;
}

export function financeGroup(row,now=Date.now()){
 const s=row?.summary,f=s?.finance;if(!f)return null;
 if(s.booking==='deposit_received')return 'received';
 if(s.booking==='cancelled')return 'cancelled';
 if(s.booking==='previo')return 'nopay';
 if(s.booking!=='finalized')return null;
 // Owner 2026-11-26: a booking the staff cancelled in Previo is not an overdue deposit – it shows under „Lemondva”
 // with its „close the case” warning, and does not swell the overdue total.
 if(row.previoState==='cancelled')return 'cancelled';
 const t=Date.parse(f.deadlineUtc||'');
 if(Number.isNaN(t))return 'waiting';
 if(t<now)return 'overdue';
 return t-now<=48*HOUR?'soon':'waiting';
}

const norm=v=>String(v||'').toLocaleLowerCase('hu-HU').normalize('NFD').replace(/[̀-ͯ]/g,'');
export function matchesQuery(row,query){
 const q=norm(query).trim();if(!q)return true;
 const s=row.summary||{};
 return [s.name,s.email,s.unit,s.finance?.reference,row.caseId,row.channel,row.previo?.house,row.source&&SOURCES[row.source]].some(v=>norm(v).includes(q));
}

// Rows of the finance view: grouped, filtered, ordered (deadline first; received newest first).
export function financeRows(rows,{now=Date.now(),group='all',query='',source='all'}={}){
 const list=(Array.isArray(rows)?rows:[]).map(row=>({row,group:financeGroup(row,now)})).filter(x=>x.group&&(group==='all'||x.group===group)&&(source==='all'||(x.row.source||'own')===source)&&matchesQuery(x.row,query));
 const key=x=>x.group==='received'?String(x.row.summary.finance.receivedOn||''):String(x.row.summary.finance.deadlineUtc||x.row.summary.arrival||'9');
 return list.sort((a,b)=>GROUP_ORDER.indexOf(a.group)-GROUP_ORDER.indexOf(b.group)||(a.group==='received'?key(b).localeCompare(key(a)):key(a).localeCompare(key(b))));
}

export function financeTotals(rows,now=Date.now(),source='all'){
 const out=Object.fromEntries(GROUP_ORDER.map(g=>[g,{count:0,amount:0,unknownAmount:0}]));
 for(const row of Array.isArray(rows)?rows:[]){
  const g=financeGroup(row,now);if(!g||source!=='all'&&(row.source||'own')!==source)continue;const a=row.summary.finance.amount;
  out[g].count++;if(Number.isSafeInteger(a))out[g].amount+=a;else out[g].unknownAmount++;
 }
 return out;
}

// Owner 2026-11-25 (#9 7163781838): the exact Previo link (payment → invoice → reservation); doubt is never "paid".
const PAY_HU={paid_in_full:'✅ Previo szerint teljesen kifizetve',deposit_paid:'✅ Previo szerint foglaló befizetve',partial:'💰 Részfizetés',none_recorded:'Befizetés: a Previóban nincs rögzítve (banki utalás még nem könyvelt lehet)',
 ambiguous:'⚠️ Befizetés nem köthető egyértelműen – ellenőrizd a Previóban',uncertain:'⚠️ Bizonytalan befizetés – ellenőrizd a Previóban',unknown:'Befizetés: a Previo most nem olvasható'};
export function paymentText(pay){
 if(!pay)return 'Befizetés: nem ellenőrzött (csak a közelgő foglalásokat nézzük)';
 const amount=Number.isSafeInteger(pay.paid)&&pay.paid!==0?' – '+huf(pay.paid):'';
 const due=pay.state==='partial'&&Number.isSafeInteger(pay.due)?', hátralék: '+huf(pay.due):'';
 return (PAY_HU[pay.state]||PAY_HU.unknown)+(['paid_in_full','deposit_paid','partial','uncertain'].includes(pay.state)?amount:'')+due;
}
export const huf=n=>Number.isSafeInteger(n)?String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' Ft':'összeg ismeretlen';
const when=iso=>new Date(iso).toLocaleString('hu-HU',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const day=d=>d.replaceAll('-','. ')+'.';
// Owner 2026-11-27: an outside booking still an OPTION in Previo after its option expiry gets a warning (Previo's own
// optionExpiration, hotel-local time) – no deposit deadline is invented and nothing is sent; the staff decide.
const hotelStamp=ms=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;};
export function previoOptionExpired(row,now=Date.now()){
 const p=row?.previo;return !!(row?.kind==='previo'&&p?.state==='option'&&/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(p.optionExpiration||'')&&p.optionExpiration<hotelStamp(now));
}
export function financeRowText(row,now=Date.now()){
 const s=row.summary||{},f=s.finance||{},g=financeGroup(row,now);
 const src=(SOURCES[row.source]||SOURCES.own)+(row.channel?' – '+row.channel:'');
 if(row.kind==='previo'){
  const p=row.previo,title=[p.voucher?'Previo '+p.voucher:'Previo-foglalás',s.unit,s.arrival&&s.departure?day(s.arrival)+' – '+day(s.departure):null].filter(Boolean).join(' · ');
  const lines=['Forrás: '+src,'Previo-állapot: '+(PREVIO_STATE_HU[p.state]||'egyéb')+(p.rooms>1?` · ${p.rooms} egység`:'')+(p.optionExpiration?' · opció lejár: '+p.optionExpiration:''),
   'Foglalás összege (Previo): '+(Number.isSafeInteger(p.price)?huf(p.price):'ismeretlen')+(p.currency&&p.currency!=='HUF'?' '+p.currency:'')];
  if(previoOptionExpired(row,now))lines.push('⚠️ Opció lejárt ('+p.optionExpiration.slice(0,16)+') – a Previóban még opció: ellenőrizd, és erősítsd meg vagy mondd le');
  if(g!=='cancelled')lines.push(paymentText(p.payment));
  return {title,lines,group:g};
 }
 const title=[s.name||'Név nélkül',s.unit,s.arrival&&s.departure?day(s.arrival)+' – '+day(s.departure):null].filter(Boolean).join(' · ');
 const lines=['Forrás: '+src,'Foglaló: '+huf(f.amount)+(f.reference?' · Previo: '+f.reference:'')];
 if(row.previoState==='cancelled')lines.push('⚠️ A Previóban lemondva – ellenőrizd, és zárd le az ügyet a napi kezelőben');
 if(g==='received')lines.push('✅ Beérkezett'+(f.receivedOn?': '+day(f.receivedOn):''));
 else if(g==='cancelled')lines.push('Lemondva');
 else if(f.deadlineUtc){
  const left=Date.parse(f.deadlineUtc)-now,h=Math.round(Math.abs(left)/HOUR);
  lines.push((g==='overdue'?'⚠️ Határidő lejárt: ':g==='soon'?'⏳ Határidő: ':'Határidő: ')+when(f.deadlineUtc)+(g==='overdue'?` (${h} órája)`:g==='soon'?` (${h} óra múlva)`:''));
 }else lines.push('Határidő nincs rögzítve');
 if(g!=='received'&&g!=='cancelled'){
  const r=f.reminders||{};
  lines.push('Emlékeztető: '+(r.final?'mindkettő elküldve':r.first?'első elküldve':'még nem ment'));
 }
 return {title,lines,group:g};
}
